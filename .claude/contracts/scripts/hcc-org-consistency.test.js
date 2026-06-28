#!/usr/bin/env node
/**
 * hcc-org-consistency.test.js —— M4 R4.1 hcc-org 一致性测试（[A-4/B-3] 修复）
 *
 * 把 hcc-org 协议宪法 + 5 部门 SKILL.md 的「协作一致性契约」从文档编码为可证伪测试。
 * 这是 [A-4/B-3] 修复的核心：RACI 总表 / 交接锚点 / 冲突仲裁 / 纯引用不变量脱离
 * markdown 自由文本检查，回归 4 类可执行断言。
 *
 * 4 类测试：
 *   ① testDepartmentsReferenceRaci    5 部门 SKILL.md §4 引用 hcc-org §2 RACI 锚点
 *   ② testRaciTableCompleteness       §2.1 节点行表结构完整 + R/A 基准（[A-8] 仲裁基准）
 *   ③ testConflictArbitrationSection  hcc-org §2.1 冲突仲裁段存在（[A-8]）
 *   ④ testNoStateWriterDuplication    hcc-org/ 全目录 0 state writer 函数名（[A-5/B-4] 纯引用）
 *
 * ⚠️ 测试② R/A 基准豁免（忠实编码 hcc-org §2.1 真实设计，非放水）：
 *    - 销售自治节点 N1/N2/N8：有 R 无显式 A（A 由 §2.1「无 A 行→决策部临时 A」兜底规则接管）→ A 基准豁免
 *    - 决策闸 HG1/HG2：有 A 无 R（boss 决策闸是审批非执行节点）→ R 基准豁免
 *    - 工作节点 N3-N7：必有 R（执行）+ 必有 A（决策部 plan 批准）
 *    设计依据：hcc-org/SKILL.md §2.1（L50-63）+ §2.1 冲突仲裁「无 A 行」兜底规则（L98-99）。
 *
 * 约束（C2）：纯 Node 内建（fs + path + assert），无外部依赖，无 spawn，无 vm/eval。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ── 路径常量（阶段5 协议降级：hcc-org/scripts/ → contracts/scripts/，协议文档 → contracts/）──
// 脚本位于 .claude/contracts/scripts/，回退两级到 contracts 根（协议文档家）
const CONTRACTS_ROOT = path.resolve(__dirname, '..'); // contracts/scripts/ → contracts/（回退 1 级）
const CHARTER_MD = path.join(CONTRACTS_ROOT, 'charter.md');           // 原 HCC_ORG_SKILL（hcc-org/SKILL.md 降级为 charter.md）
const CHARTER_DEEP = path.join(CONTRACTS_ROOT, 'references', 'charter-deep.md');
const DEPTS = ['decision', 'product', 'dev', 'ops', 'sales'];         // contract-{部门}.md（去 hcc- 前缀）
// 兼容旧引用（test②③ 用 HCC_ORG_SKILL 读 charter；test④ 不再用 HCC_ORG_DIR walkDir）
const HCC_ORG_SKILL = CHARTER_MD;
const VALID_RACI = ['R', 'A', 'C', 'I'];
// 销售自治节点：A 由 §2.1「无 A 行→决策部临时 A」兜底规则接管，表格不显式标 A
const SALES_AUTONOMOUS = new Set(['N1', 'N2', 'N8']);
// §2.1 节点行表业务行数（N1-N8 + N3.5 + HG1/HG2；N3.5 需求规格行由 M7 R7.1 插入）
const EXPECTED_NODE_ROWS = 11;

// ── 辅助：递归收集目录下所有文件（C2：纯 fs.readdirSync，无外部 walk 库）──
function walkDir(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      out.push(...walkDir(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// ── 辅助：解析 §2.1 节点行表为结构化行 ──
// 返回 [{ name, firstTok, deptCells: [{ raw, letters: string[] }, ×5] }, ...]
// deptCells 顺序固定：决策部 / 产品部 / 开发部 / 运维部 / 销售部
function parseNodeRaciTable(content) {
  const lines = content.split(/\r?\n/);
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // 表头行（含「节点 / 闸门」）标记进入 §2.1 表格
    if (trimmed.startsWith('|') && trimmed.includes('节点 / 闸门')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    // 表格结束：空行或非表格行（§2.1 表后是空行，恰好分隔 §2.2，不误吞 state 字段行表）
    if (!trimmed.startsWith('|')) break;
    // 分隔行（|----|）：跳过
    if (/^\|[\s:-]+\|/.test(trimmed)) continue;
    // 业务行：split('|') 首尾产生空串，slice(1,-1) 去掉，得 7 列
    const all = trimmed.split('|').map(p => p.trim());
    const cells = all.slice(1, all.length - 1);
    if (cells.length < 7) continue;
    const name = cells[0].replace(/\*\*/g, '').trim();
    const firstTok = name.split(/\s+/)[0]; // "N1" / "HG1" 等
    // 部门单元格 = cells[2..6]（决策/产品/开发/运维/销售）
    const deptCells = cells.slice(2, 7).map(raw => {
      const cleaned = raw.replace(/\*\*/g, '').trim(); // 去 markdown 加粗
      const letters = cleaned.split('/').map(s => s.trim()).filter(s => s.length > 0);
      return { raw, letters };
    });
    rows.push({ name, firstTok, deptCells });
  }
  return rows;
}

// ── 测试① 5 部门 SKILL.md §4 引用 hcc-org §2 RACI 锚点（M3 闸2 的一致性回归）──
function testDepartmentsReferenceRaci() {
  // 阶段5 协议降级：5 部门 skill → contract-{部门}.md；锚点暂保留旧文本（hcc-org/SKILL.md），
  // 阶段F 改 5 contract 锚点为 charter.md 时同步更新此处 ANCHOR。
  const ANCHOR = '参见 charter.md §2 RACI 总表';
  for (const d of DEPTS) {
    const contractFile = path.join(CONTRACTS_ROOT, `contract-${d}.md`);
    assert(fs.existsSync(contractFile), `contract-${d}.md 存在`);
    const content = fs.readFileSync(contractFile, 'utf8');
    assert(content.includes(ANCHOR),
      `contract-${d}.md §4 引用 RACI 锚点「${ANCHOR}」（阶段F 改 charter.md 时同步更新）`);
  }
}

// ── 测试② §2.1 节点行表结构完整 + R/A 基准（[A-8] 冲突仲裁基准）──
function testRaciTableCompleteness() {
  const content = fs.readFileSync(HCC_ORG_SKILL, 'utf8');
  const rows = parseNodeRaciTable(content);
  assert(rows.length === EXPECTED_NODE_ROWS,
    `§2.1 节点行表应有 ${EXPECTED_NODE_ROWS} 个业务行（N1-N8 + HG1/HG2），实际 ${rows.length}`);

  for (const row of rows) {
    // (a) 每个部门单元格的每个 RACI 字母 ∈ {R,A,C,I}（结构合法，拒非法字符/空格）
    for (const cell of row.deptCells) {
      for (const letter of cell.letters) {
        assert(VALID_RACI.includes(letter),
          `${row.name} 单元格「${cell.raw}」含非法 RACI 字母「${letter}」（合法 R/A/C/I）`);
      }
    }
    const allLetters = row.deptCells.flatMap(c => c.letters);
    // (b) R 基准：工作节点（N*）必有 R（有人执行）；决策闸（HG*）是审批非执行 → 豁免
    if (row.firstTok.startsWith('N')) {
      assert(allLetters.includes('R'),
        `${row.name} 工作节点至少 1 个 R（有人执行）`);
    }
    // (c) A 基准：销售自治节点（N1/N2/N8）A 由 §2.1 兜底规则接管 → 豁免；其余必有 A
    if (!SALES_AUTONOMOUS.has(row.firstTok)) {
      assert(allLetters.includes('A'),
        `${row.name} 至少 1 个 A（销售自治节点 N1/N2/N8 除外，A 由 §2.1 兜底规则接管）`);
    }
  }
}

// ── 测试③ 冲突仲裁段存在（[A-8] 修复：仲裁基准上提必读层）──
function testConflictArbitrationSection() {
  const content = fs.readFileSync(HCC_ORG_SKILL, 'utf8');
  assert(/§2\.1 冲突仲裁|冲突仲裁规则/.test(content),
    'hcc-org §2.1 冲突仲裁段存在（[A-8] 仲裁基准执行机制）');
}

// ── 测试④ 协议文档 0 state writer 函数名（[A-5/B-4] 纯引用不变量）──
// 阶段5 协议降级：原 walkDir(hcc-org/) 改为检查降级后的协议文档（charter.md + charter-deep.md，
// 即原 hcc-org/SKILL.md + references/org-protocol-deep.md）。5 contract + org-claude.md 不在此列
//（部门协议 / 实施者契约各自范围）。scripts/ 工具已迁 contracts/scripts/，不属协议文档。
function testNoStateWriterDuplication() {
  const files = [CHARTER_MD, CHARTER_DEEP].filter((f) => fs.existsSync(f));
  assert(files.length >= 1,
    `charter 协议文档存在（charter.md + charter-deep.md，实际 ${files.length} 文件）`);
  const FORBIDDEN = /atomicWriteJSON|writeFileSync|require.*init-state/;
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    assert(!FORBIDDEN.test(content),
      `${path.relative(CONTRACTS_ROOT, f)} 无 state writer 函数名复制（[A-5/B-4] 纯引用，真理源在 schema 文档）`);
  }
}

// ── 测试⑤：去模糊化防回归（M2b，charter §1 总则6 + terminology.md §禁令清单）──
// 断言「无合法语境的纯删除/替换词」在产出文档 0 命中（M3 已清，防回归）。
// 豁免：terminology.md（禁令清单本身列词）+ charter.md/charter-deep.md（§1 总则6 列词作转化例子）。
// 这些词（真综合/空中楼阁/灵魂/拼命挖）M3 已全替换或删除，产出文档不该再出现；若未来回归引入即报警。
function testNoBannedTermsRegression() {
  const FORBIDDEN = /真综合|空中楼阁|灵魂|拼命挖/;
  const PROJECT_ROOT = path.resolve(CONTRACTS_ROOT, '..');
  const EXEMPT = new Set([path.join(CONTRACTS_ROOT, 'terminology.md'), CHARTER_MD, CHARTER_DEEP, path.join(PROJECT_ROOT, 'skills', 'cc-2pp', '_roles', 'injection-template.md')]); // 禁令清单载体（terminology/injection-template）+ 总则6 列词（charter/charter-deep）豁免
  const hits = [];
  const scan = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of walkDir(dir)) {
      if (!f.endsWith('.md') || EXEMPT.has(f)) continue;
      const content = fs.readFileSync(f, 'utf8');
      const m = content.match(FORBIDDEN);
      if (m) hits.push(`${path.relative(PROJECT_ROOT, f)}: ${[...new Set(m)].join('/')}`);
    }
  };
  scan(path.join(PROJECT_ROOT, 'skills'));
  scan(CONTRACTS_ROOT);
  assert(hits.length === 0,
    `产出文档 0 命中无合法语境词（真综合/空中楼阁/灵魂/拼命挖，M3 已清防回归）。命中：\n${hits.join('\n')}`);
}

// ── main：跑 5 测试，统计 passed/failed，failed>0 → exit(1) ──
function main() {
  const tests = [
    ['测试① 5部门引用RACI锚点', testDepartmentsReferenceRaci],
    ['测试② RACI表结构+R/A基准', testRaciTableCompleteness],
    ['测试③ 冲突仲裁段存在', testConflictArbitrationSection],
    ['测试④ hcc-org零state-writer', testNoStateWriterDuplication],
    ['测试⑤ 去模糊化防回归', testNoBannedTermsRegression],
  ];
  let passed = 0;
  const failures = [];
  for (const [label, fn] of tests) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${label}`);
    } catch (e) {
      failures.push({ label, message: e.message });
      console.log(`  ✗ ${label}`);
      console.log(`      ${e.message}`);
    }
  }
  console.log(`\n=== hcc-org 一致性测试：${passed}/${tests.length} PASS ===`);
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.length} 项`);
    process.exit(1);
  }
}

main();
