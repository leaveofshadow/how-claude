#!/usr/bin/env node
/**
 * dag-placeholder.test.js —— M5 R5.2 占位拓扑跑通验证（C7）
 *
 * 用 dag.placeholder.json 跑 advance-node + resolve-hg 完整序列，验证 8 节点 DAG
 * N1→N8 全流转（含 HG1/HG2 停等 + N6⇄N7 loop_back 收敛后取 N7→N8 出口，A 方案）。
 *
 * 验收（R5.2）：
 *   - pipeline-state.current_node 最终 = N8
 *   - 全程 direction.json status='active'/gate:null 字节不变（C1：advance/resolve 不碰 direction.json）
 *   - 序列中观测到 action=converged_exit（A 方案收敛后取出口推进）
 *   - history 含 converged:max_iter reached 事件
 *
 * 约束（C2）：被测脚本仅 fs+path+crypto（内建）+ 同 skill require。本测试 spawn 调被测脚本。
 * ⚠️ fixture 用 node fs.writeFileSync 'utf8'（无 BOM），读 direction.json 用 node fs（避 PowerShell 乱码）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const ADVANCE = path.join(SCRIPT_DIR, 'advance-node.js');
const PIPELINE_STATE = path.join(SCRIPT_DIR, 'pipeline-state.js');
const RESOLVE = path.join(SCRIPT_DIR, 'resolve-hg.js');
const INIT_STATE = path.join(SCRIPT_DIR, '..', '..', 'cc-runtime', 'scripts', 'init-state.js');
const DAG_PLACEHOLDER = path.join(SCRIPT_DIR, '..', 'dag.placeholder.json');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  − ${msg}`); passed++; }
  else { console.error(`  ✗ FAIL: ${msg}`); failed++; }
}

// 隔离临时 state 根（含 direction.json fixture）+ dag.placeholder.json 副本
function makeIsolatedRoot() {
  const tmpBase = path.join(os.tmpdir(), `layer2-m5-r52-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const stateRoot = path.join(tmpBase, '.venture', 'state');
  fs.mkdirSync(stateRoot, { recursive: true });
  // cc-runtime init-state 造 direction.json fixture（status:active/gate:null）
  const r = spawnSync('node', [INIT_STATE, '--root', stateRoot, '--force'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`init-state fixture 失败：${r.stderr || r.stdout}`);
  const dagCopy = path.join(tmpBase, 'dag.placeholder.json');
  fs.copyFileSync(DAG_PLACEHOLDER, dagCopy);
  return { stateRoot, dagCopy, tmpBase };
}

function cleanup(tmpBase) { try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (e) {} }

function readJSON(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function readRaw(fp) { return fs.readFileSync(fp, 'utf8'); }
function psPath(stateRoot) { return path.join(stateRoot, 'pipeline-state.json'); }
function dirPath(stateRoot) { return path.join(stateRoot, 'direction.json'); }

function runAdvance(stateRoot, dagCopy) {
  return spawnSync('node', [ADVANCE, 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
}
function runResolve(stateRoot, dagCopy) {
  return spawnSync('node', [RESOLVE, 'resolve', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
}

// ── R5.2 占位拓扑跑通 ──
function testPlaceholderTopologyRun() {
  console.log('\n[Test R5.2] 占位拓扑跑通：dag.placeholder.json N1→N8 全流转（HG1/HG2 停等 + N6⇄N7 收敛→N8 出口）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const initR = spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    assert(initR.status === 0, `pipeline-state init exit 0（实际 ${initR.status}；stderr=${JSON.stringify(initR.stderr)}）`);

    // C1 基线：direction.json 原始字节快照（全程比对，证明 advance/resolve 不碰 direction.json）
    const dirBaseline = readRaw(dirPath(stateRoot));
    assert(JSON.parse(dirBaseline).status === 'active' && JSON.parse(dirBaseline).gate === null,
      `C1 基线：direction.json fixture status=active/gate:null 正确`);

    let steps = 0;
    const MAX_STEPS = 40;  // 防死循环（实际约 14 步）
    let convergedExitSeen = false;
    const trace = [];  // 每步 (action, current_node, status, gate, iteration)

    while (steps < MAX_STEPS) {
      const s = readJSON(psPath(stateRoot));
      if (s.current_node === 'N8') break;  // 到达终点 N8

      // 按 status 决策：awaiting_human → resolve（boss 决策解除）；否则 → advance 推进
      const r = (s.status === 'awaiting_human') ? runResolve(stateRoot, dagCopy) : runAdvance(stateRoot, dagCopy);
      assert(r.status === 0, `步骤 ${steps + 1} exit 0（实际 ${r.status}；stderr=${JSON.stringify(r.stderr)}）`);

      const rObj = JSON.parse(r.stdout);
      const ns = readJSON(psPath(stateRoot));
      trace.push({ step: steps + 1, action: rObj.action, node: ns.current_node, status: ns.status, gate: ns.gate, iter: ns.iteration });
      if (rObj.action === 'converged_exit') convergedExitSeen = true;

      // C1 全程核验：direction.json 字节不变（每步都比对）
      assert(readRaw(dirPath(stateRoot)) === dirBaseline,
        `C1 步骤 ${steps + 1}（${rObj.action}）：direction.json 字节未变`);

      steps++;
    }

    // ── 验收断言 ──
    const final = readJSON(psPath(stateRoot));
    assert(steps < MAX_STEPS, `R5.2 未死循环（${steps} 步收敛到达 N8，上限 ${MAX_STEPS}）`);
    assert(final.current_node === 'N8',
      `R5.2 终态：current_node=N8（实际 ${final.current_node}，全流转到达终点）`);
    assert(convergedExitSeen,
      `R5.2 收敛出口：序列中观测到 action=converged_exit（A 方案 N7→N8 出口推进）`);
    assert(final.status === 'active' && final.gate === null,
      `R5.2 终态 status=active/gate:null（实际 ${final.status}/${final.gate}）`);

    // 收敛事件 history 含 converged:max_iter reached
    const convergedEv = final.history.filter((h) => /converged:max_iter reached/.test(h.reason || ''));
    assert(convergedEv.length >= 1,
      `history 含 converged:max_iter reached 事件（实际 ${convergedEv.length} 条）`);

    // C1 终态核验：direction.json 全程字节未变
    assert(readRaw(dirPath(stateRoot)) === dirBaseline,
      `C1 终态：direction.json 全程字节未变（${steps} 步 advance/resolve 均未碰 direction.json）`);
    const dirFinal = readJSON(dirPath(stateRoot));
    assert(dirFinal.status === 'active' && dirFinal.gate === null,
      `C1 终态：direction.json status=active/gate:null（实际 ${dirFinal.status}/${dirFinal.gate}）`);

    // 推进轨迹摘要（可视化 N1→N8 序列）
    console.log(`  推进轨迹（${steps} 步）：`);
    trace.forEach((t) =>
      console.log(`    [${String(t.step).padStart(2)}] ${String(t.action).padEnd(20)} → node=${t.node} status=${t.status} gate=${t.gate} iter=${t.iter}`));
  } finally {
    cleanup(tmpBase);
  }
}

testPlaceholderTopologyRun();

console.log(`\n==== ${passed} passing, ${failed} failing ====`);
process.exit(failed === 0 ? 0 : 1);
