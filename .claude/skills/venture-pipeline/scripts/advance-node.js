#!/usr/bin/env node
/**
 * venture-pipeline advance-node.js —— 层2 DAG 引擎「推进」核心（M2 R2.1-R2.5）
 *
 * 依据：references/pipeline-state-schema.md（嫁接1 写者隔离）+ references/dag-schema.md（gate 来源）
 * 裁决：50-decision §2.1（HG 折叠为带停等 edge）+ §2.2（嫁接1）+ §7 C1/C2
 * 验收：70-requirements R2.1（流转）/ R2.2（signal 四态）/ R2.3（loop_back 收敛）/ R2.4（HG 触发）/ R2.5（换向监测）
 *
 * 约束（C2）：仅 fs+path+crypto（内建）+ './load-graph' + './pipeline-state'（同 skill）+
 *            '../../cc-runtime/scripts/init-state'（同项目复用 atomicWriteJSON）。禁 vm/eval/Function/SDK 子进程。
 * C1 硬约束（嫁接1，最关键）：
 *   - advance-node.js 是 pipeline-state.json 合法写者（schema §4.3 已授权）
 *   - 读 direction.json.current_version 是纯读（同 pipeline-state.js init readDirectionVersion），允许
 *   - 绝对禁止 spawn direction.set / require('child_process') / 写 direction.json
 *   - direction.json 永远 status:active / gate:null（shift-direction.js line 126-127 硬编码）
 *
 * 子命令：
 *   node advance-node.js advance [--dag <path>] [--root <dir>]  # 推进一拍
 */
'use strict';

const fs = require('fs');
const path = require('path');
// 同 skill：load-graph（computeGraphHash 用于 R2.5 重算）
const { computeGraphHash } = require('./load-graph');
// 同 skill：pipeline-state（cmdSetHg 用于 R2.4 triggerHG，cmdRead 读状态）
const { cmdRead, cmdSetHg, resolveStateRoot, resolveDagPath } = require('./pipeline-state');
// 同项目：cc-runtime atomicWriteJSON（临时文件 + rename 原子写）
const { atomicWriteJSON } = require('../../cc-runtime/scripts/init-state');

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

// direction.json 路径（与 pipeline-state.js 一致，纯读 current_version）
function directionFilePath(stateRoot) {
  return path.join(stateRoot, 'direction.json');
}

// 读 pipeline-state.json（不存在抛错）
function readPipelineState(stateRoot) {
  const fp = stateFilePath(stateRoot);
  if (!fs.existsSync(fp)) {
    throw new Error(`pipeline-state.json 不存在：${fp}（请先 node pipeline-state.js init）`);
  }
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// 纯读 direction.json.current_version（R2.5 换向监测源）
// C1：纯读非写，不改变 direction.json 语义；读失败 fallback=state.direction_version（不阻塞）
function readDirectionVersion(stateRoot, fallback) {
  const dirPath = directionFilePath(stateRoot);
  try {
    if (!fs.existsSync(dirPath)) return fallback;
    const obj = JSON.parse(fs.readFileSync(dirPath, 'utf8'));
    return (obj && typeof obj.current_version === 'number') ? obj.current_version : fallback;
  } catch (e) {
    return fallback;
  }
}

// 读 dag.json → 对象（仅算 hash + 取 nodes/edges/loop_backs，不调 loadGraph 避字位检测阻塞）
function readDagObj(dagPath) {
  if (!fs.existsSync(dagPath)) {
    throw new Error(`dag.json 不存在：${dagPath}`);
  }
  return JSON.parse(fs.readFileSync(dagPath, 'utf8'));
}

// ── R2.5 watchDirectionShift：换向监测 ──
// 启动时读 direction.json.current_version，比对 pipeline-state.direction_version。
// 若变化（boss 调 shift-direction.js 换向）→ 重置 current_node=null / frontier=[] / iteration=0 /
//   graph_hash 用当前 dag.json 重算 + history 追加 reset 事件。
// 返回 { reset:bool, state } —— reset=true 表示已重置，调用方应直接落盘 + 终止本次推进。
function watchDirectionShift(stateRoot, dagPath, state) {
  const dirVersion = readDirectionVersion(stateRoot, state.direction_version);
  if (dirVersion === state.direction_version) {
    return { reset: false, state };
  }

  // boss 换向：重置推进态（C6：graph_hash 用当前 dag.json 重算）
  const dagObj = readDagObj(dagPath);
  const newHash = computeGraphHash(dagObj);
  const now = new Date().toISOString();
  const fromSnapshot = {
    direction_version: state.direction_version,
    current_node: state.current_node,
    iteration: state.iteration,
  };
  const next = Object.assign({}, state, {
    direction_version: dirVersion,
    current_node: null,
    frontier: [],
    iteration: 0,
    status: 'active',
    gate: null,
    graph_hash: newHash,
    history: (Array.isArray(state.history) ? state.history : []).concat([{
      ts: now,
      action: 'advance',  // history.action 枚举无 'reset'，借用 advance + reason 标识（schema §2 一致）
      from: fromSnapshot,
      to: {
        direction_version: dirVersion,
        current_node: null,
        iteration: 0,
        status: 'active',
        gate: null,
      },
      reason: `direction 换向监测：v${state.direction_version}→v${dirVersion}，重置推进态`,
    }]),
  });
  return { reset: true, state: next };
}

// ── 从 current_node 找出边 ──
function findOutEdges(edges, nodeId) {
  return edges.filter((e) => e.from === nodeId);
}

// ── R2.2 evaluateEdge：评估 out-edge 的 signal ──
// 返回 { flow:bool, blocked:bool, warn:bool, askHG:bool, gate, reason }
//   flow=true → 流转；blocked=true → red 停等不流转；warn=true → yellow 记录但流转；askHG=true → unknown 走 HG
function evaluateEdge(edge) {
  const sig = edge && edge.condition && edge.condition.signal;
  // gate 来源（R2.0 数据驱动）：unknown 询问 fallback HG1
  const gate = (edge && edge.condition && edge.condition.gate) || 'HG1';

  switch (sig) {
    case 'green':
      return { flow: true, blocked: false, warn: false, askHG: false, gate, reason: 'signal=green 自动流转' };
    case 'yellow':
      return { flow: true, blocked: false, warn: true, askHG: false, gate, reason: 'signal=yellow 记录警告但流转' };
    case 'red':
      return { flow: false, blocked: true, warn: false, askHG: false, gate, reason: 'blocked:signal=red 停等不流转' };
    case 'unknown':
      return { flow: false, blocked: false, warn: false, askHG: true, gate, reason: 'signal=unknown 询问，走 HG' };
    default:
      // 非法 signal 枚举 → 视为 unknown 询问（保守降级到 HG）
      return { flow: false, blocked: false, warn: false, askHG: true, gate, reason: `signal 非法（${sig}）降级询问 HG` };
  }
}

// ── R2.3 handleLoopBack：loop_back 收敛 ──
// 若该 edge 在 dag.loop_backs 中 → iteration++；若 iteration>=max_iter → 不回环 + 标记 converged。
// 返回 { loopBack:bool, converged:bool, newIter, reason }
//   loopBack=true 表示这是回环 edge；converged=true 表示达 max_iter 不回环
function handleLoopBack(edge, loopBacks, currentIter) {
  const lb = loopBacks.find((l) => l.from === edge.from && l.to === edge.to);
  if (!lb) {
    return { loopBack: false, converged: false, newIter: currentIter, reason: null };
  }
  const newIter = currentIter + 1;
  const maxIter = (typeof lb.max_iter === 'number') ? lb.max_iter : 0;
  if (newIter >= maxIter) {
    return {
      loopBack: true,
      converged: true,
      newIter,
      reason: `converged:max_iter reached（iteration=${newIter}>=max_iter=${maxIter}）`,
    };
  }
  return {
    loopBack: true,
    converged: false,
    newIter,
    reason: `loop_back 回环 iteration=${newIter}（<max_iter=${maxIter}）`,
  };
}

// ── R2.4 triggerHG：触发 HG 停等（嫁接1，绝不碰 direction.json）──
// 调 cmdSetHg({gate, root})，history 自动追加 set_hg 事件。
// 返回 cmdSetHg 的结果（含已更新的 state，由调用方读回落盘一致性）。
function triggerHG(gate, reason, stateRoot, fromSnapshot) {
  const result = cmdSetHg({ gate, root: stateRoot });
  // cmdSetHg 已写 status:awaiting_human/gate + history。追加 reason 关联（按需补一条 advance context）。
  // 为避免双重 history 条目，triggerHG 仅返回结果；advance 主流程读回 state 后追加 advance 事件。
  return result;
}

// ── advance 主流程（R2.1-R2.5）──
function cmdAdvance(opts) {
  const stateRoot = resolveStateRoot(opts.root);
  const dagPath = resolveDagPath(opts.dag);

  let state = readPipelineState(stateRoot);
  const dagObj = readDagObj(dagPath);
  const nodes = Array.isArray(dagObj.nodes) ? dagObj.nodes : [];
  const edges = Array.isArray(dagObj.edges) ? dagObj.edges : [];
  const loopBacks = Array.isArray(dagObj.loop_backs) ? dagObj.loop_backs : [];

  // R2.5 watchDirectionShift（先于推进）
  const shift = watchDirectionShift(stateRoot, dagPath, state);
  if (shift.reset) {
    // 换向：落盘重置态 + 终止本次推进（history 已记 reset 事件）
    atomicWriteJSON(stateFilePath(stateRoot), shift.state);
    return {
      ok: true,
      command: 'advance',
      action: 'direction_shift_reset',
      from_version: state.direction_version,
      to_version: shift.state.direction_version,
      current_node: null,
      message: 'direction 换向监测触发，推进态已重置（本次 advance 不推进节点）',
    };
  }
  state = shift.state;

  // R2.1 起点：current_node=null → 定位 dag.nodes[0].id
  let fromNode = state.current_node;
  if (!fromNode) {
    if (nodes.length === 0) {
      throw new Error('dag.json 无 nodes，无法定位起点');
    }
    fromNode = nodes[0].id;
    // 起点定位 = 一次隐式推进（从 null 到 N1），history 记 enter
    const now = new Date().toISOString();
    const enterEdge = { to: fromNode, condition: { signal: 'green', awaiting_human: false } };
    const newFrontier = findOutEdges(edges, fromNode).map((e) => e.to);
    state = Object.assign({}, state, {
      current_node: fromNode,
      frontier: newFrontier,
      history: (Array.isArray(state.history) ? state.history : []).concat([{
        ts: now,
        action: 'advance',
        from: { current_node: null, status: state.status, gate: state.gate },
        to: { current_node: fromNode, status: 'active', gate: null },
        reason: `enter:current_node 定位起点 ${fromNode}`,
      }]),
    });
    atomicWriteJSON(stateFilePath(stateRoot), state);
    return {
      ok: true,
      command: 'advance',
      action: 'enter',
      from: null,
      to: fromNode,
      frontier: newFrontier,
      message: `current_node 定位起点 ${fromNode}（本次 advance 仅进入起点，下次推进才评估 out-edge）`,
    };
  }

  // R2.1 找出边
  const outEdges = findOutEdges(edges, fromNode);
  if (outEdges.length === 0) {
    // 到达终点
    const now = new Date().toISOString();
    state = Object.assign({}, state, {
      frontier: [],
      history: (Array.isArray(state.history) ? state.history : []).concat([{
        ts: now,
        action: 'advance',
        from: { current_node: fromNode },
        to: { current_node: fromNode },
        reason: 'completed:无 out-edge 到达终点',
      }]),
    });
    atomicWriteJSON(stateFilePath(stateRoot), state);
    return {
      ok: true,
      command: 'advance',
      action: 'completed',
      at: fromNode,
      message: `到达终点 ${fromNode}（无 out-edge）`,
    };
  }

  // 取首条 out-edge（C5 subgraph/fan_out 并行分支未实现，单线推进取 outEdges[0]）
  const edge = outEdges[0];
  const fromSnapshot = {
    current_node: state.current_node,
    status: state.status,
    gate: state.gate,
    iteration: state.iteration,
  };

  // R2.2 evaluateEdge（signal 评估先于 awaiting_human，正交但顺序固定）
  const ev = evaluateEdge(edge);

  // R2.4 awaiting_human 检查（与 signal 正交，true 触发 HG 停等，不推进）
  if (edge.condition && edge.condition.awaiting_human === true) {
    // gate 来源：awaiting_human edge 必须声明 condition.gate（R2.0 裁决）
    const gate = edge.condition.gate;
    if (!gate) {
      throw new Error(`awaiting_human edge 缺 gate：from=${edge.from} to=${edge.to}（R2.0 数据驱动裁决）`);
    }
    triggerHG(gate, `awaiting_human 停等：${edge.from}→${edge.to}`, stateRoot, fromSnapshot);
    // 读回 set-hg 后的 state，追加 advance context（关联触发源）
    state = readPipelineState(stateRoot);
    const now = new Date().toISOString();
    state = Object.assign({}, state, {
      history: (Array.isArray(state.history) ? state.history : []).concat([{
        ts: now,
        action: 'advance',
        from: fromSnapshot,
        to: { current_node: state.current_node, status: state.status, gate: state.gate },
        reason: `awaiting_human 停等触发 HG：${gate}（edge ${edge.from}→${edge.to}）`,
      }]),
    });
    atomicWriteJSON(stateFilePath(stateRoot), state);
    return {
      ok: true,
      command: 'advance',
      action: 'awaiting_human',
      gate,
      at: fromNode,
      message: `awaiting_human 停等触发 ${gate}（不推进 current_node，boss 决策后 advance 继续）`,
    };
  }

  // signal 分支处理
  if (ev.askHG) {
    // unknown（或非法）：走 HG 询问（gate 来源：edge.condition.gate || 'HG1' fallback）
    triggerHG(ev.gate, `${ev.reason}（edge ${edge.from}→${edge.to}）`, stateRoot, fromSnapshot);
    state = readPipelineState(stateRoot);
    const now = new Date().toISOString();
    state = Object.assign({}, state, {
      history: (Array.isArray(state.history) ? state.history : []).concat([{
        ts: now,
        action: 'advance',
        from: fromSnapshot,
        to: { current_node: state.current_node, status: state.status, gate: state.gate },
        reason: `${ev.reason} 触发 HG${ev.gate}`,
      }]),
    });
    atomicWriteJSON(stateFilePath(stateRoot), state);
    return {
      ok: true,
      command: 'advance',
      action: 'ask_hg',
      gate: ev.gate,
      at: fromNode,
      message: `${ev.reason}，触发 HG${ev.gate}（不推进 current_node）`,
    };
  }

  if (ev.blocked) {
    // red：不流转，history 记 blocked
    const now = new Date().toISOString();
    state = Object.assign({}, state, {
      history: (Array.isArray(state.history) ? state.history : []).concat([{
        ts: now,
        action: 'advance',
        from: fromSnapshot,
        to: { current_node: fromNode, status: 'active', gate: null },
        reason: ev.reason,  // 'blocked:signal=red 停等不流转'
      }]),
    });
    atomicWriteJSON(stateFilePath(stateRoot), state);
    return {
      ok: true,
      command: 'advance',
      action: 'blocked',
      reason: ev.reason,
      at: fromNode,
      message: `${ev.reason}（current_node 不变，status 保持 active）`,
    };
  }

  // green 或 yellow：流转（yellow 先记警告）
  // R2.3 handleLoopBack：若 edge 是 loop_back，iteration++ / 达 max_iter 收敛
  const lb = handleLoopBack(edge, loopBacks, state.iteration);

  if (lb.converged) {
    // A方案（M5 R5.2 裁决）：达 max_iter 后不再回环，改走 fromNode「首条非 loop_back out-edge」（出口）。
    // 语义：loop_back=有限循环，达上限后继续往下（取出口推进），满足「收敛后→N8」原意。
    // 向后兼容：fromNode 无出口（仅此 loop_back edge）→ fallback 停 fromNode（M2 测试⑤ 旧行为）。
    const exitEdge = outEdges.find((e) => !loopBacks.some((l) => l.from === e.from && l.to === e.to));
    // exitEdge 自动排除当前触发的 loop_back edge（它是 loop_back）；找到则是有出口

    if (exitEdge) {
      // 收敛后出口路径：先判 awaiting_human（HG 停等路径），再判 signal（evaluateEdge）
      const exitAwaiting = exitEdge.condition && exitEdge.condition.awaiting_human === true;
      const exitEv = evaluateEdge(exitEdge);

      if (exitAwaiting || exitEv.askHG) {
        // 出口是 HG 停等 edge（awaiting_human:true 或 signal:unknown）→ 触发 HG（不推进，保持停等语义）
        // C1：triggerHG 仅写 pipeline-state.json，绝不碰 direction.json
        triggerHG(exitEv.gate, `${lb.reason}；收敛后出口 ${exitEdge.from}→${exitEdge.to} 触发 HG${exitEv.gate}`, stateRoot, fromSnapshot);
        state = readPipelineState(stateRoot);
        const nowHG = new Date().toISOString();
        state = Object.assign({}, state, {
          iteration: lb.newIter,
          history: (Array.isArray(state.history) ? state.history : []).concat([{
            ts: nowHG,
            action: 'advance',
            from: fromSnapshot,
            to: { current_node: state.current_node, status: state.status, gate: state.gate, iteration: lb.newIter },
            reason: `${lb.reason}；收敛后出口 ${exitEdge.from}→${exitEdge.to} 停等 HG${exitEv.gate}`,
          }]),
        });
        atomicWriteJSON(stateFilePath(stateRoot), state);
        return {
          ok: true,
          command: 'advance',
          action: 'converged_exit_awaiting',
          reason: lb.reason,
          gate: exitEv.gate,
          at: exitEdge.from,
          iteration: lb.newIter,
          message: `${lb.reason}，收敛后出口 ${exitEdge.from}→${exitEdge.to} 触发 HG${exitEv.gate}（停等 boss 决策）`,
        };
      }

      if (exitEv.blocked) {
        // 出口 signal=red：不推进，停 fromNode（收敛后出口阻塞，保持收敛态）
        const nowBlk = new Date().toISOString();
        state = Object.assign({}, state, {
          iteration: lb.newIter,
          history: (Array.isArray(state.history) ? state.history : []).concat([{
            ts: nowBlk,
            action: 'advance',
            from: fromSnapshot,
            to: { current_node: fromNode, status: 'active', gate: null, iteration: lb.newIter },
            reason: `${lb.reason}；收敛后出口 ${exitEdge.from}→${exitEdge.to} signal=red 阻塞`,
          }]),
        });
        atomicWriteJSON(stateFilePath(stateRoot), state);
        return {
          ok: true,
          command: 'advance',
          action: 'converged_exit_blocked',
          reason: `${lb.reason}；出口 signal=red 阻塞`,
          at: fromNode,
          iteration: lb.newIter,
          message: `${lb.reason}，收敛后出口 signal=red 阻塞（停在 ${fromNode}）`,
        };
      }

      // 出口 green/yellow：推进到出口 toNode（loop_back 有限循环达上限后继续往下）
      const toNode = exitEdge.to;
      const newFrontier = findOutEdges(edges, toNode).map((e) => e.to);
      const now = new Date().toISOString();
      const reasonParts = [`${lb.reason}；收敛后改走出口 ${exitEdge.from}→${toNode}`];
      if (exitEv.warn) reasonParts.push('warning:signal=yellow');
      state = Object.assign({}, state, {
        current_node: toNode,
        frontier: newFrontier,
        iteration: lb.newIter,
        status: 'active',
        gate: null,
        history: (Array.isArray(state.history) ? state.history : []).concat([{
          ts: now,
          action: 'advance',
          from: fromSnapshot,
          to: { current_node: toNode, status: 'active', gate: null, iteration: lb.newIter },
          reason: reasonParts.join('；'),
        }]),
      });
      atomicWriteJSON(stateFilePath(stateRoot), state);
      return {
        ok: true,
        command: 'advance',
        action: 'converged_exit',
        from: exitEdge.from,
        to: toNode,
        iteration: lb.newIter,
        frontier: newFrontier,
        warn: exitEv.warn,
        reason: lb.reason,
        message: `${lb.reason}，收敛后推进 ${exitEdge.from}→${toNode}${exitEv.warn ? '（含 yellow 警告）' : ''}`,
      };
    }

    // fallback：fromNode 无出口（仅 loop_back），停 fromNode（M2 旧行为，向后兼容测试⑤）
    const now = new Date().toISOString();
    state = Object.assign({}, state, {
      iteration: lb.newIter,
      history: (Array.isArray(state.history) ? state.history : []).concat([{
        ts: now,
        action: 'advance',
        from: fromSnapshot,
        to: { current_node: fromNode, status: 'active', gate: null, iteration: lb.newIter },
        reason: lb.reason,
      }]),
    });
    atomicWriteJSON(stateFilePath(stateRoot), state);
    return {
      ok: true,
      command: 'advance',
      action: 'converged',
      reason: lb.reason,
      at: fromNode,
      iteration: lb.newIter,
      message: `${lb.reason}（current_node 停在 ${fromNode}，无出口收敛）`,
    };
  }

  // 正常流转（含 loop_back 未达 max_iter 的回环推进）
  const toNode = edge.to;
  const newFrontier = findOutEdges(edges, toNode).map((e) => e.to);
  const now = new Date().toISOString();
  const reasonParts = [ev.reason];
  if (ev.warn) reasonParts.push('warning:signal=yellow');
  if (lb.loopBack) reasonParts.push(lb.reason);

  state = Object.assign({}, state, {
    current_node: toNode,
    frontier: newFrontier,
    iteration: lb.newIter,
    // 流转后 status 回到 active（若此前 awaiting_human 已由 resolve 解除则保持；这里流转=继续推进）
    status: 'active',
    gate: null,
    history: (Array.isArray(state.history) ? state.history : []).concat([{
      ts: now,
      action: 'advance',
      from: fromSnapshot,
      to: { current_node: toNode, status: 'active', gate: null, iteration: lb.newIter },
      reason: reasonParts.join('；'),
    }]),
  });
  atomicWriteJSON(stateFilePath(stateRoot), state);
  return {
    ok: true,
    command: 'advance',
    action: 'advance',
    from: fromNode,
    to: toNode,
    frontier: newFrontier,
    iteration: lb.newIter,
    warn: ev.warn,
    message: `流转 ${fromNode}→${toNode}${ev.warn ? '（含 yellow 警告）' : ''}`,
  };
}

// ── CLI 入口 ──
if (require.main === module) {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.command) {
    process.stdout.write([
      '用法：',
      '  node advance-node.js advance [--dag <path>] [--root <dir>]',
      '',
    ].join('\n'));
    process.exit(opts.help ? 0 : 2);
  }

  try {
    let result;
    switch (opts.command) {
      case 'advance':  result = cmdAdvance(opts); break;
      default:
        throw new Error(`未知子命令：${opts.command}（可用：advance）`);
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
  cmdAdvance,
  watchDirectionShift,
  evaluateEdge,
  handleLoopBack,
  triggerHG,
  readDirectionVersion,
  findOutEdges,
};
