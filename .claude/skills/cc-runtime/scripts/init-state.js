#!/usr/bin/env node
/**
 * cc-runtime init-state.js —— 初始化 .venture/state/ 四文件
 *
 * 依据：cc-runtime/references/state-schema.md（frozen-v1，§8 默认值）
 * 验收：70-requirements §1.1（四文件生成）+ §1.2（checkpoint 字段完备性）
 *
 * 约束（C2 修订）：纯 Node fs + path，禁用任何 SDK 子进程。
 * 原子性（M4）：JSON 文件用「临时文件 + fs.renameSync」（Windows MOVEFILE_REPLACE_EXISTING），
 *               读者要么看到旧版要么看到新版，不会看到半写中间态。
 *
 * 幂等：已存在的文件默认跳过（除非 --force 覆盖）。
 * 用法：
 *   node init-state.js                      # 初始化 ./.venture/state/
 *   node init-state.js --root <dir>         # 指定状态根
 *   node init-state.js --force              # 覆盖已存在文件
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ── CLI 参数解析 ──
function resolveRoot(argv) {
  const idx = argv.indexOf('--root');
  if (idx !== -1 && argv[idx + 1]) return path.resolve(argv[idx + 1]);
  return path.resolve('.hcc', 'state');  // hcc 目录统一阶段2：init 写固定新（新文件落新位置）
}

const FORCE = process.argv.includes('--force');

// ── 原子写（M4 修订：Windows rename 竞态防护）──
// 写临时文件 → rename 覆盖。rename 是原子操作，避免读到半写状态 / EPERM。
function atomicWriteJSON(filePath, obj) {
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath); // Node 跨平台 = Windows MOVEFILE_REPLACE_EXISTING
}

// ── 四文件默认值（严格照 state-schema.md §8）──
// isoNow 由调用方注入（脚本 CLI 入口用 new Date().toISOString()，测试注入固定值保证确定性）
function defaults(isoNow) {
  return {
    checkpoint: {
      // autopilot 原字段（零迁移保留）
      created_at: isoNow,
      trigger: 'sessionstart',
      active_modes: { venture: 'init' },
      todo_summary: { pending: 0, in_progress: 0, completed: 0 },
      wisdom_exported: false,
      background_jobs: { active: [], recent: [], stats: null },
      // venture 扩展（痛点3 补丁）
      current_node: null,
      current_task: null,
      explore_paths: [],
      plan_path: null,
      progress_percent: 0,
      iteration: 0,
      last_progress_hash: null,
      direction_version: 1,
      direction_path: '.venture/state/direction.json',
      trace_ref: '.venture/state/trace.ndjson',
      guardrails: {
        max_iteration: 10,
        no_progress_streak: 0,
        budget_tokens_used: 0,
        budget_tokens_cap: 500000,
      },
      continue_from: null,
      // C1 修订新增
      stagnation_count: 0,
      health: 'ok',
    },
    direction: {
      current_version: 1,
      current_path: '.venture/artifacts/v1/',
      current_plan: null,
      set_at: isoNow,
      set_reason: '初始化',
      status: 'active',
      gate: null,
      superseded_paths: [],
      history: [],
    },
    tasks: {
      direction_version: 1,
      updated_at: isoNow,
      tasks: [],
    },
  };
}

// ── 主流程：初始化四文件 ──
function initState(root, opts) {
  const force = (opts && opts.force) || false;
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  const isoNow = (opts && opts.now) || new Date().toISOString();
  const d = defaults(isoNow);

  // hcc 目录统一阶段2：direction_path/trace_ref 跟随实际 stateRoot（相对 cwd，原 defaults 硬编码 .venture/state）
  const stateRel = path.relative(process.cwd(), root) || '.';
  d.checkpoint.direction_path = path.join(stateRel, 'direction.json');
  d.checkpoint.trace_ref = path.join(stateRel, 'trace.ndjson');

  // 各文件的写入器
  const writers = {
    'checkpoint.json': () => atomicWriteJSON(path.join(root, 'checkpoint.json'), d.checkpoint),
    'direction.json': () => atomicWriteJSON(path.join(root, 'direction.json'), d.direction),
    'tasks.tree.json': () => atomicWriteJSON(path.join(root, 'tasks.tree.json'), d.tasks),
    'trace.ndjson': () => {
      // 空文件（0 字节），首行由 H2 PostToolUse 追加
      fs.writeFileSync(path.join(root, 'trace.ndjson'), '', 'utf8');
    },
  };

  const result = { created: [], skipped: [], root };
  for (const [name, writer] of Object.entries(writers)) {
    const fp = path.join(root, name);
    if (fs.existsSync(fp) && !force) {
      result.skipped.push(name);
      continue;
    }
    writer();
    result.created.push(name);
  }
  return result;
}

// ── CLI 入口 ──
if (require.main === module) {
  const root = resolveRoot(process.argv);
  const result = initState(root, { force: FORCE });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

module.exports = { initState, defaults, atomicWriteJSON, resolveRoot };
