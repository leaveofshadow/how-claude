#!/usr/bin/env node
/**
 * venture-resume.test.js —— M4 断点续传测试（TDD：先红后绿）
 *
 * 覆盖 R4.1-R4.2（70-requirements）：
 *   ① R4.1 正态续传：checkpoint.continue_from=node:N2,task:占位,iter:2 +
 *      pipeline-state.current_node=N2 + graph_hash 匹配 → exit 0 + resumed at N2 iter:2
 *   ② R4.1 漂移态：改 dag.json 后 graph_hash 不匹配 → exit 1 + stderr 拒绝续传
 *   ③ R4.2 trace 追加：续传成功后 trace.ndjson 最后一行含 action:resume,node:N2,iter:2,direction_version
 *
 * 续传双源（schema §4.2）：
 *   - checkpoint.continue_from（层1 续跑锚点；规范格式 node:<n>,task:<t>,iter:<i>，见 state-schema.md §70）
 *   - pipeline-state.current_node（层2 DAG 推进态；schema §4.2 明确主源）
 *
 * 约束（C2）：被测 venture-resume.js 仅 fs+path+crypto（内建）+ 同 skill/同项目 require。
 *            本测试用 child_process spawn 调被测脚本 + cc-runtime init-state.js 造 fixture。
 * ⚠️ PowerShell UTF-8 BOM 陷阱：所有 fixture 用 node fs.writeFileSync(p, json, 'utf8')。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const SCRIPT = path.join(SCRIPT_DIR, 'venture-resume.js');
const INIT_STATE = path.join(SCRIPT_DIR, '..', '..', 'cc-runtime', 'scripts', 'init-state.js');
const DAG = path.join(SCRIPT_DIR, '..', 'dag.json');
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

// 造隔离临时 state 根（init-state.js 造 direction.json + checkpoint.json + 空 trace.ndjson）
function makeIsolatedRoot() {
  const tmpBase = path.join(os.tmpdir(), `layer2-m4-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const stateRoot = path.join(tmpBase, '.venture', 'state');
  fs.mkdirSync(stateRoot, { recursive: true });

  const r = spawnSync('node', [INIT_STATE, '--root', stateRoot, '--force'], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`init-state fixture 失败：${r.stderr || r.stdout}`);
  }

  const dagCopy = path.join(tmpBase, 'dag.json');
  fs.copyFileSync(DAG, dagCopy);

  return { stateRoot, dagCopy, tmpBase };
}

function cleanup(tmpBase) {
  try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (e) {}
}

function writeJSON(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), 'utf8');
}
function readJSON(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function psPath(stateRoot) { return path.join(stateRoot, 'pipeline-state.json'); }
function checkpointPath(stateRoot) { return path.join(stateRoot, 'checkpoint.json'); }
function tracePath(stateRoot) { return path.join(stateRoot, 'trace.ndjson'); }
function tasksTreePath(stateRoot) { return path.join(stateRoot, 'tasks.tree.json'); }
function dagHash(dagCopy) {
  return computeGraphHash(JSON.parse(fs.readFileSync(dagCopy, 'utf8')));
}
function runResume(stateRoot, dagCopy) {
  return spawnSync('node', [SCRIPT, 'resume', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
}

// ── Test 1 R4.1 正态续传 ──
function testR41Resume() {
  console.log('\n[Test 1] R4.1 正态续传：current_node=N2 + continue_from=node:N2,task:占位,iter:2 → resumed at N2 iter:2');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeJSON(psPath(stateRoot), {
      direction_version: 1,
      current_node: 'N2',
      frontier: ['N3'],
      iteration: 0,
      status: 'active',
      gate: null,
      graph_hash: dagHash(dagCopy),
      history: [],
    });
    const cp = readJSON(checkpointPath(stateRoot));
    cp.continue_from = 'node:N2,task:占位,iter:2';
    writeJSON(checkpointPath(stateRoot), cp);

    const r = runResume(stateRoot, dagCopy);

    assert(r.status === 0, `exit 0（实际 ${r.status}）`);
    let out = null;
    try { out = JSON.parse(r.stdout); } catch (e) {}
    assert(out !== null && out.node === 'N2', `恢复到 N2（stdout.node=${out && out.node}）`);
    assert(out !== null && out.iter === 2, `iter=2（stdout.iter=${out && out.iter}）`);
    assert(out !== null && typeof out.message === 'string' && out.message.includes('resumed at N2 iter:2'),
      `message 含 "resumed at N2 iter:2"（实际 "${out && out.message}"）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── Test 2 R4.1 漂移态：改 dag.json → graph_hash 不匹配 → exit 1 ──
function testR41Drift() {
  console.log('\n[Test 2] R4.1 漂移态：改 dag.json 后 graph_hash 不匹配 → exit 1 + stderr 拒绝续传');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeJSON(psPath(stateRoot), {
      direction_version: 1,
      current_node: 'N2',
      frontier: ['N3'],
      iteration: 0,
      status: 'active',
      gate: null,
      graph_hash: dagHash(dagCopy),
      history: [],
    });
    const cp = readJSON(checkpointPath(stateRoot));
    cp.continue_from = 'node:N2,task:占位,iter:2';
    writeJSON(checkpointPath(stateRoot), cp);

    // 改 dag 副本（加节点 N4 + edge），hash 漂移
    const dagObj = readJSON(dagCopy);
    dagObj.nodes.push({ id: 'N4', type: 'task', skill: 'placeholder', exit_condition: 'N4 占位漂移' });
    dagObj.edges.push({ from: 'N3', to: 'N4', condition: { signal: 'green', awaiting_human: false } });
    writeJSON(dagCopy, dagObj);

    const r = runResume(stateRoot, dagCopy);

    assert(r.status === 1, `exit 1（实际 ${r.status}）`);
    assert(typeof r.stderr === 'string' && r.stderr.includes('graph_hash 不匹配') && r.stderr.includes('拒绝续传'),
      `stderr 含 "graph_hash 不匹配"+"拒绝续传"（实际 "${(r.stderr || '').trim().slice(0, 120)}"）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── Test 3 R4.2 trace.ndjson 追加 resume 事件 ──
function testR42Trace() {
  console.log('\n[Test 3] R4.2 续传成功后 trace.ndjson 最后一行含 action:resume,node:N2,iter:2,direction_version');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    writeJSON(psPath(stateRoot), {
      direction_version: 1,
      current_node: 'N2',
      frontier: ['N3'],
      iteration: 0,
      status: 'active',
      gate: null,
      graph_hash: dagHash(dagCopy),
      history: [],
    });
    const cp = readJSON(checkpointPath(stateRoot));
    cp.continue_from = 'node:N2,task:占位,iter:2';
    writeJSON(checkpointPath(stateRoot), cp);

    const r = runResume(stateRoot, dagCopy);
    assert(r.status === 0, `续传 exit 0 前置（实际 ${r.status}）`);

    const traceRaw = fs.readFileSync(tracePath(stateRoot), 'utf8').trim();
    const lines = traceRaw.split(/\r?\n/).filter((l) => l.length > 0);
    assert(lines.length > 0, `trace.ndjson 至少一行（实际 ${lines.length} 行）`);
    let last = null;
    try { last = JSON.parse(lines[lines.length - 1]); } catch (e) {}
    assert(last !== null && last.action === 'resume', `action=resume（实际 ${last && last.action}）`);
    assert(last !== null && last.node === 'N2', `node=N2（实际 ${last && last.node}）`);
    assert(last !== null && last.iter === 2, `iter=2（实际 ${last && last.iter}）`);
    assert(last !== null && last.direction_version === 1, `direction_version=1（实际 ${last && last.direction_version}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── Test 4 R5.1 部门 plan 中间态断点续传（[B-6] 修复）──
// [B-6] 语义：部门工作（决策部 N3 plan）进行到中间态时——trace 已记录 reasoning、tasks.tree 有 in_progress 任务、
// checkpoint 锚定 node:N3 iter:2、pipeline-state.current_node=N3——resume 后所有中间态原封保留，不静默丢。
// venture-resume 是只读恢复 + 追加 resume trace（C1 不碰 tasks.tree/direction.json），故测其「非破坏性」：
//   闸① exit 0 + message resumed at N3 iter:2（恢复点正确）
//   闸② trace 末行 = resume 事件（node:N3 action:resume iter:2 direction_version:1）
//   闸③ trace 中间态 reasoning 行保留（部门 plan 中间态不被 resume 清除）
//   闸④ tasks.tree.json in_progress 任务保留（resume 不碰 tasks.tree，部门中间态产物不丢）
function testDepartmentMidStateResume() {
  console.log('\n[Test 4] R5.1 部门 plan 中间态断点续传：决策部 N3 iter:2 plan 进行中 → resume → 中间态全部保留（trace reasoning + tasks in_progress + node 位置）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // pipeline-state：current_node=N3（决策部 plan 节点），direction_version=1，graph_hash 匹配
    writeJSON(psPath(stateRoot), {
      direction_version: 1,
      current_node: 'N3',
      frontier: ['N4'],
      iteration: 2,
      status: 'active',
      gate: null,
      graph_hash: dagHash(dagCopy),
      history: [],
    });
    // checkpoint：continue_from 锚定 N3 iter:2（决策部 plan 中间态续跑锚点）
    const cp = readJSON(checkpointPath(stateRoot));
    cp.continue_from = 'node:N3,task:决策部plan,iter:2';
    writeJSON(checkpointPath(stateRoot), cp);

    // trace：先追加一行部门 plan reasoning 中间态（resume 前部门工作已产生的中间态记录）
    fs.appendFileSync(tracePath(stateRoot),
      JSON.stringify({
        ts: '2026-06-18T00:00:00.000Z',
        action: 'reasoning',
        node: 'N3',
        iter: 2,
        step_index: 1,
        direction_version: 1,
        tool: 'Think',
        learnings: ['部门 plan 中间态：方案 α 草拟中'],
        progressHash: 'mid-state-hash',
        progress_delta: 5,
        tokensUsed: 1000,
      }) + '\n', 'utf8');

    // tasks.tree：塞一个 in_progress 任务（决策部 plan 中间态产物，resume 前已存在）
    const tasksTree = readJSON(tasksTreePath(stateRoot));
    tasksTree.tasks.push({
      id: 'T1',
      title: '决策部 plan 草拟方案 α',
      status: 'in_progress',
      direction_version: 1,
    });
    writeJSON(tasksTreePath(stateRoot), tasksTree);

    const r = runResume(stateRoot, dagCopy);

    // 闸① exit 0（恢复成功）
    assert(r.status === 0, `exit 0（实际 ${r.status}）`);
    // 闸② message 含 resumed at N3 iter:2
    let out = null;
    try { out = JSON.parse(r.stdout); } catch (e) {}
    assert(out !== null && typeof out.message === 'string' && out.message.includes('resumed at N3 iter:2'),
      `message 含 "resumed at N3 iter:2"（实际 "${out && out.message}"）`);

    // 闸③ trace 末行 = resume 事件（node:N3 iter:2 direction_version:1）
    const traceRaw = fs.readFileSync(tracePath(stateRoot), 'utf8').trim();
    const lines = traceRaw.split(/\r?\n/).filter((l) => l.length > 0);
    assert(lines.length >= 2, `trace 至少 2 行（reasoning 中间态 + resume），实际 ${lines.length} 行`);
    let last = null;
    try { last = JSON.parse(lines[lines.length - 1]); } catch (e) {}
    assert(last !== null && last.action === 'resume' && last.node === 'N3' && last.iter === 2 && last.direction_version === 1,
      `trace 末行 resume 事件 node:N3 iter:2 direction_version:1（实际 ${last && last.action}/${last && last.node}/${last && last.iter}/${last && last.direction_version}）`);

    // 闸④ trace 中间态 reasoning 行保留（[B-6] resume 非破坏，不静默丢部门 plan 中间态）
    const hasMidState = lines.some((l) => {
      try {
        const o = JSON.parse(l);
        return o.action === 'reasoning' && o.node === 'N3' && o.iter === 2;
      } catch (e) { return false; }
    });
    assert(hasMidState, `trace 保留部门 plan 中间态 reasoning 行（N3 iter:2 方案 α 草拟中，[B-6] resume 非破坏）`);

    // 闸⑤ tasks.tree.json in_progress 任务保留（resume 不碰 tasks.tree，部门中间态产物不丢）
    const tasksAfter = readJSON(tasksTreePath(stateRoot));
    const hasInProgress = tasksAfter.tasks.some((t) => t.status === 'in_progress');
    assert(hasInProgress, `tasks.tree.json in_progress 任务保留（resume 不碰 tasks.tree，[B-6] 部门中间态产物不丢）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 主入口 ──
testR41Resume();
testR41Drift();
testR42Trace();
testDepartmentMidStateResume();

console.log(`\n${'='.repeat(60)}`);
console.log(`venture-resume.test.js：${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
