#!/usr/bin/env node
/**
 * dag.venture.test.js —— M1 业务版 DAG 拓扑断言测试（C7 + 修复 #6 每改造点补 test）
 *
 * 纯拓扑结构断言（不跑引擎）：读 dag.venture.json 验证
 *   - 9 节点拓扑（M1 插 N3.5 需求规格）+ 主线 N1/N2/N3/N3.5 真 skill 名 + N4-N8 占位
 *   - exit_condition 含可证伪关键词（市场痛点 / 直接替代 / 七维评分 / 工程六块 §3 功能需求/§5 验收/N3.5_grill_log）
 *   - M1 拓扑变更：N3→N4(HG1) 拆为 N3→N3.5(普通段) + N3.5→N4(HG1)，与 N1→N2 同构（铁证1）
 *   - R3 signal 语义（普通段 unknown / HG edge awaiting_human+gate）
 *   - R3 schema 注释三处一致（_comment 含 advance-node.js:294 + resolve-hg.js:101）
 *   - R6 串行约束文档化（_writers 含 set-signal 必须串行调用）
 *   - loop_back N7→N6 max_iter=3
 *
 * 运行（R0.2 可证伪验证）：node --test .claude/skills/venture-pipeline/scripts/dag.venture.test.js → exit 0
 * 约束（C2）：仅 node 内建 fs+path+assert，无外部依赖（node:test / node:assert 为 Node 内建）。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DAG_PATH = path.join(__dirname, '..', 'dag.venture.json');
const dag = JSON.parse(fs.readFileSync(DAG_PATH, 'utf8'));

// 节点 id → 节点对象；edge (from→to) → condition（断言辅助）
const nodeById = Object.fromEntries(dag.nodes.map((n) => [n.id, n]));
const edge = (from, to) => dag.edges.find((e) => e.from === from && e.to === to);

// ── 拓扑：9 节点（M1 插 N3.5）──
test('拓扑：9 节点（M1 插 N3.5 需求规格）', () => {
  assert.strictEqual(dag.nodes.length, 9, 'nodes.length === 9（M1 后）');
});

// ── 主线 N1/N2/N3/N3.5 真 skill 名（最小可演示闭环，M1 加 N3.5 需求规格）──
test('主线 N1/N2/N3/N3.5 真 skill 名', () => {
  assert.strictEqual(nodeById.N1.skill, 'venture-sales-judge');
  assert.strictEqual(nodeById.N2.skill, 'venture-sales-judge');
  assert.strictEqual(nodeById.N3.skill, 'hcc-decision');
  assert.strictEqual(nodeById['N3.5'].skill, 'hcc-product-requirement', 'N3.5 需求规格 skill（M1 插入）');
});

// ── 占位节点 N4/N5/N6/N8 skill=placeholder（C7：拓扑运行 ≠ 业务运行）+ N7 装配 hcc-product-uiux ──
test('占位节点 N4/N5/N6/N8 skill=placeholder（C7）+ N7 装配 hcc-product-uiux', () => {
  for (const id of ['N4', 'N5', 'N6', 'N8']) {
    assert.strictEqual(nodeById[id].skill, 'placeholder', `${id}.skill === placeholder`);
  }
  // N7 装配 hcc-product-uiux（hcc-org §3.3 N7 产物归属；2026-06-24 装配，非占位）
  assert.strictEqual(nodeById.N7.skill, 'hcc-product-uiux', 'N7.skill === hcc-product-uiux（已装配）');
});

// ── exit_condition 含可证伪关键词（M1 加 N3.5，charter 块1 复审换为工程六块）──
test('exit_condition 含可证伪关键词', () => {
  assert.ok(nodeById.N1.exit_condition.includes('市场痛点'), 'N1 含 市场痛点');
  assert.ok(nodeById.N2.exit_condition.includes('直接替代'), 'N2 含 直接替代');
  assert.ok(nodeById.N3.exit_condition.includes('七维评分'), 'N3 含 七维评分');
  // N3.5 工程六块关键词（charter 块1 复审，主题4/9：从旧 PRD 五块换为工程六块，与 dag.json 一致）
  // 引擎层断言（主题4 分层）：只校验 existsSync+includes 能跑的；语义校验（R/AC 正文非空/EARS/追问数）放 SKILL.md 自检清单。
  assert.ok(nodeById['N3.5'].exit_condition.includes('§3 功能需求'), 'N3.5 含 §3 功能需求（工程六块，charter 块1 复审）');
  assert.ok(nodeById['N3.5'].exit_condition.includes('§5 验收'), 'N3.5 含 §5 验收（工程六块，charter 块1 复审）');
  assert.ok(nodeById['N3.5'].exit_condition.includes('N3.5_grill_log'), 'N3.5 含 N3.5_grill_log（grill-me 落盘契约，主题2）');
});

// ── activate_external schema 断言（主题5：防 boss 手改静默失效）──
// N3.5 节点声明 activate_external='grill-me'，dag.test.js 断言该字段结构（boss 手改破坏会被测试拦截）。
test('N3.5 activate_external === grill-me（主题5 schema 断言，防静默失效）', () => {
  assert.ok(nodeById['N3.5'].hasOwnProperty('activate_external'), 'N3.5 有 activate_external 字段（schema 隔离）');
  assert.strictEqual(nodeById['N3.5'].activate_external, 'grill-me', 'N3.5.activate_external === "grill-me"（boss 手改破坏会被此断言拦截）');
});

// ── grill_min_questions schema 断言（P1.1 堵 MAJOR 1.2：grill N 落地，防静默失效）──
// N3.5 节点声明 grill_min_questions=3，validate-n35.js 默认追问数下限读此值（MAJOR 1.2「N 未定义」的契约落点）。
test('N3.5 grill_min_questions === 3（P1.1 MAJOR 1.2 契约落点，防静默失效）', () => {
  assert.ok(nodeById['N3.5'].hasOwnProperty('grill_min_questions'), 'N3.5 有 grill_min_questions 字段（MAJOR 1.2 落地）');
  assert.strictEqual(nodeById['N3.5'].grill_min_questions, 3, 'N3.5.grill_min_questions === 3（validate-n35.js 默认追问数下限）');
});

// ── R3：所有普通段 edge（awaiting_human=false）signal=unknown ──
test('普通段 edge signal=unknown（R3：逼 agent 走 set-signal 改 green）', () => {
  const normal = dag.edges.filter((e) => e.condition.awaiting_human === false);
  assert.ok(normal.length >= 3, '至少有 N1→N2 / N2→N3 / N3→N3.5 普通段');
  for (const e of normal) {
    assert.strictEqual(e.condition.signal, 'unknown', `${e.from}→${e.to} 普通段 signal=unknown`);
  }
  // M1：N3→N3.5 是普通段（与 N1→N2 同构，set-signal 闭环推进到 N3.5）
  assert.strictEqual(edge('N3', 'N3.5').condition.awaiting_human, false, 'N3→N3.5 普通段 awaiting_human=false');
});

// ── M1：HG edge N3.5→N4 awaiting_human+gate=HG1（M1 前是 N3→N4，拆 N3.5 后 HG1 移到 N3.5→N4）──
test('HG edge N3.5→N4 awaiting_human+gate=HG1（M1 拓扑变更）', () => {
  const c = edge('N3.5', 'N4').condition;
  assert.strictEqual(c.awaiting_human, true, 'N3.5→N4 HG 段 awaiting_human');
  assert.strictEqual(c.gate, 'HG1', 'N3.5→N4 gate=HG1');
  // M1：N3→N4 已删除（拆为 N3→N3.5 + N3.5→N4），断言旧 edge 不存在（防回滚遗漏）
  assert.strictEqual(edge('N3', 'N4'), undefined, 'N3→N4 edge 已删除（M1 拆分）');
});

// ── R3：HG edge N4→N5 awaiting_human+gate=HG2 ──
test('HG edge N4→N5 awaiting_human+gate=HG2', () => {
  const c = edge('N4', 'N5').condition;
  assert.strictEqual(c.awaiting_human, true);
  assert.strictEqual(c.gate, 'HG2');
});

// ── R3 兜底：所有 HG edge（awaiting_human=true）必须声明 gate（缺 gate → advance exit 1）──
test('所有 HG edge 声明 gate ∈ {HG1,HG2}', () => {
  const hg = dag.edges.filter((e) => e.condition.awaiting_human === true);
  assert.strictEqual(hg.length, 2, '恰好 2 个 HG edge（M1 后：N3.5→N4 HG1 / N4→N5 HG2）');
  for (const e of hg) {
    assert.ok(['HG1', 'HG2'].includes(e.condition.gate), `${e.from}→${e.to} gate ∈ {HG1,HG2}`);
  }
});

// ── loop_back N7→N6 max_iter=3 ──
test('loop_back N7→N6 max_iter=3', () => {
  const lb = dag.loop_backs.find((l) => l.from === 'N7' && l.to === 'N6');
  assert.ok(lb, '存在 N7→N6 loop_back');
  assert.strictEqual(lb.max_iter, 3);
});

// ── R3 schema 注释三处一致：_comment 含 advance-node.js:294 + resolve-hg.js:101 ──
test('R3 _comment 含 advance-node.js:294 + resolve-hg.js:101（三处一致之一）', () => {
  assert.ok(dag._comment.includes('advance-node.js:294'), '_comment 含 advance-node.js:294');
  assert.ok(dag._comment.includes('resolve-hg.js:101'), '_comment 含 resolve-hg.js:101');
});

// ── R6 串行约束文档化：_writers 含 set-signal 必须串行调用 ──
test('R6 _writers 含 set-signal 必须串行调用', () => {
  assert.ok(dag._writers.includes('set-signal 必须串行调用'), '_writers 含 set-signal 必须串行调用');
});
