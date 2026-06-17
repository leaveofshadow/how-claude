#!/usr/bin/env node
/**
 * venture-pipeline venture-resume.js —— 层2 DAG 引擎「断点续传」（M4 R4.1-R4.2）
 *
 * 依据：references/pipeline-state-schema.md §4.2（resume 读 current_node）+
 *       cc-runtime/references/state-schema.md §70（continue_from 规范格式 node:<n>,task:<t>,iter:<i>）
 * 裁决：B 假设（7×24 单机=会话级断点续传，M4 即满足）+ 50-decision §7 C1/C6
 * 验收：70-requirements R4.1（正态续传 / 漂移态拒绝）/ R4.2（trace 追加 resume 事件）
 *
 * 约束（C2）：仅 fs+path（内建）+ './load-graph'（computeGraphHash）+ './pipeline-state'（同 skill require）。
 *            禁 vm/eval/Function/SDK 子进程/外部依赖。
 * C1 硬约束（嫁接1）：
 *   - resume 续传恢复 → 读 pipeline-state.current_node（schema §4.2 层2 权威源）
 *   - 读 checkpoint.continue_from（层1 续跑锚点）解析 iter
 *   - 绝不写/读 direction.json（resume 的 direction_version 从 pipeline-state 读，不需碰 direction.json）
 *
 * 子命令：
 *   node venture-resume.js resume [--dag <path>] [--root <dir>]  # 续传恢复
 */
'use strict';

const fs = require('fs');
const path = require('path');
// 同 skill：load-graph（computeGraphHash 用于 R4.1 graph_hash 漂移校验）
const { computeGraphHash } = require('./load-graph');
// 同 skill：pipeline-state（resolveStateRoot/resolveDagPath 解析路径）
const { resolveStateRoot, resolveDagPath } = require('./pipeline-state');

// ── CLI 参数解析 ──
function parseArgs(argv) {
  const opts = { command: null, dag: null, root: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dag') opts.dag = argv[++i] || null;
    else if (a === '--root') opts.root = argv[++i] || null;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!opts.command && !a.startsWith('--')) opts.command = a;
  }
  return opts;
}

// pipeline-state.json 路径（与 pipeline-state.js 一致）
function stateFilePath(stateRoot) {
  return path.join(stateRoot, 'pipeline-state.json');
}
// checkpoint.json 路径（层1 续跑锚点）
function checkpointFilePath(stateRoot) {
  return path.join(stateRoot, 'checkpoint.json');
}
// trace.ndjson 路径（层1 审计 trace）
function traceFilePath(stateRoot) {
  return path.join(stateRoot, 'trace.ndjson');
}

// 读 dag.json → 对象
function readDagObj(dagPath) {
  if (!fs.existsSync(dagPath)) {
    throw new Error(`dag.json 不存在：${dagPath}`);
  }
  return JSON.parse(fs.readFileSync(dagPath, 'utf8'));
}

// 读 pipeline-state.json（不存在抛错，同 advance-node.js readPipelineState）
function readPipelineState(stateRoot) {
  const fp = stateFilePath(stateRoot);
  if (!fs.existsSync(fp)) {
    throw new Error(`pipeline-state.json 不存在：${fp}（请先 node pipeline-state.js init）`);
  }
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// 解析 checkpoint.continue_from 规范格式（state-schema.md §70）：
//   "node:<n>,task:<t>,iter:<i>" → { node, task, iter }
// 容错：任一段缺失返回 null；iter 解析失败返回 null（调用方 fallback pipeline-state.iteration）
function parseContinueFrom(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const nodeM = raw.match(/node:([^,]*)/);
  const taskM = raw.match(/task:([^,]*)/);
  const iterM = raw.match(/iter:([^,]*)/);
  const iter = iterM ? parseInt(iterM[1], 10) : NaN;
  return {
    node: nodeM ? nodeM[1] : null,
    task: taskM ? taskM[1] : null,
    iter: Number.isFinite(iter) ? iter : null,
  };
}

// ── R4.2 appendResumeTrace：向 trace.ndjson 追加 resume 事件 ──
// 事件含当前 direction_version（INV-4 续传可追溯绑定方向）
function appendResumeTrace(stateRoot, evt) {
  const fp = traceFilePath(stateRoot);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    action: 'resume',
    node: evt.node,
    iter: evt.iter,
    direction_version: evt.direction_version,
  }) + '\n';
  fs.appendFileSync(fp, line, 'utf8');
}

// ── resume 主流程（R4.1-R4.2）──
function cmdResume(opts) {
  const stateRoot = resolveStateRoot(opts.root);
  const dagPath = resolveDagPath(opts.dag);

  // 读层2 DAG 推进态（schema §4.2 主源：current_node / direction_version / graph_hash）
  const state = readPipelineState(stateRoot);
  const currentNode = state.current_node;
  const directionVersion = state.direction_version;
  const storedHash = state.graph_hash;

  // R4.1 漂移校验（C6 防静默漂移）：重算当前 dag.json 的 graph_hash，比对 pipeline-state.graph_hash
  // 不匹配 → throw（CLI catch 统一写 stderr + exit 1，同 advance-node.js 错误风格）
  const dagObj = readDagObj(dagPath);
  const currentHash = computeGraphHash(dagObj);
  if (currentHash !== storedHash) {
    throw new Error(`graph_hash 不匹配，拒绝续传：dag=<${currentHash}> state=<${storedHash}>（dag.json 被改需先重 init 锚定）`);
  }

  // 读层1 续跑锚点（checkpoint.continue_from，state-schema.md §70 规范格式）
  const cpPath = checkpointFilePath(stateRoot);
  let parsed = { node: null, task: null, iter: null };
  if (fs.existsSync(cpPath)) {
    const cp = JSON.parse(fs.readFileSync(cpPath, 'utf8'));
    parsed = parseContinueFrom(cp.continue_from) || parsed;
  }

  // 恢复点：node 取层2 current_node（权威源），iter 取 continue_from 解析（fallback pipeline-state.iteration）
  const resumeNode = currentNode;
  const resumeIter = (parsed.iter !== null) ? parsed.iter : (typeof state.iteration === 'number' ? state.iteration : 0);
  if (!resumeNode) {
    throw new Error(`pipeline-state.current_node 为 null，无可恢复节点（请先 advance 进入起点）`);
  }

  // R4.2 追加 resume 事件（INV-4：带当前 direction_version）
  appendResumeTrace(stateRoot, { node: resumeNode, iter: resumeIter, direction_version: directionVersion });

  return {
    ok: true,
    command: 'resume',
    action: 'resumed',
    node: resumeNode,
    iter: resumeIter,
    direction_version: directionVersion,
    graph_hash_ok: true,
    message: `resumed at ${resumeNode} iter:${resumeIter}`,
  };
}

// ── CLI 入口 ──
if (require.main === module) {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.command) {
    process.stdout.write([
      '用法：',
      '  node venture-resume.js resume [--dag <path>] [--root <dir>]',
      '',
    ].join('\n'));
    process.exit(opts.help ? 0 : 2);
  }

  try {
    let result;
    switch (opts.command) {
      case 'resume':  result = cmdResume(opts); break;
      default:
        throw new Error(`未知子命令：${opts.command}（可用：resume）`);
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`错误：${e.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  cmdResume,
  parseContinueFrom,
  appendResumeTrace,
};
