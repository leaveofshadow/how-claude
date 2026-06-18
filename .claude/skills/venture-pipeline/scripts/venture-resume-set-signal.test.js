#!/usr/bin/env node
/**
 * venture-resume-set-signal.test.js —— M1 set-signal 子命令测试（R1.1-R1.4 + R5 + R3）
 *
 * 覆盖 70-requirements R1.1-R1.5：
 *   ① R1.1 参数解析（--edge/--signal/--artifact + 非法值/缺值 → exit 1）
 *   ② R1.3 [R5] --artifact 必填 + existsSync 校验（缺/不存在 → exit 1；存在 → exit 0）
 *   ③ R3 拒改 HG edge（awaiting_human:true 的 signal 是死字段 → exit 1）
 *   ④ R1 [核心] rehash 不清零：set-signal 前后 current_node/iteration/history/status/gate 恒等 + graph_hash 更新 + dag edge.signal 改 green
 *
 * 约束（C2）：被测 venture-resume.js 仅 fs+path+crypto（内建）+ 同 skill require。
 *            本测试用 child_process spawn 调被测脚本 + cc-runtime init-state.js 造 fixture。
 * ⚠️ PowerShell UTF-8 BOM 陷阱：fixture 用 node fs.writeFileSync(p, json, 'utf8')。
 * 反向验证（70 R1.4 验收3）：若 cmdSetSignal 改调 cmdInit → Test 8 必 FAIL（current_node 变 null + history.length 2→1）→ 证明测试有效。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const SCRIPT = path.join(SCRIPT_DIR, 'venture-resume.js');
const INIT_STATE = path.join(SCRIPT_DIR, '..', '..', 'cc-runtime', 'scripts', 'init-state.js');
const VENTURE_DAG = path.join(SCRIPT_DIR, '..', 'dag.venture.json');
// 复用 load-graph 算 dag 副本的 hash（造 graph_hash 匹配的 fixture）
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

// 造隔离临时 state 根 + dag.venture.json 副本
function makeIsolatedRoot() {
  const tmpBase = path.join(os.tmpdir(), `layer3-m1-setsig-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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

// 造一个"已推进到 N1"的 pipeline-state fixture（current_node=N1，模拟 advance 后状态）
// history 故意 2 条（init + advance），使 R1 反证链可靠：若 set-signal 误调 cmdInit 会把 history 重置为 1 条 → 长度断言 FAIL
function writeN1State(stateRoot, dagCopy) {
  writeJSON(psPath(stateRoot), {
    direction_version: 1,
    current_node: 'N1',
    frontier: ['N2'],
    iteration: 0,
    status: 'active',
    gate: null,
    graph_hash: dagHash(dagCopy),
    history: [
      { ts: '2026-06-18T00:00:00.000Z', action: 'init', to: { current_node: null } },
      { ts: '2026-06-18T00:00:01.000Z', action: 'advance', to: { current_node: 'N1' } },
    ],
  });
}

function runSetSignal(stateRoot, dagCopy, args) {
  return spawnSync('node', [SCRIPT, 'set-signal', '--dag', dagCopy, '--root', stateRoot, ...args], { encoding: 'utf8' });
}

// ── Test 1 [R1.1] set-signal --help 含 --edge/--signal/--artifact ──
function testHelp() {
  console.log('\n[Test 1] R1.1 set-signal --help → stdout 含 --edge / --signal / --artifact');
  const r = spawnSync('node', [SCRIPT, '--help'], { encoding: 'utf8' });
  assert(r.status === 0, `--help exit 0（实际 ${r.status}）`);
  assert(typeof r.stdout === 'string' && r.stdout.includes('set-signal'), 'stdout 含 set-signal 子命令');
  assert(typeof r.stdout === 'string' && r.stdout.includes('--edge'), 'stdout 含 --edge');
  assert(typeof r.stdout === 'string' && r.stdout.includes('--signal'), 'stdout 含 --signal');
  assert(typeof r.stdout === 'string' && r.stdout.includes('--artifact'), 'stdout 含 --artifact');
}

// ── Test 2 [R1.1] 缺 --signal → exit 1 ──
function testMissingSignal() {
  console.log('\n[Test 2] R1.1 缺 --signal → exit 1 + stderr 含 "缺 --signal"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const artifact = path.join(tmpBase, 'N1.md');
    fs.writeFileSync(artifact, '市场痛点测试', 'utf8');
    const r = runSetSignal(stateRoot, dagCopy, ['--edge', 'N1:N2', '--artifact', artifact]);
    assert(r.status === 1, `exit 1（实际 ${r.status}）`);
    assert(typeof r.stderr === 'string' && r.stderr.includes('缺 --signal'), `stderr 含 "缺 --signal"（实际 "${(r.stderr || '').trim().slice(0, 80)}"）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 3 [R1.1] --signal 非法值 → exit 1 ──
function testInvalidSignal() {
  console.log('\n[Test 3] R1.1 --signal 非法值（purple）→ exit 1 + stderr 含 "非法"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const artifact = path.join(tmpBase, 'N1.md');
    fs.writeFileSync(artifact, '市场痛点', 'utf8');
    const r = runSetSignal(stateRoot, dagCopy, ['--edge', 'N1:N2', '--signal', 'purple', '--artifact', artifact]);
    assert(r.status === 1, `exit 1（实际 ${r.status}）`);
    assert(typeof r.stderr === 'string' && r.stderr.includes('非法'), `stderr 含 "非法"（实际 "${(r.stderr || '').trim().slice(0, 80)}"）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 4 [R1.3 R5] 缺 --artifact → exit 1 ──
function testMissingArtifact() {
  console.log('\n[Test 4] R1.3 [R5] 缺 --artifact → exit 1 + stderr 含 "artifact"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const r = runSetSignal(stateRoot, dagCopy, ['--edge', 'N1:N2', '--signal', 'green']);
    assert(r.status === 1, `exit 1（实际 ${r.status}）`);
    assert(typeof r.stderr === 'string' && r.stderr.includes('artifact'), `stderr 含 "artifact"（实际 "${(r.stderr || '').trim().slice(0, 80)}"）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 5 [R1.3 R5] artifact 不存在 → exit 1 ──
function testArtifactNotExist() {
  console.log('\n[Test 5] R1.3 [R5] --artifact 文件不存在 → exit 1 + stderr 含 "不存在"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const r = runSetSignal(stateRoot, dagCopy, ['--edge', 'N1:N2', '--signal', 'green', '--artifact', path.join(tmpBase, 'nonexistent.md')]);
    assert(r.status === 1, `exit 1（实际 ${r.status}）`);
    assert(typeof r.stderr === 'string' && r.stderr.includes('不存在'), `stderr 含 "不存在"（实际 "${(r.stderr || '').trim().slice(0, 80)}"）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 6 [R3] 改 HG edge N3:N4 → exit 1（死字段拒绝）──
function testHGEdgeRejected() {
  console.log('\n[Test 6] R3 改 HG edge N3:N4（awaiting_human:true）→ exit 1 + stderr 含 "死字段"（signal 死字段，set-signal 只改普通段）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const artifact = path.join(tmpBase, 'N3.md');
    fs.writeFileSync(artifact, '七维评分', 'utf8');
    const r = runSetSignal(stateRoot, dagCopy, ['--edge', 'N3:N4', '--signal', 'green', '--artifact', artifact]);
    assert(r.status === 1, `exit 1（实际 ${r.status}）`);
    assert(typeof r.stderr === 'string' && r.stderr.includes('死字段'), `stderr 含 "死字段"（实际 "${(r.stderr || '').trim().slice(0, 80)}"）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 7 [R1.3 成功] artifact 存在 + N1:N2 green → exit 0 + stdout edge/signal ──
function testSuccess() {
  console.log('\n[Test 7] R1.3 成功：artifact 存在 + N1:N2 green → exit 0 + stdout 含 edge N1:N2 / signal green');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeN1State(stateRoot, dagCopy);
    const artifact = path.join(tmpBase, 'N1-机会调查.md');
    fs.writeFileSync(artifact, '市场痛点：测试用', 'utf8');
    const r = runSetSignal(stateRoot, dagCopy, ['--edge', 'N1:N2', '--signal', 'green', '--artifact', artifact]);
    assert(r.status === 0, `exit 0（实际 ${r.status}）`);
    let out = null;
    try { out = JSON.parse(r.stdout); } catch (e) {}
    assert(out !== null && out.edge === 'N1:N2', `stdout.edge=N1:N2（实际 ${out && out.edge}）`);
    assert(out !== null && out.signal === 'green', `stdout.signal=green（实际 ${out && out.signal}）`);
    assert(out !== null && out.old_signal === 'unknown', `stdout.old_signal=unknown（实际 ${out && out.old_signal}）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 8 [R1 核心] rehash 不清零：set-signal 前后 current_node/iteration/history/status/gate 恒等 + graph_hash 更新 ──
function testRehashNoReset() {
  console.log('\n[Test 8] R1 核心 rehash 不清零：N1 态 set-signal 后 current_node=N1（非 null）/iteration/history/status/gate 恒等 / graph_hash 更新');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeN1State(stateRoot, dagCopy);
    const before = readJSON(psPath(stateRoot));
    const beforeHash = before.graph_hash;

    const artifact = path.join(tmpBase, 'N1-机会调查.md');
    fs.writeFileSync(artifact, '市场痛点：R1 rehash 测试', 'utf8');
    const r = runSetSignal(stateRoot, dagCopy, ['--edge', 'N1:N2', '--signal', 'green', '--artifact', artifact]);
    assert(r.status === 0, `exit 0（实际 ${r.status}）`);

    const after = readJSON(psPath(stateRoot));

    // R1 核心断言：current_node 不被清零（若调 cmdInit 会变 null）
    assert(after.current_node === 'N1', `current_node=N1 保留（实际 ${after.current_node}，反证：cmdInit 会置 null）`);
    assert(after.current_node === before.current_node, `current_node 恒等 before/after（${before.current_node}→${after.current_node}）`);
    // 其余推进态字段恒等
    assert(after.iteration === before.iteration, `iteration 恒等（${before.iteration}→${after.iteration}）`);
    assert(Array.isArray(after.history) && Array.isArray(before.history) && after.history.length === before.history.length,
      `history.length 恒等（${before.history.length}→${after.history.length}，反证：cmdInit 会重置为 1 条 init）`);
    assert(after.status === before.status, `status 恒等（${before.status}→${after.status}）`);
    assert(after.gate === before.gate, `gate 恒等（${before.gate}→${after.gate}）`);
    // graph_hash 更新（signal 改了 → hash 变；证明 rehash 生效，非 noop）
    assert(typeof after.graph_hash === 'string' && after.graph_hash.length === 64, `graph_hash 是 sha256 64 字符（实际 len=${after.graph_hash && after.graph_hash.length}）`);
    assert(after.graph_hash !== beforeHash, `graph_hash 更新（rehash 生效，${beforeHash.slice(0, 8)}→${after.graph_hash.slice(0, 8)}）`);

    // dag 副本 N1:N2 edge.signal 真改 green
    const dagAfter = readJSON(dagCopy);
    const e = dagAfter.edges.find((x) => x.from === 'N1' && x.to === 'N2');
    assert(e && e.condition.signal === 'green', `dag N1:N2 edge.signal=green（实际 ${e && e.condition.signal}）`);
  } finally { cleanup(tmpBase); }
}

// ── 主入口 ──
testHelp();
testMissingSignal();
testInvalidSignal();
testMissingArtifact();
testArtifactNotExist();
testHGEdgeRejected();
testSuccess();
testRehashNoReset();

console.log(`\n${'='.repeat(60)}`);
console.log(`venture-resume-set-signal.test.js：${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
