# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Claude Code **技能（Skill）** 项目：`claude-coach` 系列——Claude Code **Loop Engineering** 教练套件。包含 1 个路由器 + 8 个专业子技能（含设计决策），按需加载。

核心理念：**你不 prompt agent，你设计循环让循环去 prompt agent。**

## 项目结构

```
.claude/skills/
├── claude-coach/                     # 路由器：诊断问题 → 路由到子技能
│   └── SKILL.md                      # 路由表 + 交互风格
├── cc-loop/                          # Loop Engineering 核心课
│   ├── SKILL.md                      # 五阶段演进 + 循环合同 + 护栏 + 闭环反馈
│   └── references/loop-guide.md      # Loop Engineering 深度参考
├── cc-goal/                          # 终态条件设计
│   ├── SKILL.md                      # 五层模型 + 自评通过 + 预检 + /goal 输出
│   └── references/goal-guide.md      # 终态条件设计方法论（supergoal 启发）
├── cc-orchestration/                 # 编排决策教练
│   ├── SKILL.md
│   └── references/orchestration-guide.md  # 含编排循环（Stage 4-5）
├── cc-config/                        # 配置系统 + 锚文件设计
│   ├── SKILL.md
│   └── references/config-systems-guide.md # 含锚文件体系（VISION.md/AGENTS.md）
├── cc-context/                       # 上下文健康教练
│   ├── SKILL.md
│   └── references/context-health-guide.md # 含循环上下文管理
├── cc-scanner/                       # 技能知识库 + 循环资产
│   ├── SKILL.md
│   └── references/scanner-guide.md       # 含技能作为循环资产
├── cc-memory/                        # 记忆系统审查教练
│   ├── SKILL.md
│   └── references/memory-review-guide.md # 含循环记忆写回
└── cc-2pp/                           # 两阶段设计决策（探索→方案→对抗→实施计划）
    ├── SKILL.md                      # 基础假设 + 双校正 + 一等公民 + 文件存储
    └── references/2pp-guide.md       # 视角库 + 对抗策略 + Plan 模板
```

## 架构设计

### 三阶段流程：Research → Ask → Plan/Route

1. **Research**：静默收集信息（读 CLAUDE.md、settings.json、memory、已安装技能）
2. **Ask**：基于发现精准提问 2-3 个关键问题
3. **Plan/Route**：路由器推荐子技能；子技能给出具体方案

### 路由器 + 子技能架构

`claude-coach` 是路由器，根据关键词路由到 8 个子技能之一：
- `cc-loop` — **Loop Engineering 核心课**（五阶段演进 + 循环合同 + 护栏 + 闭环反馈 + 锚文件）
- `cc-goal` — **终态条件设计**（五层模型 + supergoal 自评方法 + 预检 + 可粘贴 /goal 输出）
- `cc-orchestration` — 编排决策（subagent/workflow/team 决策树 + 编排循环）
- `cc-config` — 配置系统（六层配置 + CLAUDE.md 诊断 + 锚文件设计）
- `cc-context` — 上下文健康（健康检查 + 持久化策略 + 循环上下文管理）
- `cc-scanner` — 技能知识库（多源扫描 → 推荐 → 技能作为循环资产）
- `cc-memory` — 记忆审查（5系统 × 3级别 + 循环记忆写回）
- `cc-2pp` — **两阶段设计决策**（探索 → 多方案 → 对抗验证 → 实施计划 + 技术选型双校正）

每个子技能独立加载，只在触发时消耗上下文。

## 修改指南

- **claude-coach/SKILL.md**：路由表和交互风格。保持精简，不堆叠领域内容。
- **cc-*/SKILL.md**：每个子技能的触发词、速查表和流程。独立成文，互不依赖。
- **cc-*/references/*.md**：深度参考文档，按需加载。修改时只需关注单个文件。
- **不要在路由器 SKILL.md 中堆叠深度内容**——路由器只做诊断和分发。
- 所有文档使用中文简体编写。
- 文件中的决策树、流程图使用 ASCII art 格式。

## 关键约束

- 技能知识库的扫描来源有严格优先级：project > personal > skills-cli > omc > custom > builtin
- Loop 指南中 300s 间隔被明确标注为反模式（缓存冷 + 没省频率），不要推荐使用
- Goal 五层模型中，每层对应不同的工作模式（直接工作 / TaskCreate / EnterPlanMode / /goal 或 /loop）
- 配置系统六层有明确的上下文成本：Hook 零成本，CLAUDE.md 常驻，Skill 按需加载
- 循环合同必须包含三件护栏：最大迭代数、无进展检测、预算上限
- 终态条件必须通过自评（可证伪性 + 原子性 + 最弱依赖）才能输出给用户
- Loop Engineering 五阶段：ralph → /goal → /loop → 编排循环 → 全自动编排
- 锚文件体系（VISION.md/CLAUDE.md/AGENTS.md/PROMPT.md）是循环稳定性的基础
