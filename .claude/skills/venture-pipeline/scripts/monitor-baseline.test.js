#!/usr/bin/env node
/**
 * monitor-baseline.test.js —— monitor.js 纯 fs 部分 TDD（task #41 第一刀）
 *
 * 覆盖：
 *   readBaseline —— 读 .hcc/decisions/{run}/50+60+70 摘要（纯 fs，机械搬运，截断防过长）
 *   readStagnation —— 跨 skill 读 cc-runtime direction.json 的 checkpoint.stagnation_count（只读）
 *
 * 约束（C2）：仅 node 内建。test 用绝对路径 tmp fixture，不依赖 cwd。
 * 运行：node --test .claude/skills/venture-pipeline/scripts/monitor-baseline.test.js → exit 0
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const monitor = require('./monitor.js');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mon-bl-'));
}

// ── readBaseline ──

test('readBaseline：50/60/70 齐全则搬运三文件摘要', () => {
  const run = mkTmp();
  try {
    fs.writeFileSync(path.join(run, '50-decision.md'), '# 裁决\n选方案 α');
    fs.writeFileSync(path.join(run, '60-impl-plan.md'), '## 技术选型确认\n用 Postgres\n## 模块拆分\nM0/M1');
    fs.writeFileSync(path.join(run, '70-requirements.md'), '## M0\n### R0.1 需求项');
    const out = monitor.readBaseline(run);
    assert.strictEqual(out.run_dir, run);
    assert.strictEqual(out.files_present['50'], true);
    assert.strictEqual(out.files_present['60'], true);
    assert.strictEqual(out.files_present['70'], true);
    assert.ok(out.decision.includes('选方案 α'), `decision 应含 50 内容，实际 ${out.decision}`);
    assert.ok(out.plan.includes('Postgres'), `plan 应含 60 内容，实际 ${out.plan}`);
    assert.ok(out.requirements.includes('R0.1'), `requirements 应含 70 内容，实际 ${out.requirements}`);
  } finally { fs.rmSync(run, { recursive: true, force: true }); }
});

test('readBaseline：文件缺失标 files_present=false（不抛错，机械不阻塞）', () => {
  const run = mkTmp();
  try {
    fs.writeFileSync(path.join(run, '50-decision.md'), '仅 50');
    const out = monitor.readBaseline(run);
    assert.strictEqual(out.files_present['50'], true);
    assert.strictEqual(out.files_present['60'], false);
    assert.strictEqual(out.files_present['70'], false);
    assert.strictEqual(out.plan, null);
    assert.strictEqual(out.requirements, null);
  } finally { fs.rmSync(run, { recursive: true, force: true }); }
});

test('readBaseline：run 目录不存在 → files_present 全 false（不抛错）', () => {
  const ghost = path.join(mkTmp(), 'no-such-run');
  const out = monitor.readBaseline(ghost);
  assert.strictEqual(out.files_present['50'], false);
  assert.strictEqual(out.files_present['60'], false);
  assert.strictEqual(out.files_present['70'], false);
  assert.strictEqual(out.decision, null);
});

test('readBaseline：超长文件截断（防 monitor 输出过长，标 [截断]）', () => {
  const run = mkTmp();
  try {
    const long = 'X'.repeat(5000);
    fs.writeFileSync(path.join(run, '50-decision.md'), long);
    const out = monitor.readBaseline(run, { maxChars: 100 });
    assert.ok(out.decision.length <= 120, `decision 应截断，实际长度 ${out.decision.length}`);
    assert.ok(out.decision.includes('截断'), `截断应标 [截断]，实际 ${out.decision}`);
  } finally { fs.rmSync(run, { recursive: true, force: true }); }
});

// ── readStagnation ──

test('readStagnation：读 .hcc/state/direction.json 的 checkpoint.stagnation_count（跨 skill 只读）', () => {
  const root = mkTmp();
  try {
    fs.mkdirSync(path.join(root, '.hcc', 'state'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.hcc', 'state', 'direction.json'),
      JSON.stringify({ checkpoint: { stagnation_count: 3, health: 'stagnant_warn' }, direction: { current_version: 1 } })
    );
    const out = monitor.readStagnation(root);
    assert.strictEqual(out.stagnation_count, 3);
    assert.strictEqual(out.health, 'stagnant_warn');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('readStagnation：.hcc/state 不存在 → fallback .venture/state（向下兼容旧项目）', () => {
  const root = mkTmp();
  try {
    fs.mkdirSync(path.join(root, '.venture', 'state'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.venture', 'state', 'direction.json'),
      JSON.stringify({ checkpoint: { stagnation_count: 2, health: 'ok' }, direction: { current_version: 1 } })
    );
    const out = monitor.readStagnation(root);
    assert.strictEqual(out.stagnation_count, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('readStagnation：direction.json 不存在 → null（不阻塞 monitor）', () => {
  const root = mkTmp();
  try {
    const out = monitor.readStagnation(root);
    assert.strictEqual(out.stagnation_count, null);
    assert.strictEqual(out.health, null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('readStagnation：checkpoint 缺 stagnation_count 字段 → null（不抛错）', () => {
  const root = mkTmp();
  try {
    fs.mkdirSync(path.join(root, '.hcc', 'state'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.hcc', 'state', 'direction.json'),
      JSON.stringify({ checkpoint: { health: 'ok' } })  // 无 stagnation_count
    );
    const out = monitor.readStagnation(root);
    assert.strictEqual(out.stagnation_count, null);
    assert.strictEqual(out.health, 'ok');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
