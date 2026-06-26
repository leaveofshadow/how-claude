#!/usr/bin/env node
/**
 * extractArtifact-fallback.test.js —— extractArtifact fallback 验证（hcc 目录统一阶段1）
 *
 * extractArtifact（venture-resume.js）从 exit_condition 提取 artifact 路径（set-signal --artifact 用）。
 * 阶段1 改造：新路径 .hcc/<部门>/<skill>/xxx.md 优先 + fallback 旧路径 .venture/artifacts/xxx.md。
 *
 * 运行：node --test .claude/skills/venture-pipeline/scripts/extractArtifact-fallback.test.js → exit 0
 * 约束（C2）：仅 node 内建（node:test / node:assert 为 Node 内建）。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { extractArtifact } = require('./venture-resume.js');

test('新路径优先：.hcc/sales/venture-sales-judge/N1_机会调查_report.md', () => {
  const exit = 'artifact .hcc/sales/venture-sales-judge/N1_机会调查_report.md 存在且含关键词 市场痛点';
  assert.strictEqual(
    extractArtifact(exit),
    '.hcc/sales/venture-sales-judge/N1_机会调查_report.md',
    '新路径 .hcc/{部门}/{skill}/ 优先提取'
  );
});

test('fallback 旧路径：.venture/artifacts/N1-机会调查.md', () => {
  const exit = 'artifact .venture/artifacts/N1-机会调查.md 存在且含关键词 市场痛点';
  assert.strictEqual(
    extractArtifact(exit),
    '.venture/artifacts/N1-机会调查.md',
    '无 .hcc/ 时 fallback 旧路径'
  );
});

test('新旧并存取新（优先级）', () => {
  const exit = '旧 .venture/artifacts/N1.md 已废弃，实际产物 .hcc/sales/venture-sales-judge/N1_机会调查_report.md';
  assert.ok(extractArtifact(exit).startsWith('.hcc/'), '新 .hcc/ 优先于旧 .venture/artifacts/');
});

test('N3 新路径：.hcc/decision/hcc-decision/N3_决策方案_decision.md', () => {
  const exit = 'artifact .hcc/decision/hcc-decision/N3_决策方案_decision.md 存在且含关键词 七维评分';
  assert.strictEqual(
    extractArtifact(exit),
    '.hcc/decision/hcc-decision/N3_决策方案_decision.md'
  );
});

test('阶段4 兼容：docs/<子路径>/xxx.md（旧项目 docs/ 产物）', () => {
  const exit = 'artifact docs/n4-selftest-plan.md 存在且含关键词 自测';
  assert.strictEqual(extractArtifact(exit), 'docs/n4-selftest-plan.md');
});

test('无 artifact 路径 → null', () => {
  assert.strictEqual(extractArtifact('HG1 resolve 后的出口节点（无 artifact）'), null);
  assert.strictEqual(extractArtifact(null), null);
});
