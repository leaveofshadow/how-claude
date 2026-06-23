#!/usr/bin/env node
/**
 * validate-n35.test.js —— validate-n35.js 语义校验闸测试（P1.1 TDD）
 *
 * 固化 venture-product-requirement SKILL.md §4 六闸为【可执行闸】：
 *   合格 N3.5 产物 → exit 0（核心：空壳六块骗不过）
 *   各闸残缺     → exit 1 + stderr 精确指认失败闸
 *
 * 堵复盘 MAJOR 1.1（引擎层只 existsSync+includes，空壳六块可骗过）+ 1.2（grill N 未定义）。
 * 风格参考 venture-resume-set-signal.test.js（自定义 assert + spawnSync + tmpdir fixture）。
 * 运行：node validate-n35.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'validate-n35.js');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error('  ✗ ' + msg); }
}

// ── 合格模板（参考 venture-product-requirement SKILL.md §1-§6 示例）──
function goodPrd() {
  return `# N3.5 需求规格

## §1 背景与目标
问题：当前团队内部的资料检索流程需要人工执行 5 个步骤才能完成，整体错误率达到 30% 上下，效率低下。
成功标准（业务级）：用户能够通过本系统一站式完成资料检索流程，无需在中间环节手动介入任何步骤即可拿到结果。

## §2 范围与边界
项目类型: MVP ← 因 N3 方案决策结论标注当前阶段需最小可用版本以验证核心闭环价值
in-scope:
  - R1 搜索请求处理与结果返回
  - R2 离线缓存降级
  - R3 限流防护
  - R4 双语支持
  - R5 管理员审计
out-scope:
  - 用户画像与 TAM/SAM 市场规模分析（商业调研产物，本节点不产出）
  - 竞品深度对比分析

## §3 功能需求
R1: WHEN 用户通过前端界面提交搜索请求时，系统 SHALL 在 2s 内返回匹配结果列表，且查询输入长度限制在 100 字符以内执行标准化匹配。
R2: WHERE 系统检测到自身处于离线状态时，系统 SHALL 显示本地缓存的历史结果数据，并在界面顶部提示当前处于离线模式服务不可用状态。
R3: IF 单一用户的查询频率超过系统预设的速率限制阈值时，THEN 系统 SHALL 返回 HTTP 429 状态码，并在响应头中标注 Retry-After 秒数提示客户端退避重试。
R4: 系统 SHALL 支持中英文双语的搜索查询输入，对所有合法关键词执行标准化分词处理与倒排索引匹配，并返回排序后的结果列表供前端渲染显示。
R5: WHERE 当前登录用户被识别为系统管理员角色时，系统 MAY 在导航栏展示完整的审计日志面板，用于排查异常调用记录与敏感操作追溯核查。

## §4 非功能需求
NFR1（性能）: p99 响应延迟 < 200ms（负载 100 QPS 场景下）→ mirror §5 AC1 bench 阈值校验。
NFR2（可用性）: 月度可用性 ≥ 99.9%（线上稳定运行）→ mirror §5 AC 监控告警阈值。
NFR3（资源）: 单实例内存占用 < 512MB（常规负载）→ mirror §5 AC RSS 采样阈值断言。

## §5 验收标准
AC1（对应 R1）: 执行 \`node bench/search.bench.js --qps=100\` 命令，断言 p99 响应延迟 < 2000ms 且进程 exit 0 通过。
AC2（对应 R2）: 断开网络后调用 \`curl /api/search\` 接口，断言返回体包含"离线模式"字符串且 HTTP 状态码为 200。
AC3（对应 R3）: 压测超过 QPS 上限触发限流，断言响应码为 429 且 Header 含 Retry-After 字段值。
AC4（对应 R4）: 执行 \`node test/i18n.test.js\` 测试，断言中英文双语 case 全部绿通过。
AC5（对应 R5）: 以管理员身份调用 \`curl /api/audit-log\` 接口，断言返回审计日志 JSON 数组非空。

## §6 里程碑
M1（原型）: 完成 R1 与 R2 功能需求，并通过 AC1 与 AC2 验收标准闸门检查。
M2（集成）: 完成 R3 与 R4 功能需求，并通过 AC3 与 AC4 验收标准闸门检查。
M3（生产）: NFR1 至 NFR3 非功能指标全部达标，§4 mirror 到 AC 的校验全部绿通过。
`;
}

function goodGrill() {
  return `# N3.5 grill-me 追问落盘

Q1: R1 的"2s 内返回"在离线降级场景下是否仍然适用？→ 修订 R1 边界以排除离线场景。
Q2: §2 in-scope 的 R5 管理员审计是否真正属于 MVP 的必要范围？→ 收窄为可选项。
Q3: AC3 的 Retry-After 字段单位是秒还是毫秒？→ 明确为秒并在 R3 中显式标注。
`;
}

function makeRoot(prdContent, grillContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vn35-'));
  const prd = path.join(dir, 'prd.md');
  const grill = path.join(dir, 'grill.md');
  if (prdContent !== null) fs.writeFileSync(prd, prdContent, 'utf8');
  if (grillContent !== null) fs.writeFileSync(grill, grillContent, 'utf8');
  return { dir, prd, grill };
}

function run(prd, grill, extra) {
  const args = [SCRIPT, '--prd', prd, '--grill', grill];
  if (extra) args.push(...extra);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

// ── Case 0: 合格产物 → exit 0（核心：空壳骗不过，合格能过全闸）──
{
  const { prd, grill } = makeRoot(goodPrd(), goodGrill());
  const r = run(prd, grill);
  assert(r.status === 0, `Case0 合格应 exit 0（实际 ${r.status}）stderr=${r.stderr}`);
}

// ── Case 1: 缺 §6 → 闸E ──
{
  const p = goodPrd().replace(/## §6 里程碑[\s\S]*$/, '').trimEnd() + '\n';
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case1 缺§6 应 exit 1（实际 ${r.status}）`);
  assert(/闸E/.test(r.stderr) && /§6/.test(r.stderr), 'Case1 stderr 应含 闸E + §6');
}

// ── Case 2: §1 正文过短 → 闸E ──
{
  const p = goodPrd().replace(/## §1 背景与目标[\s\S]*?(?=## §2)/, '## §1 背景与目标\n短目标。\n\n');
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case2 §1过短 应 exit 1（实际 ${r.status}）`);
  assert(/闸E/.test(r.stderr) && /§1/.test(r.stderr), 'Case2 stderr 应含 闸E + §1');
}

// ── Case 3: 类型声明非法 → 闸A ──
{
  const p = goodPrd().replace('项目类型: MVP ←', '项目类型: 实验阶段 ←');
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case3 类型错 应 exit 1（实际 ${r.status}）`);
  assert(/闸A/.test(r.stderr), 'Case3 stderr 应含 闸A');
}

// ── Case 4: R 正文过短 → 闸B ──
{
  const p = goodPrd().replace(/R4: 系统 SHALL 支持中英文双语的搜索查询输入[\s\S]*?显示。/, 'R4: 短需求。');
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case4 R过短 应 exit 1（实际 ${r.status}）`);
  assert(/闸B/.test(r.stderr) && /50/.test(r.stderr), 'Case4 stderr 应含 闸B + 50');
}

// ── Case 5: R≠AC 数量 → 闸B（注入 R6 不加 AC6，EARS 仍全）──
{
  const p = goodPrd().replace(
    'R5: WHERE 当前登录用户被识别为系统管理员角色时，系统 MAY 在导航栏展示完整的审计日志面板，用于排查异常调用记录与敏感操作追溯核查。',
    'R5: WHERE 当前登录用户被识别为系统管理员角色时，系统 MAY 在导航栏展示完整的审计日志面板，用于排查异常调用记录与敏感操作追溯核查。\nR6: 系统 SHALL 在每次搜索请求处理完成后记录结构化访问日志，用于后续审计追溯与性能瓶颈分析排查。'
  );
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case5 R≠AC 应 exit 1（实际 ${r.status}）`);
  assert(/闸B/.test(r.stderr) && /≠/.test(r.stderr), 'Case5 stderr 应含 闸B + ≠');
}

// ── Case 6: AC 无可观测判据 → 闸D ──
{
  const p = goodPrd().replace(/AC1（对应 R1）: 执行[\s\S]*?exit 0 通过。/, 'AC1（对应 R1）: 系统应当提供良好的搜索体验让用户感到满意和方便使用。');
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case6 AC无可观测 应 exit 1（实际 ${r.status}）`);
  assert(/闸D/.test(r.stderr), 'Case6 stderr 应含 闸D');
}

// ── Case 7: EARS 不全（英文关键词替换为中文，保留语义）→ 闸C ──
{
  const p = goodPrd()
    .replace('WHEN 用户通过前端界面提交搜索请求时，系统 SHALL', '当用户通过前端界面提交搜索请求时，系统 SHALL')
    .replace('WHERE 系统检测到自身处于离线状态时，系统 SHALL', '在系统检测到自身处于离线状态时，系统 SHALL')
    .replace('IF 单一用户的查询频率超过系统预设的速率限制阈值时，THEN 系统 SHALL', '如果单一用户的查询频率超过系统预设的速率限制阈值时，那么系统 SHALL')
    .replace('WHERE 当前登录用户被识别为系统管理员角色时，系统 MAY', '在当前登录用户被识别为系统管理员角色时，系统 可以');
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case7 EARS不全 应 exit 1（实际 ${r.status}）`);
  assert(/闸C/.test(r.stderr), 'Case7 stderr 应含 闸C');
}

// ── Case 8: grill 追问不足（2 条 < 3）→ grill ──
{
  const g = goodGrill().replace(/Q3:[^\n]*\n/, '');
  const { prd, grill } = makeRoot(goodPrd(), g);
  const r = run(prd, grill);
  assert(r.status === 1, `Case8 grill不足 应 exit 1（实际 ${r.status}）`);
  assert(/grill/.test(r.stderr) && /追问数/.test(r.stderr), 'Case8 stderr 应含 grill + 追问数');
}

// ── Case 9: AC 正文过短 → 闸B ──
{
  const p = goodPrd().replace(/AC5（对应 R5）: 以管理员身份[\s\S]*?非空。/, 'AC5（对应 R5）: 短验收。');
  const { prd, grill } = makeRoot(p, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case9 AC过短 应 exit 1（实际 ${r.status}）`);
  assert(/闸B/.test(r.stderr) && /30/.test(r.stderr), 'Case9 stderr 应含 闸B + 30');
}

// ── Case 10: prd 不存在 → 闸F ──
{
  const { prd, grill } = makeRoot(null, goodGrill());
  const r = run(prd, grill);
  assert(r.status === 1, `Case10 prd缺 应 exit 1（实际 ${r.status}）`);
  assert(/闸F/.test(r.stderr) && /prd 不存在/.test(r.stderr), 'Case10 stderr 应含 闸F + prd 不存在');
}

// ── Case 11: --min-questions 自定义（合格 grill 3 条，要求 4）→ grill ──
{
  const { prd, grill } = makeRoot(goodPrd(), goodGrill());
  const r = run(prd, grill, ['--min-questions', '4']);
  assert(r.status === 1, `Case11 minQ=4 应 exit 1（实际 ${r.status}）`);
  assert(/grill/.test(r.stderr) && /4/.test(r.stderr), 'Case11 stderr 应含 grill + 4');
}

// ── 汇总 ──
console.log(`\nvalidate-n35.test.js: ${passed} pass / ${failed} fail`);
process.exit(failed === 0 ? 0 : 1);
