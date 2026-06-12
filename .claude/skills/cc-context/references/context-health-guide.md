# Context 健康指南 — 上下文管理深度参考

## 三大致命记忆问题

### 问题 1: "clear 后失忆"
**症状**：用户执行 /clear 后，之前的 plan、决策、进度全部丢失
**根因**：plan 文件只存在于对话上下文中，没有持久化到文件系统

### 问题 2: "compact 后走样"
**症状**：auto-compact 后，关键决策被概括掉，Claude 做出与之前矛盾的决定
**根因**：compaction 的摘要可能丢失细节，特别是复杂的架构决策

### 问题 3: "CLAUDE.md 膨胀"
**症状**：CLAUDE.md 越写越长，Claude 反而表现更差
**根因**：规则越多 → 冲突越多 → 注意力越分散 → 每条规则的效力越弱

## Context 健康检查流程

```
Step 1: 评估上下文使用率
├── 上下文 < 50%
│   └─ ✅ 健康 — 正常继续
├── 上下文 50-80%
│   └─ ⚠️ 注意 — 关键信息开始写入 memory
├── 上下文 > 80%
│   └─ 🔴 警告 — 立即持久化 + 准备 compact
└── 接近上限
    └─ 🔴🔴 紧急 — 立即 /compact，否则 auto-compact 可能丢失信息

Step 2: 检查未持久化内容
├── 有未保存的 plan？→ 写入文件
├── 有关键架构决策？→ 写入 memory
├── 有未完成的任务？→ TaskList 截图写入 memory
└── 有重要的代码变更方向？→ 写入 memory

Step 3: 选择策略
├── 继续（上下文充裕）→ 继续
├── 持久化 + compact → 先写 memory，再 /compact
├── 持久化 + clear → 先写 memory + 文件，再 /clear
└── 新会话 → 持久化所有，开新会话，从 memory 恢复
```

## 记忆持久化策略

### Plan 文件持久化

```
plan 文件持久化选项（按推荐度排序）：

方案 1: Memory 文件（推荐）
  → 写入 ~/.claude/projects/{project}/memory/plan-{topic}.md
  → 优点：新会话自动加载，Claude 自然发现
  → 适合：需要跨会话追踪的计划

方案 2: 项目文件
  → 写入 .claude/plans/{plan-name}.md
  → 优点：可版本控制，团队共享
  → 适合：项目级长期计划

方案 3: CLAUDE.md import
  → 在 CLAUDE.md 中加 @path/to/plan.md
  → 优点：启动时自动加载
  → 适合：每次启动都需要知道的计划
```

### Compact 前准备清单

```
在执行 /compact 前，检查以下内容是否已持久化：

□ 关键架构决策 → memory write
□ 代码变更方向和理由 → memory write
□ 未完成的任务列表 → TaskList 截图 → memory write
□ 重要的上下文（用户偏好、约束）→ memory write
□ 任何不能从代码本身推导出的信息 → memory write

然后执行: /compact
```

### Clear 前准备清单

```
在执行 /clear 前（比 compact 更激进）：

□ 所有 Plan 内容 → 写入 memory 或 .claude/plans/
□ 所有重要决策 → memory write
□ 当前工作进度 → memory write
□ 文件变更清单（改了哪些文件、为什么）→ memory write
□ 测试状态（哪些通过、哪些失败）→ memory write

然后执行: /clear

新会话恢复时：
  Claude 会自动加载 memory 文件
  → 说"继续之前的工作"即可
```

## Auto-Compact 防御策略

Auto-compact 会在上下文窗口快满时自动触发。防御方法：

### 策略 1: 主动 Checkpoint
```
每完成一个重要阶段后，主动将关键信息写入 memory：

"将以下决策写入 memory:
 - 选择了方案 B（微服务）
 - 原因: 扩展性需求
 - 保留的约束: 必须支持 gRPC"
```

### 策略 2: CLAUDE.md 作为锚点
```
CLAUDE.md 不受 compact 影响（每次调用都重新加载）。
把最关键的不变信息放在 CLAUDE.md 中。

示例：
 # 项目约束
 - 数据库只用 PostgreSQL
 - API 版本前缀 /api/v1/
 - 所有接口必须有 OpenAPI 文档
```

### 策略 3: 文件驱动开发
```
将工作状态保存在文件中而非对话上下文中：

 .claude/
   ├── current-task.md    ← 当前任务的详细描述
   ├── decisions.md       ← 已做出的关键决策
   └── progress.md        ← 进度追踪

这样即使 compact 丢失了对话历史，
Claude 可以通过读取这些文件恢复状态。
```

## 上下文经济优化

### 减少 CLAUDE.md 占用的技巧

| 技巧 | 效果 |
|------|------|
| 用 `@import` 拆分大段参考 | 只在需要时加载 |
| 用 Skill 替代长规则 | 按需加载，不占常驻 |
| 删除 Claude 默认就做的规则 | 节省 tokens |
| 合并相似规则 | 减少冲突风险 |
| 用示例替代描述 | 更短的规则，更好的效果 |

### Prompt Caching 优化

```
Prompt Cache 是前缀匹配（prefix match）。

缓存友好：
  ✅ CLAUDE.md 保持稳定（不频繁修改）
  ✅ import 文件内容固定
  ✅ 系统提示中的规则有稳定顺序

缓存不友好：
  ❌ 每次会话修改 CLAUDE.md
  ❌ import 的文件频繁变化
  ❌ 在 CLAUDE.md 中放动态内容（日期、计数器）
```

## 与教练技能其他模块的联动

### Context 健康 + Goal
```
制定 Goal 时，考虑上下文容量：
  - 大 Goal → 拆分为多个会话，每个有明确的持久化点
  - L4 Goal → 自验证减少人工确认，但注意上下文消耗
```

### Context 健康 + Loop
```
Loop 模式天然管理上下文：
  - ScheduleWakeup 每次唤醒是新请求，缓存可能有或没有
  - 长时间 Loop 任务 → 在循环中定期 memory write
  - 用 ScheduleWakeup 的 delaySeconds 控制缓存命中率
```

### Context 健康 + 配置系统
```
好的配置系统设计减少上下文浪费：
  - Hook 自动化 → 减少对话中的手动指令
  - Skill 按需加载 → 不占常驻上下文
  - Memory 积累经验 → 不用每次重新解释
```

---

## Loop Engineering 视角：循环中的上下文管理

在循环中，上下文管理是**关键基础设施**，不是可选项。

### 循环的上下文生命周期

```
每次迭代：
  ┌─ 加载锚文件（CLAUDE.md/PROMPT.md）→ 常量
  ├─ 加载上一轮摘要（如有）            → 变量
  ├─ 执行任务                          → 产生新上下文
  ├─ 摘要本轮结果                      → 压缩
  └─ 写回磁盘（进度/决策）             → 持久化

迭代间：
  对话上下文可能丢失（compact/reset）
  → 依赖锚文件 + 磁盘状态恢复
```

### 三种循环的上下文策略

| 循环类型 | 上下文策略 | 关键点 |
|---------|-----------|--------|
| CronCreate | 每次可能全新（冷缓存） | 严重依赖锚文件 + 磁盘状态 |
| ScheduleWakeup | 可能在热缓存内 | 控制在 270s 内保持热 |
| 自主循环 | 会话内连续 | 定期 memory writeback |

### 长循环的 memory writeback 规则

```
什么时候写回：
  ✓ 完成一个阶段 → 写回阶段成果
  ✓ 做出重要决策 → 写回决策和理由
  ✓ 发现非显而易见的模式 → 写回观察
  ✗ 不写回：代码结构（代码本身已记录）
  ✗ 不写回：密钥/敏感信息
  ✗ 不写回：显而易见的事实
```

### 循环中的 compact 策略

```
主动 checkpoint（在 compact 触发前）:
  1. 每 3-5 轮迭代后，主动 memory writeback
  2. 当前进度写入 .claude/progress.md
  3. 未完成项写入 specs/TODO.md
  4. 然后 /compact

被动 compact（auto-compact 触发时）:
  - 锚文件（CLAUDE.md）不受影响
  - memory 文件不受影响
  - 对话上下文被摘要 → 可能丢失细节
  - 预防：关键信息提前写入 memory
```
