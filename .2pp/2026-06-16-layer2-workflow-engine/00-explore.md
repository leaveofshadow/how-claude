# 00-explore.md — 层2 工作流引擎 · Phase 0 探索

> **运行目录**：`.2pp/2026-06-16-layer2-workflow-engine/`
> **日期**：2026-06-16
> **任务**：把层1 cc-runtime 的状态原语（checkpoint/trace/direction/tasks.tree）驱动成层3 cc-venture 的 8 节点 DAG 流转的「引擎」。
> **三层背景**（[50-decision.md](../2026-06-16-venture-automation-architecture/50-decision.md)）：层1 cc-runtime ✅ 地基闭合（基线层 18/18 测试）/ 层2 工作流引擎 ❌ 结构性缺口（本次设计目标）/ 层3 cc-venture 📋 8 节点 DAG 规格延后。

---

## §1 内部探索（Step 0a · Explore haiku · 6 文件扫描）

### A. 硬约束（[00-charter.md](../2026-06-16-venture-automation-architecture/00-charter.md) 提炼，不可妥协）

| 约束 | 具体含义 | 对层2 的直接要求 |
|------|---------|----------------|
| 单机 | 一台笔记本，不假设服务器/集群/外部依赖 | 层2 不可引入 Temporal/Argo/Conductor 等外部工作流引擎 |
| 单人 | 唯一人类 boss，"团队"= boss + 多 AI agent | 所有 gate 决策 = boss 一人 |
| 单 Claude | 唯一 AI，所有 agent 角色 = Claude 分饰 | 层2 的"调度器/推进器"也是 Claude，非外部进程 |
| 7×24 | 会话断点续传 | 层2 必须支持跨 session 的 pause/resume |
| P1 最懒 | human gate 把信息**重编码成 boss 一眼可决策**（信号 + RedFlag + 推荐动作），不是把难题丢给 boss | gate 面板是层2 的验收点，非原始状态 dump |
| 纯原生 | 零插件耦合，绝勿硬编码外部工具名 | 层2 用 Claude Code 原生能力（skill/script/Task/CronCreate），非第三方 |

**根原则映射**（charter 理念映射表「层2 工作流引擎」列）：P1→gate 一键三动词；**P2→DAG = 转换编排**（层2 的本质职责）；P3→gate 体验最优之一维；P4→AI 编排信息流不取代判断。

### B. 层1 给层2 的原语（[state-schema.md](../../.claude/skills/cc-runtime/references/state-schema.md) frozen-v1）

**四文件**（存储根 `.venture/state/`）：

| 文件 | 角色 | 写者 | 层2 能否调 |
|------|------|------|-----------|
| `checkpoint.json` | 断点快照（续跑锚点） | Hook（H4 Stop / H5 PreCompact） | ❌ 不可直调 checkpoint.write |
| `trace.ndjson` | 执行轨迹（每动作一行） | Hook（H2 PostToolUse） | ❌ 不可直调 trace.append |
| `direction.json` | 方向指针（单一真相源） | shift-direction.js | ✅ 经 skill 调 `direction.set` |
| `tasks.tree.json` | 任务树（与 TaskList 同构） | Hook / 整体重写 | 只读为主 |

**关键接口 V1（§5）**：`direction.set({version, reason, supersedePath})` 是**层3 节点经 skill 唯一可调的写接口**——层2 驱动换向的核心入口。`direction.current()` / `state.snapshot()` 只读可调。

**跨文件不变量 INV-1..6（§6，层2/3 可依赖做路由）**：
- **INV-1**：`checkpoint.direction_version` == `direction.current_version` == `tasks.tree.direction_version`（三文件版本一致；换向后全 +1）
- INV-2：trace_ref 指向真实存在的 trace
- INV-3：`status=="awaiting_human"` ⟹ checkpoint.health 反映 gate 等待
- **INV-4**：trace 每行 direction_version == 写入时 current_version（换向后新行带新版本）
- INV-5：tasks.tree 与 TaskList 同构
- INV-6：checkpoint.todo_summary 计数 == tasks.tree 统计

> **层1 身份定论**（[SKILL.md](../../.claude/skills/cc-runtime/SKILL.md)）：层1 是唯一写者的代理（实际写 = Hook），层2/3 只读 + 经 skill 调 direction.set。**技能不常驻，7×24 由 autopilot/ralph 驱动**。

### C. 层3 DAG 规格（[50-decision.md](../2026-06-16-venture-automation-architecture/50-decision.md) §2，层2 要驱动的目标）

**8 节点 DAG**：
```
N1 调查 → N2 竞品 → N3 计划 → HG1 → N4 judge → HG2 → N5 产品设计 → N6 画像 ⇄ N7 需求 → N8 UIUX
```

**HG 机制（§3.3，C1 修订）**：不靠 Stop exit2 阻塞（G1 已证 exit2 四重退化不可靠）。改为 `direction.json: {status:"awaiting_human", gate:"HG1/HG2"}` + H6 SessionStart 注入"等待决定"，agent 自然停等输入。boss 决定后 skill 调 `direction.set` → status 回 active。

**层3 子机制**：M1 红队对抗（N4 蓝+红队，分歧>阈值强制🟡）/ M2 N6⇄N7 互锁 MAX_ITER=3 单调收敛 / M3 放弃三轴自动 merge 送 HG2 / extractor 修订（venture-judge-extractor skill 把 markdown 卡解析成 jsonld signal）/ m1 HG 用 CronCreate durable。

**层3 ACCEPT 前置（§2.6）**：direction.json / trace.ndjson schema 已稳定（层1 M1 冻结）✅；extractor/M1/M2/M3 待层1 稳定后启动。

### D. 层2 已有定位线索（原文提及，均为零散，无独立规格）

1. charter 理念映射表「层2 工作流引擎」列（见 §A）
2. 50-decision §2.1："产物契约（jsonld_header 改为每节点真实 in/out schema，**层2 校验**）"——层2 承担节点产物契约校验
3. 50-decision §3 技能树：`venture-pipeline/` 标注"**层2 编排核心**"，与 cc-venture/extractor 同列延后
4. state-schema.md §0：schema 是"层1 与层3 共同边界"——但层2 本身的编排逻辑未被定义

> **关键空白**：DAG 流转状态机（节点进入/退出/分支条件/HG 触发）、pipeline-state.json schema、层2 如何调 direction.set 驱动节点切换——**均无规格，本次设计交付**。

### E. 可复用方法论素材（how-cc 套件，层2 设计直接可用）

| 素材 | 来源 | 对层2 的用途 |
|------|------|-------------|
| 循环合同（六要素 TRIGGER/SCOPE/ACTION/BUDGET/STOP/REPORT + 护栏三件套：最大迭代/无进展/预算 + 锚文件） | [cc-loop loop-guide.md](../../.claude/skills/cc-loop/references/loop-guide.md) | 层2 的 DAG 节点循环套此合同，护栏 → checkpoint.guardrails |
| 编排决策树（直接/Subagent/Workflow/Team 四象限 + Workflow 5 质量模式：对抗/判官/循环至干/多模扫描/完整性批评） | [cc-orchestration orchestration-guide.md](../../.claude/skills/cc-orchestration/references/orchestration-guide.md) | 层2 的 N4 judge = 判官小组，extractor 红队 = 对抗验证 |
| 编排循环合同扩展（AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY 五字段） | 同上 §编排循环 | 层2 DAG 编排需补全这五字段，CONFLICT 走 worktree SOP |
| 终态条件（五层模型 + 自评通过 + 可证伪性 + 最弱依赖） | [cc-goal goal-guide.md](../../.claude/skills/cc-goal/references/goal-guide.md) | 层2 每节点的退出条件设计 |
| 断点续跑锚点（checkpoint.continue_from = `node:judge,task:...,iter:5` + compact Block⑤） | 层1 基线层 | 层2 的 pause/resume 机制腿已就绪 |
| 换向归档（shift-direction.js：direction.set + INV-1 + ENOENT 拦截旧文件） | 层1 基线-C | 层2 的"放弃/换向"动词已有脚本支撑 |

### F. 层2 设计 8 个关键灰度点（Explore 提炼，需 Phase 0c 决策）

1. **层2 是"脚本"还是"agent"？** — cc-orchestration 定义 Workflow="脚本决定下一步、整个编排可复现"；但层1 身份定论是"技能不常驻、7×24 由 autopilot/ralph 驱动"。venture-pipeline 究竟是**确定性脚本（静态 Workflow）**还是 **supervisor 动态编排（编排循环 Stage4）**？决定它如何调 direction.set。
2. **HG 触发与层2 控制流的关系** — 层1 把 human gate 实现为被动（awaiting_human + agent 停等输入）。但层2 需**主动判断"何时进入 HG"**（N3 完成→HG1，N4 完成→HG2）。这个"节点完成→触发 gate"逻辑住在层2 哪里？显式状态机 vs agent 读 checkpoint 自判？
3. **pipeline-state.json vs direction.json 职责边界** — §2.1 提"pipeline-state.json 自动判断分支"，但层1 已有 direction.json（status/gate 字段）。两者同文件 / 层2 新增第三个状态文件？若新增，INV-1 三文件不变量如何扩展？**直接关系到层1 frozen-v1 是否需 major 升级（阻塞层3）**。
4. **DAG 节点流转与 trace/tasks.tree 同步** — 层2 驱动节点切换时，`checkpoint.current_node` / `iteration` 由谁写？层2 若是 agent 不可直接调 checkpoint.write（§5 禁止）；若靠 H2 启发式，节点级语义（N1→N2）比 task 级粗，匹配规则需重新定义。
5. **N6⇄N7 互锁的循环归属** — M2 规定 MAX_ITER=3 单调收敛。这个循环是层2 编排的**内嵌子循环**，还是 N6/N7 节点内部自带？前者需层2 支持"DAG 内局部循环"原语。
6. **extractor 失败降级路由** — N4 失败→extractor 无输入→`signal:unknown` 走 HG2。层2 路由表需定义"非 green/yellow/red"第四态如何流转，与"signal==green 自动路由"二值逻辑冲突。
7. **"最懒"与"DAG 可见性"张力** — charter P1 要求 boss 一眼可决策。层2 DAG 有 8 节点 + 2 gate + 1 互锁循环，状态空间不小。pipeline-state 如何重编码成"当前节点/进度%/下一步/待决策项"面板，而非原始 dump？这是层2 的 P1 验收点。
8. **层2 与层1 基线层"0 新 hook"的兼容** — 层1 基线层刻意 0 新 hook（P1 最懒）。层2 若需自动 trace/节点切换检测，是否被迫装配 H2 PostToolUse（回到被降级的 8-hook 路径）？还是层2 完全靠 agent 显式调脚本兑现？**层2 是否"零 hook"的根本选型**。

---

## §2 外部探索（Step 0b · WebSearch 4 轮 · 技术选型外部校正）

### 官方模式（Anthropic 权威，防幻觉基准）

- **[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)**：两倍方案让 Claude Agent SDK 跨多 context window 工作——含 **initializer agent 设置状态以支持可恢复的多 context 软件开发**。这是官方对"长任务跨 context"的权威模式。
- **[Claude Code Workflows 官方文档](https://code.claude.com/docs/en/workflows)**：dynamic workflows orchestrate many subagents from **a script Claude writes and you can rerun**。适合 codebase audits / large migrations / cross-checked tasks。**关键边界：是单会话内可重运行的脚本，不自带跨 session 持久化**。
- **[How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)**：combining AI agents with **deterministic safeguards like retry logic and regular checkpoints**。
- **[Augment Code 分析](https://www.augmentcode.com/guides/anthropic-agent-sdk-what-ships-vs-what-you-build)**（关键事实声明）：SDK 提供 agent loop + context 管理，但 **durable execution 和 checkpoint-based job resumption 是你必须自己构建的**。

### 社区实践（GitHub + 大牛，过滤 SEO）

- **[barkain/claude-code-workflow-orchestration](https://github.com/barkain/claude-code-workflow-orchestration)**：Claude Code 工作流编排插件——automatic task decomposition + parallel agent execution + specialized agent delegation。社区真实 DAG 实现，最可借鉴。
- **[FutureSearch: Using Claude Code as a Workflow Engine](https://futuresearch.ai/blog/claude-code-workflow-engine/)**：orchestrator 模式——主 Claude Code 进程读 skill + spawn subagents via Task + 协调。与层2"驱动 DAG"最贴。
- **[Addy Osmani: Long-running Agents](https://addyosmani.com/blog/long-running-agents/)**：把 agent 当长运行服务器进程——**写中间状态到磁盘、每 N 单元 checkpoint、从失败恢复**。与层1 落盘哲学完全一致。
- **[Medium: From Chat to Orchestration](https://medium.com/jin-system-architect/from-chat-to-orchestration-claude-code-dynamic-workflows-dont-make-ai-stronger-they-make-it-81e6639658cf)**：动态工作流把编排逻辑**移出 chat context 进 code**（防认知漂移 + 状态管理）。
- **[Orkes: Durable Conductor Workflow](https://orkes.io/blog/how-to-build-workflows-using-claude-code-and-conductor-skills/)**：durable 工作流 + 持久化——**但引入 Conductor 外部依赖，与单机纯原生冲突，仅作对比参照**（理解为什么要自建）。

### 设计共识（4 轮搜索提炼，跨官方+社区趋同）

1. **编排逻辑移出 chat context，进 code/script** — 防认知漂移（Medium + 官方 Workflows）。这是"为什么层2 要落盘状态机"的根因。
2. **状态持久化到磁盘是共识** — 层1 已做（checkpoint/trace/direction/tasks.tree），外部验证此路径正确。
3. **durable execution + checkpoint resumption 必须自建** — Augment 明确 SDK 不提供。**印证层2 使命的必要性**：层1 的 checkpoint 是地基，层2 是"durable execution"的构建者。
4. **原生 Workflow 是单会话脚本编排，不自带跨 session 持久** — → **层2 = Workflow（单会话编排）+ 层1 状态（跨 session 持久）+ 节点推进器（跨 session 把下一节点拉起来）**。

### 对灰度点的外部回答（证据 → 收敛方向）

| 灰度点 | 外部证据 | 收敛方向（待 0c 确认） |
|--------|---------|---------------------|
| 灰度1（脚本 vs agent） | 官方 Workflows + Medium + Addy | 倾向 **Claude 写编排脚本 + 状态驱动重跑**（确定性 + 可复现），非纯 supervisor agent；但脚本可内嵌 agent 调用 |
| 灰度3（状态边界） | Augment 确认 durable 自建 | 层2 **需自己的 pipeline-state**（不可依赖 SDK 内置），但与 direction.json 的关系待裁决 |
| 灰度8（0-hook 兼容） | Addy + Anthropic 持久化靠落盘 | 跨 session 持久靠落盘 + 调度触发（CronCreate/ScheduleWakeup），**hook 非必须**，与层1 0-hook 基线一致 |

---

## §3 待挖需求（→ Phase 0c AskUserQuestion）

基于 8 灰度点 + 外部洞察，0c 要挖的 4 个架构决策（影响后续所有设计）：

- **Q1 层2 形态**：确定性脚本引擎（Claude 写编排脚本 + 状态驱动重跑）/ supervisor agent 动态编排 / 混合。→ 决定灰度1。
- **Q2 状态文件边界**：pipeline-state.json 新增（层1 major 升级）/ 复用 direction.json 扩展（层1 兼容）/ checkpoint 内嵌 node 字段。→ 决定灰度3，层1 frozen-v1 是否破。
- **Q3 触发/推进机制**：0 新 hook（agent 显式调脚本）/ 引入调度 hook（CronCreate durable / H2 自动推进）。→ 决定灰度8，P1 最懒边界。
- **Q4 范围/ROI**：层2 本次只服务 cc-venture DAG（专用、紧耦合）/ 做成通用工作流引擎（抽象、可复用）。→ ROI 澄清。

---

## §4 关键文件索引（给后续 Phase 2 agent 的指针）

| 文件 | 内容 | 读它为了 |
|------|------|---------|
| [00-charter.md](../2026-06-16-venture-automation-architecture/00-charter.md) | 硬约束 + 根原则映射 | 锚定约束（不可破） |
| [50-decision.md §2](../2026-06-16-venture-automation-architecture/50-decision.md) | 层3 8 节点 DAG 规格 | 层2 要驱动的目标 |
| [state-schema.md](../../.claude/skills/cc-runtime/references/state-schema.md) | 层1 四文件契约 + INV-1..6 | 层2 要消费的接口 |
| [cc-loop loop-guide.md](../../.claude/skills/cc-loop/references/loop-guide.md) | 循环合同 + 护栏 + 锚文件 | 节点循环模板 |
| [cc-orchestration orchestration-guide.md](../../.claude/skills/cc-orchestration/references/orchestration-guide.md) | 决策树 + 编排循环五字段 | 编排逻辑骨架 |
| [cc-goal goal-guide.md](../../.claude/skills/cc-goal/references/goal-guide.md) | 终态条件 + 自评 | 节点退出条件 |
| [cc-config config-systems-guide.md](../../.claude/skills/cc-config/references/config-systems-guide.md) | 六层配置 + 锚文件 | pipeline-state 落地层 |
| [shift-direction.js](../../.claude/skills/cc-runtime/scripts/shift-direction.js) | direction.set 实现 | 层2 调换向的现成腿 |

---

**外部探索预算**：已用 4 轮（上限 15）。设计共识已充分，按 P1 最懒收敛，剩余预算留 Phase 2 攻击者按需补。
