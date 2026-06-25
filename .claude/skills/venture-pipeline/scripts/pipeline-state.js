#!/usr/bin/env node
/**
 * venture-pipeline pipeline-state.js —— 层2 DAG 引擎状态文件管理（M1 R1.2-R1.4）
 *
 * 依据：references/pipeline-state-schema.md（8 字段 + 嫁接1 状态职责）
 * 裁决：50-decision §2.2（嫁接1：pipeline-state.json 独占 HG 停等）+ §7 C1/C6
 * 验收：70-requirements R1.2（init）/ R1.3（set-hg）/ R1.4（verify）
 *
 * 约束（C2）：仅 require('fs')+require('path')（Node 内建）+ require('./load-graph')（同 skill）+
 *            require('../../cc-runtime/scripts/init-state')（同项目复用层1 atomicWriteJSON）。
 *            禁 vm/eval/Function/外部依赖/SDK 子进程。
 *
 * C1 硬约束（嫁接1，最关键）：
 *   - set-hg 命令只写 .venture/state/pipeline-state.json（status:awaiting_human / gate:HG{n}）
 *   - 绝对禁止 require/read/write .venture/state/direction.json
 *   - direction.json 永远 status:active / gate:null（shift-direction.js line 126-127 硬编码）
 *
 * 子命令：
 *   node pipeline-state.js init [--dag <path>] [--root <dir>]   # 生成默认 pipeline-state.json
 *   node pipeline-state.js read  [--root <dir>]                 # 读当前状态 JSON 输出
 *   node pipeline-state.js set-hg --gate HG1|HG2 [--root <dir>] # HG 停等（嫁接1，禁碰 direction.json）
 *   node pipeline-state.js verify [--dag <path>] [--root <dir>] # graph_hash 校验（C6 防漂移）
 */
'use strict';

const fs = require('fs');
const path = require('path');
// 同 skill 内：load-graph.js 的 computeGraphHash（接收 dag 对象，返回 64 位 sha256 hex）
const { computeGraphHash } = require('./load-graph');
// 同项目复用层1：cc-runtime init-state.js 的 atomicWriteJSON（filePath, obj → 临时文件 + rename 原子覆盖）
const { atomicWriteJSON } = require('../../cc-runtime/scripts/init-state');

// ── CLI 参数解析 ──
function parseArgs(argv) {
  const opts = { command: null, dag: null, root: null, gate: null, hccSkill: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dag') opts.dag = argv[++i] || null;
    else if (a === '--root') opts.root = argv[++i] || null;
    else if (a === '--gate') opts.gate = argv[++i] || null;
    else if (a === '--hcc-skill') opts.hccSkill = argv[++i] || null;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!opts.command && !a.startsWith('--')) opts.command = a;
  }
  return opts;
}

// 状态根双语义（hcc 目录统一阶段2）：
//   resolveStateRoot（写/init）：固定 .hcc/state（新文件落新位置，达成统一）
//   resolveStateRootForRead（读/改）：.hcc/state 优先 + .venture/state fallback（兼容旧）
function resolveStateRoot(rootArg) {
  if (rootArg) return path.resolve(rootArg);
  return path.resolve('.hcc', 'state');
}
function resolveStateRootForRead(rootArg) {
  if (rootArg) return path.resolve(rootArg);
  const hcc = path.resolve('.hcc', 'state');
  if (fs.existsSync(hcc)) return hcc;
  return path.resolve('.venture', 'state');
}

// dag.json 路径：缺省 fallback <cwd>/.claude/skills/venture-pipeline/dag.json
function resolveDagPath(dagArg) {
  if (dagArg) return path.resolve(dagArg);
  return path.resolve('.claude', 'skills', 'venture-pipeline', 'dag.json');
}

function stateFilePath(stateRoot) {
  return path.join(stateRoot, 'pipeline-state.json');
}

// 读 dag.json → 对象（load-graph.js 的解析能力复用，但这里只需 JSON + hash，不需字位检测）
// 注：字位检测由 load-graph CLI 负责；pipeline-state 只算 hash，dag.json 假设已通过 load-graph 校验。
function readDagObj(dagPath) {
  if (!fs.existsSync(dagPath)) {
    throw new Error(`dag.json 不存在：${dagPath}`);
  }
  const raw = fs.readFileSync(dagPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`dag.json 非合法 JSON：${e.message}`);
  }
}

// 尝试读 direction.json 取 current_version（init 时同步版本号，为 R2.5 换向监测铺路）
// 注：这是「读」（非写），且 try-catch fallback——direction.json 可能尚未 init-state。
// C1 禁止的是 set-hg 碰 direction.json，init 读版本号是合理协同。
function readDirectionVersion(stateRoot) {
  const dirPath = path.join(stateRoot, 'direction.json');
  try {
    if (!fs.existsSync(dirPath)) return 1; // 尚未 init-state，fallback
    const obj = JSON.parse(fs.readFileSync(dirPath, 'utf8'));
    return (obj && typeof obj.current_version === 'number') ? obj.current_version : 1;
  } catch (e) {
    return 1; // 读失败不阻塞 init
  }
}

// hcc-org/SKILL.md 路径：缺省 <cwd>/.claude/skills/hcc-org/SKILL.md（[B-2/C-4] R2.1）
function resolveHccSkillPath(arg) {
  if (arg) return path.resolve(arg);
  return path.resolve('.claude', 'skills', 'hcc-org', 'SKILL.md');
}

// 读 hcc-org/SKILL.md frontmatter 的 protocol_version（[B-2/C-4]：cmdInit 据此写入 pipeline-state.protocol_version_read 字段）
// 纯字符串解析（C2：禁外部 yaml 依赖）——正则提取 frontmatter 内 protocol_version 行。
// hcc-org 未装 / frontmatter 无此字段 / 读失败 → null（fallback，不阻塞层2 引擎）
function readHccOrgProtocolVersion(skillPath) {
  try {
    if (!fs.existsSync(skillPath)) return null;
    const raw = fs.readFileSync(skillPath, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) return null;
    const pv = fm[1].match(/^protocol_version:\s*["']?([^"'\r\n]+)["']?\s*$/m);
    return pv ? pv[1].trim() : null;
  } catch (e) {
    return null;
  }
}

// 读当前 pipeline-state.json（不存在返回 null）
function readPipelineState(stateRoot) {
  const fp = stateFilePath(stateRoot);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// ── init 子命令（R1.2）──
// 生成默认 pipeline-state.json：status:active / gate:null / graph_hash:从 dag.json 算
function cmdInit(opts) {
  const stateRoot = resolveStateRoot(opts.root);
  const dagPath = resolveDagPath(opts.dag);
  const dagObj = readDagObj(dagPath);
  const graphHash = computeGraphHash(dagObj);
  const directionVersion = readDirectionVersion(stateRoot);
  const hccOrgVersion = readHccOrgProtocolVersion(resolveHccSkillPath(opts.hccSkill)); // [B-2/C-4] R2.1
  const now = new Date().toISOString();

  const state = {
    direction_version: directionVersion,
    current_node: null,
    frontier: [],
    iteration: 0,
    status: 'active',       // 嫁接1 默认值
    gate: null,             // 嫁接1 默认值
    graph_hash: graphHash,
    protocol_version_read: hccOrgVersion,  // [B-2/C-4] hcc-org 未装时 null（fallback）
    history: [{
      ts: now,
      action: 'init',
      from: null,
      to: { status: 'active', gate: null, current_node: null },
      reason: 'pipeline-state init',
    }],
  };

  const fp = stateFilePath(stateRoot);
  atomicWriteJSON(fp, state); // 原子写（复用层1）
  return { ok: true, command: 'init', path: fp, state };
}

// ── read 子命令 ──
// 读当前 pipeline-state.json 输出 JSON（不存在 exit 1）
function cmdRead(opts) {
  const stateRoot = resolveStateRootForRead(opts.root);
  const state = readPipelineState(stateRoot);
  if (!state) {
    throw new Error(`pipeline-state.json 不存在：${stateFilePath(stateRoot)}（请先 node pipeline-state.js init）`);
  }
  return { ok: true, command: 'read', state };
}

// ── set-hg 子命令（R1.3，C1 核心约束）──
// 写 status:awaiting_human / gate:HG{n}，追加 history。
// **绝对禁止**触碰 direction.json（嫁接1）。
function cmdSetHg(opts) {
  const gate = opts.gate;
  if (!gate) {
    throw new Error('set-hg 必须提供 --gate HG1|HG2');
  }
  if (gate !== 'HG1' && gate !== 'HG2') {
    throw new Error(`--gate 仅接受 HG1|HG2（实际 ${gate}）`);
  }

  const stateRoot = resolveStateRootForRead(opts.root);
  const old = readPipelineState(stateRoot);
  if (!old) {
    throw new Error(`pipeline-state.json 不存在：${stateFilePath(stateRoot)}（请先 node pipeline-state.js init）`);
  }

  const now = new Date().toISOString();
  const fromSnapshot = {
    status: old.status,
    gate: old.gate,
    current_node: old.current_node,
  };

  // 构造新状态（保留其他字段，只改 status/gate + 追加 history）
  const next = Object.assign({}, old, {
    status: 'awaiting_human',  // 嫁接1：独占 HG 停等语义
    gate: gate,
    history: (Array.isArray(old.history) ? old.history : []).concat([{
      ts: now,
      action: 'set_hg',
      from: fromSnapshot,
      to: { status: 'awaiting_human', gate: gate, current_node: old.current_node },
      reason: `HG 停等：${gate}`,
    }]),
  });

  // C1 核验点：此函数全程不 require/read/write direction.json
  const fp = stateFilePath(stateRoot);
  atomicWriteJSON(fp, next);
  return { ok: true, command: 'set-hg', path: fp, from: fromSnapshot, to: { status: 'awaiting_human', gate: gate } };
}

// ── verify 子命令（R1.4，C6 防静默漂移）──
// 重算当前 dag.json 的 graph_hash，与 pipeline-state.graph_hash 比对。
function cmdVerify(opts) {
  const stateRoot = resolveStateRootForRead(opts.root);
  const dagPath = resolveDagPath(opts.dag);
  const state = readPipelineState(stateRoot);
  if (!state) {
    throw new Error(`pipeline-state.json 不存在：${stateFilePath(stateRoot)}（请先 node pipeline-state.js init）`);
  }
  if (!state.graph_hash || typeof state.graph_hash !== 'string') {
    throw new Error(`pipeline-state.graph_hash 缺失或非字符串（state.graph_hash=${JSON.stringify(state.graph_hash)}）`);
  }

  const dagObj = readDagObj(dagPath);
  const currentHash = computeGraphHash(dagObj);

  if (currentHash === state.graph_hash) {
    return { ok: true, command: 'verify', match: true, graph_hash: currentHash, message: 'graph_hash 匹配' };
  }
  // C6：不匹配 → 报漂移，exit 1（dag=<新> state=<旧>）
  const err = new Error(`graph_hash 不匹配：dag=${currentHash} state=${state.graph_hash}`);
  err.code = 'GRAPH_HASH_DRIFT';
  err.dag_hash = currentHash;
  err.state_hash = state.graph_hash;
  throw err;
}

// ── CLI 入口 ──
if (require.main === module) {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.command) {
    process.stdout.write([
      '用法：',
      '  node pipeline-state.js init [--dag <path>] [--root <dir>]',
      '  node pipeline-state.js read [--root <dir>]',
      '  node pipeline-state.js set-hg --gate HG1|HG2 [--root <dir>]',
      '  node pipeline-state.js verify [--dag <path>] [--root <dir>]',
      '',
    ].join('\n'));
    process.exit(opts.help ? 0 : 2);
  }

  try {
    let result;
    switch (opts.command) {
      case 'init':    result = cmdInit(opts); break;
      case 'read':    result = cmdRead(opts); break;
      case 'set-hg':  result = cmdSetHg(opts); break;
      case 'verify':  result = cmdVerify(opts); break;
      default:
        throw new Error(`未知子命令：${opts.command}（可用：init/read/set-hg/verify）`);
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    if (e.code === 'GRAPH_HASH_DRIFT') {
      // C6：stderr 报漂移（中文前缀匹配测试「graph_hash 不匹配」）
      process.stderr.write(`graph_hash 不匹配：dag=${e.dag_hash} state=${e.state_hash}\n`);
      process.exit(1);
    }
    process.stderr.write(`错误：${e.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  resolveStateRoot,
  resolveStateRootForRead,
  resolveDagPath,
  cmdInit,
  cmdRead,
  cmdSetHg,
  cmdVerify,
};
