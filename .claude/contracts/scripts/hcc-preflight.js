#!/usr/bin/env node
// hcc-preflight.js — hcc-org 初始化自检（M6 R6.1 + R6.3，charter 块3 自检机制）
// 纯 Node fs + path（C2：禁 vm/eval/Function/SDK 子进程/外部依赖）
// 流程：读 hcc-dependencies.json → existsSync 查每条 check_paths（项目级 + 用户级 fallback）
//       → 输出 env-scan.json（timestamp + 依赖状态 + 缺失分级 required 阻断 / optional 告警）
// TTL：读现有 env-scan.json timestamp，< 24h 返缓存（cached:true）；>= 24h 重扫
// exit 0：有缺失也 exit 0，缺失在 json 里标阻断/告警（自检=提示，非硬闸）
// 可测性（R6.5）：核心逻辑 export 为纯函数，CLI main 包 require.main，测试 require 调纯函数不触发 main。

const fs = require('fs');
const path = require('path');

const TTL_MS = 24 * 60 * 60 * 1000; // 24h（charter 块3 默认）

// 纯函数：查一组路径任一存在即 installed（项目级相对 root 拼，绝对路径直查）
function checkPathsInstalled(checkPaths, projectRoot) {
  const paths = checkPaths || [];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const full = path.isAbsolute(p) ? p : path.join(projectRoot || process.cwd(), p);
    if (fs.existsSync(full)) return { installed: true, found_at: full };
  }
  return { installed: false, found_at: null };
}

// 纯函数：扫描 deps 数组 → 结果数组（缺失分级：required=true→block 阻断 / required=false→warn 告警）
function scanDeps(deps, projectRoot) {
  return (deps || []).map(function (d) {
    const chk = checkPathsInstalled(d.check_paths, projectRoot);
    const severity = chk.installed ? 'ok' : (d.required === true ? 'block' : 'warn');
    return {
      name: d.name,
      required: d.required === true,
      required_by: d.required_by || '',
      installed: chk.installed,
      found_at: chk.found_at,
      severity: severity
    };
  });
}

// 汇总（total / installed / missing_block / missing_warn）
function summarize(results) {
  return {
    total: results.length,
    installed: results.filter(function (r) { return r.installed; }).length,
    missing_block: results.filter(function (r) { return r.severity === 'block'; }).length,
    missing_warn: results.filter(function (r) { return r.severity === 'warn'; }).length
  };
}

// TTL 判定：返 'cache'（< 24h）| 'rescan'（>= 24h 或无缓存 / timestamp 非数）
function decideCache(existingTimestamp, now) {
  if (typeof existingTimestamp !== 'number') return 'rescan';
  return ((now - existingTimestamp) < TTL_MS) ? 'cache' : 'rescan';
}

// === CLI main（直接运行时执行；测试 require 时不触发）===
function main() {
  const SCRIPT_DIR = __dirname;
  const DEPS_FILE = path.join(SCRIPT_DIR, 'hcc-dependencies.json');
  const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..'); // 阶段5：contracts/scripts/ 比 skills/hcc-org/scripts/ 少 1 级（3 级回退到项目根）
  const ENV_SCAN_DIR = path.join(PROJECT_ROOT, '.hcc', 'ops', 'hcc-org');
  const ENV_SCAN_FILE = path.join(ENV_SCAN_DIR, 'env-scan.json');

  const deps = JSON.parse(fs.readFileSync(DEPS_FILE, 'utf8')).dependencies || [];

  let cache = null;
  if (fs.existsSync(ENV_SCAN_FILE)) {
    try { cache = JSON.parse(fs.readFileSync(ENV_SCAN_FILE, 'utf8')); } catch (e) { cache = null; }
  }
  const now = Date.now();
  const decision = cache ? decideCache(cache.timestamp, now) : 'rescan';

  let report;
  if (decision === 'cache') {
    report = Object.assign({}, cache, { cached: true });
  } else {
    const results = scanDeps(deps, PROJECT_ROOT);
    report = { timestamp: now, cached: false, dependencies: results, summary: summarize(results) };
    try {
      fs.mkdirSync(ENV_SCAN_DIR, { recursive: true });
      fs.writeFileSync(ENV_SCAN_FILE, JSON.stringify(report, null, 2), 'utf8');
    } catch (e) { /* 落盘失败不阻断，stdout 仍输出 */ }
  }

  const lines = [];
  lines.push('=== hcc-org 环境自检（env-scan）===');
  lines.push('cached: ' + report.cached + (report.cached ? '（TTL < 24h，返缓存）' : '（重扫）'));
  lines.push('timestamp: ' + new Date(report.timestamp).toISOString());
  lines.push('');
  lines.push('依赖状态：');
  (report.dependencies || []).forEach(function (d) {
    const tag = d.installed ? '[OK]' : (d.severity === 'block' ? '[阻断]' : '[告警]');
    lines.push('  ' + tag + ' ' + d.name + (d.required ? ' (required)' : ' (optional)') + ' ← ' + d.required_by);
    if (!d.installed) lines.push('       缺失！补装命令见 hcc-dependencies.json 的 install 字段');
  });
  lines.push('');
  const s = report.summary;
  lines.push('汇总：total=' + s.total + ' installed=' + s.installed + ' 阻断=' + s.missing_block + ' 告警=' + s.missing_warn);
  if (s.missing_block > 0) lines.push('⚠️ 有 required 依赖缺失（阻断）：对应节点（N3.5/N7）无法启动，按 install 字段补装后重跑');
  else if (s.missing_warn > 0) lines.push('ℹ️ 有 optional 依赖缺失（告警，不阻断主闭环）：用到时（N7）再补装');
  else lines.push('✅ 全部依赖就绪');
  lines.push('');
  lines.push('env-scan.json: ' + ENV_SCAN_FILE);
  console.log(lines.join('\n'));
  process.exit(0);
}

module.exports = { checkPathsInstalled, scanDeps, summarize, decideCache, TTL_MS };
if (require.main === module) main();
