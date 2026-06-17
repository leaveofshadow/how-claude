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

// ── 路径常量 ──
// 脚本位于 .claude/skills/hcc-org/scripts/，回退两级到 skills 根（5 部门 + hcc-org 同级）
const SKILL_ROOT = path.resolve(__dirname, '..', '..');
const HCC_ORG_DIR = path.join(SKILL_ROOT, 'hcc-org');
const HCC_ORG_SKILL = path.join(HCC_ORG_DIR, 'SKILL.md');
const DEPTS = ['hcc-decision', 'hcc-product', 'hcc-dev', 'hcc-ops', 'hcc-sales'];
const VALID_RACI = ['R', 'A', 'C', 'I'];
// 销售自治节点：A 由 §2.1「无 A 行→决策部临时 A」兜底规则接管，表格不显式标 A
const SALES_AUTONOMOUS = new Set(['N1', 'N2', 'N8']);
// §2.1 节点行表业务行数（N1-N8 + HG1/HG2）
const EXPECTED_NODE_ROWS = 10;

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
  const ANCHOR = '参见 hcc-org/SKILL.md §2 RACI 总表';
  for (const d of DEPTS) {
    const skillFile = path.join(SKILL_ROOT, d, 'SKILL.md');
    assert(fs.existsSync(skillFile), `${d}/SKILL.md 存在`);
    const content = fs.readFileSync(skillFile, 'utf8');
    assert(content.includes(ANCHOR),
      `${d}/SKILL.md §4 引用 hcc-org RACI 锚点「${ANCHOR}」`);
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

// ── 测试④ hcc-org/ 全目录 0 state writer 函数名（[A-5/B-4] 纯引用不变量）──
function testNoStateWriterDuplication() {
  const files = walkDir(HCC_ORG_DIR);
  assert(files.length >= 2,
    `hcc-org/ 至少含 SKILL.md + references/（实际 ${files.length} 文件）`);
  // state writer 函数符号（调用名/实现逻辑），hcc-org 只可提脚本职责名，不得出现函数符号
  // 注：shift-direction.js 等是「脚本文件名引用」（职责），非函数符号，故不在禁列
  const FORBIDDEN = /atomicWriteJSON|writeFileSync|require.*init-state/;
  for (const f of files) {
    // 排除测试文件自身：它含 FORBIDDEN regex 字面量是为「定义禁令」，非「违反禁令」。
    // 测试④ 的本意是「hcc-org 协议文档（SKILL.md + references）不复制 state writer 函数逻辑」，
    // 测试文件是验证工具，不在协议文档范畴。此排除修正自指假阳性，非放水。
    if (path.resolve(f) === path.resolve(__filename)) continue;
    const content = fs.readFileSync(f, 'utf8');
    assert(!FORBIDDEN.test(content),
      `${path.relative(SKILL_ROOT, f)} 无 state writer 函数名复制（[A-5/B-4] 纯引用，真理源在 schema 文档）`);
  }
}

// ── main：跑 4 测试，统计 passed/failed，failed>0 → exit(1) ──
function main() {
  const tests = [
    ['测试① 5部门引用RACI锚点', testDepartmentsReferenceRaci],
    ['测试② RACI表结构+R/A基准', testRaciTableCompleteness],
    ['测试③ 冲突仲裁段存在', testConflictArbitrationSection],
    ['测试④ hcc-org零state-writer', testNoStateWriterDuplication],
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
