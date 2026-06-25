#!/usr/bin/env node
/**
 * cc-runtime shift-direction.js —— 方向换向 + 旧方向归档（痛点4 机制腿）
 *
 * 实现 state-schema.md §5 接口 direction.set 的具体落地（带物理归档）：
 *   - 升 direction.current_version（v_old → v_new）
 *   - 物理归档旧方向产物目录（.venture/artifacts/v_old/ → .venture/archived/v_old/）
 *     「旧文件物理消失 > matcher 拦截」——基线层零 H1 hook，靠归档让旧路径 ENOENT 自然拦截
 *   - 原子更新 direction.json（superseded_paths 追加 + history 审计链）—— M4 原子写
 *   - 同步 checkpoint.json（INV-1 + 新方向重置 progress/iter/node/health）
 *   - 重置 tasks.tree.json（INV-1 + §4.3 换向新建空任务树）
 *   - 追加 trace shift 事件（INV-4 审计）
 *
 * 安全顺序（每步失败保持状态一致）：
 *   1. 创建新方向目录（让 direction 指向它时已存在，agent 不会读到空指针）
 *   2-4. 原子写 direction / checkpoint / tasks（INV-1 三件套一致）
 *   5. 追加 trace 事件
 *   6. 归档旧目录（最后；失败只警告——状态已一致，旧目录未移走仅削弱痛点4，不破坏一致性）
 *
 * 约束（C2）：纯 Node fs + path，禁 SDK 子进程。
 * 用法：
 *   node shift-direction.js --reason "转向市场B"          # v_old → v_old+1
 *   node shift-direction.js --reason "..." --to 3         # 指定目标版本
 *   node shift-direction.js --reason "..." --dry-run      # 只打印不执行
 *   node shift-direction.js --reason "..." --root <dir>   # 指定状态根
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('./init-state');

// ── CLI 解析 ──
function parseArgs(argv) {
  const opts = { reason: null, to: null, dryRun: false, root: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reason') opts.reason = argv[++i] || null;
    else if (a === '--to') opts.to = parseInt(argv[++i], 10);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--root') opts.root = argv[++i] || null;
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function resolveRoot(rootArg) {
  if (rootArg) return path.resolve(rootArg);
  // hcc 目录统一阶段2：读双路径（.hcc/state 优先 + .venture/state fallback）
  const hcc = path.resolve('.hcc', 'state');
  if (fs.existsSync(hcc)) return hcc;
  return path.resolve('.venture', 'state');
}

// 归档目录：优先 rename（同盘原子），跨盘 EXDEV 回退递归 copy + rm
//   dryRun=true 时只做可行性检查，不实际移动
function archiveDir(src, dst, dryRun) {
  if (!fs.existsSync(src)) return { skipped: true, reason: '源目录不存在（可能初始化后尚无产物）' };
  if (fs.existsSync(dst)) {
    if (dryRun) return { blocked: true, reason: `归档目标已存在：${dst}` };
    throw new Error(`归档目标已存在，拒绝覆盖：${dst}`);
  }
  if (dryRun) return { willArchive: src, to: dst };
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    return { archivedTo: dst };
  } catch (e) {
    if (e.code === 'EXDEV') { // 跨盘：递归复制后删源
      copyDirRecursive(src, dst);
      fs.rmSync(src, { recursive: true, force: true });
      return { archivedTo: dst, via: 'copy' };
    }
    throw e;
  }
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ── 主流程：方向换向 ──
// 返回换向结果对象；失败抛错（CLI 入口 catch + exit 1）
function shiftDirection(stateRoot, opts) {
  const dryRun = !!opts.dryRun;
  const reason = opts.reason;
  if (!reason) throw new Error('换向必须提供 --reason（boss 决策记录，审计必需）');

  const dirPath = path.join(stateRoot, 'direction.json');
  const cpPath = path.join(stateRoot, 'checkpoint.json');
  const tasksPath = path.join(stateRoot, 'tasks.tree.json');
  const tracePath = path.join(stateRoot, 'trace.ndjson');

  if (!fs.existsSync(dirPath)) {
    throw new Error(`direction.json 不存在：${dirPath}（请先 node init-state.js）`);
  }

  const oldDir = JSON.parse(fs.readFileSync(dirPath, 'utf8'));
  const oldVersion = oldDir.current_version;
  const oldPath = oldDir.current_path; // 相对项目根，如 .venture/artifacts/v1/

  const newVersion = (opts.to != null && !isNaN(opts.to)) ? opts.to : oldVersion + 1;
  if (newVersion <= oldVersion) {
    throw new Error(`目标版本 ${newVersion} 必须 > 当前版本 ${oldVersion}（换向只能前进）`);
  }

  // stateRoot = <projectRoot>/.venture/state → projectRoot = stateRoot/../..
  const projectRoot = path.resolve(stateRoot, '..', '..');
  const newPath = `.venture/artifacts/v${newVersion}/`;
  const newDirAbs = path.resolve(projectRoot, newPath);
  const oldDirAbs = path.resolve(projectRoot, oldPath);
  const archiveDstAbs = path.resolve(projectRoot, `.venture/archived/v${oldVersion}/`);

  const now = (opts.now) || new Date().toISOString();

  // ── 构造新 direction.json（§3.1）──
  const newDirObj = {
    current_version: newVersion,
    current_path: newPath,
    current_plan: null, // 新方向待规划
    set_at: now,
    set_reason: reason,
    status: 'active',
    gate: null,
    superseded_paths: (Array.isArray(oldDir.superseded_paths)
      ? [...oldDir.superseded_paths] : []).concat(oldPath), // 痛点4 拦截源
    history: (Array.isArray(oldDir.history) ? oldDir.history : []).concat([{
      version: oldVersion, path: oldPath, status: 'superseded',
      superseded_by: newVersion, superseded_at: now, superseded_reason: reason,
    }]),
  };

  // ── 构造新 checkpoint.json（INV-1 + §1.2 换向重置 progress）──
  const newCp = fs.existsSync(cpPath)
    ? JSON.parse(fs.readFileSync(cpPath, 'utf8')) : {};
  Object.assign(newCp, {
    direction_version: newVersion,
    current_node: null, current_task: null,
    explore_paths: [], plan_path: null,
    progress_percent: 0, iteration: 0, last_progress_hash: null,
    continue_from: null, // 新方向无续跑锚点
    stagnation_count: 0, health: 'ok', // C1 健康重置
    created_at: now, trigger: 'direction_shift',
  });

  // ── 构造新 tasks.tree.json（INV-1 + §4.3 换向新建空任务树）──
  const newTasks = { direction_version: newVersion, updated_at: now, tasks: [] };

  // ── trace shift 事件（§2.2 必填字段集 + 换向审计字段，INV-4 带新版本）──
  const traceLine = JSON.stringify({
    ts: now, session: 'shift-direction-cli', direction_version: newVersion,
    node: 'direction_shift', iter: 0, step_index: 0,
    action: 'direction_shift', tool: 'shift-direction',
    filesChanged: [oldPath], learnings: [`${oldVersion}->${newVersion}: ${reason}`],
    progressHash: `shift:${oldVersion}->${newVersion}`, progress_delta: 0, tokensUsed: 0,
    from_version: oldVersion, to_version: newVersion, reason,
  });

  // ── dry-run：只报告可行性，不执行 ──
  if (dryRun) {
    return {
      dryRun: true, from: oldVersion, to: newVersion,
      oldPath, newPath, archiveDst: `.venture/archived/v${oldVersion}/`,
      archivePlan: archiveDir(oldDirAbs, archiveDstAbs, true),
      direction: newDirObj, note: 'dry-run：未实际执行',
    };
  }

  // ── 执行（安全顺序：1 建新目录 → 2-4 三文件原子写 → 5 trace → 6 归档）──
  fs.mkdirSync(newDirAbs, { recursive: true });
  atomicWriteJSON(dirPath, newDirObj);
  atomicWriteJSON(cpPath, newCp);
  atomicWriteJSON(tasksPath, newTasks);
  fs.appendFileSync(tracePath, traceLine + '\n', 'utf8');

  let archiveResult;
  try {
    archiveResult = archiveDir(oldDirAbs, archiveDstAbs, false);
  } catch (e) {
    archiveResult = { error: e.message };
  }

  return { from: oldVersion, to: newVersion, oldPath, newPath, archive: archiveResult };
}

// ── CLI 入口 ──
if (require.main === module) {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log('用法: node shift-direction.js --reason "<理由>" [--to N] [--dry-run] [--root <dir>]');
    process.exit(0);
  }
  try {
    const stateRoot = resolveRoot(opts.root);
    const result = shiftDirection(stateRoot, opts);
    console.log(JSON.stringify(result, null, 2));
    if (result.archive && result.archive.error) {
      console.error(`\n⚠️ 归档失败（状态已一致，旧目录未移走，痛点4 部分缓解）：${result.archive.error}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(`\n❌ 换向失败：${e.message}`);
    process.exit(1);
  }
}

module.exports = { shiftDirection, archiveDir, copyDirRecursive, parseArgs, resolveRoot };
