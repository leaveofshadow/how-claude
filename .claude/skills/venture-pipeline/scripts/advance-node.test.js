#!/usr/bin/env node
/**
 * advance-node.test.js —— M2 集成测试（TDD：先红后绿）
 *
 * 覆盖 R2.6 八场景：
 *   ① R2.1 advance 流转基础：init 后 advance → current_node 推进 N1→N2（两次 advance：enter + green 流转）
 *   ② R2.2 signal=red：current_node 不变 + history 含 blocked:signal=red
 *   ③ R2.2 signal=unknown：status=awaiting_human（触发 HG，驳灰度6）
 *   ④ R2.2 signal=yellow：记录警告但流转（current_node 推进 + warn=true）
 *   ⑤ R2.3 loop_back 收敛：N6→N7 max_iter=3，连续 advance 4 次 → 第4次 iteration=3 不回环 + history 含 converged
 *   ⑥ R2.4 HG 触发（嫁接1）：跑到 awaiting_human edge → pipeline-state status=awaiting_human/gate=HG1
 *   ⑦ R2.4 C1 核验：awaiting_human 后 direction.json 仍 status=active/gate:null
 *   ⑧ R2.5 换向监测：shift-direction 后 advance → direction_version 更新 + current_node=null + iteration=0
 *
 * 约束（C2）：被测脚本 advance-node.js 仅 fs+path+crypto（内建）+ 同 skill/同项目 require。
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
const SCRIPT = path.join(SCRIPT_DIR, 'advance-node.js');
const PIPELINE_STATE = path.join(SCRIPT_DIR, 'pipeline-state.js');
const INIT_STATE = path.join(SCRIPT_DIR, '..', '..', 'cc-runtime', 'scripts', 'init-state.js');
const SHIFT_DIRECTION = path.join(SCRIPT_DIR, '..', '..', 'cc-runtime', 'scripts', 'shift-direction.js');
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

// 造隔离的临时 state 根（含 direction.json fixture，供 C1/R2.5 核验）
// 返回 { stateRoot, dagCopy, tmpBase }：dagCopy 是临时 dag.json 副本（mock 测试改它，不污染真实 dag.json）
function makeIsolatedRoot() {
  const tmpBase = path.join(os.tmpdir(), `layer2-m2-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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

// 调被测脚本 advance
function runAdvance(stateRoot, dagCopy) {
  return spawnSync('node', [SCRIPT, 'advance', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
}

// pipeline-state.json 路径
function psPath(stateRoot) {
  return path.join(stateRoot, 'pipeline-state.json');
}

// ── 测试① R2.1 流转基础：init 后两次 advance → N1→N2 ──
function testR21Flow() {
  console.log('\n[Test 1] R2.1 advance 流转基础：两次 advance → current_node N1→N2');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 先 init pipeline-state
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });

    // advance 1：current_node=null → 定位起点 N1（enter）
    const r1 = runAdvance(stateRoot, dagCopy);
    assert(r1.status === 0, `advance 1 exit 0（实际 ${r1.status}；stderr=${JSON.stringify(r1.stderr)}）`);

    let s = readJSON(psPath(stateRoot));
    assert(s.current_node === 'N1', `advance 1 后 current_node=N1（实际 ${s.current_node}）`);

    // advance 2：N1→N2 green 流转
    const r2 = runAdvance(stateRoot, dagCopy);
    assert(r2.status === 0, `advance 2 exit 0（实际 ${r2.status}）`);

    s = readJSON(psPath(stateRoot));
    assert(s.current_node === 'N2', `advance 2 后 current_node=N2（实际 ${s.current_node}）`);
    assert(Array.isArray(s.frontier) && s.frontier[0] === 'N3',
      `frontier=['N3']（实际 ${JSON.stringify(s.frontier)}）`);
    assert(s.status === 'active', `status=active（实际 ${s.status}）`);

    // history 含 advance 事件
    const advanceEvents = s.history.filter((h) => h.action === 'advance');
    assert(advanceEvents.length >= 2, `history 含 ≥2 条 advance 事件（实际 ${advanceEvents.length}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试② R2.2 signal=red：current_node 不变 + history 含 blocked:signal=red ──
function testR22Red() {
  console.log('\n[Test 2] R2.2 signal=red：current_node 不变 + history 含 blocked:signal=red');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 改 dag 副本：N1→N2 edge 的 signal 改 red
    const dagObj = readJSON(dagCopy);
    const e = dagObj.edges.find((x) => x.from === 'N1' && x.to === 'N2');
    e.condition.signal = 'red';
    writeJSON(dagCopy, dagObj);

    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N1
    const r = runAdvance(stateRoot, dagCopy);  // N1→N2 red 阻塞
    assert(r.status === 0, `advance exit 0（实际 ${r.status}）`);

    const s = readJSON(psPath(stateRoot));
    assert(s.current_node === 'N1', `current_node 仍=N1（实际 ${s.current_node}，red 不流转）`);
    assert(s.status === 'active', `status 仍=active（实际 ${s.status}）`);

    const lastEvent = s.history[s.history.length - 1];
    assert(/blocked:signal=red/.test(lastEvent.reason),
      `history 末条 reason 含 blocked:signal=red（实际 ${JSON.stringify(lastEvent.reason)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试③ R2.2 signal=unknown：status=awaiting_human（驳灰度6）──
function testR22Unknown() {
  console.log('\n[Test 3] R2.2 signal=unknown：status=awaiting_human（驳灰度6）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 改 dag 副本：N1→N2 signal 改 unknown（加 gate:HG1 满足 unknown 询问 fallback，这里显式声明）
    const dagObj = readJSON(dagCopy);
    const e = dagObj.edges.find((x) => x.from === 'N1' && x.to === 'N2');
    e.condition.signal = 'unknown';
    e.condition.gate = 'HG1';
    writeJSON(dagCopy, dagObj);

    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N1
    const r = runAdvance(stateRoot, dagCopy);  // unknown → 走 HG
    assert(r.status === 0, `advance exit 0（实际 ${r.status}）`);

    const s = readJSON(psPath(stateRoot));
    assert(s.status === 'awaiting_human', `status=awaiting_human（实际 ${s.status}，驳灰度6）`);
    assert(s.gate === 'HG1', `gate=HG1（实际 ${s.gate}）`);
    assert(s.current_node === 'N1', `current_node 仍=N1（实际 ${s.current_node}，unknown 不推进）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试④ R2.2 signal=yellow：记录警告但流转 ──
function testR22Yellow() {
  console.log('\n[Test 4] R2.2 signal=yellow：记录警告但 current_node 推进');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 改 dag 副本：N1→N2 signal 改 yellow
    const dagObj = readJSON(dagCopy);
    const e = dagObj.edges.find((x) => x.from === 'N1' && x.to === 'N2');
    e.condition.signal = 'yellow';
    writeJSON(dagCopy, dagObj);

    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N1
    const r = runAdvance(stateRoot, dagCopy);  // N1→N2 yellow 流转
    assert(r.status === 0, `advance exit 0（实际 ${r.status}）`);

    const s = readJSON(psPath(stateRoot));
    assert(s.current_node === 'N2', `current_node=N2（实际 ${s.current_node}，yellow 流转）`);

    const rObj = JSON.parse(r.stdout);
    assert(rObj.warn === true, `返回 warn=true（实际 ${rObj.warn}）`);

    const lastEvent = s.history[s.history.length - 1];
    assert(/warning:signal=yellow/.test(lastEvent.reason),
      `history 末条 reason 含 warning:signal=yellow（实际 ${JSON.stringify(lastEvent.reason)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑤ R2.3 loop_back 收敛：N6→N7 max_iter=3，连续 advance 4 次 → 第4次不回环 + converged ──
function testR23LoopBack() {
  console.log('\n[Test 5] R2.3 loop_back 收敛：max_iter=3，连续 advance → 达上限不再回环 + converged');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 构造专属 dag：N6→N7 loop_back max_iter=3（N7→N6 形成互锁回环）
    // 拓扑：N6 ─green→ N7 ─green→ N6（loop_back 声明 N7→N6 max_iter=3）
    const dagObj = {
      version: 1,
      nodes: [
        { id: 'N6', type: 'task', skill: 'placeholder', exit_condition: 'N6（占位）' },
        { id: 'N7', type: 'task', skill: 'placeholder', exit_condition: 'N7（占位）' },
      ],
      edges: [
        { from: 'N6', to: 'N7', condition: { signal: 'green', awaiting_human: false } },
        { from: 'N7', to: 'N6', condition: { signal: 'green', awaiting_human: false } },
      ],
      loop_backs: [
        { from: 'N7', to: 'N6', max_iter: 3, converge_field: 'signal' },
      ],
    };
    writeJSON(dagCopy, dagObj);

    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N6（current_node N6, iteration 0）

    // 连续 advance：N6→N7（iter 0，非 loop_back）→ N7→N6（iter 1）→ N6→N7 → N7→N6（iter 2）→ ... → 达 max_iter
    // 注意：loop_back 在 N7→N6 edge。每次走 N7→N6 时 iteration++。
    // 序列：enter N6 → adv N6→N7(iter0) → adv N7→N6(iter1) → adv N6→N7(iter1) → adv N7→N6(iter2)
    //       → adv N6→N7(iter2) → adv N7→N6(iter3=max) converged
    let lastReason = '';
    for (let i = 0; i < 6; i++) {
      const r = runAdvance(stateRoot, dagCopy);
      assert(r.status === 0, `advance 循环 ${i + 1} exit 0（实际 ${r.status}）`);
      const s = readJSON(psPath(stateRoot));
      const last = s.history[s.history.length - 1];
      lastReason = last.reason;
      if (/converged/.test(lastReason)) {
        // 达收敛：iteration 应=3，current_node 停在 N7（不再回环到 N6）
        assert(s.iteration === 3, `收敛时 iteration=3（实际 ${s.iteration}）`);
        assert(/converged:max_iter reached/.test(lastReason),
          `history reason 含 converged:max_iter reached（实际 ${JSON.stringify(lastReason)}）`);
        return;  // 测试通过
      }
    }
    assert(false, `6 次 advance 内未触发 converged（最后 reason=${JSON.stringify(lastReason)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑥ R2.4 HG 触发（嫁接1）：awaiting_human edge → status=awaiting_human/gate=HG1 ──
function testR24HG() {
  console.log('\n[Test 6] R2.4 HG 触发：跑到 awaiting_human edge → pipeline-state awaiting_human/HG1');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 原 dag：N1→N2(green)→N3(awaiting_human:true, gate:HG1)
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N1
    runAdvance(stateRoot, dagCopy);  // N1→N2 green
    const r = runAdvance(stateRoot, dagCopy);  // N2→N3 awaiting_human
    assert(r.status === 0, `advance exit 0（实际 ${r.status}）`);

    const s = readJSON(psPath(stateRoot));
    assert(s.status === 'awaiting_human', `status=awaiting_human（实际 ${s.status}）`);
    assert(s.gate === 'HG1', `gate=HG1（实际 ${s.gate}）`);
    assert(s.current_node === 'N2', `current_node 仍=N2（实际 ${s.current_node}，awaiting_human 不推进）`);

    const rObj = JSON.parse(r.stdout);
    assert(rObj.action === 'awaiting_human', `返回 action=awaiting_human（实际 ${rObj.action}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑦ R2.4 C1 核验：awaiting_human 后 direction.json 不动 ──
function testR24C1Direction() {
  console.log('\n[Test 7] R2.4 C1 核验：HG 触发后 direction.json 仍 status=active/gate:null');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });

    const dirBefore = readJSON(path.join(stateRoot, 'direction.json'));
    runAdvance(stateRoot, dagCopy);  // enter N1
    runAdvance(stateRoot, dagCopy);  // N1→N2
    runAdvance(stateRoot, dagCopy);  // N2→N3 HG 触发

    const dirAfter = readJSON(path.join(stateRoot, 'direction.json'));
    assert(dirAfter.status === 'active',
      `C1：HG 触发后 direction.json status 仍=active（实际 ${dirAfter.status}，嫁接1 不可破）`);
    assert(dirAfter.gate === null,
      `C1：HG 触发后 direction.json gate 仍=null（实际 ${dirAfter.gate}）`);
    assert(dirAfter.current_version === dirBefore.current_version,
      `C1：direction.json.current_version 未变（${dirBefore.current_version}→${dirAfter.current_version}）`);
    assert(dirAfter.set_at === dirBefore.set_at,
      `C1：direction.json.set_at 未变（时间戳一致=未被重写）`);

    // 对照：pipeline-state.json 应已 awaiting_human
    const ps = readJSON(psPath(stateRoot));
    assert(ps.status === 'awaiting_human' && ps.gate === 'HG1',
      `对照：pipeline-state.json 已 awaiting_human/HG1（实际 ${ps.status}/${ps.gate}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑧ R2.5 换向监测：shift-direction 后 advance → direction_version 更新 + current_node=null + iteration=0 ──
function testR25Shift() {
  console.log('\n[Test 8] R2.5 换向监测：shift-direction 后 advance → 重置推进态');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N1
    runAdvance(stateRoot, dagCopy);  // N1→N2（推进态非空：current_node=N2）

    // 记录换向前基线
    const sBefore = readJSON(psPath(stateRoot));
    assert(sBefore.direction_version === 1, `换向前 direction_version=1（实际 ${sBefore.direction_version}）`);
    assert(sBefore.current_node === 'N2', `换向前 current_node=N2（实际 ${sBefore.current_node}）`);

    // 层1 腿：shift-direction 换向（升 direction.json.current_version）
    const rShift = spawnSync('node', [SHIFT_DIRECTION, '--reason', 'test', '--root', stateRoot], { encoding: 'utf8' });
    assert(rShift.status === 0, `shift-direction exit 0（实际 ${rShift.status}；stderr=${JSON.stringify(rShift.stderr)}）`);

    // advance 监测到 direction_version 变化 → 重置
    const r = runAdvance(stateRoot, dagCopy);
    assert(r.status === 0, `advance exit 0（实际 ${r.status}）`);

    const rObj = JSON.parse(r.stdout);
    assert(rObj.action === 'direction_shift_reset', `返回 action=direction_shift_reset（实际 ${rObj.action}）`);

    const s = readJSON(psPath(stateRoot));
    assert(s.direction_version === 2, `direction_version 更新为 2（实际 ${s.direction_version}）`);
    assert(s.current_node === null, `current_node 重置为 null（实际 ${s.current_node}）`);
    assert(s.iteration === 0, `iteration 重置为 0（实际 ${s.iteration}）`);
    assert(s.status === 'active', `status=active（实际 ${s.status}）`);

    // C1 核验：direction.json 状态正确（shift-direction 写的 active/gate:null）
    const d = readJSON(path.join(stateRoot, 'direction.json'));
    assert(d.status === 'active' && d.gate === null,
      `C1：direction.json status=active/gate:null（实际 ${d.status}/${d.gate}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑨ R5.2 A方案 loop_back 收敛后继续：N6⇄N7→N8，收敛后取出口推进到 N8 ──
// 旧引擎（M2）收敛后停在 fromNode=N7 死锁，到不了 N8；A方案（M5 boss 裁决）取首条非 loop_back
// out-edge（出口 N7→N8）推进，满足 R5.2「收敛后→N8」原意。向后兼容见测试⑤（无出口→fallback）。
function testR52ConvergedExit() {
  console.log('\n[Test 9] R5.2 A方案：N6⇄N7 互锁收敛后取出口 N7→N8 推进（不卡死在 N7）');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 拓扑：N6 → N7，N7 outEdges=[N7→N6(loop_back 互锁), N7→N8(收敛出口)]，loop_back{N7→N6,max_iter:3}
    // 关键：N7→N6 声明在前（outEdges[0]，主流程回环），N7→N8 声明在后（收敛后取首条非 loop_back 出口）
    const dagObj = {
      version: 1,
      nodes: [
        { id: 'N6', type: 'task', skill: 'placeholder', exit_condition: 'N6（占位）' },
        { id: 'N7', type: 'task', skill: 'placeholder', exit_condition: 'N7（占位）' },
        { id: 'N8', type: 'task', skill: 'placeholder', exit_condition: 'N8（占位·收敛出口）' },
      ],
      edges: [
        { from: 'N6', to: 'N7', condition: { signal: 'green', awaiting_human: false } },
        { from: 'N7', to: 'N6', condition: { signal: 'green', awaiting_human: false } },
        { from: 'N7', to: 'N8', condition: { signal: 'green', awaiting_human: false } },
      ],
      loop_backs: [
        { from: 'N7', to: 'N6', max_iter: 3, converge_field: 'signal' },
      ],
    };
    writeJSON(dagCopy, dagObj);

    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N6（current_node=N6, iteration=0）

    // 序列：N6→N7(iter0)→N7→N6(iter1)→N6→N7(iter1)→N7→N6(iter2)→N6→N7(iter2)→N7→N6(iter3=converged→取出口N7→N8)
    // 第6次推进（N7→N6 iter3）触发 converged，A方案取 N7→N8 推进，current_node=N8, iteration=3
    let reached = false;
    for (let i = 0; i < 10; i++) {
      const r = runAdvance(stateRoot, dagCopy);
      assert(r.status === 0, `advance 循环 ${i + 1} exit 0（实际 ${r.status}）`);
      const s = readJSON(psPath(stateRoot));
      if (s.current_node === 'N8') {
        assert(s.iteration === 3, `A方案收敛后到 N8，iteration=3（实际 ${s.iteration}）`);
        const rObj = JSON.parse(r.stdout);
        assert(rObj.action === 'converged_exit', `返回 action=converged_exit（实际 ${rObj.action}）`);
        const last = s.history[s.history.length - 1];
        assert(/converged:max_iter reached/.test(last.reason),
          `history reason 含 converged:max_iter reached（实际 ${JSON.stringify(last.reason)}）`);
        reached = true;
        break;
      }
    }
    assert(reached, `10 次 advance 内未推进到 N8（旧引擎收敛停 N7 死锁，A方案未生效）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑩ P3.1 completed 标注：placeholder 终点 business_installed=false + message 防误读 ──
// REVIEW MINOR 3.2：N8 completed≠业务规模化（未标注），boss 看 completed 易误读"规模化做完"。
// 落点 advance-node.js completed 返回（数据驱动读 node.skill），不改 dag.json（保 C1 写者隔离 + graph_hash）。
// placeholder 终点 → business_installed=false + message 含"业务未装配/拓扑到达"。
function testR26Completed() {
  console.log('\n[Test 10] P3.1 completed 标注：placeholder 终点 business_installed=false + 防误读规模化');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    // 迷你 dag：N1(placeholder) 无出边 → advance enter N1 → 再 advance completed
    const dagObj = {
      version: 1,
      nodes: [
        { id: 'N1', type: 'task', skill: 'placeholder', exit_condition: 'N1（占位终点）' },
      ],
      edges: [],
      loop_backs: [],
    };
    writeJSON(dagCopy, dagObj);

    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N1（current_node=null → N1）
    const r = runAdvance(stateRoot, dagCopy);  // N1 无 out-edge → completed
    assert(r.status === 0, `advance exit 0（实际 ${r.status}；stderr=${JSON.stringify(r.stderr)}）`);

    const rObj = JSON.parse(r.stdout);
    assert(rObj.action === 'completed', `action=completed（实际 ${rObj.action}）`);
    assert(rObj.business_installed === false,
      `business_installed=false（placeholder 终点=业务未装配，实际 ${rObj.business_installed}）`);
    assert(/业务未装配/.test(rObj.message),
      `message 含"业务未装配"（实际 ${JSON.stringify(rObj.message)}）`);
    assert(/拓扑到达/.test(rObj.message),
      `message 含"拓扑到达"（区分引擎完成 vs 业务规模化，实际 ${JSON.stringify(rObj.message)}）`);

    const s = readJSON(psPath(stateRoot));
    const lastEvent = s.history[s.history.length - 1];
    assert(/placeholder/.test(lastEvent.reason) && /业务未装配/.test(lastEvent.reason),
      `history reason 含 placeholder+业务未装配（实际 ${JSON.stringify(lastEvent.reason)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 测试⑩b P3.1 对照：真业务终点（skill≠placeholder）business_installed=true + 不误标 ──
// 反证：数据驱动对真业务终点不标注（businessInstalled=!(skill==='placeholder') 自然 true）。
function testR26CompletedRealSkill() {
  console.log('\n[Test 10b] P3.1 对照：真业务终点 business_installed=true + message 不含"未装配"');
  const { stateRoot, dagCopy, tmpBase } = makeIsolatedRoot();
  try {
    const dagObj = {
      version: 1,
      nodes: [
        { id: 'N1', type: 'task', skill: 'venture-sales-scale', exit_condition: 'N1（真业务终点）' },
      ],
      edges: [],
      loop_backs: [],
    };
    writeJSON(dagCopy, dagObj);

    spawnSync('node', [PIPELINE_STATE, 'init', '--dag', dagCopy, '--root', stateRoot], { encoding: 'utf8' });
    runAdvance(stateRoot, dagCopy);  // enter N1
    const r = runAdvance(stateRoot, dagCopy);  // N1 无 out-edge → completed
    assert(r.status === 0, `advance exit 0（实际 ${r.status}）`);

    const rObj = JSON.parse(r.stdout);
    assert(rObj.action === 'completed', `action=completed（实际 ${rObj.action}）`);
    assert(rObj.business_installed === true,
      `business_installed=true（真业务终点，业务已装配，实际 ${rObj.business_installed}）`);
    assert(!/业务未装配/.test(rObj.message),
      `message 不含"业务未装配"（真业务终点不误标，实际 ${JSON.stringify(rObj.message)}）`);
  } finally {
    cleanup(tmpBase);
  }
}

// ── 运行 ──
testR21Flow();
testR22Red();
testR22Unknown();
testR22Yellow();
testR23LoopBack();
testR24HG();
testR24C1Direction();
testR25Shift();
testR52ConvergedExit();
testR26Completed();
testR26CompletedRealSkill();

console.log(`\n==== ${passed} passing, ${failed} failing ====`);
process.exit(failed === 0 ? 0 : 1);
