#!/usr/bin/env node
/**
 * pipeline-state.test.js —— M1 集成测试（TDD：先红后绿）
 *
 * 覆盖 R1.5 四场景：
 *   ① init：生成 pipeline-state.json，status=active/gate=null/graph_hash 64 位
 *   ② set-hg：status=awaiting_human/gate=HG1
 *   ③ verify：匹配态 exit0 + 「graph_hash 匹配」；漂移态 exit1 + 「graph_hash 不匹配」
 *   ④ C1 核验：set-hg 后 direction.json 仍 status=active/gate:null（嫁接1 不可破）
 *
 * 约束（C2）：被测脚本 pipeline-state.js 本体仅 fs+path+crypto（内建）+ 同 skill/同项目 require。
 *            本测试用 child_process spawn 调被测脚本，并先用 cc-runtime init-state.js 造 direction.json fixture。
 * ⚠️ PowerShell UTF-8 BOM 陷阱：所有 fixture 用 node fs.writeFileSync(p, json, 'utf8')（无 BOM），
 *    勿用 PowerShell Out-File（写 BOM 致 node JSON.parse 失败）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const SCRIPT = path.join(SCRIPT_DIR, 'pipeline-state.js');
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
// 返回 { stateRoot, dagCopy }：stateRoot 是临时 .venture/state，dagCopy 是临时 dag.json 副本
function makeIsolatedRoot() {
  const tmpBase = path.join(os.tmpdir(), `layer2-m1-test-${process.pid}-${Date.now()}`);
  const stateRoot = path.join(tmpBase, '.venture', 'state');
  fs.mkdirSync(stateRoot, { recursive: true });

  // 用 cc-runtime init-state.js 造 direction.json fixture（含正确 status:active/gate:null）
  const r = spawnSync('node', [INIT_STATE, '--root', stateRoot, '--force'], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`init-state fixture 失败：${r.stderr || r.stdout}`);
  }

  // dag.json 副本到临时区（漂移测试要改它，不能污染原 dag.json）
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

// ── 测试①：init ──
function testInit() {
  console.log('\n[Test 1] init → pipeline-state.json status=active/gate=null/graph_hash 64 位');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const r = spawnSync('node', [SCRIPT, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    assert(r.status === 0, `init exit 0（实际 ${r.status}；stderr=${JSON.stringify(r.stderr)}）`);

    const fp = path.join(stateRoot, 'pipeline-state.json');
    assert(fs.existsSync(fp), `pipeline-state.json 已生成（${fp}）`);

    const s = readJSON(fp);
    assert(s.status === 'active', `status=active（实际 ${s.status}）`);
    assert(s.gate === null, `gate=null（实际 ${s.gate}）`);
    assert(typeof s.graph_hash === 'string' && s.graph_hash.length === 64,
      `graph_hash 64 位 sha256（实际 ${typeof s.graph_hash} / len=${s.graph_hash ? s.graph_hash.length : 0}）`);
    assert(Array.isArray(s.history) && s.history.length === 1 && s.history[0].action === 'init',
      `history[0].action=init（实际 ${JSON.stringify(s.history && s.history[0])}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试②：set-hg ──
function testSetHg() {
  console.log('\n[Test 2] set-hg --gate HG1 → status=awaiting_human/gate=HG1');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [SCRIPT, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    const r = spawnSync('node', [SCRIPT, 'set-hg', '--gate', 'HG1', '--root', stateRoot], { encoding: 'utf8' });
    assert(r.status === 0, `set-hg exit 0（实际 ${r.status}；stderr=${JSON.stringify(r.stderr)}）`);

    const s = readJSON(path.join(stateRoot, 'pipeline-state.json'));
    assert(s.status === 'awaiting_human', `status=awaiting_human（实际 ${s.status}）`);
    assert(s.gate === 'HG1', `gate=HG1（实际 ${s.gate}）`);
    assert(Array.isArray(s.history) && s.history.length === 2,
      `history 追加 set_hg 事件（length=${s.history ? s.history.length : 0}，期望 2）`);
    assert(s.history[1].action === 'set_hg', `history[1].action=set_hg（实际 ${s.history[1] && s.history[1].action}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试③：verify（匹配态 + 漂移态）──
function testVerify() {
  console.log('\n[Test 3] verify 匹配态 exit0 + 漂移态 exit1');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [SCRIPT, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });

    // 匹配态：dag.json 未变，verify 应 exit0 + 「graph_hash 匹配」
    const rMatch = spawnSync('node', [SCRIPT, 'verify', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    assert(rMatch.status === 0, `匹配态 exit 0（实际 ${rMatch.status}）`);
    assert(/graph_hash 匹配/.test(rMatch.stdout),
      `匹配态 stdout 含「graph_hash 匹配」（实际 stdout=${JSON.stringify(rMatch.stdout)}）`);

    // 漂移态：改 dag.json（加一节点）后 verify 应 exit1 + stderr「graph_hash 不匹配：dag=<新> state=<旧>」
    const dagObj = readJSON(dagCopy);
    dagObj.nodes.push({ id: 'N9', type: 'task', skill: 'placeholder', exit_condition: '漂移测试节点' });
    // ⚠️ 用 node fs.writeFileSync 写（无 BOM），勿用 PowerShell Out-File
    fs.writeFileSync(dagCopy, JSON.stringify(dagObj, null, 2), 'utf8');

    const rDrift = spawnSync('node', [SCRIPT, 'verify', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    assert(rDrift.status === 1, `漂移态 exit 1（实际 ${rDrift.status}）`);
    assert(/graph_hash 不匹配：dag=[0-9a-f]+ state=[0-9a-f]+/.test(rDrift.stderr),
      `漂移态 stderr 含「graph_hash 不匹配：dag=<新> state=<旧>」（实际 stderr=${JSON.stringify(rDrift.stderr)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试④：C1 核验（set-hg 后 direction.json 不动）──
function testC1DirectionUnchanged() {
  console.log('\n[Test 4] C1 核验：set-hg 后 direction.json 仍 status=active/gate:null（嫁接1）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [SCRIPT, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });

    // 先读 direction.json 基线（init-state fixture 造的）
    const dirBefore = readJSON(path.join(stateRoot, 'direction.json'));
    assert(dirBefore.status === 'active', `direction.json init 后 status=active（实际 ${dirBefore.status}）`);
    assert(dirBefore.gate === null, `direction.json init 后 gate=null（实际 ${dirBefore.gate}）`);

    // set-hg（嫁接1 核验点：此命令不应触碰 direction.json）
    spawnSync('node', [SCRIPT, 'set-hg', '--gate', 'HG1', '--root', stateRoot], { encoding: 'utf8' });

    const dirAfter = readJSON(path.join(stateRoot, 'direction.json'));
    assert(dirAfter.status === 'active',
      `C1：set-hg 后 direction.json status 仍=active（实际 ${dirAfter.status}，嫁接1 不可破）`);
    assert(dirAfter.gate === null,
      `C1：set-hg 后 direction.json gate 仍=null（实际 ${dirAfter.gate}，嫁接1 不可破）`);
    assert(dirAfter.current_version === dirBefore.current_version,
      `C1：direction.json.current_version 未变（${dirBefore.current_version}→${dirAfter.current_version}）`);
    assert(dirAfter.set_at === dirBefore.set_at,
      `C1：direction.json.set_at 未变（时间戳一致=未被重写）`);

    // 对照：pipeline-state.json 应已变（证明 set-hg 写对了文件）
    const ps = readJSON(path.join(stateRoot, 'pipeline-state.json'));
    assert(ps.status === 'awaiting_human' && ps.gate === 'HG1',
      `对照：pipeline-state.json 已变为 awaiting_human/HG1（实际 ${ps.status}/${ps.gate}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 运行 ──
testInit();
testSetHg();
testVerify();
testC1DirectionUnchanged();

console.log(`\n==== ${passed} passing, ${failed} failing ====`);
process.exit(failed === 0 ? 0 : 1);
