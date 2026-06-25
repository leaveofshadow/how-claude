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
    // P3.3 堵 REVIEW MINOR 4.3：shift-direction 后 current_node=null，boss 直接 resume 撞错无指引。
    // 给可执行命令（非动词"请先 advance"）：首次 init 后或换向后，advance 会重新定位起点
    // （advance-node.js:224 current_node=null → nodes[0].id）。
    throw new Error(`pipeline-state.current_node 为 null，无可恢复节点（首次 init 后或 shift-direction 换向后 current_node=null；请先 node advance-node.js advance 重新定位起点）`);
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

// ── orchestrate 辅助：正则转义 ──
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 从 exit_condition 提取入口命令（"skill /entry" 模式；skill 前缀限定，排除 .venture/artifacts 路径里的 /）
// N1: exit_condition 含 "venture-sales-judge /judge 阶段一" → /judge；N2: → /compete；N3(hcc-decision 无 / 入口) → null
function extractEntry(skill, exitCondition) {
  if (typeof skill !== 'string' || typeof exitCondition !== 'string') return null;
  const re = new RegExp(escapeRegex(skill) + '\\s+/([a-z][a-z0-9_-]*)', 'i');
  const m = exitCondition.match(re);
  return m ? '/' + m[1] : null;
}

// 从 exit_condition 提取 artifact 路径（set-signal --artifact 用）
// 双路径（hcc 目录统一阶段1）：新路径 .hcc/<部门>/<skill>/xxx.md 优先；
//   不存在则读旧路径 .venture/artifacts/xxx.md（兼容期：旧项目/未迁节点仍可提取）
function extractArtifact(exitCondition) {
  if (typeof exitCondition !== 'string') return null;
  // 新路径优先：.hcc/<任意子路径>/xxx.md（层3产物统一目录，charter L126）
  const mNew = exitCondition.match(/\.hcc[\\/][^\s）)]+\.md/i);
  if (mNew) return mNew[0];
  // 旧路径：.venture/artifacts/xxx.md
  const mOld = exitCondition.match(/\.venture[\\/]artifacts[\\/][^\s）)]+\.md/i);
  return mOld ? mOld[0] : null;
}

// ── orchestrate 主流程（M2 R2.1-R2.2）──
// 语义（决策 A + v2-R4）：纯读侧，读 state.current_node + dag.node 拼 markdown 指令卡输出 stdout。
// 不写文件（纯提示），不 spawn skill（C2），跳过 hash 比对（orchestrate 是提示不是续传，不拒绝漂移态——R2.1 验证5）。
// [v2-R4] 强制提示当前节点下一步命令（普通段出边→set-signal+advance；HG 出边→resolve-hg），逐字含 --edge/--artifact/--dag，让 agent 复制粘贴即可执行。
function cmdOrchestrate(opts) {
  const stateRoot = resolveStateRoot(opts.root);
  const dagPath = resolveDagPath(opts.dag);

  // 读 state.current_node（R2.1 验证5：跳过 hash 比对，orchestrate 不拒绝漂移态——与 cmdResume L130-134 不同，不调 computeGraphHash）
  const state = readPipelineState(stateRoot);
  const currentNode = state.current_node;
  if (!currentNode) {
    throw new Error(`pipeline-state.current_node 为 null，无可编排节点（请先 advance 进入起点）`);
  }

  const dagObj = readDagObj(dagPath);
  const node = dagObj.nodes.find((n) => n.id === currentNode);
  if (!node) {
    throw new Error(`dag 无节点 ${currentNode}（current_node 与 dag 不一致）`);
  }

  // R2.2：占位节点分支（skill=placeholder → 占位提示，不输出激活指令）
  if (node.skill === 'placeholder') {
    return {
      ok: true,
      command: 'orchestrate',
      node: currentNode,
      placeholder: true,
      card: `# 当前节点：${currentNode}（占位）\n\n该节点为占位，最小闭环验证到此为止，N4-N8 + HG2 待层3 后续装配。\n`,
    };
  }

  // 找出边 + 判定类型（普通段 awaiting_human=false / HG edge awaiting_human=true）
  const outEdges = Array.isArray(dagObj.edges) ? dagObj.edges.filter((e) => e.from === currentNode) : [];
  const normalEdge = outEdges.find((e) => e.condition && e.condition.awaiting_human === false) || null;
  const hgEdge = outEdges.find((e) => e.condition && e.condition.awaiting_human === true) || null;

  // 提取入口命令 + artifact 路径（从 exit_condition，skill 前缀限定排除路径）
  const entry = extractEntry(node.skill, node.exit_condition);
  const artifact = extractArtifact(node.exit_condition);

  // 拼 markdown 指令卡
  const lines = [];
  lines.push(`# 当前节点：${currentNode}`);
  lines.push('');
  lines.push(`## 该激活的 skill`);
  lines.push(`- skill: ${node.skill}`);
  lines.push(`- 入口: ${entry || '(无 slash 入口，' + node.skill + ' 直接执行)'}`);
  lines.push('');

  // [R2.4b 模块B] activate_external 字段：节点声明需激活的外部 skill（数据驱动，非节点 ID 特判）
  // 延续 orchestrate 数据驱动模式（同 node.skill==='placeholder' 分支同构，读 node.activate_external 字段判）。
  // N3.5 具体：activate_external=grill-me → 提示激活 grill-me 打磨 §3 功能需求清晰度/可验证性/边界完整，
  //           禁问市场规模/用户画像/竞品，产出落盘 N3.5_grill_log.md（追问数 ≥ N + 修订点，主题2 落盘契约）。
  // 通用性：读 node.activate_external，非硬编码 currentNode==='N3.5'（boss 可对任意节点加此字段）。
  if (node.activate_external) {
    lines.push(`## ⚠️ 必须激活的外部 skill`);
    lines.push(`- 外部 skill: ${node.activate_external}`);
    lines.push(`- 理由: 本节点 design（工程需求规格 §3 功能需求）需经 ${node.activate_external} 打磨清晰度/可验证性/边界完整`);
    lines.push(`- 激活方式: 显式 /grilling（${node.activate_external} 的 disable-model-invocation=true，不会自动触发）`);
    lines.push(`- 追问靶子: §3 每条 R{n} 的无歧义/可验证性/边界完整；§3 R{n} 触发条件 ∈ §2 in-scope`);
    lines.push(`- 禁问: 市场规模/用户画像/竞品`);
    lines.push(`- 落盘: N3.5_grill_log.md（含追问数 ≥ N + 每条对应 §3/§2 修订点）`);
    lines.push('');
  }

  lines.push(`## 完成判据（exit_condition，引擎不校验，由你/boss 对照）`);
  lines.push(`- ${node.exit_condition}`);
  lines.push('');
  lines.push(`## 完成后你必须做（缝合闭环，强制，不准跳）`);
  if (normalEdge) {
    const edgeStr = `${normalEdge.from}:${normalEdge.to}`;
    const artifactArg = artifact ? ` --artifact ${artifact}` : '';
    lines.push(`1. node venture-resume.js set-signal --edge ${edgeStr} --signal green${artifactArg} --dag ${dagPath}`);
    lines.push(`2. node advance-node.js advance --dag ${dagPath}`);
    lines.push(`3. node venture-resume.js orchestrate --dag ${dagPath}（看下一个节点指令）`);
    lines.push('');
    lines.push(`⚠️ 不准跳过 set-signal 直接 advance（否则 signal 留 unknown → advance 触发 HG 停等卡死）`);
  } else if (hgEdge) {
    lines.push(`1. （boss 闸）复核本节点 artifact 质量 → node resolve-hg.js resolve --gate ${hgEdge.condition.gate} --dag ${dagPath}`);
    lines.push(`2. node venture-resume.js orchestrate --dag ${dagPath}（看 HG 越闸后下一节点指令）`);
    lines.push('');
    lines.push(`⚠️ HG edge 的 signal 是死字段（不靠 set-signal），越闸靠 resolve-hg（advance-node.js:294 awaiting_human 优先于 :325 signal）`);
  } else {
    lines.push(`（当前节点无出边，为终点）`);
  }
  lines.push('');
  lines.push(`## 当前状态`);
  lines.push(`- current_node: ${currentNode}`);
  lines.push(`- status: ${state.status || '(未知)'}`);
  if (outEdges.length > 0) {
    lines.push(`- 出边:`);
    for (const e of outEdges) {
      const c = e.condition || {};
      const sig = c.signal || '?';
      const ah = c.awaiting_human ? 'true' : 'false';
      const gatePart = c.gate ? `, gate=${c.gate}` : '';
      const kind = c.awaiting_human ? 'HG edge（signal 死字段，靠 resolve-hg 越闸）' : '普通段（signal 驱动 advance）';
      lines.push(`  - ${e.from}→${e.to} (signal=${sig}, awaiting_human=${ah}${gatePart})  ← ${kind}`);
    }
  }
  const card = lines.join('\n') + '\n';

  return {
    ok: true,
    command: 'orchestrate',
    node: currentNode,
    skill: node.skill,
    entry: entry,
    out_edges: outEdges.map((e) => ({ from: e.from, to: e.to, kind: (e.condition && e.condition.awaiting_human) ? 'HG' : 'normal' })),
    card: card,
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
      '  node venture-resume.js orchestrate [--dag <path>] [--root <dir>]',
      '',
    ].join('\n'));
    process.exit(opts.help ? 0 : 2);
  }

  try {
    let result;
    switch (opts.command) {
      case 'resume':  result = cmdResume(opts); break;
      case 'set-signal':  result = cmdSetSignal(opts); break;
      case 'orchestrate':  result = cmdOrchestrate(opts); break;
      default:
        throw new Error(`未知子命令：${opts.command}（可用：resume / set-signal / orchestrate）`);
    }
    // orchestrate 输出纯 markdown 指令卡（给人/agent 读，非结构化 JSON）；其他子命令输出 JSON
    if (opts.command === 'orchestrate') {
      process.stdout.write(result.card.endsWith('\n') ? result.card : result.card + '\n');
    } else {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }
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
  cmdOrchestrate,
  extractEntry,
  extractArtifact,
  parseContinueFrom,
  appendResumeTrace,
};
