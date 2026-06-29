#!/usr/bin/env node
/**
 * monitor-diff.test.js —— monitor.js git diff + 聚合 TDD（task #41 第二刀）
 *
 * 覆盖：
 *   isInterfaceFile / isTechStackFile —— 文件分类启发式（纯函数）
 *   gitDiffStat —— git diff --numstat 量 + 分类（child_process execSync 仅调 git）
 *   detectDrift —— 聚合 baseline + stagnation + diff → 漂移材料 + mechanical_signals
 *   CLI e2e —— node monitor.js --run <dir> --root <root>
 *
 * 约束（C2）：仅 node 内建 + child_process（仅调 git）。git fixture 用 spawnSync git init。
 * 运行：node --test .claude/skills/venture-pipeline/scripts/monitor-diff.test.js → exit 0
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const monitor = require('./monitor.js');
const SCRIPT = path.join(__dirname, 'monitor.js');

// ── git fixture helper ──
function mkGitRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mon-git-'));
  spawnSync('git', ['init', '-q'], { cwd: tmp, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 't@t.test'], { cwd: tmp, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: tmp, encoding: 'utf8' });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tmp, encoding: 'utf8' });
  return tmp;
}
function gitCommit(cwd, msg) {
  spawnSync('git', ['add', '-A'], { cwd, encoding: 'utf8' });
  spawnSync('git', ['commit', '-q', '-m', msg], { cwd, encoding: 'utf8' });
}
function writeFile(cwd, rel, content) {
  const fp = path.join(cwd, ...rel.split(/[\\/]/));
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
}

// ── 文件分类启发式（纯函数）──

test('isInterfaceFile：路径含 contract/interface/api/schema/dag → true', () => {
  assert.strictEqual(monitor.isInterfaceFile('src/contracts/api.js'), true);
  assert.strictEqual(monitor.isInterfaceFile('contracts/schema.md'), true);
  assert.strictEqual(monitor.isInterfaceFile('src/interfaces/types.ts'), true);
  assert.strictEqual(monitor.isInterfaceFile('src/index.js'), true);
  assert.strictEqual(monitor.isInterfaceFile('src/utils/helper.js'), false);
});

test('isTechStackFile：package.json/go.mod/dag.*.json 等 → true', () => {
  assert.strictEqual(monitor.isTechStackFile('package.json'), true);
  assert.strictEqual(monitor.isTechStackFile('subdir/go.mod'), true);
  assert.strictEqual(monitor.isTechStackFile('dag.venture.json'), true);
  assert.strictEqual(monitor.isTechStackFile('package-lock.json'), true);
  assert.strictEqual(monitor.isTechStackFile('src/index.js'), false);
});

test('safeRef：HEAD~N / HEAD^ ref 语法合法（不误 fallback HEAD）', () => {
  assert.strictEqual(monitor.safeRef('HEAD~5'), 'HEAD~5');
  assert.strictEqual(monitor.safeRef('HEAD^'), 'HEAD^');
  assert.strictEqual(monitor.safeRef('main~2'), 'main~2');
  assert.strictEqual(monitor.safeRef('HEAD'), 'HEAD');
  assert.strictEqual(monitor.safeRef('abc123def'), 'abc123def');
});

test('safeRef：shell 元字符注入仍拒（fallback HEAD）', () => {
  assert.strictEqual(monitor.safeRef('; rm -rf /'), 'HEAD');
  assert.strictEqual(monitor.safeRef('$(whoami)'), 'HEAD');
  assert.strictEqual(monitor.safeRef('HEAD;echo'), 'HEAD');
  assert.strictEqual(monitor.safeRef('`id`'), 'HEAD');
  assert.strictEqual(monitor.safeRef(null), 'HEAD');
});

// ── gitDiffStat ──

test('gitDiffStat：working tree 未提交变更（since=HEAD 默认）→ 检测 +/- 行 + 文件分类', () => {
  const repo = mkGitRepo();
  try {
    writeFile(repo, 'src/app.js', 'console.log(1)\n');
    gitCommit(repo, 'init');
    // working tree 变更：改 app.js + 新增 package.json + 新增 contracts/api.js
    writeFile(repo, 'src/app.js', 'console.log(1)\nconsole.log(2)\n');  // +1
    writeFile(repo, 'package.json', '{}');                              // 新增（技术栈）
    writeFile(repo, 'contracts/api.js', 'export default {}\n');        // 新增（接口）

    const out = monitor.gitDiffStat(repo);  // since 默认 HEAD
    assert.strictEqual(out.error, null, `不应报错，实际 ${out.error}`);
    assert.ok(out.changed_files.includes('src/app.js'), `应含 app.js，实际 ${JSON.stringify(out.changed_files)}`);
    assert.ok(out.changed_files.includes('package.json'));
    assert.ok(out.changed_files.includes('contracts/api.js'));
    assert.ok(out.diff_insertions >= 1, `insertions 应 >=1，实际 ${out.diff_insertions}`);
    assert.ok(out.tech_stack_files_changed.includes('package.json'));
    assert.ok(out.interface_files_changed.includes('contracts/api.js'));
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('gitDiffStat：since=<commit> → 只报该 commit 之后的变更', () => {
  const repo = mkGitRepo();
  try {
    writeFile(repo, 'a.js', '1\n');
    gitCommit(repo, 'c1');
    const head1 = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
    writeFile(repo, 'b.js', '2\n');
    gitCommit(repo, 'c2');

    const out = monitor.gitDiffStat(repo, head1);  // c1 → c2 的变更
    assert.strictEqual(out.error, null);
    assert.ok(out.changed_files.includes('b.js'), `应含 b.js（c2 新增），实际 ${JSON.stringify(out.changed_files)}`);
    assert.ok(!out.changed_files.includes('a.js'), `不应含 a.js（c1 已存在）`);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('gitDiffStat：非 git 仓库 → error 不阻塞（机械层容错）', () => {
  const nongit = fs.mkdtempSync(path.join(os.tmpdir(), 'mon-nogit-'));
  try {
    const out = monitor.gitDiffStat(nongit);
    assert.ok(out.error, `非 git 仓库应报 error，实际 ${JSON.stringify(out)}`);
    assert.strictEqual(out.diff_lines_total, 0);
    assert.strictEqual(out.changed_files.length, 0);
  } finally { fs.rmSync(nongit, { recursive: true, force: true }); }
});

test('gitDiffStat：无变更 → changed_files 空 + diff_lines_total=0', () => {
  const repo = mkGitRepo();
  try {
    writeFile(repo, 'a.js', '1\n');
    gitCommit(repo, 'c1');
    const out = monitor.gitDiffStat(repo);  // 干净 working tree
    assert.strictEqual(out.error, null);
    assert.strictEqual(out.changed_files.length, 0);
    assert.strictEqual(out.diff_lines_total, 0);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

// ── detectDrift 聚合 ──

test('detectDrift：聚合 baseline + stagnation + diff → 漂移材料 + mechanical_signals', () => {
  const repo = mkGitRepo();
  try {
    // baseline 决策目录
    const run = path.join(repo, '.hcc', 'decisions', 'testrun');
    writeFile(repo, '.hcc/decisions/testrun/50-decision.md', '# 裁决\n选 Postgres');
    writeFile(repo, '.hcc/decisions/testrun/60-impl-plan.md', '## 技术选型确认\nPostgres');
    writeFile(repo, '.hcc/decisions/testrun/70-requirements.md', '## M0\n### R0.1');
    // cc-runtime direction.json（stagnation）
    writeFile(repo, '.hcc/state/direction.json', JSON.stringify({
      checkpoint: { stagnation_count: 4, health: 'stagnant_warn' },
    }));
    // 初始 commit + 变更
    writeFile(repo, 'src/app.js', '1\n');
    gitCommit(repo, 'init');
    writeFile(repo, 'src/app.js', '1\n2\n');
    writeFile(repo, 'package.json', '{}');

    const out = monitor.detectDrift({ runDir: run, root: repo, stagnationK: 3 });
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.command, 'monitor');
    assert.strictEqual(out.baseline.files_present['50'], true);
    assert.strictEqual(out.stagnation.stagnation_count, 4);
    assert.strictEqual(out.mechanical_signals.stagnation_count, 4);
    assert.strictEqual(out.mechanical_signals.stagnation_blocked, true, '4>=3 应 blocked');
    assert.ok(out.diff.changed_files.includes('package.json'));
    assert.ok(out.mechanical_signals.tech_stack_files_changed.includes('package.json'));
    assert.ok(out.mechanical_hints.includes('tech_drift_signal'));
    assert.ok(out.mechanical_hints.includes('implementation_stall_signal'));
    assert.strictEqual(out.needs_semantic_classification, true);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('detectDrift：接口文件变更 → architecture_drift_signal', () => {
  const repo = mkGitRepo();
  try {
    writeFile(repo, 'src/app.js', '1\n');
    gitCommit(repo, 'init');
    writeFile(repo, 'contracts/api.js', 'export default {}\n');  // 接口文件新增

    const out = monitor.detectDrift({ runDir: null, root: repo });
    assert.ok(out.mechanical_hints.includes('architecture_drift_signal'), `应含架构信号，实际 ${out.mechanical_hints}`);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('detectDrift：无变更 + 无 stagnation → no_drift_detected', () => {
  const repo = mkGitRepo();
  try {
    writeFile(repo, 'a.js', '1\n');
    gitCommit(repo, 'init');
    const out = monitor.detectDrift({ runDir: null, root: repo });
    assert.ok(out.mechanical_hints.includes('no_drift_detected'), `应含 no_drift，实际 ${out.mechanical_hints}`);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('detectDrift：有 diff 但无接口/技术栈文件 → generic_drift_signal（避免空 hints 歧义）', () => {
  const repo = mkGitRepo();
  try {
    writeFile(repo, 'src/app.js', '1\n');
    gitCommit(repo, 'init');
    writeFile(repo, 'src/app.js', '1\n2\n3\n');  // 普通文件变更（非接口/技术栈）
    const out = monitor.detectDrift({ runDir: null, root: repo });
    assert.ok(out.mechanical_hints.includes('generic_drift_signal'), `应含 generic_drift，实际 ${out.mechanical_hints}`);
    assert.strictEqual(out.mechanical_signals.diff_lines_total > 0, true);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

// ── CLI e2e ──

test('CLI：node monitor.js --run <dir> --root <root> 输出漂移材料 JSON', () => {
  const repo = mkGitRepo();
  try {
    const run = path.join(repo, '.hcc', 'decisions', 'cli');
    writeFile(repo, '.hcc/decisions/cli/50-decision.md', '裁决X');
    writeFile(repo, 'src/app.js', '1\n');
    gitCommit(repo, 'init');
    writeFile(repo, 'src/app.js', '1\n2\n');

    const r = spawnSync('node', [SCRIPT, '--run', run, '--root', repo], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `CLI 应 exit 0，stderr=${r.stderr}`);
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.command, 'monitor');
    assert.strictEqual(out.baseline.files_present['50'], true);
    assert.ok(out.diff.changed_files.includes('src/app.js'));
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});
