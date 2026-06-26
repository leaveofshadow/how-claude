#!/usr/bin/env node
/**
 * write-artifact.test.js —— write-artifact 落盘受控验证（hcc 目录统一阶段4 Task 1）
 * 运行：node --test write-artifact.test.js
 * 约束（C2）：node 内建。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPT = path.join(__dirname, 'write-artifact.js');
const DAG = path.join(__dirname, '..', 'dag.venture.json');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'));
}

test('write-artifact 写到 dag exit_condition 规定路径（N1）', () => {
  const tmp = mkTmp();
  try {
    const dagCopy = path.join(tmp, 'dag.json');
    fs.copyFileSync(DAG, dagCopy);
    const inFile = path.join(tmp, 'content.md');
    fs.writeFileSync(inFile, '市场痛点：测试产物', 'utf8');
    const r = spawnSync('node', [SCRIPT, '--node', 'N1', '--in', inFile, '--dag', dagCopy], { cwd: tmp, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `exit 0（stderr=${(r.stderr || '').trim().slice(0, 80)}）`);
    const out = JSON.parse(r.stdout);
    assert.ok(out.path.endsWith('N1_机会调查_report.md'), `path 应为 N1 规定路径，实际 ${out.path}`);
    assert.ok(out.bytes > 0, 'bytes > 0');
    const written = path.join(tmp, out.path.replace(/\//g, path.sep));
    assert.ok(fs.existsSync(written), '产物文件已写到规定路径');
    assert.strictEqual(fs.readFileSync(written, 'utf8'), '市场痛点：测试产物', '内容正确');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('write-artifact placeholder 节点（N4 无 artifact 路径）→ exit 1', () => {
  const tmp = mkTmp();
  try {
    const dagCopy = path.join(tmp, 'dag.json');
    fs.copyFileSync(DAG, dagCopy);
    const inFile = path.join(tmp, 'c.md');
    fs.writeFileSync(inFile, 'x', 'utf8');
    const r = spawnSync('node', [SCRIPT, '--node', 'N4', '--in', inFile, '--dag', dagCopy], { cwd: tmp, encoding: 'utf8' });
    assert.strictEqual(r.status, 1, 'N4 placeholder 无 artifact 路径 → exit 1');
    assert.ok((r.stderr || '').includes('无 artifact 路径'), `stderr 应含"无 artifact 路径"，实际 ${(r.stderr || '').trim()}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('write-artifact 缺参数 → exit 1', () => {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
  assert.strictEqual(r.status, 1, '缺参数 → exit 1');
  assert.ok((r.stderr || '').includes('用法'), 'stderr 含"用法"');
});
