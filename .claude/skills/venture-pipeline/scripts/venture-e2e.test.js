#!/usr/bin/env node
/**
 * venture-e2e.test.js —— 业务端到端推进链（charter 块1 复盘 P1.2，堵 MAJOR 2.3）
 *
 * 固化 R8.1-R8.3 推进链——多 CLI 协作（advance / set-signal / orchestrate / resolve-hg）
 * 从未串联验证过。advance-node.test 用 dag.json（普通 edge 默认 green 可直接 advance），
 * 未覆盖 dag.venture.json 的真实推进链：unknown 普通 edge 必先 set-signal green 才流转
 * + N3.5 节点 activate_external=grill-me 激活 + N3.5→N4 HG1 越闸 resolve-hg 全链。
 *
 * 推进链（端到端，非单点 mock）：
 *   fixture current_node=N3
 *   → set-signal N3:N3.5 green + N3 artifact（unknown 普通 edge 改 green）
 *   → advance → N3→N3.5 流转（current_node=N3.5 / frontier=[N4]）
 *   → orchestrate N3.5 → 指令卡含 grill-me + resolve-hg + HG1（HG 出边）
 *   → advance N3.5 → N3.5→N4 awaiting_human 触发（status=awaiting_human/gate=HG1/current_node 停 N3.5）
 *   → resolve-hg resolve --gate HG1 → 越闸 N4（current_node=N4/active/gate=null/frontier=[N5]）
 *   → C1 核验：resolve-hg 只写 pipeline-state.json，direction.json 仍 active/gate:null（嫁接1）
 *
 * 反证 case：非 awaiting_human 时 resolve-hg 拒绝（exit 1 + stderr 指认）。
 *
 * 约束（C2）：被测脚本均纯 Node 内建 + 同 skill/cc-runtime require，无外部依赖。
 *            本测试 child_process spawn 调被测 CLI + cc-runtime init-state.js 造 fixture。
 * ⚠️ PowerShell UTF-8 BOM 陷阱：fixture 用 node fs.writeFileSync(p, json, 'utf8')。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const VR = path.join(SCRIPT_DIR, 'venture-resume.js');            // set-signal / orchestrate
const ADV = path.join(SCRIPT_DIR, 'advance-node.js');             // advance
const RHG = path.join(SCRIPT_DIR, 'resolve-hg.js');               // resolve-hg
const INIT_STATE = path.join(SCRIPT_DIR, '..', '..', 'cc-runtime', 'scripts', 'init-state.js');
const VENTURE_DAG = path.join(SCRIPT_DIR, '..', 'dag.venture.json');
// 复用 load-graph 算 dag 副本 hash（造 graph_hash 匹配的 fixture）
const { computeGraphHash } = require('./load-graph');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  − ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

// 造隔离临时 state 根（init-state.js 造 direction.json）+ dag.venture.json 副本
function makeIsolatedRoot() {
  const tmpBase = path.join(os.tmpdir(), `p12-e2e-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const stateRoot = path.join(tmpBase, '.venture', 'state');
  fs.mkdirSync(stateRoot, { recursive: true });

  const r = spawnSync('node', [INIT_STATE, '--root', stateRoot, '--force'], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`init-state fixture 失败：${r.stderr || r.stdout}`);
  }

  const dagCopy = path.join(tmpBase, 'dag.venture.json');
  fs.copyFileSync(VENTURE_DAG, dagCopy);

  return { stateRoot, dagCopy, tmpBase };
}

function cleanup(tmpBase) {
  try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (e) {}
}
function writeJSON(fp, obj) { fs.writeFileSync(fp, JSON.stringify(obj, null, 2), 'utf8'); }
function readJSON(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function psPath(stateRoot) { return path.join(stateRoot, 'pipeline-state.json'); }
function dagHash(dagCopy) { return computeGraphHash(JSON.parse(fs.readFileSync(dagCopy, 'utf8'))); }

// 造「已推进到 N3」的 pipeline-state fixture（模拟 N1/N2 走完后停在 N3 待推进 N3.5）
// graph_hash 用 dag 副本 hash（advance 不校验漂移，但 set-signal rehash 后保持一致）
function writeN3State(stateRoot, dagCopy) {
  writeJSON(psPath(stateRoot), {
    direction_version: 1,
    current_node: 'N3',
    frontier: [],
    iteration: 0,
    status: 'active',
    gate: null,
    graph_hash: dagHash(dagCopy),
    history: [
      { ts: '2026-06-18T00:00:00.000Z', action: 'init', to: { current_node: null } },
      { ts: '2026-06-18T00:00:01.000Z', action: 'advance', to: { current_node: 'N3' } },
    ],
  });
}

// ── Test 1 [R8 核心链] 端到端推进 N3 → N3.5 → HG1 → N4 ──
function testE2EPushChain() {
  console.log('\n[Test 1] R8 端到端推进链：N3 --set-signal+advance--> N3.5 --orchestrate(grill-me)--> HG1 --resolve-hg--> N4');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeN3State(stateRoot, dagCopy);

    // ── 步骤1：set-signal N3:N3.5 green + N3 artifact（unknown 普通 edge 改 green）──
    const art = path.join(tmpBase, '.hcc', 'decision', 'hcc-decision', 'N3_决策方案_decision.md');
    fs.mkdirSync(path.dirname(art), { recursive: true });
    fs.writeFileSync(art, '七维评分：hcc-decision 拍板测试', 'utf8');
    const r1 = spawnSync('node', [VR, 'set-signal', '--dag', dagCopy, '--root', stateRoot,
      '--edge', 'N3:N3.5', '--signal', 'green', '--artifact', art], { encoding: 'utf8' });
    assert(r1.status === 0, `步骤1 set-signal N3:N3.5 green exit 0（实际 ${r1.status}）stderr=${(r1.stderr || '').trim().slice(0, 80)}`);
    let o1 = null; try { o1 = JSON.parse(r1.stdout); } catch (e) {}
    assert(o1 && o1.edge === 'N3:N3.5', `步骤1 stdout.edge=N3:N3.5（实际 ${o1 && o1.edge}）`);
    assert(o1 && o1.signal === 'green', `步骤1 stdout.signal=green（实际 ${o1 && o1.signal}）`);

    // ── 步骤2：advance → N3→N3.5 流转 ──
    const r2 = spawnSync('node', [ADV, 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    assert(r2.status === 0, `步骤2 advance exit 0（实际 ${r2.status}）stderr=${(r2.stderr || '').trim().slice(0, 80)}`);
    let s = readJSON(psPath(stateRoot));
    assert(s.current_node === 'N3.5', `步骤2 advance 后 current_node=N3.5（实际 ${s.current_node}）`);
    assert(s.status === 'active', `步骤2 status=active（实际 ${s.status}）`);
    assert(Array.isArray(s.frontier) && s.frontier[0] === 'N4',
      `步骤2 frontier=[N4]（实际 ${JSON.stringify(s.frontier)}）`);

    // ── 步骤3：orchestrate N3.5 → 指令卡含 grill-me + resolve-hg + HG1 ──
    const r3 = spawnSync('node', [VR, 'orchestrate', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    assert(r3.status === 0, `步骤3 orchestrate exit 0（实际 ${r3.status}）stderr=${(r3.stderr || '').trim().slice(0, 80)}`);
    const out = r3.stdout || '';
    assert(out.includes('当前节点：N3.5'), `步骤3 stdout 含 "当前节点：N3.5"`);
    assert(out.includes('grill-me'), `步骤3 stdout 含 "grill-me"（N3.5 activate_external 注入）`);
    assert(out.includes('resolve-hg'), `步骤3 stdout 含 "resolve-hg"（N3.5→N4 HG 出边提示）`);
    assert(out.includes('HG1'), `步骤3 stdout 含 "HG1"（gate 名）`);

    // ── 步骤4：advance N3.5 → N3.5→N4 HG 触发 awaiting_human ──
    const r4 = spawnSync('node', [ADV, 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    assert(r4.status === 0, `步骤4 advance(N3.5) exit 0（实际 ${r4.status}）stderr=${(r4.stderr || '').trim().slice(0, 80)}`);
    s = readJSON(psPath(stateRoot));
    assert(s.status === 'awaiting_human', `步骤4 status=awaiting_human（实际 ${s.status}）`);
    assert(s.gate === 'HG1', `步骤4 gate=HG1（实际 ${s.gate}）`);
    assert(s.current_node === 'N3.5', `步骤4 current_node 停 N3.5（实际 ${s.current_node}，HG 不推进）`);

    // ── 步骤5：resolve-hg resolve --gate HG1 → 越闸 N4 ──
    const r5 = spawnSync('node', [RHG, 'resolve', '--dag', dagCopy, '--root', stateRoot, '--gate', 'HG1'], { encoding: 'utf8' });
    assert(r5.status === 0, `步骤5 resolve-hg exit 0（实际 ${r5.status}）stderr=${(r5.stderr || '').trim().slice(0, 80)}`);
    s = readJSON(psPath(stateRoot));
    assert(s.current_node === 'N4', `步骤5 resolve-hg 后 current_node=N4（实际 ${s.current_node}）`);
    assert(s.status === 'active', `步骤5 status=active（实际 ${s.status}，HG 已解除）`);
    assert(s.gate === null, `步骤5 gate=null（实际 ${s.gate}）`);
    assert(Array.isArray(s.frontier) && s.frontier[0] === 'N5',
      `步骤5 frontier=[N5]（实际 ${JSON.stringify(s.frontier)}）`);
    let o5 = null; try { o5 = JSON.parse(r5.stdout); } catch (e) {}
    assert(o5 && o5.action === 'resolve', `步骤5 返回 action=resolve（实际 ${o5 && o5.action}）`);
    assert(o5 && o5.to === 'N4', `步骤5 返回 to=N4（实际 ${o5 && o5.to}）`);
    assert(o5 && o5.gate_cleared === 'HG1', `步骤5 返回 gate_cleared=HG1（实际 ${o5 && o5.gate_cleared}）`);

    // ── 步骤6：C1 核验（嫁接1）resolve-hg 不动 direction.json ──
    const d = readJSON(path.join(stateRoot, 'direction.json'));
    assert(d.status === 'active' && d.gate === null,
      `步骤6 C1：direction.json 仍 active/gate:null（实际 ${d.status}/${d.gate}，resolve-hg 只写 pipeline-state.json）`);

    // ── 步骤7：history 含 resolve_hg 事件（越闸留痕）──
    const rh = (Array.isArray(s.history) ? s.history : []).filter((h) => h.action === 'resolve_hg');
    assert(rh.length >= 1, `步骤7 history 含 resolve_hg 事件（实际 ${rh.length}）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 2 [反证] 非 awaiting_human 时 resolve-hg 拒绝（exit 1）──
function testResolveHgRejectsNonAwaiting() {
  console.log('\n[Test 2] 反证：非 awaiting_human（status=active）时 resolve-hg exit 1 + stderr 指认');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeN3State(stateRoot, dagCopy);  // status=active（未触发 HG）
    const r = spawnSync('node', [RHG, 'resolve', '--dag', dagCopy, '--root', stateRoot, '--gate', 'HG1'], { encoding: 'utf8' });
    assert(r.status === 1, `非 awaiting_human 时 resolve-hg exit 1（实际 ${r.status}）`);
    const err = (r.stderr || '');
    assert(/无可解除|awaiting_human/.test(err), `stderr 含 无可解除/awaiting_human（实际 "${err.trim().slice(0, 80)}"）`);
  } finally { cleanup(tmpBase); }
}

// ── 主入口 ──
testE2EPushChain();
testResolveHgRejectsNonAwaiting();

console.log(`\n${'='.repeat(60)}`);
console.log(`venture-e2e.test.js：${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
