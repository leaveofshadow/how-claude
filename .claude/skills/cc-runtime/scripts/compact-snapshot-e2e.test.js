/**
 * compact-snapshot-e2e.test.js —— Block⑤ 扩展端到端验证（基线-B）
 *
 * 测的是【真实的用户全局 hook 子进程】，非内联副本。用 spawnSync 喂 stdin 触发 write.js，
 * 检查生成的 snapshot 正文。覆盖两个维度：
 *   - 兼容性：非 venture 项目（无 .venture/state）→ exit 0 + 无 Block⑤ + 现有 Block①②③④ 正常
 *   - 正确性：venture 项目 → snapshot 含完整 Block⑤（方向版本/路径/废弃路径/节点/续跑锚点/健康告警）
 *
 * 依据：50-decision.md「扩展 compact-snapshot 最轻形态」基线层；state-schema.md §3 direction.json 字段。
 * 运行：node --test compact-snapshot-e2e.test.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// 被测目标：用户全局 PreCompact hook（选项甲：纯原生，零插件耦合）
const WRITE_JS = path.join(os.homedir(), '.claude', 'hooks', 'compact-snapshot-write.js');
const HAS_HOOK = fs.existsSync(WRITE_JS);

// 构造最小 transcript：1 条真实 user prompt（Block③）+ 1 条 assistant text（Block④）
function writeTranscript(dir) {
  const lines = [
    JSON.stringify({ type: 'user', isMeta: false, message: { content: '端到端测试目标' } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '端到端测试要点' }] } }),
  ];
  const tp = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(tp, lines.join('\n') + '\n', 'utf8');
  return tp;
}

// 以 PreCompact hook 的 stdin 契约触发真实 write.js
function runHook(cwd, transcriptPath) {
  const input = JSON.stringify({
    session_id: 'verify-block5-e2e', // 无路径分隔符，通过 write.js 的文件名防护
    cwd,
    transcript_path: transcriptPath,
    trigger: 'manual',
  });
  return spawnSync('node', [WRITE_JS], { input, cwd, encoding: 'utf8', timeout: 15000 });
}

function readSnapshot(cwd) {
  return fs.readFileSync(
    path.join(cwd, '.claude', 'compact-snapshots', 'verify-block5-e2e.md'), 'utf8'
  );
}

// 让 write.js 的 findProjectRoot 锚定此临时 root 为「真实项目根」（REAL_MARKERS 含 settings.json）。
// 修复 e2e 失败根因：os.tmpdir() 位于用户 home 子树，write.js 的 findProjectRoot 向上遍历
// 会命中全局 ~/.claude/（含 skills/hooks/settings 等 marker），导致 snapshot 误写到全局
// （project=newuser）而非临时 root，readSnapshot(root) 随即 ENOENT。
// 在临时 root 造 .claude/settings.json marker，findProjectRoot i=0 即命中锚定此 root。
function makeProjectRoot(dir) {
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{}\n', 'utf8');
}

// ── 兼容性：非 venture 项目零影响（改的是全局 hook，必须向后兼容）──
test('兼容性：非 venture 目录 → exit 0 + 无 Block⑤ + 现有 Block 正常', { skip: !HAS_HOOK && '全局 hook 不存在' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noven-'));
  try {
    makeProjectRoot(root);
    const tp = writeTranscript(root);
    const r = runHook(root, tp);
    assert.strictEqual(r.status, 0, `write.js 应 exit 0（实际 ${r.status}）stderr=${r.stderr}`);

    const snap = readSnapshot(root);
    // 向后兼容核心断言：非 venture 项目不应出现 Block⑤
    assert.ok(!snap.includes('venture 方向状态'), '非 venture 项目 snapshot 不应含 Block⑤');
    // 现有 4 个 Block 必须照常工作（证明扩展未破坏既有行为）
    assert.ok(snap.includes('端到端测试目标'), 'Block③ 当前目标应正常');
    assert.ok(snap.includes('端到端测试要点'), 'Block④ 最近要点应正常');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── 正确性：venture 项目 → snapshot 含完整 Block⑤ ──
test('正确性：venture 目录 → snapshot 含完整 Block⑤', { skip: !HAS_HOOK && '全局 hook 不存在' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ven-'));
  try {
    makeProjectRoot(root);
    // 构造 .venture/state：direction v2（v1 已废弃）+ checkpoint（judge 节点停滞）
    const stateDir = path.join(root, '.venture', 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'direction.json'), JSON.stringify({
      current_version: 2,
      status: 'active',
      current_path: '.venture/artifacts/v2/',
      superseded_paths: ['.venture/artifacts/v1/'], // 痛点4：旧方向路径
    }));
    fs.writeFileSync(path.join(stateDir, 'checkpoint.json'), JSON.stringify({
      current_node: 'judge',
      current_task: '评审方案A',
      iteration: 5,
      progress_percent: 60,
      continue_from: 'judge/iter5', // 痛点3：续跑锚点
      health: 'stagnant', // C1 修订：健康告警
      stagnation_count: 2,
      direction_version: 2,
    }));

    const tp = writeTranscript(root);
    const r = runHook(root, tp);
    assert.strictEqual(r.status, 0, `write.js 应 exit 0（实际 ${r.status}）stderr=${r.stderr}`);

    const snap = readSnapshot(root);
    // Block⑤ 标题 + 当前方向
    assert.ok(snap.includes('## venture 方向状态'), '应含 Block⑤ 标题');
    assert.ok(snap.includes('v2 (active)'), '应含当前方向 v2 active');
    assert.ok(snap.includes('.venture/artifacts/v2/'), '应含当前方向路径');
    // 痛点4 核心：废弃路径告警（compact 后 agent 一眼看到「v1 别读」）
    assert.ok(snap.includes('🚫 已废弃方向路径'), '应含废弃路径告警');
    assert.ok(snap.includes('.venture/artifacts/v1/'), '应列出被废弃的 v1 路径');
    // 痛点3 核心：续跑锚点（compact 后 agent 知道「从 judge/iter5 接着干」）
    assert.ok(snap.includes('节点/任务: judge'), '应含当前节点');
    assert.ok(snap.includes('评审方案A'), '应含当前任务');
    assert.ok(snap.includes('第 5 轮 · 60%'), '应含迭代/进度');
    assert.ok(snap.includes('续跑锚点: judge/iter5'), '应含续跑锚点');
    // C1 健康：停滞告警
    assert.ok(snap.includes('stagnant'), '应含健康告警');
    assert.ok(snap.includes('连续 2 轮无进展'), '应含停滞计数');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── 健壮性：direction.json 损坏 → 静默跳过 Block⑤，绝不影响 compact ──
test('健壮性：direction.json 损坏 → 静默 exit 0 + 无 Block⑤', { skip: !HAS_HOOK && '全局 hook 不存在' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'corrupt-'));
  try {
    makeProjectRoot(root);
    const stateDir = path.join(root, '.venture', 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'direction.json'), '{ 不是合法 JSON');
    // checkpoint 留空（只有损坏的 direction）

    const tp = writeTranscript(root);
    const r = runHook(root, tp);
    assert.strictEqual(r.status, 0, '损坏 JSON 也必须 exit 0（绝不阻塞 compact）');

    const snap = readSnapshot(root);
    assert.ok(!snap.includes('venture 方向状态'), '损坏时应静默跳过 Block⑤');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── hcc 目录统一（gap ②）：.hcc/state 优先于 .venture/state ──
// 改造点：readVentureState 改目录级 resolve（.hcc/state 优先 + .venture/state fallback），
// 对齐 pipeline-state.js:resolveStateRootForRead / shift-direction.js:resolveRoot（阶段2）。
// 验证：.hcc/state + .venture/state 同时存在 → 读 .hcc/state（新路径），忽略 .venture/state（旧）。
test('hcc 统一（gap②）：.hcc/state 优先于 .venture/state → snapshot 用 .hcc 数据', { skip: !HAS_HOOK && '全局 hook 不存在' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hcchcc-'));
  try {
    makeProjectRoot(root);
    // 构造 .hcc/state（新路径，direction v3 + checkpoint hcc-node）
    const hccDir = path.join(root, '.hcc', 'state');
    fs.mkdirSync(hccDir, { recursive: true });
    fs.writeFileSync(path.join(hccDir, 'direction.json'), JSON.stringify({
      current_version: 3,
      status: 'active',
      current_path: '.hcc/decisions/v3/',
      superseded_paths: [],
    }));
    fs.writeFileSync(path.join(hccDir, 'checkpoint.json'), JSON.stringify({
      current_node: 'hcc-node',
      iteration: 7,
      progress_percent: 80,
      direction_version: 3,
    }));
    // 旧 .venture/state（direction v1，应被忽略——证明优先读 .hcc/state）
    const venDir = path.join(root, '.venture', 'state');
    fs.mkdirSync(venDir, { recursive: true });
    fs.writeFileSync(path.join(venDir, 'direction.json'), JSON.stringify({
      current_version: 1,
      status: 'active',
      current_path: '.venture/artifacts/v1/',
    }));

    const tp = writeTranscript(root);
    const r = runHook(root, tp);
    assert.strictEqual(r.status, 0, `write.js 应 exit 0（实际 ${r.status}）stderr=${r.stderr}`);

    const snap = readSnapshot(root);
    // 优先读 .hcc/state（v3 / hcc-node）
    assert.ok(snap.includes('## venture 方向状态'), '应含 Block⑤ 标题');
    assert.ok(snap.includes('v3 (active)'), '应读 .hcc/state 的 v3（非 .venture v1）');
    assert.ok(snap.includes('hcc-node'), '应读 .hcc/state 的节点');
    assert.ok(snap.includes('第 7 轮 · 80%'), '应读 .hcc/state 的迭代/进度');
    // 反证：不读 .venture/state 的 v1
    assert.ok(!snap.includes('v1 (active)'), '不应读 .venture/state 的 v1（fallback 顺序：.hcc 优先）');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
