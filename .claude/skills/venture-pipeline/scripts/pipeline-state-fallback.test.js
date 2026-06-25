#!/usr/bin/env node
/**
 * pipeline-state-fallback.test.js —— stateRoot 双语义 fallback 验证（hcc 目录统一阶段2）
 *
 * pipeline-state.js resolveStateRoot 拆双语义：
 *   resolveStateRoot（写/init）：固定 .hcc/state（新文件落新位置）
 *   resolveStateRootForRead（读/改）：.hcc/state 优先 + .venture/state fallback
 *
 * 隔离：resolveStateRoot 依赖 cwd（path.resolve('.hcc','state')），用 spawnSync 子进程
 *       设 cwd=tmp 调函数——避开 node:test 并发的 process.chdir 冲突。
 *       pipeline-state.js 有 require.main 守卫（L238），require 不触发 main。
 *
 * 运行：node --test .claude/skills/venture-pipeline/scripts/pipeline-state-fallback.test.js → exit 0
 * 约束（C2）：仅 node 内建。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPT = path.join(__dirname, 'pipeline-state.js');

// 子进程 require pipeline-state.js + 调函数（cwd 隔离）
function callInCwd(cwd, expr) {
  const r = spawnSync('node', ['-e', `const m = require(${JSON.stringify(SCRIPT)}); console.log(${expr});`], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`子进程失败（cwd=${cwd}）：${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ps-fb-'));
}

test('resolveStateRootForRead：.hcc/state 存在则优先（不读 .venture/state）', () => {
  const tmp = mkTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.hcc', 'state'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.venture', 'state'), { recursive: true });
    const out = callInCwd(tmp, 'm.resolveStateRootForRead(undefined)');
    assert.ok(out.includes('.hcc'), `应优先 .hcc/state，实际 ${out}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('resolveStateRootForRead：.hcc/state 不存在则 fallback .venture/state', () => {
  const tmp = mkTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.venture', 'state'), { recursive: true });
    const out = callInCwd(tmp, 'm.resolveStateRootForRead(undefined)');
    assert.ok(out.includes('.venture'), `应 fallback .venture/state，实际 ${out}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('resolveStateRoot（写/init）：固定 .hcc/state（不管 .venture 是否存在）', () => {
  const tmp = mkTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.venture', 'state'), { recursive: true }); // 旧存在
    const out = callInCwd(tmp, 'm.resolveStateRoot(undefined)');
    assert.ok(out.includes('.hcc'), `写应固定 .hcc/state（不受 .venture 影响），实际 ${out}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
