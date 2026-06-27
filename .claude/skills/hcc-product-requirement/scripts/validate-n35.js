#!/usr/bin/env node
/**
 * validate-n35.js —— N3.5 需求规格语义校验（charter 块1 复盘 P1.1）
 *
 * 把 hcc-product-requirement/SKILL.md §4 六闸从「agent 自检 + 人工 M2 闸」
 * 升级为【可执行闸】，堵复盘 MAJOR 1.1（引擎层只 existsSync+includes，空壳六块可骗过）
 * + MAJOR 1.2（grill-me 追问数 N 未定义）。
 *
 * 定位（charter 主题4 分层的自动化补强，非取代 agent 自检）：
 *   引擎层 exit_condition（dag.venture.json N3.5）→ existsSync + includes（产物路径 + 关键词）
 *   本脚本（语义层）→ 六闸正则校验（标题/长度/类型声明/EARS/R↔AC/可观测判据/grill 追问数）
 *   agent 自检 + M2 人工闸 → 仍保留（语义之外的质量判断）
 *
 * 校验项（SKILL.md §4 六闸）：
 *   闸F  产物存在（existsSync prd + grill）
 *   闸E  六块标题（§1-§6）+ 块正文 ≥ 50 字
 *   闸A  §2 首行类型声明（项目类型: <PoC|MVP|通用框架|生产级> ← <证据>）
 *   闸B  §3 R{n} 正文 ≥ 50 字 + §5 AC{n} 正文 ≥ 30 字 + R↔AC 一一对应（数量相等）
 *   闸C  §3 EARS 完整枚举（SHALL/WHEN/WHERE/MAY/IF 五种全出现；类型裁剪弹性留 agent 自检 + M2）
 *   闸D  §5 AC 含可观测判据（反引号命令 / 数值+单位 / 验证动词；模糊词降为 warn）
 *   grill  N3.5_grill_log.md 追问数（^Q{n}:）≥ min-questions（默认 3）
 *
 * 约束（C2）：纯 Node 内建（fs + path），无 crypto/vm/eval/外部依赖/子进程。
 */
'use strict';

const fs = require('fs');

// ── 常量 ──
const MIN_Q_DEFAULT = 3;
const EARS_KEYWORDS = ['SHALL', 'WHEN', 'WHERE', 'MAY', 'IF'];
const VALID_TYPES = ['PoC', 'MVP', '通用框架', '生产级'];
const VAGUE_WORDS = ['友好', '快速', '易用', '合理'];

// 六块定义（id 用于 startsWith 匹配；§3/§5 按条目校验，块本身不校验长度）
const BLOCKS = [
  { id: '§1', title: '§1 背景与目标', minLen: 50 },
  { id: '§2', title: '§2 范围与边界', minLen: 50 },
  { id: '§3', title: '§3 功能需求', minLen: 0 },
  { id: '§4', title: '§4 非功能需求', minLen: 50 },
  { id: '§5', title: '§5 验收标准', minLen: 0 },
  { id: '§6', title: '§6 里程碑', minLen: 50 },
];

// ── 参数解析 ──
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prd') args.prd = argv[++i];
    else if (a === '--grill') args.grill = argv[++i];
    else if (a === '--min-questions') args.minQuestions = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

// ── 提取二级标题块（## 开头），key 为去前缀的纯净标题 ──
function extractBlocks(content) {
  const lines = content.split(/\r?\n/);
  const blocks = {};
  let curTitle = null;
  let curLines = [];
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (curTitle !== null) blocks[curTitle] = curLines.join('\n');
      curTitle = line.trim().replace(/^##\s+/, '').replace(/\*\*/g, '');
      curLines = [];
    } else if (curTitle !== null) {
      curLines.push(line);
    }
  }
  if (curTitle !== null) blocks[curTitle] = curLines.join('\n');
  return blocks;
}

function findBlock(blocks, id) {
  const key = Object.keys(blocks).find((k) => k.startsWith(id));
  return key ? blocks[key] : null;
}

// ── AC 可观测判据（闸D）：反引号命令 / 数值+单位 / 验证标记 / 验证动词 ──
function isObservable(body) {
  return (
    /`[^`]+`/.test(body) ||                                            // 反引号命令
    /\d+(\.\d+)?\s*(ms|秒|s|%|QPS|HTTP|状态码|次|字|小时|分钟|天)/i.test(body) || // 数值+单位
    /(exit\s*\d|HTTP\s*\d{3}|状态码|p99|p95)/i.test(body) ||            // 验证标记
    /(执行|调用|返回|断言|验证|显示|输出|生成|记录|提示|拒绝|触发|通知|保存|加载|校验|拦截)/.test(body) // 动作/验证动词（闸B R + 闸D AC 共用）
  );
}

// ── 主校验：返回 { errors[], warns[], passed, qCount } ──
function validate(prdPath, grillPath, minQuestions) {
  const errors = [];
  const warns = [];

  // 闸F：产物存在
  if (!fs.existsSync(prdPath)) errors.push(`闸F 失败：prd 不存在（${prdPath}）`);
  if (!fs.existsSync(grillPath)) errors.push(`闸F 失败：grill 不存在（${grillPath}）`);
  if (errors.length) return { errors, warns, passed: false, qCount: 0 };

  const prd = fs.readFileSync(prdPath, 'utf8');
  const grill = fs.readFileSync(grillPath, 'utf8');
  const blocks = extractBlocks(prd);

  // 闸E：六块标题 + 块正文长度下限
  for (const b of BLOCKS) {
    const body = findBlock(blocks, b.id);
    if (body === null) {
      errors.push(`闸E 失败：缺块 ${b.title}`);
      continue;
    }
    if (b.minLen > 0 && body.trim().length < b.minLen) {
      errors.push(`闸E 失败：${b.title} 正文 ${body.trim().length} 字 < 下限 ${b.minLen}`);
    }
  }

  // 闸A：§2 首行类型声明（正则锚定块内首个非空行）
  const s2 = findBlock(blocks, '§2');
  if (s2 !== null) {
    const firstLine = (s2.split(/\r?\n/).find((l) => l.trim()) || '').trim();
    const typeRe = /^项目类型:\s*(PoC|MVP|通用框架|生产级)\s*←\s*.+/;
    if (!typeRe.test(firstLine)) {
      errors.push(`闸A 失败：§2 首行无合法类型声明（期望"项目类型: <PoC|MVP|通用框架|生产级> ← <证据>"，实际 "${firstLine.slice(0, 40)}"）`);
    }
  }

  // 闸B + 闸C：§3 R 条目
  const s3 = findBlock(blocks, '§3');
  const s5 = findBlock(blocks, '§5');
  let rCount = 0;
  if (s3 !== null) {
    const rLines = s3.split(/\r?\n/).filter((l) => /^R\d+:/.test(l.trim()));
    rCount = rLines.length;
    if (rCount === 0) {
      errors.push('闸B 失败：§3 无 R{n} 条目');
    } else {
      const earsSeen = new Set();
      for (const rl of rLines) {
        const body = rl.replace(/^R\d+:\s*/, '');
        if (body.length < 50) {
          errors.push(`闸B 失败：${rl.trim().slice(0, 24)} 正文 ${body.length} 字 < 下限 50`);
        }
        for (const k of EARS_KEYWORDS) if (body.includes(k)) earsSeen.add(k);
        // 闸B：R 可观测判据标记（SKILL.md L95「为 §5 AC 预留映射」+ L213 闸B「含可观测判据标记」）
        if (!isObservable(body)) {
          errors.push(`闸B 失败：${rl.trim().slice(0, 24)} 无可观测判据标记（需数值单位/反引号命令/动作动词）`);
        }
      }
      // 闸C：EARS 完整枚举（SKILL.md L216-217「至少枚举 SHALL|WHEN|WHERE|MAY|IF 五种句式」）
      const missingEars = EARS_KEYWORDS.filter((k) => !earsSeen.has(k));
      if (missingEars.length > 0) {
        errors.push(`闸C 失败：§3 未完整枚举五种 EARS，缺 ${missingEars.join('/')}（已见：${[...earsSeen].join('/') || '无'}；类型裁剪弹性留 agent 自检 + M2）`);
      }
    }
  }

  // 闸B + 闸D：§5 AC 条目
  if (s5 !== null) {
    const acLines = s5.split(/\r?\n/).filter((l) => /^AC\d+/.test(l.trim()));
    if (acLines.length === 0) {
      errors.push('闸B 失败：§5 无 AC{n} 条目');
    } else {
      if (rCount > 0 && acLines.length !== rCount) {
        errors.push(`闸B 失败：R 数（${rCount}）≠ AC 数（${acLines.length}），应一一对应`);
      }
      for (const al of acLines) {
        const body = al.replace(/^AC\d+[^:]*:\s*/, '');
        if (body.length < 30) {
          errors.push(`闸B 失败：${al.trim().slice(0, 24)} 正文 ${body.length} 字 < 下限 30`);
        }
        // 闸D：可观测判据
        if (!isObservable(body)) {
          errors.push(`闸D 失败：${al.trim().slice(0, 24)} 无可观测判据（需反引号命令/数值单位/验证动词）`);
        }
        // 模糊词降为 warn（辅助，非否决）
        for (const w of VAGUE_WORDS) {
          if (body.includes(w)) warns.push(`闸D 辅助：${al.trim().slice(0, 24)} 含模糊词 "${w}"（已降为 warn，主判据是正向可观测）`);
        }
      }
    }
  } else if (s3 !== null) {
    errors.push('闸B 失败：缺 §5 验收标准（无法校验 R↔AC 对应）');
  }

  // grill：追问数（^Q{n}:）≥ minQuestions
  const qCount = (grill.match(/^Q\d+:/gm) || []).length;
  if (qCount < minQuestions) {
    errors.push(`grill 失败：追问数 ${qCount} < 下限 ${minQuestions}（--min-questions）`);
  }

  return { errors, warns, passed: errors.length === 0, qCount };
}

// ── main ──
const args = parseArgs(process.argv);

if (args.help || (!args.prd && !args.grill)) {
  console.log(`validate-n35.js —— N3.5 需求规格语义校验（charter 主题4 分层自动化闸）

用法：
  node validate-n35.js --prd <path> --grill <path> [--min-questions N]

校验项（hcc-product-requirement SKILL.md §4 六闸）：
  闸F    产物存在（existsSync prd + grill）
  闸E    六块标题（§1-§6）+ 块正文 ≥ 50 字
  闸A    §2 首行类型声明（项目类型: <PoC|MVP|通用框架|生产级> ← <证据>）
  闸B    §3 R{n} 正文 ≥ 50 字 + §5 AC{n} ≥ 30 字 + R↔AC 一一对应
  闸C    §3 EARS 完整枚举（SHALL/WHEN/WHERE/MAY/IF 五种全出现）
  闸D    §5 AC 含可观测判据（反引号命令 / 数值单位 / 验证动词）
  grill  N3.5_grill_log.md 追问数（^Q{n}:）≥ min-questions（默认 ${MIN_Q_DEFAULT}）

退出码：0 通过 / 1 失败（stderr 列失败闸 + 原因）`);
  process.exit(args.help ? 0 : 1);
}

if (!args.prd) { console.error('缺 --prd（N3.5_需求规格_prd.md 路径）'); process.exit(1); }
if (!args.grill) { console.error('缺 --grill（N3.5_grill_log.md 路径）'); process.exit(1); }
const minQ = Number.isFinite(args.minQuestions) ? args.minQuestions : MIN_Q_DEFAULT;

const result = validate(args.prd, args.grill, minQ);
if (result.passed) {
  console.log(`✓ N3.5 语义校验通过（闸E/F/A/B/C/D 全过 + grill 追问数 ${result.qCount}≥${minQ}）`);
  for (const w of result.warns) console.log(`  ⚠ ${w}`);
  process.exit(0);
} else {
  console.error(`✗ N3.5 语义校验失败（${result.errors.length} 项不达标）：`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}
