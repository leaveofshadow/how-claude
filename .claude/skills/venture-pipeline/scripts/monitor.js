#!/usr/bin/env node
/**
 * monitor.js —— pipeline 漂移检测机械层（task #41，M2 实现）
 *
 * 设计（见 venture-pipeline SKILL.md「monitor 漂移检测」节）：
 *   用户不显式声明变更 → monitor 主动漂移检测（baseline vs current）
 *   机械（monitor.js）+ 语义（编排者 Claude）分工：
 *     · monitor.js 做可机械检测的（git diff --stat 量 + 接口文件变更 + stagnation_count + 读 baseline 50/60/70 摘要）
 *     · 编排者 Claude 做语义分类（读 monitor 输出 → 分类需求/技术/架构漂移 → 触发分级）
 *     · 不把语义塞脚本规则（变更语义复杂，规则覆盖不全）
 *
 * 机械职责边界（关键——只搬运不分类）：
 *   · readBaseline：读 50/60/70 全文摘要（截断防过长）→ 搬到输出给 Claude 对比
 *   · readStagnation：跨 skill 读 cc-runtime checkpoint.stagnation_count（验证闸挂隐式信号）
 *   · gitDiffStat：git diff --stat 量 + 变更文件分类（接口/技术栈/普通）→ 第二刀
 *   · detectDrift：聚合并标 mechanical_signals → 第二刀
 *   ★ 语义（需求/技术漂移分类）= needs_semantic_classification flag，留给编排者 Claude
 *
 * 约束（C2 调整，2026-06-29）：
 *   - 仅 require('fs')+require('path')（Node 内建）
 *   - git diff 用 require('child_process').execSync **仅调 git**（只读检测，第二刀）
 *   - 禁 spawn skill / 禁 vm/eval/Function / 禁写任何 state 文件（monitor 只读检测器）
 *   - 跨 skill 只读：读 cc-runtime direction.json 的 checkpoint（编排层读执行层健康信号，不写）
 *
 * 接口（CLI 第二刀补全）：
 *   node monitor.js --run <dir> [--since <commit>] [--root <dir>] [--stagnation-k <N>]
 *     --run         baseline 决策目录（.hcc/decisions/{run}/，含 50/60/70）
 *     --since       git diff baseline commit（默认 HEAD = working tree 未提交变更）
 *     --root        项目根（默认 cwd；stagnation 读取根）
 *     --stagnation-k 验证闸挂阻塞线（默认 3）
 *
 * 输出：漂移材料 JSON（给编排者 Claude 语义分类）
 *
 * 实现：readBaseline + readStagnation（纯 fs）+ gitDiffStat + detectDrift + parseArgs + CLI
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');  // 仅调 git diff（只读检测）；禁 spawn skill/vm/eval，C2 边界见 head

// baseline 摘要默认上限（防 monitor 输出过长；机械层只搬运，语义提取留 Claude）
const DEFAULT_MAX_CHARS = 2000;

// baseline 文件 → 字段映射（cc-2pp 文件存储约定）
const BASELINE_FILES = [
  ['50', '50-decision.md', 'decision'],       // 50 裁决记录
  ['60', '60-impl-plan.md', 'plan'],          // 60 实施计划（含技术选型确认 + 模块拆分）
  ['70', '70-requirements.md', 'requirements'], // 70 细化需求清单
];

// ── 工具：截断防过长（超限标 [截断 原→限]）──
function truncate(text, max) {
  if (text == null) return null;
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n[截断 ${text.length}→${max}]`;
}

// ── stateRoot 双语义（复用 pipeline-state.js resolveStateRootForRead 逻辑）──
// 读优先：.hcc/state（hcc 统一阶段2 新位置）+ .venture/state fallback（向下兼容旧项目）
// monitor.js 独立实现（不 require pipeline-state，避免 cwd 依赖——本函数用 root 参数拼接）
function resolveStateRootForRead(root) {
  if (!root) root = '.';
  const hcc = path.join(root, '.hcc', 'state');
  if (fs.existsSync(hcc)) return hcc;
  return path.join(root, '.venture', 'state');
}

// ── readBaseline：读 50/60/70 摘要（纯 fs，机械搬运）──
// runDir 不存在 / 文件缺失 → 对应 files_present=false + 字段 null（不抛错，机械层容错不阻塞）
function readBaseline(runDir, opts) {
  const maxChars = (opts && typeof opts.maxChars === 'number') ? opts.maxChars : DEFAULT_MAX_CHARS;
  const result = {
    run_dir: runDir,
    files_present: { '50': false, '60': false, '70': false },
    decision: null,
    plan: null,
    requirements: null,
  };
  if (!runDir || !fs.existsSync(runDir)) return result;

  for (const [_key, fname, field] of BASELINE_FILES) {
    const fp = path.join(runDir, fname);
    if (fs.existsSync(fp)) {
      result.files_present[_key] = true;
      try {
        result[field] = truncate(fs.readFileSync(fp, 'utf8'), maxChars);
      } catch (e) {
        // 读失败保 files_present=true 但字段 null（不阻塞）
        result[field] = null;
      }
    }
  }
  return result;
}

// ── readStagnation：跨 skill 读 cc-runtime checkpoint.stagnation_count（只读）──
// 读取路径：{stateRoot}/direction.json → .checkpoint.{stagnation_count, health}
// direction.json 不存在 / 缺 checkpoint / 缺字段 → null（不阻塞 monitor）
function readStagnation(root) {
  const result = { stagnation_count: null, health: null };
  if (!root) return result;
  const dirPath = path.join(resolveStateRootForRead(root), 'direction.json');
  try {
    if (!fs.existsSync(dirPath)) return result;
    const obj = JSON.parse(fs.readFileSync(dirPath, 'utf8'));
    const cp = obj && obj.checkpoint;
    if (!cp) return result;
    if (typeof cp.stagnation_count === 'number') result.stagnation_count = cp.stagnation_count;
    if (typeof cp.health === 'string') result.health = cp.health;
  } catch (e) {
    // 解析失败不阻塞（机械层容错）
  }
  return result;
}

// ── 文件分类启发式（机械，不精确——精确语义留 Claude）──
// 接口文件 = 架构边界/契约定义变更（架构漂移强信号）
function isInterfaceFile(file) {
  const norm = file.replace(/\\/g, '/');
  // 路径段含 contract/interface/api/schema/dag
  if (/(^|\/)(contracts?|interfaces?|apis?|schemas?|dag)\//i.test(norm)) return true;
  // 文件名 index/types/interfaces.{js,ts,d.ts}
  if (/(^|\/)(index|types|interfaces)\.(js|mjs|cjs|ts|tsx|d\.ts)$/i.test(norm)) return true;
  return false;
}

// 技术栈文件 = 依赖/构建配置变更（技术漂移信号）
function isTechStackFile(file) {
  const base = file.replace(/\\/g, '/').split('/').pop();
  if (/^(package\.json|go\.mod|cargo\.toml|requirements.*\.txt|pyproject\.toml|poetry\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|pom\.xml|build\.gradle|composer\.json|gemfile)$/i.test(base)) return true;
  if (/^dag\..*\.json$/i.test(base)) return true;  // pipeline dag 配置
  return false;
}

// git ref 安全校验（防 shell 注入——since 来自 CLI 参数）
// 允许 git ref 语法：HEAD / HEAD~N / HEAD^ / branch~N / commit-hash / tag
// 拒 shell 元字符（; | $ ` 空格等）防注入
function safeRef(ref) {
  if (!ref || !/^[A-Za-z0-9._~^\/-]+$/.test(ref)) return 'HEAD';
  return ref;
}

// ── gitDiffStat：git diff --numstat 量 + 文件分类（仅调 git，只读）──
// cwd 非 git 仓库 / git 不可用 → error 不阻塞（机械层容错，detectDrift 继续）
function gitDiffStat(cwd, since) {
  const ref = safeRef(since);
  const result = {
    since: ref,
    changed_files: [],
    diff_insertions: 0,
    diff_deletions: 0,
    diff_lines_total: 0,
    interface_files_changed: [],
    tech_stack_files_changed: [],
    raw_numstat: '',
    untracked_files: [],
    error: null,
  };
  let raw;
  try {
    raw = execSync(`git diff --numstat ${ref}`, { cwd: cwd || '.', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    result.error = `git diff 失败：${(e.stderr || e.message || '').toString().split('\n')[0]}`;
    return result;
  }
  result.raw_numstat = raw.trim();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const add = parts[0];
    const del = parts[1];
    const file = parts.slice(2).join('\t');
    const a = /^\d+$/.test(add) ? parseInt(add, 10) : 0;
    const d = /^\d+$/.test(del) ? parseInt(del, 10) : 0;
    result.diff_insertions += a;
    result.diff_deletions += d;
    result.diff_lines_total += a + d;
    result.changed_files.push(file);
    if (isInterfaceFile(file)) result.interface_files_changed.push(file);
    if (isTechStackFile(file)) result.tech_stack_files_changed.push(file);
  }

  // 补 untracked 新文件（git diff HEAD 不含未跟踪文件，但新增模块/接口是重要漂移信号，不可漏）
  // untracked 无 numstat 统计（未跟踪），insertions/deletions 不计，仅计入 changed_files + 分类
  try {
    const untrackedRaw = execSync('git ls-files --others --exclude-standard', { cwd: cwd || '.', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    for (const f of untrackedRaw.split('\n')) {
      const file = f.trim();
      if (!file) continue;
      result.untracked_files.push(file);
      if (!result.changed_files.includes(file)) {
        result.changed_files.push(file);
        if (isInterfaceFile(file)) result.interface_files_changed.push(file);
        if (isTechStackFile(file)) result.tech_stack_files_changed.push(file);
      }
    }
  } catch (e) {
    // untracked 读取失败不阻塞（diff 部分仍有效）
  }
  return result;
}

// ── detectDrift：聚合 baseline + stagnation + diff → 漂移材料 ──
// ★ 机械只检测客观信号，语义分类（需求/技术漂移 + 小/中/大分级）留编排者 Claude
//   mechanical_hints = 机械可判的客观信号特征（非语义分级）：
//     architecture_drift_signal —— 接口/契约文件变更（架构边界动）
//     tech_drift_signal         —— 技术栈文件变更
//     implementation_stall_signal — stagnation ≥ K（验证闸挂隐式信号）
//     no_drift_detected         —— 无变更 + 无 stagnation
function detectDrift(opts) {
  const runDir = opts && opts.runDir;
  const root = (opts && opts.root) || '.';
  const since = opts && opts.since;
  const stagnationK = (opts && typeof opts.stagnationK === 'number') ? opts.stagnationK : 3;
  const maxChars = (opts && typeof opts.maxChars === 'number') ? opts.maxChars : DEFAULT_MAX_CHARS;

  const baseline = readBaseline(runDir, { maxChars });
  const stagnation = readStagnation(root);
  const diff = gitDiffStat(root, since);

  const stagnationBlocked = (stagnation.stagnation_count != null && stagnation.stagnation_count >= stagnationK);
  const mechanical_signals = {
    diff_lines_total: diff.diff_lines_total,
    diff_insertions: diff.diff_insertions,
    diff_deletions: diff.diff_deletions,
    changed_files_count: diff.changed_files.length,
    interface_files_changed: diff.interface_files_changed,
    tech_stack_files_changed: diff.tech_stack_files_changed,
    stagnation_count: stagnation.stagnation_count,
    stagnation_health: stagnation.health,
    stagnation_blocked: stagnationBlocked,
    diff_error: diff.error,
  };

  // 机械客观信号（无量级魔数——diff 量级判断留 Claude 按项目规模定）
  const hints = [];
  if (diff.interface_files_changed.length > 0) hints.push('architecture_drift_signal');
  if (diff.tech_stack_files_changed.length > 0) hints.push('tech_drift_signal');
  if (stagnationBlocked) hints.push('implementation_stall_signal');
  if (hints.length === 0 && diff.diff_lines_total === 0 && !diff.error) hints.push('no_drift_detected');
  else if (hints.length === 0 && diff.diff_lines_total > 0) hints.push('generic_drift_signal');  // 有变更无机械特征→编排者语义量级判断（避免空 hints 歧义）

  return {
    ok: true,
    command: 'monitor',
    run: runDir,
    since: diff.since,
    baseline,
    stagnation,
    diff,
    mechanical_signals,
    mechanical_hints: hints,
    needs_semantic_classification: true,  // 需求/技术漂移语义分类 + 量级分级留编排者 Claude
  };
}

// ── CLI 参数解析 ──
function parseArgs(argv) {
  const opts = { run: null, since: null, root: null, stagnationK: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') opts.run = argv[++i] || null;
    else if (a === '--since') opts.since = argv[++i] || null;
    else if (a === '--root') opts.root = argv[++i] || null;
    else if (a === '--stagnation-k') opts.stagnationK = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

// ── CLI 入口 ──
if (require.main === module) {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write([
      'monitor.js —— pipeline 漂移检测机械层（输出漂移材料给编排者 Claude 语义分类）',
      '',
      '用法：',
      '  node monitor.js --run <dir> [--since <commit>] [--root <dir>] [--stagnation-k <N>]',
      '',
      '参数：',
      '  --run          baseline 决策目录（.hcc/decisions/{run}/，含 50/60/70）',
      '  --since        git diff baseline commit（默认 HEAD = working tree 未提交变更）',
      '  --root         项目根（默认 cwd；stagnation 读取根 + git diff cwd）',
      '  --stagnation-k 验证闸挂阻塞线（默认 3）',
      '',
      '输出：漂移材料 JSON（baseline + stagnation + diff + mechanical_signals + hints）',
      '      needs_semantic_classification=true → 编排者 Claude 做需求/技术漂移语义分类 + 分级',
      '',
    ].join('\n'));
    process.exit(0);
  }

  try {
    const result = detectDrift({
      runDir: opts.run,
      root: opts.root,
      since: opts.since,
      stagnationK: opts.stagnationK,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`错误：${e.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  truncate,
  resolveStateRootForRead,
  readBaseline,
  readStagnation,
  gitDiffStat,
  detectDrift,
  isInterfaceFile,
  isTechStackFile,
  safeRef,
  parseArgs,
  DEFAULT_MAX_CHARS,
  BASELINE_FILES,
};
