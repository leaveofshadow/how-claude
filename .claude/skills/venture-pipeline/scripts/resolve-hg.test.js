#!/usr/bin/env node
/**
 * resolve-hg.test.js —— M3 集成测试（TDD：先红后绿）
 *
 * 覆盖 R3.1 六场景：
 *   ① awaiting_human 状态 → resolve 推进 current_node、status=active、gate=null、history 含 resolve_hg
 *   ② 非 awaiting_human（active）状态 → resolve 抛错"无可解除的 HG"
 *   ③ 无 pipeline-state.json → resolve 抛错"不存在"
 *   ④ current_node 无 out-edge → resolve 抛错"无 out-edge"
 *   ⑤ --gate 不匹配 → 抛错"gate 不匹配"
 *   ⑥ C1 核验：临时 state 目录同时放 direction.json，resolve 后 direction.json 内容未变（证明 resolve-hg 不写 direction.json）
 *
 * 约束（C2）：被测脚本 resolve-hg.js 仅 fs+path（内建）+ 同 skill/同项目 require。
 *            本测试用 child_process spawn 调被测脚本，并先用 cc-runtime init-state.js 造 direction.json fixture。
 * ⚠️ PowerShell UTF-8 BOM 陷阱：所有 fixture 用 node fs.writeFileSync(p, json, 'utf8')（无 BOM），
 *    勿用 PowerShell Out-File（写 BOM 致 node JSON.parse 失败）。
 * ⚠️ C1 核验读 direction.json 用 node fs 读（readJSON helper），勿用 PowerShell ConvertFrom-Json（中文 set_reason 乱码）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const SCRIPT = path.join(SCRIPT_DIR, 'resolve-hg.js');
const PIPELINE_STATE = path.join(SCRIPT_DIR, 'pipeline-state.js');
const INIT_STATE = path.join(SCRIPT_DIR, '..', '..', 'cc-runtime', 'scripts', 'init-state.js');
const DAG = path.join(SCRIPT_DIR, '..', 'dag.json');

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

// 造隔离的临时 state 根（含 direction.json fixture，供 C1 核验）
// 返回 { stateRoot, dagCopy, tmpBase }：dagCopy 是临时 dag.json 副本（mock 测试改它，不污染真实 dag.json）
function makeIsolatedRoot() {
  const tmpBase = path.join(os.tmpdir(), `layer2-m3-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const stateRoot = path.join(tmpBase, '.venture', 'state');
  fs.mkdirSync(stateRoot, { recursive: true });

  // 用 cc-runtime init-state.js 造 direction.json fixture（含正确 status:active/gate:null）
  const r = spawnSync('node', [INIT_STATE, '--root', stateRoot, '--force'], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`init-state fixture 失败：${r.stderr || r.stdout}`);
  }

  // dag.json 副本到临时区（mock 测试要改它，不能污染原 dag.json）
  const dagCopy = path.join(tmpBase, 'dag.json');
  fs.copyFileSync(DAG, dagCopy);

  return { stateRoot, dagCopy, tmpBase };
}

function cleanup(tmpBase) {
  try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (e) {}
}

function readJSON(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// 写 JSON fixture（无 BOM，⚠️ 勿用 PowerShell Out-File）
function writeJSON(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), 'utf8');
}

// 调被测脚本 resolve
function runResolve(stateRoot, dagCopy, extraArgs) {
  const args = [SCRIPT, 'resolve', '--dag', dagCopy, '--root', stateRoot];
  if (extraArgs) args.push(...extraArgs);
  return spawnSync('node', args, { encoding: 'utf8' });
}

// pipeline-state.json 路径
function psPath(stateRoot) {
  return path.join(stateRoot, 'pipeline-state.json');
}

// direction.json 路径
function dirPath(stateRoot) {
  return path.join(stateRoot, 'direction.json');
}

// ── 测试① awaiting_human → resolve 推进 + 解除 HG + history 含 resolve_hg ──
function testResolveAdvance() {
  console.log('\n[Test 1] awaiting_human → resolve 推进 current_node、status=active、gate=null、history 含 resolve_hg');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 用默认 dag（N2→N3 是 awaiting_human:true, gate:HG1）
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    // advance 到 N1（enter）
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    // advance N1→N2（green 流转）
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    // advance N2→N3（awaiting_human 触发 HG1，current_node 停在 N2）
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });

    // 前置确认：已 awaiting_human
    let s = readJSON(psPath(stateRoot));
    assert(s.status === 'awaiting_human', `前置：status=awaiting_human（实际 ${s.status}）`);
    assert(s.gate === 'HG1', `前置：gate=HG1（实际 ${s.gate}）`);
    assert(s.current_node === 'N2', `前置：current_node=N2（实际 ${s.current_node}）`);

    // resolve：解除 HG1 并推进 N2→N3
    const r = runResolve(stateRoot, dagCopy);
    assert(r.status === 0, `resolve exit 0（实际 ${r.status}；stderr=${JSON.stringify(r.stderr)}）`);

    s = readJSON(psPath(stateRoot));
    assert(s.current_node === 'N3', `resolve 后 current_node=N3（实际 ${s.current_node}，推进越过 awaiting_human edge）`);
    assert(s.status === 'active', `resolve 后 status=active（实际 ${s.status}，HG 已解除）`);
    assert(s.gate === null, `resolve 后 gate=null（实际 ${s.gate}）`);

    // history 含 resolve_hg 事件
    const resolveEvents = s.history.filter((h) => h.action === 'resolve_hg');
    assert(resolveEvents.length >= 1, `history 含 ≥1 条 resolve_hg 事件（实际 ${resolveEvents.length}）`);
    const last = resolveEvents[resolveEvents.length - 1];
    assert(/N2→N3/.test(last.reason),
      `resolve_hg 事件 reason 含 N2→N3（实际 ${JSON.stringify(last.reason)}）`);

    // 返回值校验
    const rObj = JSON.parse(r.stdout);
    assert(rObj.action === 'resolve', `返回 action=resolve（实际 ${rObj.action}）`);
    assert(rObj.from === 'N2' && rObj.to === 'N3', `返回 from=N2 to=N3（实际 ${rObj.from}→${rObj.to}）`);
    assert(rObj.gate_cleared === 'HG1', `返回 gate_cleared=HG1（实际 ${rObj.gate_cleared}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试② 非 awaiting_human（active）→ 抛错"无可解除的 HG" ──
function testNotAwaiting() {
  console.log('\n[Test 2] 非 awaiting_human（active）状态 → resolve 抛错"无可解除的 HG"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    // init 后 status=active，未触发 HG
    const r = runResolve(stateRoot, dagCopy);
    assert(r.status !== 0, `resolve 非 0 退出（实际 ${r.status}，active 不可 resolve）`);
    assert(/无可解除的 HG/.test(r.stderr),
      `stderr 含"无可解除的 HG"（实际 ${JSON.stringify(r.stderr)}）`);
    assert(/active/.test(r.stderr),
      `stderr 含当前 status=active（实际 ${JSON.stringify(r.stderr)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试③ 无 pipeline-state.json → 抛错"不存在" ──
function testNoState() {
  console.log('\n[Test 3] 无 pipeline-state.json → resolve 抛错"不存在"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 不 init pipeline-state（只造了 direction.json fixture）
    const r = runResolve(stateRoot, dagCopy);
    assert(r.status !== 0, `resolve 非 0 退出（实际 ${r.status}）`);
    assert(/不存在/.test(r.stderr),
      `stderr 含"不存在"（实际 ${JSON.stringify(r.stderr)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试④ current_node 无 out-edge → 抛错"无 out-edge" ──
function testNoOutEdge() {
  console.log('\n[Test 4] current_node 无 out-edge → resolve 抛错"无 out-edge"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 构造专属 dag：单节点 N1 无 out-edge，但先 set-hg 让 status=awaiting_human
    const dagObj = {
      version: 1,
      nodes: [{ id: 'N1', type: 'task', skill: 'placeholder', exit_condition: 'N1' }],
      edges: [],
      loop_backs: [],
    };
    writeJSON(dagCopy, dagObj);
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    // 手动 advance 到 N1（enter，current_node=N1，无 out-edge）
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    // 手动 set-hg 模拟 awaiting_human（current_node=N1 无 out-edge 但 status=awaiting_human）
    spawnSync('node', [PIPELINE_STATE, 'set-hg', '--gate', 'HG1', '--root', stateRoot], { encoding: 'utf8' });

    const r = runResolve(stateRoot, dagCopy);
    assert(r.status !== 0, `resolve 非 0 退出（实际 ${r.status}）`);
    assert(/无 out-edge/.test(r.stderr),
      `stderr 含"无 out-edge"（实际 ${JSON.stringify(r.stderr)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑤ --gate 不匹配 → 抛错"gate 不匹配" ──
function testGateMismatch() {
  console.log('\n[Test 5] --gate 不匹配 → resolve 抛错"gate 不匹配"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    // 已 awaiting_human, gate=HG1
    const r = runResolve(stateRoot, dagCopy, ['--gate', 'HG2']);
    assert(r.status !== 0, `resolve 非 0 退出（实际 ${r.status}）`);
    assert(/gate 不匹配/.test(r.stderr),
      `stderr 含"gate 不匹配"（实际 ${JSON.stringify(r.stderr)}）`);
    assert(/HG1/.test(r.stderr) && /HG2/.test(r.stderr),
      `stderr 同时含当前 gate HG1 与传入 HG2（实际 ${JSON.stringify(r.stderr)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑥ C1 核验：resolve 后 direction.json 内容未变 ──
function testC1Direction() {
  console.log('\n[Test 6] C1 核验：resolve 后 direction.json 内容未变（resolve-hg 不写 direction.json）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    spawnSync('node', [path.join(SCRIPT_DIR, 'advance-node.js'), 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });

    // resolve 前 direction.json 全量快照
    const dirBefore = readJSON(dirPath(stateRoot));
    const dirBeforeRaw = fs.readFileSync(dirPath(stateRoot), 'utf8');

    runResolve(stateRoot, dagCopy);

    // resolve 后 direction.json 内容（字节级比对，证明未被重写）
    const dirAfterRaw = fs.readFileSync(dirPath(stateRoot), 'utf8');
    const dirAfter = readJSON(dirPath(stateRoot));
    assert(dirAfterRaw === dirBeforeRaw,
      `C1：direction.json 原始字节未变（resolve-hg 绝不写 direction.json）`);
    assert(dirAfter.status === 'active',
      `C1：direction.json status 仍=active（实际 ${dirAfter.status}）`);
    assert(dirAfter.gate === null,
      `C1：direction.json gate 仍=null（实际 ${dirAfter.gate}）`);
    assert(dirAfter.current_version === dirBefore.current_version,
      `C1：direction.json.current_version 未变（${dirBefore.current_version}→${dirAfter.current_version}）`);
    assert(dirAfter.set_at === dirBefore.set_at,
      `C1：direction.json.set_at 未变（时间戳一致=未被重写）`);

    // 对照：pipeline-state.json 应已 active（HG 已解除）
    const ps = readJSON(psPath(stateRoot));
    assert(ps.status === 'active' && ps.gate === null,
      `对照：pipeline-state.json 已 active/gate=null（实际 ${ps.status}/${ps.gate}）`);
    assert(ps.current_node === 'N3',
      `对照：pipeline-state.json current_node=N3（实际 ${ps.current_node}，已推进）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 运行 ──
testResolveAdvance();
testNotAwaiting();
testNoState();
testNoOutEdge();
testGateMismatch();
testC1Direction();

console.log(`\n==== ${passed} passing, ${failed} failing ====`);
process.exit(failed === 0 ? 0 : 1);
