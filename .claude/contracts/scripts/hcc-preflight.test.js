// hcc-preflight.test.js — 测 hcc-preflight.js 核心逻辑（M6 R6.5，修复 #6）
// 覆盖：existsSync 查路径 + 缺失分级（required 阻断 / optional 告警）+ TTL 24h 决策 + 汇总
// 测纯函数（scanDeps/decideCache/summarize），不触发 CLI main（require.main !== preflight）

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const preflight = require('./hcc-preflight.js');
const scanDeps = preflight.scanDeps;
const decideCache = preflight.decideCache;
const summarize = preflight.summarize;
const TTL_MS = preflight.TTL_MS;

// 造临时项目根（含可选 grill-me fixture），返回路径；用例结束清理
function mkTmpRoot(withGrillMe) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hcc-pf-'));
  if (withGrillMe) {
    fs.mkdirSync(path.join(tmp, '.claude/skills/grill-me'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.claude/skills/grill-me/SKILL.md'), '# grill-me', 'utf8');
  }
  return tmp;
}

test('用例1: grill-me 存在 fixture → installed + severity ok', () => {
  const tmp = mkTmpRoot(true);
  try {
    const deps = [{ name: 'grill-me', required: true, check_paths: ['.claude/skills/grill-me/SKILL.md'] }];
    const r = scanDeps(deps, tmp);
    assert.strictEqual(r[0].installed, true);
    assert.strictEqual(r[0].severity, 'ok');
    assert.ok(r[0].found_at && r[0].found_at.indexOf('grill-me') >= 0);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('用例2: grill-me 缺失 + required=true → missing + severity block（阻断）', () => {
  const tmp = mkTmpRoot(false);
  try {
    const deps = [{ name: 'grill-me', required: true, check_paths: ['.claude/skills/grill-me/SKILL.md'] }];
    const r = scanDeps(deps, tmp);
    assert.strictEqual(r[0].installed, false);
    assert.strictEqual(r[0].severity, 'block');
    assert.strictEqual(r[0].found_at, null);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('用例2b: optional 依赖缺失 + required=false → severity warn（告警，非阻断）', () => {
  const tmp = mkTmpRoot(false);
  try {
    const deps = [{ name: 'bergside', required: false, check_paths: ['.claude/skills/minimal/SKILL.md'] }];
    const r = scanDeps(deps, tmp);
    assert.strictEqual(r[0].installed, false);
    assert.strictEqual(r[0].severity, 'warn');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('用例2c: 双查路径 fallback——项目级缺失但绝对路径(用户级)存在 → installed', () => {
  const tmp = mkTmpRoot(false);
  try {
    // 造一个绝对路径 fixture（模拟用户级 skill）
    const absDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-skills-'));
    fs.mkdirSync(path.join(absDir, 'grill-me'), { recursive: true });
    const absSkill = path.join(absDir, 'grill-me', 'SKILL.md');
    fs.writeFileSync(absSkill, '# grill-me', 'utf8');
    const deps = [{
      name: 'grill-me', required: true,
      check_paths: ['.claude/skills/grill-me/SKILL.md', absSkill]  // 项目级(缺) + 绝对(存在)
    }];
    const r = scanDeps(deps, tmp);
    assert.strictEqual(r[0].installed, true);  // fallback 命中绝对路径
    fs.rmSync(absDir, { recursive: true, force: true });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('用例3: TTL < 24h → 决策 cache', () => {
  const now = 1000000;
  assert.strictEqual(decideCache(now - 1000, now), 'cache');           // 1s 前
  assert.strictEqual(decideCache(now - (TTL_MS - 1), now), 'cache');   // 接近 24h 边界内
});

test('用例4: TTL >= 24h 或无缓存 → 决策 rescan', () => {
  const now = 1000000;
  assert.strictEqual(decideCache(now - TTL_MS - 1, now), 'rescan');    // 超 24h
  assert.strictEqual(decideCache(undefined, now), 'rescan');           // 无缓存
  assert.strictEqual(decideCache('bad', now), 'rescan');               // timestamp 非数
  assert.strictEqual(decideCache(null, now), 'rescan');
});

test('汇总 summarize 四字段正确', () => {
  const results = [
    { installed: true, severity: 'ok' },
    { installed: false, severity: 'block' },
    { installed: false, severity: 'warn' }
  ];
  const s = summarize(results);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.installed, 1);
  assert.strictEqual(s.missing_block, 1);
  assert.strictEqual(s.missing_warn, 1);
});

test('TTL_MS 常量 = 24h', () => {
  assert.strictEqual(TTL_MS, 24 * 60 * 60 * 1000);
});
