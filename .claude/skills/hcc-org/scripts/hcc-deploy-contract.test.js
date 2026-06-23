#!/usr/bin/env node
/**
 * hcc-deploy-contract.test.js —— 产出项目部署契约 schema 断言（charter 块1 复盘 P2，堵 REVIEW MINOR 3.x）
 *
 * 契约依据：hcc-org/SKILL.md §6 产出项目部署契约（框架级声明：部署要求随产出等级裁剪）。
 * 断言 hcc-dependencies.json 部署字段齐全（可证伪闸 §6 末尾声明）：
 *   ① 每条依赖有 location ∈ {project, sandbox, user}（§6.1 三类位置）
 *   ② 每条依赖有 required_for 数组，元素 ∈ §2 类型集 {PoC, MVP, 通用框架, 生产级}
 *   ③ venture-sales-judge 条目存在（N1/N2 外部依赖，P2 补全）：required:true / location:user
 *   ④ grill-me（required 依赖）location:user + 全档
 *   ⑤ bergside（optional）PoC 档不在 required_for（N7 才用）
 *   ⑥ hcc-org SKILL.md §6 含 venture-product-requirement §2 联动锚点（类型集单源真理）
 *   ⑦ hcc-preflight.js 不读 location/required_for（向后兼容：新字段纯契约声明，不破坏 preflight）
 *
 * 注：hcc-preflight.js 只读 check_paths/required/required_by，不读 location/required_for；
 *     本测试独立于 preflight，纯 schema 断言（C2：仅 fs+path+assert，无外部依赖）。
 *
 * 运行：node --test .claude/skills/hcc-org/scripts/hcc-deploy-contract.test.js → exit 0
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DEPS_PATH = path.join(__dirname, 'hcc-dependencies.json');
const SKILL_PATH = path.join(__dirname, '..', 'SKILL.md');
const PREFLIGHT_PATH = path.join(__dirname, 'hcc-preflight.js');

const LOCATIONS = ['project', 'sandbox', 'user'];
const TIERS = ['PoC', 'MVP', '通用框架', '生产级'];

const deps = JSON.parse(fs.readFileSync(DEPS_PATH, 'utf8'));
const skillMd = fs.readFileSync(SKILL_PATH, 'utf8');
const depByName = Object.fromEntries(deps.dependencies.map((d) => [d.name, d]));

// ── ① 每条依赖有 location ∈ {project,sandbox,user} ──
test('① 每条依赖 location ∈ {project,sandbox,user}（§6.1 三类位置）', () => {
  assert.ok(deps.dependencies.length >= 3, '至少 3 条依赖（grill-me / bergside / venture-sales-judge）');
  for (const d of deps.dependencies) {
    assert.ok(Object.prototype.hasOwnProperty.call(d, 'location'), `${d.name} 有 location 字段（P2 新增）`);
    assert.ok(LOCATIONS.includes(d.location), `${d.name}.location="${d.location}" ∈ ${JSON.stringify(LOCATIONS)}`);
  }
});

// ── ② 每条依赖有 required_for 数组，元素 ∈ §2 类型集 ──
test('② 每条依赖 required_for 数组 + 元素 ∈ §2 类型集', () => {
  for (const d of deps.dependencies) {
    assert.ok(Array.isArray(d.required_for), `${d.name} required_for 是数组（P2 新增）`);
    assert.ok(d.required_for.length >= 1, `${d.name} required_for 非空`);
    for (const t of d.required_for) {
      assert.ok(TIERS.includes(t), `${d.name}.required_for 含 "${t}" ∈ §2 类型集 ${JSON.stringify(TIERS)}`);
    }
  }
});

// ── ③ venture-sales-judge 条目存在（P2 补全 N1/N2 外部依赖声明）──
test('③ venture-sales-judge 存在：required:true / location:user / 含 PoC（P2 补全）', () => {
  const vsj = depByName['venture-sales-judge'];
  assert.ok(vsj, 'venture-sales-judge 条目存在（此前缺失，P2 补全 N1/N2 外部依赖声明）');
  assert.strictEqual(vsj.required, true, 'venture-sales-judge required=true（N1/N2 主线必需）');
  assert.strictEqual(vsj.location, 'user', 'venture-sales-judge location=user（系统级 installed）');
  assert.ok(vsj.required_for.includes('PoC'), 'venture-sales-judge required_for 含 PoC（任何等级 N1/N2 都跑）');
});

// ── ④ grill-me（required 依赖）location=user + 全档 ──
test('④ grill-me required:true / location:user / 全档', () => {
  const gm = depByName['grill-me'];
  assert.ok(gm);
  assert.strictEqual(gm.required, true);
  assert.strictEqual(gm.location, 'user');
  assert.strictEqual(gm.required_for.length, TIERS.length, 'grill-me 全档需要（N3.5 主闭环）');
});

// ── ⑤ bergside（optional）PoC 档不在 required_for（N7 才用，PoC 可不装）──
test('⑤ bergside optional + required_for 不含 PoC（§6.2 矩阵：PoC 外部依赖装即可）', () => {
  const bg = depByName['bergside-type-ui'];
  assert.ok(bg);
  assert.strictEqual(bg.required, false);
  assert.ok(!bg.required_for.includes('PoC'), 'bergside PoC 档非必需（N7 迭代优化才用）');
});

// ── ⑥ hcc-org SKILL.md §6 含 venture-product-requirement §2 联动锚点（单源真理）──
test('⑥ hcc-org §6 含 venture-product-requirement §2 联动锚点 + 伪问题标注', () => {
  assert.ok(skillMd.includes('§6 产出项目部署契约'), 'SKILL.md 有 §6 段（部署契约落地）');
  assert.ok(skillMd.includes('venture-product-requirement §2'), '§6 含 venture-product-requirement §2 联动锚点（类型集单源，不另造档位）');
  assert.ok(skillMd.includes('伪问题'), '§6 标注「部署模型=框架静态属性」是伪问题（REVIEW Open Q#1 闭合）');
  assert.ok(skillMd.includes('sandbox') && skillMd.includes('project'), '§6 含三类位置代号（project/sandbox/user）');
});

// ── ⑦ hcc-preflight.js 不读 location/required_for（向后兼容验证）──
test('⑦ hcc-preflight.js 不读 location/required_for（新字段纯契约声明，向后兼容）', () => {
  const pf = fs.readFileSync(PREFLIGHT_PATH, 'utf8');
  assert.ok(!/d\.location/.test(pf), 'preflight 不读 d.location（部署契约字段不破坏 preflight）');
  assert.ok(!/d\.required_for/.test(pf), 'preflight 不读 d.required_for（向后兼容）');
});
