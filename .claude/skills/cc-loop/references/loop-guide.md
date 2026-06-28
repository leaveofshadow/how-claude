# Loop Engineering 深度参考

## 这是什么

Loop Engineering 是 2026 年 6 月爆发的 AI 编程新范式。一句话：**你不 prompt agent，你设计循环让循环去 prompt agent**。

本文档是 cc-loop 技能的深度参考，覆盖从理论到实战的完整知识体系。

---

## 一、历史演进：从 ReAct 到编排循环

理解循环的 lineage，才能选择正确的层级。

| 阶段 | 时间 | 核心模式 | 代表 |
|------|------|---------|------|
| ReAct | 2022 | Reason → Act → Observe → Repeat | 学术论文 |
| AutoGPT | 2023 | Goal 驱动自 prompt | 有名但常空转 |
| ralph loop | 2025.7 | bash while + PROMPT.md + 磁盘持久化 | Geoffrey Huntley |
| /goal | 2026 春 | 终态条件驱动，validator 确认完成 | Claude Code / Codex |
| /loop | 2026 春 | 调度 + 动态间隔 + 一个斜杠命令 | Claude Code |
| 编排循环 | 2026 夏 | 多 agent 并行 + 持续监督 | Gas Town (Steve Yegge) |

**关键跃迁点**：ralph → /goal → 编排循环。每次跃迁，人的角色从"循环内"移到"循环外"。

### ralph loop（Stage 1）

```bash
while :; do cat PROMPT.md | claude; done
```

ralph 的创新不是聪明的编排，而是**纪律**：
- 每次迭代**重置上下文**到固定的锚文件
- 进度存在**磁盘和 git**里，不在对话里
- 每次**只做一个离散任务**，验证，退出

Huntley 用 ralph 花 ~$297 构建了 Cursed（一门 esoteric 编程语言）。

### /goal（Stage 2）

给 agent 一个**终态条件**，让它自己判断是否完成。比 ralph 更高层：
- 不用写 PROMPT.md 描述"做什么"，直接描述"完成时什么样"
- agent 自己决定执行路径

### /loop（Stage 3）

Claude Code 内置的调度命令：
```
/loop 5m /babysit     → 每5分钟自动处理 PR review
/loop 30m /slack-feedback → 每30分钟提交反馈
/loop check the deploy    → 动态间隔，agent 自己决定
```

### 编排循环（Stage 4-5）

Stage 4：循环监督多个 agent，**并行 worktree**（标准化流程见下）
Stage 5：Gas Town 式 — Mayor agent + patrol agents，20-30 个 Claude Code 实例持续运行

#### worktree 标准化流程（Stage 4 的实质化）

并发槽位 ≤ 2：同时活跃 worktree ≤ 2。⚠️ 这是"同时工作"上限，**不是创建总数配额**——可以规划 5 个 worktree 任务排队，但同一时刻只有 2 个在跑，其余等槽位释放。

```
1. 判定开     任务与其他活跃任务无依赖 → 可开 worktree 并行
              （有依赖 → 串行，等上游 worktree 合并后接力）
2. 开         git worktree add .wt/{slug} -b feat/{slug}
              （独立分支，命名 feat/{里程碑或任务slug}；不在主分支动）
3. 绑定       一个 worktree ←→ 一组 agent + 该里程碑验证闸(60) + 该 worktree 需求项(70)
              （绑定后，循环知道这个 worktree 该跑哪些需求项、过什么闸）
4. 并发控制   活跃 worktree ≤ 2；新任务槽位满 → 排队，等回收
              （BUDGET 的物理约束：超过 2 个并行 = 上下文/资源不可控）
5. 闸         worktree 内独立跑验证闸（60 的验证闸 + 70 的可证伪验证）
              过闸才 commit；不过闸 = 该 worktree 不算完成
6. 合并       过闸 → commit → merge 回主干（或开 PR）
              跨 worktree 冲突 → 按 CONFLICT 规则处理（见下）
7. 回收       合并完成 → git worktree remove .wt/{slug} + 删分支
              槽位释放 → 推进排队中的下一个任务
8. 监督(循环) Stage 4 循环职责：检查各 worktree 闸状态、活跃数 ≤2、推进排队
              无进展（某 worktree 连续 K 轮不过闸）→ 触发护栏停止该 worktree
```

**CONFLICT 规则（跨 worktree 合并冲突）**：
- 先合并的 worktree 胜出（FIFO）；后合并的负责 rebase 解决冲突
- 冲突涉及同一文件同一区域 → 编排者介入，不让两个 agent 互相覆盖
- 解决后重跑该 worktree 验证闸，确认未破坏

**失败恢复（RECOVERY）**：
- worktree 验证闸连续不过 → git restore 回滚该 worktree 该步，重做（不污染主干）
- worktree 整体卡死 → 标记 BLOCKED，回收槽位，人介入或降级

---

## 二、循环解剖学

### 一个循环的 6 个要素

```
┌─────────────────────────────────────────────┐
│              LOOP CONTRACT                   │
│                                              │
│  TRIGGER  ──→  什么触发这次循环？             │
│  SCOPE    ──→  作用域是什么？                 │
│  ACTION   ──→  每次迭代做什么？               │
│  BUDGET   ──→  最多花多少资源？               │
│  STOP     ──→  什么时候停？                   │
│  REPORT   ──→  输出什么？                     │
│                                              │
│  ┌──────────────────────────┐               │
│  │   FEEDBACK (闭环反馈)     │               │
│  │   tests / typecheck /    │               │
│  │   review / lint          │               │
│  └──────────────────────────┘               │
│                                              │
│  ┌──────────────────────────┐               │
│  │   GUARDRAILS (护栏)       │               │
│  │   最大迭代 / 无进展检测    │               │
│  │   预算上限               │               │
│  └──────────────────────────┘               │
│                                              │
│  ┌──────────────────────────┐               │
│  │   ANCHORS (锚文件)        │               │
│  │   VISION.md / CLAUDE.md  │               │
│  │   PROMPT.md / Tests      │               │
│  └──────────────────────────┘               │
└─────────────────────────────────────────────┘
```

### 循环合同详解

```yaml
# 示例：PR babysit 循环
TRIGGER: "每 5 分钟，或 PR 收到新评论时"
SCOPE:   "我创建的所有未合并 PR"
ACTION:  "读 CI 状态 → 失败则修复 → 读 review 评论 → 在 worktree 中回复"
BUDGET:  "每次最多 3 个 sub-agent，50k tokens"
STOP:    "所有 PR green + approved，或 10 次迭代，或花费 > $5"
REPORT:  "每次迭代后发 Slack #eng-bots 摘要"
```

### 闭环 vs 开环

| 类型 | 行为 | 生产适用 |
|------|------|---------|
| **开环** | agent 写 → 说"好了" → 停 | ❌ 只能 demo |
| **闭环** | agent 写 → 跑测试 → 读结果 → 不通过则修复 → 重复 | ✅ 可上线 |
| **审查循环** | 闭环 + 后台审查 agent 持续喂反馈 | ✅ 适合长时间自主 |

**核心原则**：循环的可信度 = 里面有什么在说"不"。
测试、typecheck、review gate — 这些才是循环的核心（验证闸），不是循环本身。

---

## 三、护栏系统

### 护栏一：最大迭代数

```bash
MAX=10
for i in $(seq 1 $MAX); do
  cat PROMPT.md | claude -p --dangerously-skip-permissions
  grep -q "BLOCKED" specs/TODO.md && break
  grep -q "\[ \]" specs/TODO.md || break
  sleep 10
done
```

Claude Code 的 `/goal` 原生追踪 turns。裸 ralph 循环没有上限，必须手动加。

### 护栏二：无进展检测

当相同的错误信息、空 diff、或失败的测试连续出现 **N 次** → 停止。

```
检测逻辑：
  if 连续 3 次相同错误 → 停止 + 报告
  if 连续 2 次空 diff → 停止 + 报告
  if 连续 3 次同一测试失败 → 停止 + 报告
```

Huntley 会根据失败模式"像调吉他一样"调 ralph prompt — Loop Engineering 包含 **prompt 迭代**，不只是 bash。

### 护栏三：预算上限

在睡觉前设置 per-loop 预算：
- token 上限：每轮 X tokens
- dollar 上限：总计 $X
- Uber 的教训：4 个月烧完全年 AI 预算，最终每人每工具每月 $1,500 上限

---

## 四、锚文件体系

循环的稳定性来自持久化的项目知识，不是对话上下文。

```
VISION.md      → 方向：我们在建什么、为什么、完成长什么样
                  （Steinberger 在每个项目都放这个）
CLAUDE.md      → 规则：技术栈、命令、护栏、每轮重读
AGENTS.md      → agent 规则：每个 agent 的行为约束
PROMPT.md      → 循环 prompt：每轮喂给 agent 的固定内容
loop.md        → 自定义 /loop 默认 prompt
Tests          → 反馈：能说"不"的东西
```

**为什么锚文件重要？**
- 每次循环迭代可能丢失上下文（compact / reset）
- 锚文件是每次迭代重新加载的"常量"
- 对话上下文是"变量" — 会变、会丢
- 锚文件 + 对话上下文 = 完整的工作记忆

---

## 五、决策树：选哪种循环？

```
需要循环/自动化？
│
├─ 轮询外部状态？（CI 状态、部署进度、远程服务响应）
│  └─ ✅ CronCreate（固定间隔）
│     • 用 /loop 5m /your-command 触发
│     • 避免 :00/:30 整点（全球用户同时请求）
│     • 7 天自动过期，提醒用户
│     • durable: true 可跨会话持久
│
├─ 不确定工作量的迭代？（优化代码、写作循环、逐步调试）
│  └─ ✅ ScheduleWakeup（动态自步进）
│     • 用 /loop /your-command 触发
│     • Claude 自行决定下次唤醒时间
│     • 传回相同 prompt 实现持续迭代
│
├─ 完全无人值守的长时间任务？（夜间审查、大规模扫描）
│  └─ ✅ 自主循环（<<autonomous-loop-dynamic>>）
│     • 用 /loop（无参数）触发
│     • 无用户 prompt 时用哨兵模式
│     • 适合完全自主的长时间工作
│
└─ 不确定？
   └─ 先问：你的任务有明确的终止条件吗？
      • 有 → ScheduleWakeup（达到条件时停）
      • 没有 → CronCreate（定时检查）
```

### 三大变体速查

| 维度 | CronCreate | ScheduleWakeup | 自主循环 |
|------|-----------|----------------|---------|
| **触发** | `/loop 5m /foo` | `/loop /foo` | `/loop` |
| **机制** | cron 定时触发 | 动态自步进 | 自主哨兵 |
| **适用** | 轮询外部状态 | 迭代不确定任务 | 无人值守 |
| **缓存** | 每次可能冷 | 可控制在热区 | 通常冷启动 |
| **生命周期** | 7天自动过期 | 会话内 | 会话内 |
| **持久化** | `durable:true` 跨会话 | 仅内存 | 仅内存 |
| **延迟范围** | 60-3600s | 60-3600s | 60-3600s |

---

## 六、缓存窗口策略

```
Anthropic Prompt Cache TTL = 5 分钟（300秒）

┌─────────────────────────────────────────────┐
│  缓存热区: 60s - 270s                        │
│  → 积极轮询用这个，速度快、成本低              │
├─────────────────────────────────────────────┤
│  ⚠️ 临界点: 270s - 300s                      │
│  → 绝对不要用！冷启动但没省到频率              │
├─────────────────────────────────────────────┤
│  缓存冷区: 300s+                             │
│  → 接受冷启动，但用低频(1200-1800s)           │
│  → 适合等待不确定何时变化的事件                │
└─────────────────────────────────────────────┘
```

**核心规则：**
- 积极轮询（CI、部署）→ 60-270s，保持缓存热
- 等待变化（生产监控）→ 1200-1800s，接受冷但低频
- **不要用 300s** — 最差选择：冷启动 + 没省频率
- 不要用 :00 或 :30 整点分钟 — 全球用户同时请求

### ScheduleWakeup 的 delaySeconds 选择

```
你在等什么？
│
├─ 外部 CI/CD（通常 5-10 分钟）
│  └─ 270s（缓存热区内最长的安全等待）
├─ 人类操作（不确定时间）
│  └─ 1200s（20分钟，冷启动但合理等待）
├─ 空闲心跳（长任务保活）
│  └─ 1200-1800s（20-30分钟）
└─ 快速迭代（每轮几秒）
   └─ 60s（缓存热，快速反馈）
```

---

## 七、实战模板

### Level 0: Babysit 一个 PR（15 分钟）

```
/loop 10m Review PR #123. 如果 CI 失败，修复它。
如果有未处理的 review 评论，在 worktree 中处理并 push。
如果一切 green + approved，停止。
```

观察两轮。确认它先读状态再行动。

### Level 1: ralph + 护栏（1 小时）

创建 `PROMPT.md`：
```
你是一个自主编程 agent。
1. 读 specs/TODO.md 找到下一个未完成项。
2. 精确实现该项。
3. 运行 npm test。
4. 测试通过 → commit + 标记完成。
5. 连续 2 次相同测试失败 → 写 BLOCKED 到 specs/TODO.md 并退出。
6. 每次只做一项，做完退出。
```

包装：
```bash
#!/bin/bash
MAX=10
for i in $(seq 1 $MAX); do
  cat PROMPT.md | claude -p --dangerously-skip-permissions
  grep -q "BLOCKED" specs/TODO.md && break
  grep -q "\[ \]" specs/TODO.md || break
  sleep 10
done
```

⚠️ 在隔离的 worktree 或容器中运行，不要在主分支直接跑。

### Level 2: 编排循环（持续）

组合 `/loop` + skills + 云端 session + `/goal` 实现多小时自主工作。

### 其他实用模板

**监控 CI 构建**：
```
/loop 3m 检查最近的 CI 构建（用 gh run list --limit 1），
如果 completed + success → 告诉我并停止；
如果 completed + failure → 显示失败日志并停止；
如果 running → 继续等待。
```

**迭代优化代码**：
```
/loop 持续优化 src/utils/performance.ts 中的热点函数，
每轮：运行 benchmark（node bench.js），记录结果，
如果性能比上一轮提升 < 2%，认为收敛，停止并展示优化历程。
注意不要改变函数的公共 API。
```

**无人值守审查**：
```
/loop 自动审查 src/ 目录下所有 TypeScript 文件，
找出潜在安全问题（SQL注入、XSS、硬编码密钥），
每发现一个问题就修复它，全部扫描完毕后生成安全报告。
```

---

## 八、技能复用：循环的资产

> 如果一件事你做了两次，把它变成自动 skill。如果一件事很难，做完后把它变成 skill，下次就免费了。
> — Steinberger

```
/loop 30m /code-review     → 每30分钟自动审查代码
/loop 15m /fix-ci          → 每15分钟检查并修复CI
/loop 1h /dependency-audit → 每小时审计依赖
```

每个 skill 是一个**命名配方** = prompt + 工具策略 + 验证步骤。
循环是**管道**，skill 是**内容**。

循环不调用 skill 时，只是 `while true` 围绕一个陌生人。
循环调用精心设计的 skill 库时，是一个**复利系统**。

---

## 九、Monitor vs Loop vs CronCreate

| 场景 | 用什么 | 为什么 |
|------|--------|--------|
| 一次通知（构建完成） | `Bash run_in_background` + `until` | 简单，完成后自动退出 |
| 持续监控每行日志 | `Monitor` + `tail -f` | 每行都是事件，实时响应 |
| 定时检查（每N分钟） | `CronCreate` | 固定间隔，不依赖日志流 |
| 不确定迭代 | `ScheduleWakeup` | 动态节奏，完成时停 |

---

## 十、CronCreate 参数速查

| 参数 | 说明 | 示例 |
|------|------|------|
| `cron` | 标准 5 字段 cron | `"*/5 * * * *"` |
| `prompt` | 每次触发时执行的 prompt | `"检查 CI 状态"` |
| `recurring` | 是否循环（默认 true） | `true` / `false` |
| `durable` | 跨会话持久化 | `true` / `false` |

**cron 表达式技巧：**
- `"3 */2 * * *"` — 每2小时的第3分钟
- `"*/7 * * * *"` — 每7分钟
- `"30 14 28 2 *"` — 2月28日14:30（一次性）
- 避免整点：用 `"3 9 * * *"` 而非 `"0 9 * * *"`

---

## 十一、反模式（不要这样做）

| ❌ 反模式 | 为什么错 | ✅ 正确做法 |
|----------|---------|-----------|
| 循环没有终止条件 | 无限循环浪费 tokens | 始终包含"什么情况下停止" |
| 300s 间隔 | 最差选择：缓存冷+没省频率 | 要么 270s（热），要么 1200s+（冷但低频） |
| 整点分钟（:00/:30） | 全球用户同时请求 | 用偏移分钟（3/7/13 等） |
| 开环循环（无反馈） | 自我 agreeing on repeat | 加入 tests/typecheck/review |
| 无护栏运行 | 账单惊喜 | 最大迭代 + 无进展检测 + 预算上限 |
| 用 ScheduleWakeup 轮询外部 | 设计目的是不确定迭代 | 用 CronCreate 固定间隔 |
| 长任务不用 durable | 会话结束任务就没了 | `durable: true` 跨会话 |
| Monitor 用 tail -f + grep | Monitor 结束后 grep 仍在后台 | 用 `until` 循环 + `Bash run_in_background` |

---

## 十二、Boris 的自主运行建议

Boris Cherny（Claude Code 创造者）在 2025.12 之前 30 天内提交了 **259 个 PR**，全部由 Claude Code 编写。他 2025.11 删掉了 IDE。

五个建议：
1. **Auto mode** — 不要每步都问权限
2. **动态 workflow** — 编排数百个子 agent
3. **`/goal` 或 `/loop`** — 给 agent 终态方向
4. **云端运行** — 关上笔记本循环继续
5. **端到端自验证** — 循环的可信度 = 自检能力

---

## 参考来源

- ExplainX: [Loop Engineering with Claude Code 2026](https://explainx.ai/blog/loop-engineering-coding-agents-claude-code-guide-2026)
- Linas: [Loop Engineering Complete Guide](https://linas.substack.com/p/loop-engineering-complete-guide)
- MindStudio: [What Is Loop Engineering](https://www.mindstudio.ai/blog/what-is-loop-engineering-ai-coding-agents)
- Steinberger 原始推文: 2026.6.8, 6.5M+ views
- Boris Cherny: WorkOS Acquired Unplugged, 2026.6.2
- Geoffrey Huntley: Ralph Wiggum loop, 2025.7
- Steve Yegge: Gas Town, 2026.1
