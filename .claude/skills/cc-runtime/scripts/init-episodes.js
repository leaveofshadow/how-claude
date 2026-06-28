#!/usr/bin/env node
/**
 * cc-runtime init-episodes.js —— 初始化 .hcc/state/episodes.json（经验蒸馏三段式，schema v2）
 *
 * 依据：.hcc/decisions/2026-06-28-episodes-distill/50-decision.md（α'' + Phase 0b 修正）
 * 配套：60-impl-plan.md M0
 *
 * episodes.json 是 compact-snapshot 附属经验库（非 state-schema frozen 四文件）：
 *   - verified_facts / lessons：agent 蒸馏写（信号触发，见 50-decision 蒸馏 prompt）
 *   - last_run：compact-snapshot hook 机械填（从 checkpoint/transcript 提取）
 *
 * 复用 init-state.js 的 atomicWriteJSON（M4 原子写，Windows rename 防竞态）+ resolveRoot。
 * 幂等：已存在默认跳过（除非 --force）。
 * 用法：
 *   node init-episodes.js                # 初始化 ./.hcc/state/episodes.json
 *   node init-episodes.js --root <dir>   # 指定状态根
 *   node init-episodes.js --force        # 覆盖已存在
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteJSON, resolveRoot } = require('./init-state');

const FORCE = process.argv.includes('--force');

// episodes schema v2 默认值（50-decision）
// verified_facts/lessons 初始空（agent 蒸馏填）；last_run 占位（hook 填）
function defaults(isoNow) {
  return {
    schema_version: 2,
    verified_facts: [],  // agent 蒸馏写：{fact, evidence, confidence, utility, ts}
    lessons: [],         // agent 蒸馏写：{lesson, signal, anti_pattern, occurrence, utility, ts}
    last_run: {          // compact-snapshot hook 机械填
      node: null,
      iter: 0,
      result: null,
      ts: null,
    },
    updated_at: isoNow,
  };
}

// 主流程：初始化 episodes.json（幂等 + --force）
function initEpisodes(root, opts) {
  const force = (opts && opts.force) || false;
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  const isoNow = (opts && opts.now) || new Date().toISOString();
  const fp = path.join(root, 'episodes.json');

  if (fs.existsSync(fp) && !force) {
    return { created: [], skipped: ['episodes.json'], root };
  }
  atomicWriteJSON(fp, defaults(isoNow));
  return { created: ['episodes.json'], skipped: [], root };
}

// CLI 入口（测试 require 时不触发）
if (require.main === module) {
  const root = resolveRoot(process.argv);
  const result = initEpisodes(root, { force: FORCE });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

module.exports = { initEpisodes, defaults };
