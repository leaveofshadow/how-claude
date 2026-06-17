#!/usr/bin/env node
/**
 * venture-pipeline resolve-hg.js —— 层2 DAG 引擎「解除 HG 停等并推进」（M3 R3.1）
 *
 * 依据：references/pipeline-state-schema.md（嫁接1 写者隔离 + §4.3 写者表）
 * 裁决：50-decision §2.1（HG 折叠为带停等 edge）+ §2.2（嫁接1）+ §7 C1/C2
 *
 * 语义：boss 对当前 HG 决策"继续推进"后调用，解除 awaiting_human 并推进越过那条
 *       awaiting_human/unknown edge（即 advance 当下会触发 HG 停等的那条 edge）。
 *
 * 约束（C2）：仅 fs+path（内建）+ './advance-node'（findOutEdges/handleLoopBack）+
 *            './pipeline-state'（resolveStateRoot/resolveDagPath/cmdRead）+
 *            '../../cc-runtime/scripts/init-state'（atomicWriteJSON）。禁 vm/eval/Function/SDK 子进程/外部依赖。
 *
 * C1 硬约束（嫁接1，最关键）：
 *   - resolve-hg.js 是 pipeline-state.json 合法写者（schema §4.3 已授权）
 *   - **绝对禁止** require('child_process') / 读写 direction.json / spawn direction.set
 *   - direction.json 的 status/gate 永远是 active/null（shift-direction.js line 126-127 硬编码）
 *
 * 子命令：
 *   node resolve-hg.js resolve [--dag <path>] [--root <dir>] [--gate HG1|HG2]
 */
'use strict';

const fs = require('fs');
const path = require('path');
// 同 skill：advance-node 的 findOutEdges / handleLoopBack（复用边查询 + loop_back 收敛逻辑）
const { findOutEdges, handleLoopBack } = require('./advance-node');
// 同 skill：pipeline-state 的 resolveStateRoot / resolveDagPath / cmdRead
const { resolveStateRoot, resolveDagPath } = require('./pipeline-state');
// 同项目：cc-runtime atomicWriteJSON（临时文件 + rename 原子写，与 advance-node 同源）
const { atomicWriteJSON } = require('../../cc-runtime/scripts/init-state');

// ── CLI 参数解析 ──
function parseArgs(argv) {
  const opts = { command: null, dag: null, root: null, gate: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dag') opts.dag = argv[++i] || null;
    else if (a === '--root') opts.root = argv[++i] || null;
    else if (a === '--gate') opts.gate = argv[++i] || null;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!opts.command && !a.startsWith('--')) opts.command = a;
  }
  return opts;
}

// pipeline-state.json 路径（与 advance-node.js line 45-47 一致；pipeline-state.js 未 export stateFilePath）
function stateFilePath(stateRoot) {
  return path.join(stateRoot, 'pipeline-state.json');
}

// 读 pipeline-state.json（不存在抛错，复制 advance-node.js line 55-61 实现）
function readPipelineState(stateRoot) {
  const fp = stateFilePath(stateRoot);
  if (!fs.existsSync(fp)) {
    throw new Error(`pipeline-state.json 不存在：${fp}（请先 node pipeline-state.js init）`);
  }
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// 读 dag.json → 对象（复制 advance-node.js line 77-82 实现；pipeline-state 未 export readDagObj）
function readDagObj(dagPath) {
  if (!fs.existsSync(dagPath)) {
    throw new Error(`dag.json 不存在：${dagPath}`);
  }
  return JSON.parse(fs.readFileSync(dagPath, 'utf8'));
}

// ── resolve 主流程（解除 HG 停等并推进越过 awaiting_human/unknown edge）──
function cmdResolve(opts) {
  const stateRoot = resolveStateRoot(opts.root);
  const dagPath = resolveDagPath(opts.dag);

  // 读当前 state（不存在抛错）
  const state = readPipelineState(stateRoot);

  // 必须处于 awaiting_human 才能解除
  if (state.status !== 'awaiting_human') {
    throw new Error(`无可解除的 HG（当前 status=${state.status}，仅 awaiting_human 可 resolve）`);
  }

  // 若提供 --gate，必须与当前停等的 gate 一致
  if (opts.gate) {
    if (state.gate !== opts.gate) {
      throw new Error(`gate 不匹配（当前 gate=${state.gate}，传入 --gate=${opts.gate}）`);
    }
  }

  // 读 dag 取 edges / loop_backs
  const dagObj = readDagObj(dagPath);
  const edges = Array.isArray(dagObj.edges) ? dagObj.edges : [];
  const loopBacks = Array.isArray(dagObj.loop_backs) ? dagObj.loop_backs : [];

  // 从 current_node 找 out-edge（同 advance 取首条，C5 单线推进）
  const fromNode = state.current_node;
  const outEdges = findOutEdges(edges, fromNode);
  if (outEdges.length === 0) {
    throw new Error(`current_node=${fromNode} 无 out-edge，无可推进`);
  }
  const edge = outEdges[0];

  // loop_back 收敛检查（复用 advance-node.handleLoopBack）：已收敛则无可推进
  const lb = handleLoopBack(edge, loopBacks, state.iteration);
  if (lb.converged) {
    throw new Error(`loop_back 已收敛（达 max_iter，iteration=${lb.newIter}），无可推进`);
  }

  // 推进越过这条 edge
  const toNode = edge.to;
  const newFrontier = findOutEdges(edges, toNode).map((e) => e.to);
  const now = new Date().toISOString();

  // 构造推进后状态：解除 HG（status=active/gate=null）+ current_node 前进 + history 追加 resolve_hg
  const fromSnapshot = {
    current_node: fromNode,
    status: state.status,
    gate: state.gate,
    iteration: state.iteration,
  };
  const next = Object.assign({}, state, {
    current_node: toNode,
    frontier: newFrontier,
    iteration: lb.newIter,
    status: 'active',
    gate: null,
    history: (Array.isArray(state.history) ? state.history : []).concat([{
      ts: now,
      action: 'resolve_hg',
      from: fromSnapshot,
      to: { current_node: toNode, status: 'active', gate: null, iteration: lb.newIter },
      reason: `resolve_hg:boss 决策推进 ${fromNode}→${toNode}（解除 ${state.gate}）`,
    }]),
  });

  // 原子写（同 advance-node，合法写者，C1：仅写 pipeline-state.json，绝不碰 direction.json）
  atomicWriteJSON(stateFilePath(stateRoot), next);

  return {
    ok: true,
    command: 'resolve',
    action: 'resolve',
    from: fromNode,
    to: toNode,
    gate_cleared: state.gate,
    iteration: lb.newIter,
    frontier: newFrontier,
    message: `HG ${state.gate} 已解除，推进 ${fromNode}→${toNode}`,
  };
}

// ── CLI 入口 ──
if (require.main === module) {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.command) {
    process.stdout.write([
      '用法：',
      '  node resolve-hg.js resolve [--dag <path>] [--root <dir>] [--gate HG1|HG2]',
      '',
    ].join('\n'));
    process.exit(opts.help ? 0 : 2);
  }

  try {
    let result;
    switch (opts.command) {
      case 'resolve':  result = cmdResolve(opts); break;
      default:
        throw new Error(`未知子命令：${opts.command}（可用：resolve）`);
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
  cmdResolve,
  // 暴露内部函数便于测试与同 skill 复用
  stateFilePath,
  readPipelineState,
  readDagObj,
};
