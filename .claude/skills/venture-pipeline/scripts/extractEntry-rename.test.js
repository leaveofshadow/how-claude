#!/usr/bin/env node
/**
 * extractEntry-rename.test.js —— M0 命名追溯安全性验证（50-decision 修复 #5）
 *
 * extractEntry（venture-resume.js:250-255）用【动态前缀】正则提取入口命令：
 *   new RegExp(escapeRegex(skill) + '\\s+/([a-z][a-z0-9_-]*)', 'i')
 * 前缀来自 node.skill 字段（不硬编码 skill 名）→ 命名追溯要求 skill 字段 + exit_condition
 *   内嵌文本【成对】更改，否则 extractEntry 静默返回 null（orchestrate 丢失入口点）。
 *
 * 验证（venture-judge → venture-sales-judge 重命名后入口提取仍正确）：
 *   - 真 dag 数据 N1/N2：skill=venture-sales-judge + exit 含 "venture-sales-judge /judge|/compete" → /judge /compete
 *   - 真 dag 数据 N3：hcc-decision 无 "/入口" 模式 → null
 *   - ★命名追溯一致性反例：skill 改新名 + exit 残留旧名 "venture-judge /judge" → null（前缀限定，旧名不匹配新 skill）
 *   - 动态前缀：同一段 exit 文本，skill=新名匹配 / skill=旧名返回 null
 *
 * 运行（M0 可证伪验证）：node --test .claude/skills/venture-pipeline/scripts/extractEntry-rename.test.js → exit 0
 * 约束（C2）：仅 node 内建 fs+path+assert，无外部依赖（node:test / node:assert 为 Node 内建）。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { extractEntry } = require('./venture-resume.js');

// 读真实 dag 数据（端到端验证实际拓扑，非手工 fixture）
const DAG_PATH = path.join(__dirname, '..', 'dag.venture.json');
const dag = JSON.parse(fs.readFileSync(DAG_PATH, 'utf8'));
const nodeById = Object.fromEntries(dag.nodes.map((n) => [n.id, n]));

// ── 真 dag 数据：N1 skill=venture-sales-judge + exit 含 "venture-sales-judge /judge" → /judge ──
test('N1：skill=venture-sales-judge + exit_condition 含 "venture-sales-judge /judge" → /judge', () => {
  const n = nodeById.N1;
  assert.strictEqual(n.skill, 'venture-sales-judge', 'N1.skill 已重命名');
  const entry = extractEntry(n.skill, n.exit_condition);
  assert.strictEqual(entry, '/judge', 'extractEntry 提取 /judge 入口');
});

// ── 真 dag 数据：N2 → /compete ──
test('N2：skill=venture-sales-judge + exit_condition 含 "venture-sales-judge /compete" → /compete', () => {
  const n = nodeById.N2;
  assert.strictEqual(n.skill, 'venture-sales-judge', 'N2.skill 已重命名');
  const entry = extractEntry(n.skill, n.exit_condition);
  assert.strictEqual(entry, '/compete', 'extractEntry 提取 /compete 入口');
});

// ── N3：hcc-decision 无 "/入口" 模式 → null ──
test('N3：hcc-decision 无 "/入口" → null', () => {
  const n = nodeById.N3;
  const entry = extractEntry(n.skill, n.exit_condition);
  assert.strictEqual(entry, null, 'hcc-decision 无 / 入口，返回 null');
});

// ── ★ 命名追溯一致性反例：skill 改新名但 exit 残留旧名 → null（M0 核心验证）──
// 证明：skill 字段与 exit_condition 文本必须成对更改；漏改 exit → extractEntry 静默失效（orchestrate 丢失入口）
test('★反例：skill=venture-sales-judge + exit 残留旧名 "venture-judge /judge" → null（前缀限定）', () => {
  const staleExit = 'artifact N1.md 存在且含关键词（venture-judge /judge 阶段一产出）';
  const entry = extractEntry('venture-sales-judge', staleExit);
  assert.strictEqual(
    entry,
    null,
    '旧名 venture-judge 不匹配新 skill 前缀 → null（证明前缀来自 skill 字段，命名追溯须成对改）'
  );
});

// ── 动态前缀：同一段 exit 文本，新名匹配 / 旧名返回 null ──
test('动态前缀：exit="venture-sales-judge /judge"，skill=新名匹配 / skill=旧名 null', () => {
  const exit = 'venture-sales-judge /judge 阶段一机会调查产出';
  assert.strictEqual(extractEntry('venture-sales-judge', exit), '/judge', '新 skill 名匹配 → /judge');
  assert.strictEqual(extractEntry('venture-judge', exit), null, '旧 skill 名在新文本里无 / 模式 → null');
});

// ── skill 前缀限定：排除 .venture/artifacts 路径里的 /（extractEntry 注释 L248 行为）──
test('路径排除：exit 含 .venture/artifacts/N1-xx.md 路径，不被误提取，仍取 skill+/judge', () => {
  const exit =
    'artifact .venture/artifacts/N1-机会调查.md 存在且含关键词（venture-sales-judge /judge 产出）';
  assert.strictEqual(
    extractEntry('venture-sales-judge', exit),
    '/judge',
    '正则匹配 skill+/judge，而非 artifacts 路径里的 /'
  );
});
