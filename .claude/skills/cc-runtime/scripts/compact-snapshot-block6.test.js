/**
 * compact-snapshot-block6.test.js —— Block⑥ 经验蒸馏扩展验证（M2 验证闸）
 *
 * 测真实全局 hook 子进程。构造 .hcc/state/episodes.json → 断言 snapshot 含 Block⑥ 循环经验。
 * 依据：.hcc/decisions/2026-06-28-episodes-distill/60-impl-plan.md M2 验证闸
 *       （生成 snapshot 含 Block⑥ + last_run 字段）
 * 运行：node --test compact-snapshot-block6.test.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const WRITE_JS = path.join(os.homedir(), '.claude', 'hooks', 'compact-snapshot-write.js');
const HAS_HOOK = fs.existsSync(WRITE_JS);

function writeTranscript(dir) {
  const lines = [
    JSON.stringify({ type: 'user', isMeta: false, message: { content: 'block6 测试目标' } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'block6 要点' }] } }),
  ];
  const tp = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(tp, lines.join('\n') + '\n', 'utf8');
  return tp;
}
function runHook(cwd, transcriptPath, sid) {
  const input = JSON.stringify({ session_id: sid, cwd, transcript_path: transcriptPath, trigger: 'manual' });
  return spawnSync('node', [WRITE_JS], { input, cwd, encoding: 'utf8', timeout: 15000 });
}
function readSnapshot(cwd, sid) {
  return fs.readFileSync(path.join(cwd, '.claude', 'compact-snapshots', sid + '.md'), 'utf8');
}
function makeProjectRoot(dir) {
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{}\n', 'utf8'); // 锚定此 root 为真实项目根
}

test('Block⑥ 正确性：episodes.json 存在 → snapshot 含循环经验（facts/lessons/last_run）', { skip: !HAS_HOOK && '全局 hook 不存在' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ep6-'));
  const sid = 'verify-block6';
  try {
    makeProjectRoot(root);
    const tp = writeTranscript(root);
    const stateDir = path.join(root, '.hcc', 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'episodes.json'), JSON.stringify({
      schema_version: 2,
      verified_facts: [{ fact: '市场A有3竞品', evidence: '调研', confidence: 'high', utility: 5, ts: 't' }],
      lessons: [{ lesson: '别用X库', signal: '验证闸挂', anti_pattern: '改用Y', occurrence: 2, utility: 4, ts: 't' }],
      last_run: { node: 'N3', iter: 3, result: '部分通过', ts: 't' },
      updated_at: 't',
    }), 'utf8');
    const r = runHook(root, tp, sid);
    assert.strictEqual(r.status, 0, `write.js 应 exit 0（实际 ${r.status}）stderr=${r.stderr}`);
    const snap = readSnapshot(root, sid);
    assert.ok(snap.includes('循环经验'), 'snapshot 应含 Block⑥「循环经验」标题');
    assert.ok(snap.includes('市场A有3竞品'), 'Block⑥ 应含 verified_fact');
    assert.ok(snap.includes('别用X库'), 'Block⑥ 应含 lesson');
    assert.ok(snap.includes('节点 N3'), 'Block⑥ 应含 last_run node=N3');
    assert.ok(snap.includes('utility top 5'), 'Block⑥ 应按 utility 排序标注');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Block⑥ 兼容：无 episodes.json → 不输出 Block⑥（零影响非 hcc 项目）', { skip: !HAS_HOOK && '全局 hook 不存在' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noep6-'));
  const sid = 'verify-block6-noep';
  try {
    makeProjectRoot(root);
    const tp = writeTranscript(root);
    const r = runHook(root, tp, sid);
    assert.strictEqual(r.status, 0);
    const snap = readSnapshot(root, sid);
    assert.ok(!snap.includes('循环经验'), '无 episodes.json 时不应输出 Block⑥');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Block⑥ consolidation：utility 衰减 + evict 低 utility 低 occurrence + 回写 episodes.json', { skip: !HAS_HOOK && '全局 hook 不存在' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ep6cons-'));
  const sid = 'verify-block6-cons';
  try {
    makeProjectRoot(root);
    const tp = writeTranscript(root);
    const stateDir = path.join(root, '.hcc', 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'episodes.json'), JSON.stringify({
      schema_version: 2,
      verified_facts: [
        { fact: '高价值', utility: 5, occurrence: 1, ts: 't' },      // 衰减→4，留
        { fact: '低价值偶发', utility: 1, occurrence: 0, ts: 't' },  // 衰减→0，occ<3，evict
        { fact: '反复出现', utility: 1, occurrence: 5, ts: 't' },    // 衰减→0，occ≥3，留
      ],
      lessons: [],
      last_run: { node: null, iter: 0, result: null, ts: null },
      updated_at: 't',
    }), 'utf8');
    const r = runHook(root, tp, sid);
    assert.strictEqual(r.status, 0, `write.js 应 exit 0（实际 ${r.status}）stderr=${r.stderr}`);
    // 读回写后的 episodes.json（consolidation 已跑）
    const ep = JSON.parse(fs.readFileSync(path.join(stateDir, 'episodes.json'), 'utf8'));
    const facts = ep.verified_facts;
    assert.ok(facts.some(f => f.fact === '高价值' && f.utility === 4), '高价值衰减 5→4 且留');
    assert.ok(!facts.some(f => f.fact === '低价值偶发'), '低价值偶发 evict（utility→0 + occ<3）');
    assert.ok(facts.some(f => f.fact === '反复出现'), '反复出现留（occ≥3 即使 utility→0）');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
