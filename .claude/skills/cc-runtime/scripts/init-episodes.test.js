#!/usr/bin/env node
/**
 * init-episodes.test.js —— M0 验证（60-impl-plan 验证闸）
 * 纯 node:test，无外部依赖。覆盖：创建/幂等/--force/defaults 结构。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { initEpisodes, defaults } = require('./init-episodes');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ep-'));
}

test('initEpisodes 创建 episodes.json schema v2 三段结构', () => {
  const root = tmpRoot();
  const r = initEpisodes(root, { now: '2026-06-28T00:00:00Z' });
  assert.deepEqual(r.created, ['episodes.json']);
  assert.deepEqual(r.skipped, []);
  const ep = JSON.parse(fs.readFileSync(path.join(root, 'episodes.json'), 'utf8'));
  assert.equal(ep.schema_version, 2);
  assert.deepEqual(ep.verified_facts, []);
  assert.deepEqual(ep.lessons, []);
  assert.equal(ep.last_run.node, null);
  assert.equal(ep.last_run.iter, 0);
  assert.equal(ep.updated_at, '2026-06-28T00:00:00Z');
});

test('initEpisodes 幂等：已存在 skipped，内容不变', () => {
  const root = tmpRoot();
  initEpisodes(root, { now: 't1' });
  const r = initEpisodes(root, { now: 't2' });
  assert.deepEqual(r.skipped, ['episodes.json']);
  assert.deepEqual(r.created, []);
  const ep = JSON.parse(fs.readFileSync(path.join(root, 'episodes.json'), 'utf8'));
  assert.equal(ep.updated_at, 't1'); // 未被 t2 覆盖
});

test('initEpisodes --force 覆盖已存在', () => {
  const root = tmpRoot();
  initEpisodes(root, { now: 't1' });
  const r = initEpisodes(root, { now: 't2', force: true });
  assert.deepEqual(r.created, ['episodes.json']);
  const ep = JSON.parse(fs.readFileSync(path.join(root, 'episodes.json'), 'utf8'));
  assert.equal(ep.updated_at, 't2');
});

test('initEpisodes 自动创建不存在的 root 目录', () => {
  const root = path.join(tmpRoot(), 'nested', 'state');
  const r = initEpisodes(root, { now: 't' });
  assert.deepEqual(r.created, ['episodes.json']);
  assert.ok(fs.existsSync(path.join(root, 'episodes.json')));
});

test('defaults 返回 schema v2 完整结构', () => {
  const d = defaults('t');
  assert.equal(d.schema_version, 2);
  assert.ok(Array.isArray(d.verified_facts));
  assert.ok(Array.isArray(d.lessons));
  assert.equal(typeof d.last_run, 'object');
  assert.equal(d.last_run.node, null);
  assert.equal(d.updated_at, 't');
});
