#!/usr/bin/env node
/**
 * venture-pipeline load-graph.js —— 解析 dag.json → 内存图（M0 R0.4）
 *
 * 依据：references/dag-schema.md（三原语 + 字位预留 C5）
 * 验收：70-requirements R0.4（解析 / 字位报未实现 / graph_hash 确定性）
 *
 * 约束（C2）：仅 require('fs') + require('path') + require('crypto')（Node 内建），
 *            禁 vm/eval/Function/SDK 子进程。
 * 字位（C5）：遇 subgraph/fan_out 且 implemented:false → stderr 报「未实现：{字段}」+ exit 1。
 *            零运行时逻辑（纯数据预留，50 §7.4）。
 *
 * 用法：
 *   node load-graph.js --dag <path>   # 输出 {nodes, edges, loop_backs, graph_hash} JSON
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── CLI 参数解析 ──
function resolveDagPath(argv) {
  const idx = argv.indexOf('--dag');
  if (idx !== -1 && argv[idx + 1]) return path.resolve(argv[idx + 1]);
  return null;
}

// ── C5 字位检测：implemented:false 的字位遇即报未实现 ──
// 字位列表（50 §4 γ 残值嫁接，纯数据预留）
const RESERVED_FIELDS = ['subgraph', 'fan_out'];

function detectUnimplemented(dagObj) {
  const reports = [];
  for (const f of RESERVED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(dagObj, f)) {
      const slot = dagObj[f];
      // 字位存在即视为未实现触发（implemented:false 是显式标注；缺该键也按未实现处理更保守，
      // 但需求要求字位 reserved:true, implemented:false —— 严格匹配该结构）
      if (slot && typeof slot === 'object' && slot.reserved === true) {
        reports.push(f);
      }
    }
  }
  return reports;
}

// ── 确定性序列化：递归排序 JSON 键 ──
// 同一对象键顺序无关，保证 graph_hash 对同一 dag.json 稳定。
function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = sortKeysDeep(value[k]);
    }
    return sorted;
  }
  return value;
}

function computeGraphHash(dagObj) {
  const sorted = sortKeysDeep(dagObj);
  const str = JSON.stringify(sorted); // 无空格，确定性
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

// ── 主流程：解析 dag.json ──
function loadGraph(dagPath) {
  if (!fs.existsSync(dagPath)) {
    throw new Error(`dag.json 不存在：${dagPath}`);
  }
  const raw = fs.readFileSync(dagPath, 'utf8');
  let dagObj;
  try {
    dagObj = JSON.parse(raw);
  } catch (e) {
    throw new Error(`dag.json 非合法 JSON：${e.message}`);
  }

  // C5 字位检测（在计算 hash 前报错，避免对未实现字位产出有效输出）
  const unimplemented = detectUnimplemented(dagObj);
  if (unimplemented.length > 0) {
    const err = new Error(`未实现：${unimplemented.join(', ')}（C5 字位预留，50 §7.4）`);
    err.code = 'UNIMPLEMENTED_FIELD';
    err.fields = unimplemented;
    throw err;
  }

  // 提取三原语（schema 见 dag-schema.md）
  const nodes = Array.isArray(dagObj.nodes) ? dagObj.nodes : [];
  const edges = Array.isArray(dagObj.edges) ? dagObj.edges : [];
  const loopBacks = Array.isArray(dagObj.loop_backs) ? dagObj.loop_backs : [];

  // graph_hash 在移除字位前计算（dag.json 原文 hash，便于 pipeline-state.verify 比对）
  // 注：此处 dagObj 已过滤字位（detectUnimplemented 通过 = 无字位），hash 反映纯净拓扑。
  const graphHash = computeGraphHash(dagObj);

  return { nodes, edges, loop_backs: loopBacks, graph_hash: graphHash };
}

// ── CLI 入口 ──
if (require.main === module) {
  const dagPath = resolveDagPath(process.argv);
  if (!dagPath) {
    process.stderr.write('用法：node load-graph.js --dag <path>\n');
    process.exit(2);
  }
  try {
    const result = loadGraph(dagPath);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    if (e.code === 'UNIMPLEMENTED_FIELD') {
      // C5：stderr 报未实现（中文前缀匹配测试「未实现：subgraph」）
      for (const f of e.fields) {
        process.stderr.write(`未实现：${f}（C5 字位预留，50 §7.4）\n`);
      }
      process.exit(1);
    }
    process.stderr.write(`错误：${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { loadGraph, detectUnimplemented, computeGraphHash, sortKeysDeep };
