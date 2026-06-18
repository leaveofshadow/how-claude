<#
.SYNOPSIS
  deploy-hcc.ps1 —— 层3 cc-venture 沙箱部署脚本（决策 D：开发/运行分离）
.DESCRIPTION
  创建 E:\tmp\hcc 运行沙箱：复制 6 个 skill + dag.venture.json + 创建 .venture/{state,artifacts}。
  硬检查 cc-runtime（require 链不断）+ dag.venture.json。自包含真独立测试沙箱（用户约束③原话）。
  来源：cc-2pp 2026-06-18-cc-venture-layer3 决策 D + 70-requirements R3.1。
  幂等：New-Item -Force + Copy-Item -Force，重跑覆盖不报错（删 .venture/state 重 init 即可重跑）。
#>
[CmdletBinding()]
param()

# 1. 创建目录树（.venture/state 引擎状态 + .venture/artifacts 业务产物 [R5]）
$sandbox = 'E:\tmp\hcc'
New-Item -ItemType Directory -Force "$sandbox\.claude\skills" | Out-Null
New-Item -ItemType Directory -Force "$sandbox\.venture\state" | Out-Null
New-Item -ItemType Directory -Force "$sandbox\.venture\artifacts" | Out-Null

# 2. 复制 5 个项目级 skill（venture-pipeline / hcc-decision / hcc-sales / hcc-org / cc-runtime）
$srcBase = 'E:\work\person\vibe_coding\skills\how-claude\.claude\skills'
$projectSkills = @('venture-pipeline', 'hcc-decision', 'hcc-sales', 'hcc-org', 'cc-runtime')
foreach ($s in $projectSkills) {
  Copy-Item -Recurse -Force "$srcBase\$s" "$sandbox\.claude\skills\$s"
}

# 3. venture-judge 从用户级复制（开发源码仓无此 skill；决策 D 项目级+用户级双防线）
$ventureJudgeSrc = 'C:\Users\newuser\.claude\skills\venture-judge'
if (Test-Path $ventureJudgeSrc) {
  Copy-Item -Recurse -Force $ventureJudgeSrc "$sandbox\.claude\skills\venture-judge"
} else {
  Write-Warning "用户级 venture-judge 不存在（$ventureJudgeSrc）—— /judge 将靠 fallback；项目级无此 skill。"
}

# 4. 硬检查 cc-runtime（require 链不断的前提：advance-node.js → ../../cc-runtime/scripts/init-state）
if (-not (Test-Path "$sandbox\.claude\skills\cc-runtime\scripts\init-state.js")) {
  throw 'cc-runtime 复制失败，require 链会断（advance-node.js require ../../cc-runtime/scripts/init-state）'
}

# 5. 硬检查 dag.venture.json（业务版 8 节点 DAG）
if (-not (Test-Path "$sandbox\.claude\skills\venture-pipeline\dag.venture.json")) {
  throw 'dag.venture.json 复制失败'
}

# 6. 输出下一步（决策 E 6 步验收 Step 0 init）
Write-Host "部署完成：$sandbox"
Write-Host '下一步（决策 E 6 步验收 Step 0 init）：'
Write-Host "  cd $sandbox"
Write-Host '  node .claude\skills\venture-pipeline\scripts\pipeline-state.js init --dag .claude\skills\venture-pipeline\dag.venture.json'
Write-Host ''
Write-Host '复制清单：5 项目级 skill（venture-pipeline/hcc-decision/hcc-sales/hcc-org/cc-runtime）+ venture-judge（用户级）= 6 skill'
