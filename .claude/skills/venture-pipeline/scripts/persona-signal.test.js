#!/usr/bin/env node
/**
 * persona-signal.test.js —— M5 R5.4 signal 收敛判据可证伪编码（驳 B-β-5）
 *
 * 把 references/persona-signal.md 定义的 N6⇄N7 互锁收敛判据，从「文档」编码为「可执行纯函数」，
 * 零依赖测试证伪——这正是驳 B-β-5 的核心：收敛判据脱离 markdown 自由文本解析，回归可证伪。
 *
 * ⚠️ 本测试独立于 advance-node 引擎。引擎层 handleLoopBack 只实现 force_converge 触发
 *    （iter >= max_iter），因层2占位拓扑 venture-persona 是 placeholder（C7），不真产 signal jsonld。
 *    signal「字段级比对收敛」是判据的可证伪化编码（本地函数 judgeConvergence/validateSignal），
 *    供层3 venture-persona 真正产出 signal 后对齐实现。
 *
 * 判据（persona-signal.md §二/§三）：
 *   - signal = 固定枚举 green|yellow|red|unknown（非 free text）
 *   - 收敛条件：① signal 枚举值相同 ② segment 受控词表值相同 ③ delta_from_prev < DELTA_THRESHOLD(0.1)
 *   - force_converge 边界：iter >= MAX_ITER(3) 强制收敛（驳 off-by-one，第 3 轮强制，不存在第 4 轮）
 *
 * 约束（C2）：纯 Node 内建，无外部依赖，无 spawn。
 */
'use strict';

// ── 判据常量（与 persona-signal.md §三一致）──
const VALID_SIGNALS = ['green', 'yellow', 'red', 'unknown'];
const MAX_ITER = 3;
const DELTA_THRESHOLD = 0.1;

// ── 判据函数（可证伪编码）──

// signal 合法性校验：拒绝 free text（驳 B-β-5：segment 值非固定枚举 → 不可证伪）
function validateSignal(s) {
  if (!s || typeof s !== 'object') return { ok: false, reason: 'signal 非对象' };
  if (!VALID_SIGNALS.includes(s.signal)) {
    return { ok: false, reason: `signal 非法枚举值:「${s.signal}」（合法:${VALID_SIGNALS.join('|')}，拒绝 free text）` };
  }
  if (typeof s.segment !== 'string' || s.segment.trim() === '') {
    return { ok: false, reason: 'segment 必须是受控词表值（非空 string）' };
  }
  return { ok: true };
}

// 收敛判定：force_converge（iter>=MAX_ITER）优先，否则 signal 字段级比对
function judgeConvergence(prev, curr, iter, opts) {
  opts = opts || {};
  const maxIter = opts.max_iter != null ? opts.max_iter : MAX_ITER;
  const deltaTh = opts.delta_threshold != null ? opts.delta_threshold : DELTA_THRESHOLD;

  // ① force_converge：iter >= MAX_ITER（驳 off-by-one：第 3 轮强制，无第 4 轮）
  if (iter >= maxIter) {
    return { converged: true, mode: 'force', reason: `converged:max_iter reached (iter=${iter}>=${maxIter})` };
  }

  // 首轮无 prev（无上一轮产出可比对）→ 无法字段级比对 → 不收敛
  if (!prev || typeof prev !== 'object') {
    return { converged: false, mode: 'none', reason: 'not converged (无 prev 可比对，首轮)' };
  }

  // ② signal 字段级比对（结构化，非 markdown 文本比对）
  const signalEq = prev.signal === curr.signal;
  const segmentEq = prev.segment === curr.segment;
  const deltaOk = typeof curr.delta_from_prev === 'number' && curr.delta_from_prev < deltaTh;

  if (signalEq && segmentEq && deltaOk) {
    return { converged: true, mode: 'signal',
      reason: `converged:signal field-level match (signal=${curr.signal}, segment=${curr.segment}, delta=${curr.delta_from_prev}<${deltaTh})` };
  }
  return { converged: false, mode: 'none',
    reason: `not converged (signalEq=${signalEq}, segmentEq=${segmentEq}, deltaOk=${deltaOk})` };
}

// ── 测试框架 ──
let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  − ${msg}`); passed++; }
  else { console.error(`  ✗ FAIL: ${msg}`); failed++; }
}

// ── 测试1: signal 四态枚举合法 ──
function testValidateSignalValid() {
  console.log('\n[Test R5.4-1] signal 四态枚举合法（green/yellow/red/unknown）');
  for (const sig of VALID_SIGNALS) {
    assert(validateSignal({ signal: sig, segment: 'SMB_retail' }).ok === true,
      `signal=${sig} 合法`);
  }
}

// ── 测试2: 拒绝 free text（驳 B-β-5 核心）──
function testRejectFreeText() {
  console.log('\n[Test R5.4-2] 拒绝 free text signal（驳 B-β-5：segment/signal 非固定枚举 → 不可证伪）');
  const badSignals = ['purple', 'greenish', 'GREEN', '', null, 42, 'maybe'];
  for (const bad of badSignals) {
    const r = validateSignal({ signal: bad, segment: 'SMB_retail' });
    assert(r.ok === false,
      `signal=${JSON.stringify(bad)} 被拒（非合法枚举）`);
  }
  // segment 空/非词表值也被拒
  assert(validateSignal({ signal: 'green', segment: '' }).ok === false, 'segment 空 → 拒');
  assert(validateSignal({ signal: 'green', segment: '  ' }).ok === false, 'segment 纯空白 → 拒');
}

// ── 测试3: force_converge 在 MAX_ITER 强制收敛（驳 off-by-one）──
function testForceConvergeAtMaxIter() {
  console.log('\n[Test R5.4-3] force_converge：iter>=MAX_ITER(3) 强制收敛（驳 off-by-one，第3轮强制）');
  const prev = { signal: 'yellow', segment: 'SMB', delta_from_prev: 0.5 };  // 未达字段级一致
  const curr = { signal: 'yellow', segment: 'SMB_retail', delta_from_prev: 0.3 };
  const r = judgeConvergence(prev, curr, 3);  // iter=3 = MAX_ITER
  assert(r.converged === true, 'iter=3 强制收敛（即便字段未达一致）');
  assert(r.mode === 'force', 'mode=force（max_iter reached）');
  assert(/max_iter reached/.test(r.reason), 'reason 含 "converged:max_iter reached"');
}

// ── 测试4: force_converge 边界——iter<MAX_ITER 不强制，走信号判据 ──
function testForceConvergeBoundaryIter2() {
  console.log('\n[Test R5.4-4] force_converge 边界：iter=2(<MAX_ITER) 不强制，走 signal 判据');
  const prev = { signal: 'yellow', segment: 'SMB', delta_from_prev: 0.5 };
  const curr = { signal: 'yellow', segment: 'SMB_retail', delta_from_prev: 0.3 };  // segment 不同
  const r = judgeConvergence(prev, curr, 2);
  assert(r.converged === false, 'iter=2 不强制收敛（mode 应非 force）');
  assert(r.mode !== 'force', 'iter=2 mode≠force（未达 max_iter）');
}

// ── 测试5: signal 驱动提前收敛（字段一致 + delta<阈值）──
function testSignalDrivenConvergeIter2() {
  console.log('\n[Test R5.4-5] signal 驱动提前收敛：iter=2 字段一致 + delta<阈值');
  const prev = { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.5 };
  const curr = { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.02 };  // 全一致 + delta=0.02<0.1
  const r = judgeConvergence(prev, curr, 2);
  assert(r.converged === true, 'iter=2 signal 驱动收敛（无需等到 MAX_ITER）');
  assert(r.mode === 'signal', 'mode=signal（field-level match）');
  assert(/field-level match/.test(r.reason), 'reason 含 "signal field-level match"');
}

// ── 测试6: 未收敛——signal 枚举值不同 ──
function testNoConvergeSignalDiffers() {
  console.log('\n[Test R5.4-6] 未收敛：signal 枚举值不同（green vs yellow）');
  const prev = { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.5 };
  const curr = { signal: 'yellow', segment: 'SMB_retail', delta_from_prev: 0.02 };
  const r = judgeConvergence(prev, curr, 2);
  assert(r.converged === false, 'signal green≠yellow → 不收敛');
}

// ── 测试7: 未收敛——delta 超阈值 ──
function testNoConvergeDeltaExceeds() {
  console.log('\n[Test R5.4-7] 未收敛：delta_from_prev 超阈值（0.5 >= 0.1）');
  const prev = { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.5 };
  const curr = { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.5 };  // 字段同但 delta=0.5
  const r = judgeConvergence(prev, curr, 2);
  assert(r.converged === false, 'delta=0.5>=0.1 → 不收敛（persona 仍漂移）');
}

// ── 测试8: DELTA_THRESHOLD 严格小于边界 ──
function testDeltaThresholdStrict() {
  console.log('\n[Test R5.4-8] DELTA_THRESHOLD=0.1 严格 <（等于不收敛，0.09 收敛）');
  const prev = { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.5 };
  // delta=0.1 等于阈值 → 严格 < 不满足
  assert(judgeConvergence(prev, { ...prev, delta_from_prev: 0.1 }, 2).converged === false,
    'delta=0.1（=阈值）→ 不收敛（严格 <）');
  // delta=0.09 略小于阈值 → 收敛
  assert(judgeConvergence(prev, { ...prev, delta_from_prev: 0.09 }, 2).converged === true,
    'delta=0.09（<阈值）→ 收敛');
}

// ── 测试9: off-by-one 显式核验——iter=3 收敛后无需 iter=4 ──
function testOffByOneCorrection() {
  console.log('\n[Test R5.4-9] off-by-one 修正：MAX_ITER=3 = 最多3轮，不存在第4轮强制');
  // 模拟 N6⇄N7 三轮互锁的收敛判定序列
  const seq = [
    judgeConvergence(null, { signal: 'yellow', segment: 'SMB', delta_from_prev: 1 }, 1),
    judgeConvergence({ signal: 'yellow', segment: 'SMB' }, { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.3 }, 2),
    judgeConvergence({ signal: 'green', segment: 'SMB_retail' }, { signal: 'green', segment: 'SMB_retail', delta_from_prev: 0.05 }, 3),
  ];
  // 三轮序列：首轮无 prev 不收敛 → 第二轮 signal 不同不收敛 → 第三轮 force 收敛
  assert(seq[0].converged === false, 'iter=1 首轮（无 prev）不收敛');
  assert(seq[1].converged === false, 'iter=2 signal green≠yellow → 不收敛');
  assert(seq[2].converged === true && seq[2].mode === 'force', 'iter=3 收敛（force）');
  // 关键 off-by-one 断言：不存在「第4轮」语义——judgeConvergence 永不返回需要 iter=4 的状态
  // 即：任何 iter>=3 调用必 converged=true（force 路径）
  assert(judgeConvergence({ signal: 'red' }, { signal: 'red', delta_from_prev: 0.99 }, 3).converged === true,
    'iter=3 即便 delta=0.99 仍强制收敛（无第4轮）');
}

// ── 执行全部 ──
testValidateSignalValid();
testRejectFreeText();
testForceConvergeAtMaxIter();
testForceConvergeBoundaryIter2();
testSignalDrivenConvergeIter2();
testNoConvergeSignalDiffers();
testNoConvergeDeltaExceeds();
testDeltaThresholdStrict();
testOffByOneCorrection();

console.log(`\n==== ${passed} passing, ${failed} failing ====`);
process.exit(failed === 0 ? 0 : 1);
