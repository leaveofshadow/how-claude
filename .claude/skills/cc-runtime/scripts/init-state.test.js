/**
 * init-state.test.js —— 验证层1 四文件 schema 可落地（M1 任务 #25）
 *
 * 框架：node:test（零依赖，Windows Node 自带，符合 C2 纯 Node 约束）
 * 运行：node --test init-state.test.js
 *
 * 验收映射：
 *   - 70-requirements §1.1（四文件生成）
 *   - 70-requirements §1.2（checkpoint 字段完备性）
 *   - 70-requirements §1.3（direction 结构 + 原子性）
 *   - state-schema.md §6 不变量（INV-1 跨文件 direction_version 一致）
 *   - 幂等性（已存在跳过）
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { initState } = require('./init-state');

const FIXED_NOW = '2026-06-16T00:00:00.000Z';

// 临时状态根（每次测试独立，测后清理）
function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'venture-state-'));
}
function clean(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

// 70-requirements §1.2 必填字段清单（与 state-schema.md §1.1 对齐）
const REQUIRED_CHECKPOINT_FIELDS = [
  'created_at', 'trigger', 'active_modes', 'todo_summary', 'wisdom_exported',
  'background_jobs', 'current_node', 'current_task', 'explore_paths', 'plan_path',
  'progress_percent', 'iteration', 'last_progress_hash', 'direction_version',
  'direction_path', 'trace_ref', 'guardrails', 'continue_from',
  'stagnation_count', 'health',
];
const REQUIRED_GUARDRAILS = ['max_iteration', 'no_progress_streak', 'budget_tokens_used', 'budget_tokens_cap'];

// ── hcc 目录统一阶段2：resolveRoot 写固定 .hcc/state + direction_path 动态化 ──
const { spawnSync } = require('child_process');

test('S2：resolveRoot 无 --root 落 .hcc/state（subprocess cwd 隔离）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'init-fb-'));
  try {
    const SCRIPT = path.join(__dirname, 'init-state.js');
    const r = spawnSync('node', ['-e', `const m=require(${JSON.stringify(SCRIPT)}); console.log(m.resolveRoot([]));`], { cwd: tmp, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `子进程失败：${r.stderr}`);
    assert.ok(r.stdout.trim().includes('.hcc'), `resolveRoot 无 --root 应落 .hcc/state，实际 ${r.stdout.trim()}`);
  } finally { clean(tmp); }
});

test('S2：initState direction_path/trace_ref 跟随 root 动态化（含 .hcc/state）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'init-fb-'));
  try {
    const hccRoot = path.join(tmp, '.hcc', 'state');
    initState(hccRoot, { now: FIXED_NOW });
    const cp = JSON.parse(fs.readFileSync(path.join(hccRoot, 'checkpoint.json'), 'utf8'));
    assert.ok(cp.direction_path.includes('.hcc'), `direction_path 应跟随 root（含 .hcc），实际 ${cp.direction_path}`);
    assert.ok(cp.trace_ref.includes('.hcc'), `trace_ref 应跟随 root（含 .hcc），实际 ${cp.trace_ref}`);
    assert.ok(cp.direction_path.endsWith('direction.json'), `direction_path 应指向 direction.json`);
  } finally { clean(tmp); }
});

// ── §1.1 四文件生成 🔴 ──
test('§1.1 初始化生成全部四文件', () => {
  const root = tmpRoot();
  try {
    const result = initState(root, { now: FIXED_NOW });
    assert.deepEqual(
      [...result.created].sort(),
      ['checkpoint.json', 'direction.json', 'tasks.tree.json', 'trace.ndjson'].sort(),
      '应生成全部四文件'
    );
    for (const f of result.created) {
      assert.ok(fs.existsSync(path.join(root, f)), `文件应存在: ${f}`);
    }
    assert.equal(result.skipped.length, 0);
  } finally {
    clean(root);
  }
});

// ── §1.2 checkpoint 字段完备性 🔴 ──
test('§1.2 checkpoint.json 字段完备', () => {
  const root = tmpRoot();
  try {
    initState(root, { now: FIXED_NOW });
    const cp = JSON.parse(fs.readFileSync(path.join(root, 'checkpoint.json'), 'utf8'));

    for (const f of REQUIRED_CHECKPOINT_FIELDS) {
      assert.ok(f in cp, `checkpoint 缺少字段: ${f}`);
    }
    for (const g of REQUIRED_GUARDRAILS) {
      assert.ok(g in cp.guardrails, `guardrails 缺少字段: ${g}`);
    }

    // C1 修订字段
    assert.equal(cp.stagnation_count, 0, 'stagnation_count 初始应为 0');
    assert.equal(cp.health, 'ok', 'health 初始应为 ok');

    // venture 默认值（state-schema.md §8）
    assert.equal(cp.direction_version, 1);
    assert.equal(cp.progress_percent, 0);
    assert.equal(cp.iteration, 0);
    assert.equal(cp.guardrails.max_iteration, 10);
    assert.equal(cp.guardrails.budget_tokens_cap, 500000);
    assert.equal(cp.guardrails.budget_tokens_used, 0);
    assert.equal(cp.continue_from, null);
    assert.equal(cp.last_progress_hash, null);
  } finally {
    clean(root);
  }
});

// ── §1.3 direction 结构 + 原子性（无 .tmp 残留）🔴 ──
test('§1.3 direction.json 结构正确且无临时文件残留', () => {
  const root = tmpRoot();
  try {
    initState(root, { now: FIXED_NOW });
    const dir = JSON.parse(fs.readFileSync(path.join(root, 'direction.json'), 'utf8'));

    assert.equal(dir.current_version, 1);
    assert.equal(dir.status, 'active');
    assert.equal(dir.gate, null);
    assert.deepEqual(dir.history, []);
    assert.deepEqual(dir.superseded_paths, []);

    // M4 原子写：不应残留 .tmp 文件
    assert.ok(!fs.existsSync(path.join(root, 'direction.json.tmp')), '原子写后不应残留 .tmp');
    assert.ok(!fs.existsSync(path.join(root, 'checkpoint.json.tmp')));
    assert.ok(!fs.existsSync(path.join(root, 'tasks.tree.json.tmp')));
  } finally {
    clean(root);
  }
});

// ── trace.ndjson 初始化为空文件 🟡 ──
test('trace.ndjson 初始化为空文件（0 字节）', () => {
  const root = tmpRoot();
  try {
    initState(root, { now: FIXED_NOW });
    const stat = fs.statSync(path.join(root, 'trace.ndjson'));
    assert.equal(stat.size, 0, 'trace.ndjson 初始应为空文件');
  } finally {
    clean(root);
  }
});

// ── tasks.tree.json 结构 🟡 ──
test('tasks.tree.json 初始为空任务树', () => {
  const root = tmpRoot();
  try {
    initState(root, { now: FIXED_NOW });
    const tasks = JSON.parse(fs.readFileSync(path.join(root, 'tasks.tree.json'), 'utf8'));
    assert.equal(tasks.direction_version, 1);
    assert.deepEqual(tasks.tasks, []);
  } finally {
    clean(root);
  }
});

// ── state-schema.md §6 INV-1：direction_version 跨三文件一致 ──
test('INV-1: direction_version 跨 checkpoint/direction/tasks 一致', () => {
  const root = tmpRoot();
  try {
    initState(root, { now: FIXED_NOW });
    const cp = JSON.parse(fs.readFileSync(path.join(root, 'checkpoint.json'), 'utf8'));
    const dir = JSON.parse(fs.readFileSync(path.join(root, 'direction.json'), 'utf8'));
    const tasks = JSON.parse(fs.readFileSync(path.join(root, 'tasks.tree.json'), 'utf8'));
    assert.equal(cp.direction_version, dir.current_version, 'checkpoint.direction_version 应等于 direction.current_version');
    assert.equal(dir.current_version, tasks.direction_version, 'direction.current_version 应等于 tasks.direction_version');
  } finally {
    clean(root);
  }
});

// ── 幂等：已存在默认跳过 ──
test('幂等性：重复初始化默认跳过已存在文件', () => {
  const root = tmpRoot();
  try {
    initState(root, { now: FIXED_NOW });
    // 第二次初始化（不同时间戳）应全部跳过，文件内容不变
    const r2 = initState(root, { now: '2026-06-16T01:00:00.000Z' });
    assert.equal(r2.created.length, 0, '已存在文件不应重建');
    assert.equal(r2.skipped.length, 4, '应跳过全部四文件');

    // 验证内容仍是第一次的时间戳（未被覆盖）
    const cp = JSON.parse(fs.readFileSync(path.join(root, 'checkpoint.json'), 'utf8'));
    assert.equal(cp.created_at, FIXED_NOW, '跳过模式下不应覆盖内容');
  } finally {
    clean(root);
  }
});

// ── 幂等：--force 覆盖 ──
test('--force 覆盖已存在文件', () => {
  const root = tmpRoot();
  try {
    initState(root, { now: FIXED_NOW });
    const r2 = initState(root, { now: '2026-06-16T02:00:00.000Z', force: true });
    assert.equal(r2.created.length, 4, 'force 模式应重建全部四文件');
    const cp = JSON.parse(fs.readFileSync(path.join(root, 'checkpoint.json'), 'utf8'));
    assert.equal(cp.created_at, '2026-06-16T02:00:00.000Z', 'force 应覆盖为新时间戳');
  } finally {
    clean(root);
  }
});
