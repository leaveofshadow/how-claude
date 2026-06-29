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
 * 第一刀（本文件）：readBaseline + readStagnation + truncate + resolveStateRootForRead（纯 fs）
 * 第二刀（待补）：gitDiffStat + detectDrift 聚合 + parseArgs + CLI main
 */
'use strict';

const fs = require('fs');
const path = require('path');

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

module.exports = {
  truncate,
  resolveStateRootForRead,
  readBaseline,
  readStagnation,
  DEFAULT_MAX_CHARS,
  BASELINE_FILES,
};
