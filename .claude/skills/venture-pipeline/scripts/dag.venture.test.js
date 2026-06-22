#!/usr/bin/env node
/**
 * dag.venture.test.js —— M0 R0.2 业务版 DAG 拓扑断言测试（C7）
 *
 * 纯拓扑结构断言（不跑引擎）：读 dag.venture.json 验证
 *   - 8 节点拓扑 + 主线 N1/N2/N3 真 skill 名 + N4-N8 占位
 *   - exit_condition 含可证伪关键词（市场痛点 / 直接替代 / 七维评分）
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

// ── 拓扑：8 节点 ──
test('拓扑：8 节点', () => {
  assert.strictEqual(dag.nodes.length, 8, 'nodes.length === 8');
});

// ── 主线 N1/N2/N3 真 skill 名（最小可演示闭环，50-decision §7）──
test('主线 N1/N2/N3 真 skill 名', () => {
  assert.strictEqual(nodeById.N1.skill, 'venture-sales-judge');
  assert.strictEqual(nodeById.N2.skill, 'venture-sales-judge');
  assert.strictEqual(nodeById.N3.skill, 'hcc-decision');
});

// ── 占位节点 N4-N8 skill=placeholder（C7：拓扑运行 ≠ 业务运行）──
test('占位节点 N4-N8 skill=placeholder（C7）', () => {
  for (const id of ['N4', 'N5', 'N6', 'N7', 'N8']) {
    assert.strictEqual(nodeById[id].skill, 'placeholder', `${id}.skill === placeholder`);
  }
});

// ── exit_condition 含可证伪关键词（R0.2 L58）──
test('exit_condition 含可证伪关键词', () => {
  assert.ok(nodeById.N1.exit_condition.includes('市场痛点'), 'N1 含 市场痛点');
  assert.ok(nodeById.N2.exit_condition.includes('直接替代'), 'N2 含 直接替代');
  assert.ok(nodeById.N3.exit_condition.includes('七维评分'), 'N3 含 七维评分');
});

// ── R3：所有普通段 edge（awaiting_human=false）signal=unknown ──
test('普通段 edge signal=unknown（R3：逼 agent 走 set-signal 改 green）', () => {
  const normal = dag.edges.filter((e) => e.condition.awaiting_human === false);
  assert.ok(normal.length >= 2, '至少有 N1→N2 / N2→N3 普通段');
  for (const e of normal) {
    assert.strictEqual(e.condition.signal, 'unknown', `${e.from}→${e.to} 普通段 signal=unknown`);
  }
});

// ── R3：HG edge N3→N4 awaiting_human+gate=HG1 ──
test('HG edge N3→N4 awaiting_human+gate=HG1', () => {
  const c = edge('N3', 'N4').condition;
  assert.strictEqual(c.awaiting_human, true);
  assert.strictEqual(c.gate, 'HG1');
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
  assert.strictEqual(hg.length, 2, '恰好 2 个 HG edge（HG1/HG2）');
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
