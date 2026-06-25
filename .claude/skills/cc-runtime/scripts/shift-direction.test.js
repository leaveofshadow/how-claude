/**
 * shift-direction.test.js —— 方向换向 + 归档验证（基线-C）
 *
 * 框架：node:test（零依赖）。验证 state-schema.md §5 direction.set 落地 + INV-1 + 归档语义。
 * 运行：node --test shift-direction.test.js
 *
 * 验收映射：
 *   - 基本换向（版本升级 + direction 三字段 + history 审计链）
 *   - INV-1：checkpoint/direction/tasks direction_version 三件套一致
 *   - INV-4：trace 新行带新 direction_version
 *   - §1.2 换向重置：checkpoint progress/iter/node/health 归零
 *   - §4.3 换向：tasks 新建空树
 *   - 痛点4 归档：旧产物物理移走（ENOENT）+ 新方向目录创建
 *   - 安全：--reason 必填 / --to 必须 > 当前 / --dry-run 不改文件 / 归档目标存在拒绝覆盖
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { initState } = require('./init-state');
const { shiftDirection } = require('./shift-direction');

const T1 = '2026-06-16T00:00:00.000Z';
const T2 = '2026-06-16T05:00:00.000Z';

// ── hcc 目录统一阶段2：resolveRoot 读双路径 fallback（subprocess cwd 隔离）──
const { spawnSync } = require('child_process');

test('S2：resolveRoot .hcc/state 存在优先', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shift-fb-'));
  try {
    const SCRIPT = path.join(__dirname, 'shift-direction.js');
    fs.mkdirSync(path.join(tmp, '.hcc', 'state'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.venture', 'state'), { recursive: true });
    const r = spawnSync('node', ['-e', `const m=require(${JSON.stringify(SCRIPT)}); console.log(m.resolveRoot(undefined));`], { cwd: tmp, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `子进程失败：${r.stderr}`);
    assert.ok(r.stdout.trim().includes('.hcc'), `应优先 .hcc/state，实际 ${r.stdout.trim()}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('S2：resolveRoot .hcc/state 不存在 fallback .venture/state', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shift-fb-'));
  try {
    const SCRIPT = path.join(__dirname, 'shift-direction.js');
    fs.mkdirSync(path.join(tmp, '.venture', 'state'), { recursive: true });
    const r = spawnSync('node', ['-e', `const m=require(${JSON.stringify(SCRIPT)}); console.log(m.resolveRoot(undefined));`], { cwd: tmp, encoding: 'utf8' });
    assert.ok(r.stdout.trim().includes('.venture'), `应 fallback .venture/state，实际 ${r.stdout.trim()}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// 构造临时项目：init-state 初始化四文件 + 可选地放 v1 产物（含子目录）
function setupProject(withArtifacts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'venture-shift-'));
  const stateRoot = path.join(root, '.venture', 'state');
  initState(stateRoot, { now: T1 });
  if (withArtifacts) {
    const artDir = path.join(root, '.venture', 'artifacts', 'v1');
    fs.mkdirSync(path.join(artDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(artDir, '01-research.md'), '# 旧方向产物');
    fs.writeFileSync(path.join(artDir, 'sub', 'note.md'), '子目录产物');
  }
  return { root, stateRoot };
}
function clean(root) { fs.rmSync(root, { recursive: true, force: true }); }

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ── 基本换向 v1→v2 + INV-1 + 归档 + trace 🔴 ──
test('基本换向 v1→v2：版本升级 + INV-1 + 归档 + trace', () => {
  const { root, stateRoot } = setupProject(true);
  try {
    const r = shiftDirection(stateRoot, { reason: '转向市场B', now: T2 });
    assert.strictEqual(r.from, 1);
    assert.strictEqual(r.to, 2);
    assert.strictEqual(r.newPath, '.venture/artifacts/v2/');

    // direction.json（§3.1）
    const dir = readJson(path.join(stateRoot, 'direction.json'));
    assert.strictEqual(dir.current_version, 2);
    assert.strictEqual(dir.current_path, '.venture/artifacts/v2/');
    assert.strictEqual(dir.status, 'active');
    assert.strictEqual(dir.current_plan, null);
    assert.ok(dir.superseded_paths.includes('.venture/artifacts/v1/'), 'superseded_paths 应含旧路径');
    assert.strictEqual(dir.history.length, 1);
    assert.strictEqual(dir.history[0].version, 1);
    assert.strictEqual(dir.history[0].superseded_by, 2);
    assert.strictEqual(dir.history[0].status, 'superseded');
    assert.strictEqual(dir.history[0].superseded_reason, '转向市场B');

    // INV-1：三件套 direction_version 一致
    const cp = readJson(path.join(stateRoot, 'checkpoint.json'));
    const tasks = readJson(path.join(stateRoot, 'tasks.tree.json'));
    assert.strictEqual(cp.direction_version, 2);
    assert.strictEqual(tasks.direction_version, 2);
    assert.strictEqual(dir.current_version, cp.direction_version);
    assert.strictEqual(dir.current_version, tasks.direction_version);

    // §1.2 换向重置
    assert.strictEqual(cp.progress_percent, 0);
    assert.strictEqual(cp.iteration, 0);
    assert.strictEqual(cp.current_node, null);
    assert.strictEqual(cp.current_task, null);
    assert.strictEqual(cp.continue_from, null);
    assert.strictEqual(cp.stagnation_count, 0);
    assert.strictEqual(cp.health, 'ok');
    assert.strictEqual(cp.trigger, 'direction_shift');

    // §4.3 tasks 空树
    assert.deepStrictEqual(tasks.tasks, []);

    // trace 追加（INV-4 带新版本）
    const traceRaw = fs.readFileSync(path.join(stateRoot, 'trace.ndjson'), 'utf8').trim();
    assert.ok(traceRaw.length > 0, 'trace 应有 shift 事件');
    const ev = JSON.parse(traceRaw.split('\n').pop());
    assert.strictEqual(ev.action, 'direction_shift');
    assert.strictEqual(ev.direction_version, 2); // INV-4
    assert.strictEqual(ev.from_version, 1);
    assert.strictEqual(ev.to_version, 2);

    // 痛点4 归档：旧产物物理移走
    assert.ok(!fs.existsSync(path.join(root, '.venture', 'artifacts', 'v1', '01-research.md')), '旧产物应已移走');
    assert.ok(fs.existsSync(path.join(root, '.venture', 'archived', 'v1', '01-research.md')), '归档目标应含旧产物');
    assert.ok(fs.existsSync(path.join(root, '.venture', 'archived', 'v1', 'sub', 'note.md')), '子目录产物也应归档');
    // 新方向目录已创建
    assert.ok(fs.existsSync(path.join(root, '.venture', 'artifacts', 'v2')), '新方向目录应已创建');
  } finally {
    clean(root);
  }
});

// ─--reason 必填 🔴 ──
test('安全：--reason 必填，缺失则抛错', () => {
  const { root, stateRoot } = setupProject(false);
  try {
    assert.throws(() => shiftDirection(stateRoot, {}), /--reason/, '无 reason 应抛错');
  } finally { clean(root); }
});

// ── --to 必须 > 当前版本 🔴 ──
test('安全：--to 必须 > 当前版本', () => {
  const { root, stateRoot } = setupProject(false);
  try {
    assert.throws(
      () => shiftDirection(stateRoot, { reason: 'x', to: 1 }),
      /必须 > 当前版本/, '指定更小版本应抛错'
    );
  } finally { clean(root); }
});

// ── --dry-run：不改文件 + 返回预演 🟡 ──
test('dry-run：不改任何文件，返回可行性预演', () => {
  const { root, stateRoot } = setupProject(true);
  try {
    const before = readJson(path.join(stateRoot, 'direction.json'));
    const r = shiftDirection(stateRoot, { reason: '试探', dryRun: true, now: T2 });
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.to, 2);
    assert.ok(r.archivePlan.willArchive, 'dry-run 应报告将归档的源');

    // 文件未被改动
    const after = readJson(path.join(stateRoot, 'direction.json'));
    assert.deepStrictEqual(after, before, 'dry-run 不应改 direction.json');
    assert.ok(fs.existsSync(path.join(root, '.venture', 'artifacts', 'v1', '01-research.md')), '产物应仍在原处');
  } finally { clean(root); }
});

// ── 归档目标已存在：软失败（状态推进 + 归档警告 + 不覆盖已有归档）🟡 ──
// 设计：归档在最后执行，失败只警告不回滚（前面三文件已原子写，硬抛会致「状态已变+报错」困惑）。
// 痛点4 降级：物理归档失败 → 旧文件未移走，但 superseded_paths 仍告警（compact Block⑤ 覆盖）。
test('健壮性：归档目标已存在时软失败，状态推进且不覆盖已有归档', () => {
  const { root, stateRoot } = setupProject(true);
  try {
    // 预先放置 archived/v1（模拟历史残留），带 sentinel
    fs.mkdirSync(path.join(root, '.venture', 'archived', 'v1'), { recursive: true });
    fs.writeFileSync(path.join(root, '.venture', 'archived', 'v1', 'sentinel'), '历史归档');
    const r = shiftDirection(stateRoot, { reason: 'x', now: T2 });
    // 软失败：不抛错，状态仍推进
    assert.strictEqual(r.to, 2);
    assert.ok(r.archive.error && r.archive.error.includes('归档目标已存在'), '归档应报错警告');
    // direction 状态已推进（INV-1 一致）
    const dir = readJson(path.join(stateRoot, 'direction.json'));
    assert.strictEqual(dir.current_version, 2);
    // 已有归档未被覆盖（sentinel 还在）
    assert.ok(fs.existsSync(path.join(root, '.venture', 'archived', 'v1', 'sentinel')), '已有归档不应被覆盖');
    // 旧产物未移走（归档失败的预期降级，靠 superseded_paths 告警兜底）
    assert.ok(fs.existsSync(path.join(root, '.venture', 'artifacts', 'v1', '01-research.md')), '旧产物未移走是归档失败预期降级');
  } finally { clean(root); }
});

// ── 旧目录不存在（init 后无产物即换向）：归档 skipped，其余正常 🟡 ──
test('健壮性：旧产物目录不存在时归档 skipped，版本仍正确升级', () => {
  const { root, stateRoot } = setupProject(false); // 不放产物
  try {
    const r = shiftDirection(stateRoot, { reason: '初始即换向', now: T2 });
    assert.strictEqual(r.to, 2);
    assert.ok(r.archive.skipped, '无产物应 skipped');
    const dir = readJson(path.join(stateRoot, 'direction.json'));
    assert.strictEqual(dir.current_version, 2); // 文件仍正确升级
    assert.ok(fs.existsSync(path.join(root, '.venture', 'artifacts', 'v2')), '新目录仍创建');
  } finally { clean(root); }
});

// ── 连续换向 v1→v2→v3：history 累积 + superseded_paths 累积 🟡 ──
test('连续换向：history 与 superseded_paths 正确累积', () => {
  const { root, stateRoot } = setupProject(true);
  try {
    shiftDirection(stateRoot, { reason: '一换', now: T2 });
    shiftDirection(stateRoot, { reason: '二换', now: '2026-06-16T10:00:00.000Z' });
    const dir = readJson(path.join(stateRoot, 'direction.json'));
    assert.strictEqual(dir.current_version, 3);
    assert.strictEqual(dir.history.length, 2);
    assert.ok(dir.superseded_paths.includes('.venture/artifacts/v1/'));
    assert.ok(dir.superseded_paths.includes('.venture/artifacts/v2/'));
    // INV-1
    const cp = readJson(path.join(stateRoot, 'checkpoint.json'));
    assert.strictEqual(cp.direction_version, 3);
    // trace 两行
    const lines = fs.readFileSync(path.join(stateRoot, 'trace.ndjson'), 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 2);
  } finally { clean(root); }
});
