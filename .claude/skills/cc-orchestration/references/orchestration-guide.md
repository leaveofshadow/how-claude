# 编排指南 — Subagent/Workflow/Team 深度参考

## 核心决策：谁持有计划？

| | 直接工作 | Subagent | Workflow | Team |
|---|---|---|---|---|
| **谁决定下一步** | Claude 逐轮 | Claude 逐轮委托 | **脚本决定** | Lead agent 逐轮 |
| **中间结果在哪** | 对话上下文 | 独立上下文窗口 | 脚本变量 | 共享任务列表 |
| **可复现性** | 无 | worker 定义 | **整个编排** | team 定义 |
| **规模** | 单任务 | 几个委托 | **几十上百 agent** | 几个长期 peer |
| **中断恢复** | 从头开始 | 从头开始 | **可恢复** | peer 继续运行 |
| **适用场景** | 简单任务 | 中等复杂度 | 大规模/质量保证 | 长期并行协作 |

## 选择流程图

```
你的任务是什么特征？
│
├─ 单文件小改动（改个函数、修个 bug）
│  └─ 直接工作 — 零开销
│
├─ 需要搜索/分析但不改代码（找 bug、理解架构）
│  └─ Explore agent (haiku) — 成本低、速度快
│
├─ 需要深度分析（架构评审、安全审计）
│  └─ Analyst agent (opus) — 质量最高
│
├─ 2-3 个独立子任务（改前端 + 改后端 + 改测试）
│  └─ 并行 Agents — 墙钟时间短
│     model: sonnet（标准）或 opus（复杂）
│
├─ 确定性流水线（扫描 → 分析 → 修复 → 验证）
│  └─ Workflow pipeline — 可控、可复现
│
├─ 需要多视角后综合（多方案对比、多角度审查）
│  └─ Workflow parallel — 独立评审后综合
│
├─ 需要防止假阳性（安全审计、bug 发现）
│  └─ Workflow + 对抗验证 — N 个怀疑者否决
│
├─ 3+ 个长期并行任务（同时写 3 个功能）
│  └─ Team 模式 — peer 各自在 worktree 隔离运行（操作见 cc-loop Stage4 worktree SOP）
│
└─ 不确定复杂度
   └─ Explore agent 先侦察 → 再决定
```

## Subagent 配置指南

### Agent 文件格式
```markdown
---
name: your-agent-name
description: Use when...（描述触发条件，不要描述工作流）
tools: Read, Grep, Glob, Bash   # 可选，不写则继承全部
model: sonnet                    # 可选: sonnet/opus/haiku/inherit
---

你的 agent 的系统提示词。
告诉它：角色、能力、工作方式、约束。
```

### Agent 存放位置
| 类型 | 位置 | 作用域 | 优先级 |
|------|------|--------|--------|
| 项目 agents | `.claude/agents/` | 当前项目 | 高 |
| 用户 agents | `~/.claude/agents/` | 所有项目 | 低 |

### 模型选择指南

| 模型 | 何时用 | 典型场景 |
|------|--------|---------|
| **haiku** | 快速查找、简单分类 | 文件搜索、格式转换、简单 QA |
| **sonnet** | 标准开发任务 | 写代码、调试、测试、重构 |
| **opus** | 深度分析、架构决策 | 代码审查、安全审计、方案设计 |

### Agent 设计设计要点

1. **单一职责** — 一个 agent 做一件事
2. **限制工具** — 只给必要的工具（安全性+聚焦）
3. **详细提示** — 包含具体指令、示例、约束
4. **用 Claude 生成初版** — 然后迭代优化

## Workflow 5 种质量模式

### 模式 1: 对抗验证（Adversarial Verify）
```
适用：安全审计、bug 发现、重要决策验证

流程：
  发现 → N 个独立怀疑者并行审查
  → ≥多数否决则丢弃
  → 存活的结果更可信

示例：
  Phase 'Find': 3 个 finder 并行找 bug
  Phase 'Verify': 每个 bug 由 3 个 skeptic 独立尝试反驳
  → ≥2 个 skeptic 反驳 = 丢弃
```

### 模式 2: 判官小组（Judge Panel）
```
适用：方案设计、架构选择、多解法问题

流程：
  N 个独立方案并行起草
  → 独立 judge 打分
  → 选评分最高方案 + 嫁接次高方案的优点

示例：
  Phase 'Draft': 3 个 agent 独立设计方案
  Phase 'Judge': 1 个 judge 评分并综合
```

### 模式 3: 循环至干（Loop Until Dry）
```
适用：未知规模的发现任务（找 bug、搜文件）

流程：
  持续发现 → 去重 → 直到 K 轮无新结果

示例：
  while (dry < 2) {
    finders parallel → new findings
    dedup vs seen → if none, dry++
    else dry = 0, verify new ones
  }
```

### 模式 4: 多模式扫描（Multi-Modal Sweep）
```
适用：全面搜索（代码审计、依赖检查）

流程：
  不同搜索角度的 agent 并行
  → 各自盲区不同 → 合并覆盖更全

示例：
  Agent 1: 按目录扫描
  Agent 2: 按内容模式扫描
  Agent 3: 按依赖关系扫描
```

### 模式 5: 完整性批评（Completeness Critic）
```
适用：最终检查

流程：
  完成所有发现后 → 一个 agent 问"还漏了什么？"
  → 它的回答成为下一轮工作
```

## Workflow 代码模式速查

```javascript
// Pipeline（默认，推荐）
// 每个 item 独立通过所有 stage，无屏障
const results = await pipeline(
  items,
  item => agent(`分析 ${item}`, {schema: SCHEMA}),
  result => agent(`验证 ${result}`, {schema: VERIFY_SCHEMA})
)

// Parallel（屏障，需要全部结果再继续）
const all = await parallel([
  () => agent('方案A', {schema}),
  () => agent('方案B', {schema}),
  () => agent('方案C', {schema})
])
const best = pickBest(all)

// Loop until dry
const seen = new Set(), confirmed = []
let dry = 0
while (dry < 2) {
  const found = await parallel(finders.map(f => () => agent(f.prompt, {schema})))
  const fresh = found.flat().filter(f => !seen.has(key(f)))
  if (!fresh.length) { dry++; continue }
  dry = 0; fresh.forEach(f => seen.add(key(f)))
  const judged = await parallel(fresh.map(f => () => agent(`验证 ${f}`, {schema})))
  confirmed.push(...judged.filter(v => v.real))
}
```

## Team 模式设计要点

### 何时需要 Team
- 3+ 个独立且长期运行的任务
- 需要不同专家同时工作
- 任务之间需要协调但不强依赖

### Team 生命周期
```
team-plan → team-prd → team-exec → team-verify → team-fix
                                        ↑              │
                                        └──────────────┘
                                        （fix 循环有最大次数）
```

### Team vs Workflow 选择

| 特征 | 选 Team | 选 Workflow |
|------|---------|------------|
| 需要用户中途干预 | ✅ | ❌ |
| 任务完全确定 | 不一定 | ✅ |
| 需要长期运行 | ✅ | ✅ |
| 需要可复现的编排 | 不一定 | ✅ |
| agent 之间需要协调 | ✅ | 通过脚本 |

---

## Loop Engineering 视角：编排循环

编排循环是 Loop Engineering 的 Stage 4-5：循环不再驱动单个 agent，而是**监督多个 agent 的协同**。

### 从单 agent 循环到编排循环

```
Stage 1-3: 单 agent 循环
  while: cat PROMPT.md | claude
  → 一个 agent 做所有事

Stage 4: 编排循环
  while: supervisor reads state → dispatches agents → reads results → repeats
  → 一个 supervisor 管多个 worker

Stage 5: 全自动编排（Gas Town）
  Mayor agent + patrol agents，持续运行
  → 多个 peer 各自循环（在隔离 worktree 中），通过 git 状态协调
```

### 编排循环 vs 静态 Workflow

| 维度 | 静态 Workflow | 编排循环 |
|------|--------------|---------|
| 计划 | 写死在脚本里 | supervisor 每轮动态决定 |
| 适应性 | 输入变化时失败 | 根据每轮结果调整 |
| 恢复 | 从头重跑 | 从断点继续 |
| 适合 | 确定性流水线 | 不确定性任务 |

### 编排循环的合同扩展

在标准循环合同基础上，编排循环需要额外定义：

```
AGENTS    → 哪些 agent 可用？各自的能力？
ROUTING   → 什么情况分派给哪个 agent？
MERGE     → 多个 agent 的结果如何合并？（worktree 是物理隔离实现：每个 agent 一个独立 worktree/分支，过闸后 merge 回主干）
CONFLICT  → agent 之间冲突时怎么解决？（跨 worktree 合并冲突走 cc-loop Stage4 worktree SOP 的 CONFLICT 规则：FIFO + rebase + 编排者介入）
RECOVERY  → agent 失败时的降级策略？
```

### 实战模式

**PR Babysit（Boris 推荐）**:
```
/loop babysit all my PRs.
Auto-fix build issues,
and when comments come in,
use a worktree agent to fix them.
```
→ supervisor 循环 + 分派 worktree-isolated sub-agents（隔离/合并/冲突/回收走 cc-loop Stage4 worktree SOP）

**代码审查自动化**:
```
/loop 30m /code-review
```
→ 循环调用命名 skill → skill 内部可能启动并行 agents
