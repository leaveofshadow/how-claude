#!/usr/bin/env node
/**
 * venture-resume-orchestrate.test.js —— M2 orchestrate 子命令测试（R2.1-R2.2）
 *
 * 覆盖 70-requirements R2.1-R2.2：
 *   ① R2.1-验证1 orchestrate --help 含 --dag/--root（子命令注册）
 *   ② R2.1-验证2 N1 指令卡四串：当前节点：N1 / skill: venture-judge / 入口: /judge /
 *      set-signal --edge N1:N2 --signal green --artifact .venture/artifacts/N1-机会调查.md
 *   ③ R2.1-验证3 orchestrate 后 state 目录无新增文件（纯 stdout，不写文件——C1 写者隔离：orchestrate 非写者）
 *   ④ R2.1-验证4 grep venture-resume.js 全文件无 child_process/spawn/exec/vm/eval（C2 纯 Node，不 spawn skill）
 *   ⑤ R2.1-验证5 dag 漂移态（graph_hash 不匹配）orchestrate 不 exit 1（跳过 hash 比对——提示非续传）
 *   ⑥ R2.2 占位节点（N4 skill=placeholder）→ 占位提示"占位"+"最小闭环验证到此为止"
 *   ⑦ R2.1 HG 出边（N3→N4 awaiting_human:true gate=HG1）→ 提示 resolve-hg（不 set-signal，R3 死字段语义）
 *
 * 约束（C2）：被测 venture-resume.js 仅 fs+path+crypto（内建）+ 同 skill require。
 *            本测试用 child_process spawn 调被测脚本 + cc-runtime init-state.js 造 fixture。
 * ⚠️ PowerShell UTF-8 BOM 陷阱：fixture 用 node fs.writeFileSync(p, json, 'utf8')。
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
  const tmpBase = path.join(os.tmpdir(), `layer3-m2-orch-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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

// 造"已推进到 currentNode"的 pipeline-state fixture（模拟 advance 后状态）
function writeState(stateRoot, dagCopy, currentNode) {
  writeJSON(psPath(stateRoot), {
    direction_version: 1,
    current_node: currentNode,
    frontier: [],
    iteration: 0,
    status: 'active',
    gate: null,
    graph_hash: dagHash(dagCopy),
    history: [
      { ts: '2026-06-18T00:00:00.000Z', action: 'init', to: { current_node: null } },
      { ts: '2026-06-18T00:00:01.000Z', action: 'advance', to: { current_node: currentNode } },
    ],
  });
}

function runOrchestrate(stateRoot, dagCopy) {
  return spawnSync('node', [SCRIPT, 'orchestrate', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
}

// 递归列目录文件（快照对比，验"不写文件"）
function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out.sort();
}

// ── Test 1 [R2.1-验证1] orchestrate --help 含 orchestrate / --dag / --root ──
function testHelp() {
  console.log('\n[Test 1] R2.1-验证1 orchestrate --help → stdout 含 orchestrate / --dag / --root');
  const r = spawnSync('node', [SCRIPT, '--help'], { encoding: 'utf8' });
  assert(r.status === 0, `--help exit 0（实际 ${r.status}）`);
  assert(typeof r.stdout === 'string' && r.stdout.includes('orchestrate'), 'stdout 含 orchestrate 子命令');
  assert(typeof r.stdout === 'string' && r.stdout.includes('--dag'), 'stdout 含 --dag');
  assert(typeof r.stdout === 'string' && r.stdout.includes('--root'), 'stdout 含 --root');
}

// ── Test 2 [R2.1-验证2 核心] N1 指令卡四串 ──
function testN1InstructionCard() {
  console.log('\n[Test 2] R2.1-验证2 N1 指令卡四串：当前节点：N1 / skill: venture-judge / 入口: /judge / set-signal ... N1-机会调查.md');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeState(stateRoot, dagCopy, 'N1');
    const r = runOrchestrate(stateRoot, dagCopy);
    assert(r.status === 0, `orchestrate exit 0（实际 ${r.status}，stderr=${(r.stderr || '').trim().slice(0, 80)}）`);
    const out = r.stdout || '';
    assert(out.includes('当前节点：N1'), `stdout 含 "当前节点：N1"`);
    assert(out.includes('skill: venture-judge'), `stdout 含 "skill: venture-judge"`);
    assert(out.includes('入口: /judge'), `stdout 含 "入口: /judge"（从 exit_condition 正则提取 "venture-judge /judge"）`);
    assert(out.includes('set-signal --edge N1:N2 --signal green --artifact .venture/artifacts/N1-机会调查.md'),
      `stdout 含 set-signal --edge N1:N2 --signal green --artifact .venture/artifacts/N1-机会调查.md（逐字命令）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 3 [R2.1-验证3] orchestrate 不写文件（C1 写者隔离：非写者）──
function testNoFileWrite() {
  console.log('\n[Test 3] R2.1-验证3 orchestrate 后 state 目录文件列表恒等（纯 stdout，不写文件）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeState(stateRoot, dagCopy, 'N1');
    const before = listFiles(stateRoot);
    const r = runOrchestrate(stateRoot, dagCopy);
    assert(r.status === 0, `orchestrate exit 0（实际 ${r.status}）`);
    const after = listFiles(stateRoot);
    assert(JSON.stringify(before) === JSON.stringify(after),
      `state 目录文件列表恒等（前 ${before.length} 个 → 后 ${after.length} 个）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 4 [R2.1-验证4] C2 全文件无 spawn/exec/vm/eval ──
function testNoSpawn() {
  console.log('\n[Test 4] R2.1-验证4 C2：venture-resume.js 全文件无 child_process/spawn/exec/vm/eval（orchestrate 不 spawn skill）');
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const matches = src.match(/child_process|spawnSync|spawn\s*\(|exec\s*\(|execSync|require\(['"]vm['"]\)|new\s+Function\s*\(|require\(['"]eval['"]\)/g);
  assert(matches === null, `全文件无 spawn/exec/vm/eval（实际匹配：${matches ? matches.join(', ') : '无'}）`);
}

// ── Test 5 [R2.1-验证5] dag 漂移态 orchestrate 不 exit 1（跳过 hash 比对）──
function testHashDriftTolerant() {
  console.log('\n[Test 5] R2.1-验证5 dag 漂移（graph_hash 不匹配）orchestrate 不 exit 1 + 仍输出 N1 指令卡');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeState(stateRoot, dagCopy, 'N1');
    // 手改 dag 副本加节点 N9（dag 实际 hash 变，state.graph_hash 仍是旧的 → 漂移态）
    const dagObj = readJSON(dagCopy);
    dagObj.nodes.push({ id: 'N9', type: 'task', skill: 'placeholder', exit_condition: '漂移探测节点' });
    writeJSON(dagCopy, dagObj);
    const r = runOrchestrate(stateRoot, dagCopy);
    assert(r.status === 0, `漂移态 orchestrate exit 0（实际 ${r.status}，反证：cmdResume 因 hash 漂移会 exit 1，orchestrate 不校验）`);
    assert((r.stdout || '').includes('当前节点：N1'), `漂移态仍输出 "当前节点：N1"`);
  } finally { cleanup(tmpBase); }
}

// ── Test 6 [R2.2] 占位节点 N4 → 占位提示 ──
function testPlaceholderN4() {
  console.log('\n[Test 6] R2.2 占位节点 N4（skill=placeholder）→ stdout 含 "占位" + "最小闭环验证到此为止"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeState(stateRoot, dagCopy, 'N4');
    const r = runOrchestrate(stateRoot, dagCopy);
    assert(r.status === 0, `orchestrate exit 0（实际 ${r.status}）`);
    const out = r.stdout || '';
    assert(out.includes('占位'), `stdout 含 "占位"`);
    assert(out.includes('最小闭环验证到此为止'), `stdout 含 "最小闭环验证到此为止"`);
    // 占位分支不该输出激活 skill 指令（无 set-signal 提示）
    assert(!out.includes('set-signal'), `占位分支不含 set-signal 激活指令（占位不装配业务）`);
  } finally { cleanup(tmpBase); }
}

// ── Test 7 [R2.1 HG 分支] N3 HG 出边 → resolve-hg 提示（不 set-signal）──
function testHGEdgeN3() {
  console.log('\n[Test 7] R2.1 HG 分支：N3→N4（awaiting_human:true gate=HG1）→ stdout 含 resolve-hg + HG1（不 set-signal）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeState(stateRoot, dagCopy, 'N3');
    const r = runOrchestrate(stateRoot, dagCopy);
    assert(r.status === 0, `orchestrate exit 0（实际 ${r.status}）`);
    const out = r.stdout || '';
    assert(out.includes('resolve-hg'), `stdout 含 "resolve-hg"（HG 越闸靠 resolve-hg，非 set-signal）`);
    assert(out.includes('HG1'), `stdout 含 "HG1"（gate 名）`);
    assert(out.includes('当前节点：N3'), `stdout 含 "当前节点：N3"`);
    // HG 出边分支不该提示 set-signal N3:N4（signal 是死字段）
    assert(!out.includes('set-signal --edge N3:N4'), `HG 分支不含 "set-signal --edge N3:N4"（HG edge signal 死字段，R3）`);
  } finally { cleanup(tmpBase); }
}

// ── 主入口 ──
testHelp();
testN1InstructionCard();
testNoFileWrite();
testNoSpawn();
testHashDriftTolerant();
testPlaceholderN4();
testHGEdgeN3();

console.log(`\n${'='.repeat(60)}`);
console.log(`venture-resume-orchestrate.test.js：${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
