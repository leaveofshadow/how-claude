#!/usr/bin/env node
/**
 * venture-pipeline venture-resume.js —— 层2 DAG 引擎「断点续传」+ 缝合层 set-signal
 *                                        （M4 R4.1-R4.2 + M1 R1.1-R1.5）
 *
 * 依据：references/pipeline-state-schema.md §4.2（resume 读 current_node）+
 *       cc-runtime/references/state-schema.md §70（continue_from 规范格式 node:<n>,task:<t>,iter:<i>）
 * 裁决：B 假设（7×24 单机=会话级断点续传，M4 即满足）+ 50-decision §7 C1/C6
 *       + cc-2pp 2026-06-18-cc-venture-layer3 R1/R5/R6
 * 验收：70-requirements R4.1/R4.2（resume）+ R1.1-R1.5（set-signal）
 *
 * 约束（C2）：仅 fs+path（内建）+ './load-graph'（computeGraphHash）+ './pipeline-state'（同 skill require）。
 *            禁 vm/eval/Function/SDK 子进程/外部依赖。
 * C1 硬约束（嫁接1）：
 *   - resume 续传恢复 → 读 pipeline-state.current_node（schema §4.2 层2 权威源）
 *   - 读 checkpoint.continue_from（层1 续跑锚点）解析 iter
 *   - 绝不写/读 direction.json（resume 的 direction_version 从 pipeline-state 读，不需碰 direction.json）
 *   - set-signal 是普通段 edge.signal 唯一写者（代 agent 改 dag.json edge.signal + rehash pipeline-state.graph_hash）
 *
 * 子命令：
 *   node venture-resume.js resume [--dag <path>] [--root <dir>]                                              # 续传恢复
 *   node venture-resume.js set-signal --edge <from:to> --signal <green|yellow|red|unknown> --artifact <path>  # 改普通段 signal + rehash
 *                                       [--dag <path>] [--root <dir>]
 */
'use strict';

const fs = require('fs');
const path = require('path');
// 同 skill：load-graph（computeGraphHash 用于 R4.1 graph_hash 漂移校验 + R1 set-signal rehash）
const { computeGraphHash } = require('./load-graph');
// 同 skill：pipeline-state（resolveStateRoot/resolveDagPath 解析路径）
const { resolveStateRoot, resolveDagPath } = require('./pipeline-state');

// ── CLI 参数解析 ──
function parseArgs(argv) {
  const opts = { command: null, dag: null, root: null, edge: null, signal: null, artifact: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dag') opts.dag = argv[++i] || null;
    else if (a === '--root') opts.root = argv[++i] || null;
    else if (a === '--edge') opts.edge = argv[++i] || null;
    else if (a === '--signal') opts.signal = argv[++i] || null;
    else if (a === '--artifact') opts.artifact = argv[++i] || null;
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

// 写回 pipeline-state.json（整对象写回，in-place 改字段，非 cmdInit 整覆盖清零——R1 set-signal rehash 用）
// 单次 writeFileSync 对小 JSON 原子（要么整体成功要么失败，无半写）；防并发由 R6 串行约束 + graph_hash 漂移检测兜底。
function writePipelineState(stateRoot, state) {
  const fp = stateFilePath(stateRoot);
  fs.writeFileSync(fp, JSON.stringify(state, null, 2), 'utf8');
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

// ── set-signal 主流程（M1 R1.1-R1.3）──
// 语义（R3 + dag.venture.json _writers）：代 agent 改普通段 edge.signal（如 N1→N2 unknown→green），
// 改完后 [R1 核心] 轻量 rehash 重算 graph_hash 写回 pipeline-state.json（禁调 cmdInit——
// pipeline-state.js:132-148 cmdInit 整对象覆盖清零 current_node:null:134 / iteration:0:136 / history 重置:141+，
// 串调会死循环）。[R5] --artifact 必填 + existsSync 校验（防零产出骗验收）。[R6] read-modify-write 串行（见 _writers）。
function cmdSetSignal(opts) {
  // R1.1：--edge / --signal 参数校验
  if (!opts.edge) throw new Error('set-signal 缺 --edge <from:to>（如 N1:N2）');
  if (!opts.signal) throw new Error('set-signal 缺 --signal <green|yellow|red|unknown>');
  const VALID_SIGNALS = ['green', 'yellow', 'red', 'unknown'];
  if (!VALID_SIGNALS.includes(opts.signal)) {
    throw new Error(`--signal 非法：${opts.signal}（合法：${VALID_SIGNALS.join('|')}）`);
  }

  // R5：--artifact 必填 + existsSync 校验（堵零产出骗验收）
  if (!opts.artifact) {
    throw new Error('--artifact 必填（防零产出骗验收，R5）');
  }
  if (!fs.existsSync(opts.artifact)) {
    throw new Error(`--artifact 文件不存在：${opts.artifact}（R5）`);
  }

  // R1.1：解析 --edge from:to
  const parts = opts.edge.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`--edge 格式非法：${opts.edge}（应为 from:to 如 N1:N2）`);
  }
  const [from, to] = parts;

  const stateRoot = resolveStateRoot(opts.root);
  const dagPath = resolveDagPath(opts.dag);
  const dagObj = readDagObj(dagPath);

  // 找匹配 edge
  const edge = dagObj.edges.find((e) => e.from === from && e.to === to);
  if (!edge) {
    throw new Error(`edge 不存在：${from}→${to}（dag 无此 edge）`);
  }
  if (!edge.condition || edge.condition.awaiting_human === true) {
    // R3：set-signal 只改普通段 edge.signal；HG edge 的 signal 是死字段
    //（advance-node.js:294 awaiting_human 检查命中即 return :314-321，走不到 :325 signal 分支；
    // HG 越闸靠 resolve-hg.js:101,110 取 outEdges[0].to 无脑推进不读 signal）
    throw new Error(`edge ${from}→${to} 是 HG edge（awaiting_human:true），signal 是死字段——set-signal 只改普通段 edge（R3，HG 越闸靠 resolve-hg）`);
  }

  // 改 dag.json 普通段 edge.signal（in-place 改字段，整对象写回）
  const oldSignal = edge.condition.signal;
  edge.condition.signal = opts.signal;
  fs.writeFileSync(dagPath, JSON.stringify(dagObj, null, 2), 'utf8');

  // [R1 核心] 轻量 rehash：只重算 graph_hash 写回 pipeline-state.json（禁调 cmdInit！）
  // readPipelineState 读出现有推进态 → 只改 graph_hash 字段 → writePipelineState 整对象写回（保留 current_node/iteration/history/status/gate）
  const newHash = computeGraphHash(dagObj);  // 复用本文件已 require（load-graph）
  const state = readPipelineState(stateRoot);  // 复用本文件 readPipelineState（读现有推进态，非 cmdInit 构造默认）
  const preserved = {
    current_node: state.current_node,
    iteration: state.iteration,
    history_len: Array.isArray(state.history) ? state.history.length : null,
    status: state.status,
    gate: state.gate,
  };
  state.graph_hash = newHash;  // 只改这一个字段
  writePipelineState(stateRoot, state);

  return {
    ok: true,
    command: 'set-signal',
    edge: `${from}:${to}`,
    signal: opts.signal,
    old_signal: oldSignal,
    artifact: opts.artifact,
    graph_hash: newHash,
    rehash_preserved: preserved,  // R1 不清零证据（current_node/iteration/history/status/gate 恒等，仅 graph_hash 更新）
    message: `edge ${from}→${to} signal=${oldSignal}→${opts.signal}，graph_hash rehash（未调 init，current_node=${preserved.current_node} 保留）`,
  };
}

// ── CLI 入口 ──
if (require.main === module) {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.command) {
    process.stdout.write([
      '用法：',
      '  node venture-resume.js resume [--dag <path>] [--root <dir>]',
      '  node venture-resume.js set-signal --edge <from:to> --signal <green|yellow|red|unknown> --artifact <path> [--dag <path>] [--root <dir>]',
      '',
    ].join('\n'));
    process.exit(opts.help ? 0 : 2);
  }

  try {
    let result;
    switch (opts.command) {
      case 'resume':  result = cmdResume(opts); break;
      case 'set-signal':  result = cmdSetSignal(opts); break;
      default:
        throw new Error(`未知子命令：${opts.command}（可用：resume / set-signal）`);
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
  cmdSetSignal,
  parseContinueFrom,
  appendResumeTrace,
};
