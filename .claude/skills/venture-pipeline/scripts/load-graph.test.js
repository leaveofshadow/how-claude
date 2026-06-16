#!/usr/bin/env node
/**
 * load-graph.test.js —— TDD 测试（先红后绿）
 *
 * 覆盖 R0.4 三验证闸：
 *   ① 解析 dag.json → 3 nodes / 3 edges 正确
 *   ② 含 subgraph/fan_out implemented:false 字位时 stderr 报「未实现」+ exit≠0
 *   ③ graph_hash 连跑两次相等（确定性）
 *
 * 约束：C2 纯 fs+path（本测试用 child_process spawn 被测脚本，被测脚本本身仅 fs+path）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'load-graph.js');
const DAG = path.join(__dirname, '..', 'dag.json');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

// ── 测试①：解析 3 nodes / 3 edges ──
function testParseBasic() {
  console.log('\n[Test 1] 解析 dag.json → 3 nodes / 3 edges');
  const r = spawnSync('node', [SCRIPT, '--dag', DAG], { encoding: 'utf8' });
  assert(r.status === 0, `exit 0（实际 ${r.status}）`);
  let out = null;
  try { out = JSON.parse(r.stdout); } catch (e) {
    assert(false, `stdout 非合法 JSON：${e.message}`);
    return;
  }
  assert(out.nodes && out.nodes.length === 3, `nodes.length=3（实际 ${out.nodes ? out.nodes.length : 'undefined'}）`);
  assert(out.edges && out.edges.length === 3, `edges.length=3（实际 ${out.edges ? out.edges.length : 'undefined'}）`);
  assert(typeof out.graph_hash === 'string' && out.graph_hash.length === 64,
    `graph_hash 64 位 sha256（实际 ${typeof out.graph_hash} / len=${out.graph_hash ? out.graph_hash.length : 0}）`);
}

// ── 测试②：字位报未实现 ──
function testReservedFieldReportsUnimplemented() {
  console.log('\n[Test 2] 含 subgraph implemented:false 字位 → stderr「未实现」+ exit≠0');
  const tmp = path.join(os.tmpdir(), `layer2-m0-test-${process.pid}-${Date.now()}.json`);
  const base = JSON.parse(fs.readFileSync(DAG, 'utf8'));
  base.subgraph = { reserved: true, implemented: false };
  fs.writeFileSync(tmp, JSON.stringify(base, null, 2), 'utf8');
  try {
    const r = spawnSync('node', [SCRIPT, '--dag', tmp], { encoding: 'utf8' });
    assert(r.status !== 0, `exit≠0（实际 ${r.status}）`);
    const errText = (r.stderr || '') + (r.stdout || '');
    assert(/未实现：subgraph/.test(errText), `stderr 含「未实现：subgraph」（实际 stderr=${JSON.stringify(r.stderr)}）`);
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
}

// ── 测试③：graph_hash 确定性 ──
function testGraphHashDeterministic() {
  console.log('\n[Test 3] graph_hash 连跑两次相等（确定性）');
  const r1 = spawnSync('node', [SCRIPT, '--dag', DAG], { encoding: 'utf8' });
  const r2 = spawnSync('node', [SCRIPT, '--dag', DAG], { encoding: 'utf8' });
  assert(r1.status === 0 && r2.status === 0, `两次均 exit 0（${r1.status}/${r2.status}）`);
  let h1 = null, h2 = null;
  try { h1 = JSON.parse(r1.stdout).graph_hash; } catch (e) {}
  try { h2 = JSON.parse(r2.stdout).graph_hash; } catch (e) {}
  assert(typeof h1 === 'string' && h1.length === 64, `第一次 hash 64 位（${h1 ? h1.length : 'null'}）`);
  assert(typeof h2 === 'string' && h2.length === 64, `第二次 hash 64 位（${h2 ? h2.length : 'null'}）`);
  assert(h1 === h2, `两次 hash 相等（${h1} vs ${h2}）`);
}

// ── 运行 ──
testParseBasic();
testReservedFieldReportsUnimplemented();
testGraphHashDeterministic();

console.log(`\n==== ${passed} passing, ${failed} failing ====`);
process.exit(failed === 0 ? 0 : 1);
