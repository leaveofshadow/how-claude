---
run: 2026-06-16-venture-automation-architecture
phase: 2
plan: 1
title: 方案1 — 状态中心化（State as Single Source of Truth）
视角: 架构组 (opus)
切入点: 状态作为单一真相源 — 层1自主循环运行时是脊梁，所有状态集中统一 store，层2/3读写之
created: 2026-06-16
status: draft
direction_version: 1
度量单位: token / 轮次 / skill 配置 / 可验证闸（禁人天/人周）
---

# 方案1 — 状态中心化（State as Single Source of Truth）

> **核心切入点**：把层1自主循环运行时设计成整个系统的**脊梁**——所有状态（checkpoint 快照 / trace 轨迹 / 任务树 / 当前方向 / 迭代计数 / 无进展指纹）集中在一个统一的 state store，层2（harness 工作流引擎）和层3（venture 业务流水线）都只读写它，不持有副本。**痛点3（任务记录不更新）和痛点4（换方向后读旧文件）的统一解药**：不是给每个机制打补丁，而是让状态有唯一持有者，agent 写状态走唯一入口，agent 读状态也走唯一入口。
>
> **一句话前提**：当所有节点对"现在我们在做什么、做到哪、为什么是这个方向"都只看同一份真相时，checkpoint 不会空、旧计划不会被重读——因为旧计划被指针原子失效了，新计划被指针原子激活了。

---

## 1. 全景三层架构 + 层间接口契约 + 数据流

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│ 层3  venture 业务流水线（8节点 DAG，D2 human gate 串在 judge 后）       │
│                                                                       │
│  商业调查 ─→ 竞品 ─→ 计划 ─→ [judge + human gate] ─→ 产品设计          │
│                                                  │                    │
│                                                  ↓                    │
│                                    用户画像 ─→ 需求 ─→ UIUX            │
│                                                                       │
│  每个节点 = 一个 WorkflowType 枚举值 + QualityMode × 执行形状组合        │
│  judge 节点 → venture-judge 集成（6入口选 /judge /deep /report）        │
│  用户画像/需求节点 = 缺口，用 deep-interview / deep-research 降级        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ 读写 venture 产物 + 节点状态
                            ↓
        ┌───────────────────────────────────────────────────┐
        │ 接口契约 V2（层2 → 层1）：declareWorkflow(workflowType,        │
        │   qualityMode, shape, contract6, agents, routing)              │
        │   / stepDone(nodeId, artifactPath, verifyResult)               │
        │   / readTrace(nodeId) / supersedeDirection(reason)             │
        └───────────────────────────┬───────────────────────────────────┘
                                    ↓
┌───────────────────────────────────────────────────────────────────────┐
│ 层2  harness 工作流引擎（ecc 编排范式 + autopilot 可配 pipeline 泛化）   │
│                                                                       │
│  WorkflowType 枚举(7): Executor | PlanDo | ExplorePlanDo |            │
│    ExplorePlanDoReview | LoopPlanner | DiscoveryLoop | GateReview      │
│  QualityMode(5): Adversarial | JudgePanel | LoopUntilDry |            │
│    MultiModalSweep | CompletenessCritic                              │
│  执行形状(3): pipeline | parallel | loop-until-dry                    │
│                                                                       │
│  编排层(继承 cc-orch 编排合同扩展): AGENTS/ROUTING/MERGE/CONFLICT/      │
│    RECOVERY — 决定每个 venture 节点用哪种组合、节点间如何传递产物         │
└───────────────────────────┬───────────────────────────────────────────┘
                            │ 读写循环状态（唯一入口）
                            ↓
        ┌───────────────────────────────────────────────────┐
        │ 接口契约 V1（层2/层3 → 层1）：                              │
        │   checkpoint.write(partial)   ← Hook 强制调用                  │
        │   trace.append(entry)         ← 每轮追加                       │
        │   direction.set(newDir)       ← 原子方向切换                   │
        │   direction.current()         ← 读当前有效方向                 │
        │   state.snapshot()            ← 全量快照(给 SessionStart)      │
        └───────────────────────────┬───────────────────────────────────┘
                                    ↓
┌───────────────────────────────────────────────────────────────────────┐
│ 层1  自主循环运行时【脊梁】— 状态作为单一真相源                          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │            UNIFIED STATE STORE (.venture/state/)              │    │
│  │                                                                │    │
│  │  checkpoint.json   ← autopilot state 扩展（痛点3补字段）        │    │
│  │  trace.ndjson      ← ralph progress.txt 泛化（追加式日志）     │    │
│  │  direction.json    ← 单一方向指针（痛点4原子切换）              │    │
│  │  tasks.tree.json   ← 任务树（TaskList 序列化）                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                  ↑↓                                  │
│  Hook 层（零上下文成本，强制写入）：                                    │
│    PostToolUse → 增量写 trace                                         │
│    Stop        → 写 checkpoint + 查 tasks-pending 阻止过早停           │
│    PreCompact  → 全量快照 checkpoint                                  │
│    SessionStart→ 加载 direction.current() + 最近 trace               │
│                                                                       │
│  长会话驱动器：autopilot pipeline（骨架）+ ralph trace（语义）          │
└───────────────────────────────────────────────────────────────────────┘
```

### 1.2 层间接口契约

**V1（层2/层3 → 层1，必走 Hook 或 skill，禁止 agent 直接写文件）**：

| 方法 | 输入 | 输出 | 谁调用 | 强制机制 |
|------|------|------|--------|---------|
| `checkpoint.write(partial)` | 部分字段 | OK | skill 内 / Hook | Stop + PreCompact hook |
| `trace.append(entry)` | {ts, nodeId, action, filesChanged, learnings, progressHash} | OK | skill 内 | PostToolUse hook |
| `direction.set(newDir)` | {version, reason, supersedePath} | newVersion | human gate 后 skill | 用户确认动作触发 |
| `direction.current()` | — | {version, path, status} | SessionStart / 任何节点入口 | SessionStart hook 注入 |
| `state.snapshot()` | — | 全部4文件 JSON | SessionStart / debug | SessionStart hook |

**契约原则**：层1是**唯一写者**的代理（实际写的是 Hook，agent 调用 skill 触发 Hook），层2/3 是**只读者**（读 direction.current 决定读哪个计划文件）。这从机制上消灭了"agent 记得更新但忘了"（痛点3）和"agent 重读旧文件"（痛点4）。

### 1.3 数据流（一次完整 venture 流水线）

```
1. SessionStart hook → direction.current() 注入 "direction v1"
2. 层3 商业调查节点 → 层2 declareWorkflow(DiscoveryLoop, MultiModalSweep, parallel)
   → trace.append ×N（每轮探索）
   → 产物写 .venture/artifacts/v1/01-research.md
3. 计划节点 → 层2 declareWorkflow(ExplorePlanDoReview, JudgePanel, pipeline)
   → 产物 .venture/artifacts/v1/03-plan.md（带 direction_version: 1）
4. judge 节点 → venture-judge /deep → 评判卡
5. [human gate] 用户确认方向 → 若换方向：
   direction.set({version:2, reason:"...", supersedePath:"v1/03-plan.md"})
   → direction.json 原子更新：v1 status:superseded, superseded_by:v2
   → 旧文件不删，但 direction.current() 返回 v2
6. 产品设计/用户画像/需求/UIUX 节点 → 全自动串联（D2），全部读 direction.current() 拿 v2
7. 每个节点完成 → Stop hook → checkpoint.write(更新 current_node / progress%)
8. compact 触发 → PreCompact hook → 全量快照
9. 会话恢复 → SessionStart → snapshot 加载 → 从 checkpoint.continue_from 续跑
```

---

## 2. 层1深度设计（本次焦点）

### 2.1 checkpoint 字段补全（在 autopilot state 上扩展）

autopilot 现有 state（来自 00-explore §2）每阶段独立 + QA 护栏。痛点3 的证据是 `.omc/state/checkpoints/*.json` 字段空（`active_modes:{}` / `todo_summary` 全0）。补全方案——**在 autopilot checkpoint JSON 上加 venture 扩展字段**，不另起炉灶：

```jsonc
// .venture/state/checkpoint.json（autopilot 兼容 + venture 扩展）
{
  // === autopilot 原有字段（保留，确保兼容） ===
  "created_at": "2026-06-16T10:00:00Z",
  "trigger": "stop" | "precompact" | "sessionstart",
  "active_modes": { "autopilot": "execution", "venture": "node:judge" },  // ← 补：填实内容而非{}
  "todo_summary": { "pending": 3, "in_progress": 1, "completed": 4 },     // ← 补：从 tasks.tree.json 聚合
  "wisdom_exported": false,
  "background_jobs": { "active": [], "recent": [], "stats": null },

  // === venture 扩展字段（痛点3 补丁） ===
  "current_node": "judge",                  // 层3 当前节点
  "current_task": "评判卡生成 v2",           // 具体任务（非空）
  "explore_paths": [                         // 探索产物路径列表
    ".venture/artifacts/v2/01-research.md",
    ".venture/artifacts/v2/02-competitor.md"
  ],
  "plan_path": ".venture/artifacts/v2/03-plan.md",   // 当前计划文件
  "progress_percent": 37,                    // 0-100，按节点权重算
  "iteration": 5,                            // 当前节点迭代轮次
  "last_progress_hash": "sha256:ab12cd",     // 无进展检测指纹（护栏二）
  "direction_version": 2,                    // 绑定 direction.json 的 version
  "direction_path": ".venture/state/direction.json",  // 反向指针
  "trace_ref": ".venture/state/trace.ndjson",         // trace 文件引用
  "guardrails": {                            // 循环合同三件套（cc-loop L153-188）
    "max_iteration": 10,                     // 护栏一
    "no_progress_streak": 0,                 // 护栏二（连续N次同hash）
    "budget_tokens_used": 125000,            // 护栏三（token）
    "budget_tokens_cap": 500000
  },
  "continue_from": "node:judge,task:评判卡生成 v2,iter:5"  // SessionStart 续跑锚
}
```

**为什么这样设计**：
- **保留 autopilot 原字段** → autopilot 的 6 阶段 pipeline、QA 护栏、ralplan 短路全部不动，零迁移成本。
- **venture 扩展字段挂在同一 JSON** → 单一真相源，不用跨文件 join。
- **每个字段都对应一个痛点或护栏** → `current_task`/`progress_percent` 灭痛点3；`direction_version` 灭痛点4；`guardrails` 落地 cc-loop 三件套；`continue_from` 让 SessionStart 一行恢复。

### 2.2 trace 存储：扩展 ralph progress.txt 还是独立 trace store？

**决策：独立 trace store（`.venture/state/trace.ndjson`），但语义继承 ralph progress.txt。**

ralph progress.txt 结构（00-explore §2）：`Codebase Patterns` + 每个故事 `{timestamp, storyId, implementation[], filesChanged[], learnings[]}`。它是**追加式 trace 的唯一现成实现**，语义对（每轮留痕 + 下一轮注入）。

但**不直接复用文件**，原因：
1. ralph trace 绑定"user story → passes:true"模型，venture 流水线是"node → artifact"，模型不同，硬塞会扭曲。
2. ralph trace 是 Markdown 自由文本，venture 需要**机器可读**（层2 编排要 grep 聚合进度、层3 要按 nodeId 查产物）。
3. 单一真相源原则下，trace 应和 checkpoint 同目录、同生命周期，而非散落在 ralph 的 `.omc/ralph/`。

**trace.ndjson 格式**（每行一个 JSON，追加写）：

```jsonc
// 每行一条，ndjson 格式（便于流式读 + grep）
{"ts":"2026-06-16T10:01:00Z","node":"research","iter":1,"action":"deep-research","filesChanged":[".venture/artifacts/v2/01-research.md"],"learnings":["市场A有3个竞品"],"progressHash":"sha256:ab12","tokensUsed":15000}
{"ts":"2026-06-16T10:05:00Z","node":"research","iter":2,"action":"anysearch","filesChanged":[],"learnings":[],"progressHash":"sha256:ab12","tokensUsed":8000}
// ↑ iter2 同 hash + 无 filesChanged = 无进展信号（护栏二触发候选）
```

**与 ralph 的关系**：
- **继承**：追加式语义、`filesChanged`/`learnings` 字段名、`getProgressContext()` 注入下一轮的思想。
- **泛化**：`storyId` → `node`（venture 节点）；新增 `iter`/`progressHash`/`tokensUsed`（支持护栏和预算）。
- **隔离**：独立文件、独立目录（`.venture/state/`），不污染 `.omc/ralph/`（OMC 状态体系的整合边界见 §2.6）。

### 2.3 方向切换机制（D4）：单一指针文件原子切换

**决策：单一指针文件 `.venture/state/direction.json` 原子切换，计划文件只读不写状态字段。**

两个候选（00-explore §3 痛点4）：
- A. 计划文件加 `status:active|superseded` + `superseded_by` 字段
- B. 单一指针文件原子切换

**选 B，论证**：

| 维度 | A（计划文件加字段） | B（单一指针）✅ |
|------|---------------------|----------------|
| 原子性 | 改 N 个旧文件状态，非原子 | 改 1 个指针文件，原子 |
| 漏改风险 | 旧文件多时易漏标 | 无（只动指针） |
| 读取成本 | agent 要 glob 所有计划文件再 filter | agent 只读 1 个指针 |
| 与单一真相源的契合 | 状态分散在多文件 | **状态集中在指针** ✅ |
| 向后兼容 | 要给所有历史文件补字段 | 历史文件不动 |

痛点4 的根因（00-explore §3）是"autopilot ralplan 短路只检查文件存在不检查 superseded"。方案 B 从根上解决：**短路逻辑改为读 `direction.current()` 而非 glob 文件**——指针说 v2 是 active，glob 到 v1 也不读。

**direction.json 格式**：

```jsonc
{
  "current_version": 2,
  "current_path": ".venture/artifacts/v2/",
  "current_plan": ".venture/artifacts/v2/03-plan.md",
  "set_at": "2026-06-16T10:30:00Z",
  "set_reason": "用户在 judge 后确认转向市场B",
  "history": [
    {
      "version": 1,
      "path": ".venture/artifacts/v1/",
      "status": "superseded",
      "superseded_by": 2,
      "superseded_at": "2026-06-16T10:30:00Z",
      "superseded_reason": "用户在 judge 后确认转向市场B"
    }
  ]
}
```

**原子性保证**：写入用"写临时文件 + rename"模式（POSIX rename 原子；Windows 用 MoveFile + REPLACE_EXISTING），Hook 层封装，agent 不直接写。

**human gate 流程**（D2）：judge 节点出评判卡 → 用户确认 → 若换方向，用户指令触发 `direction.set()` skill → direction.json 原子更新 → 后续节点全部读 v2。

### 2.4 Hook 强制写入时机（cc-config 9事件 × 层1需求）

cc-config L121-133 列了 9 种 Hook 事件。层1 选其中 4 个挂强制写入（其余不挂，避免噪声）：

| Hook 事件 | 层1 动作 | 为什么是这个时机 | 对应痛点 |
|-----------|---------|----------------|---------|
| **PostToolUse** (matcher: Write\|Edit) | 增量 `trace.append`：记录刚改了什么文件、learnings 由 skill 填 | 工具刚完成，信息最新；零延迟 | 痛点3（trace 留痕） |
| **Stop** | `checkpoint.write({trigger:"stop"})` + 查 `tasks.tree.json` 有 pending → `exit 2` 阻止过早停 | Claude 想停时是检查"任务真做完没"的最佳点 | 痛点3（cc-config 模式4 原型） |
| **PreCompact** | `checkpoint.write({trigger:"precompact"})` 全量快照（含 continue_from） | compact 前是抢救窗口，过了就丢 | 痛点3（跨压缩恢复） |
| **SessionStart** | `state.snapshot()` 加载：direction.current() + 最近10条 trace + checkpoint.continue_from | 会话开始是"从哪续跑"的决策点 | 痛点3+4（恢复 + 方向锚定） |

**不挂的事件**：
- `UserPromptSubmit` → 太频繁，噪声大；方向切换走 skill 触发而非每 prompt 检查。
- `Notification`/`SubagentStop`/`SessionEnd` → 与层1 核心需求无关。
- `PreToolUse` → 层1 是写状态不是拦截，PreToolUse 用于安全（cc-config 模式2），职责不同。

**强制性的本质**：Hook 是 harness 执行的（cc-config L4 "Hook 零上下文成本" + "自动行为必须 settings.json"原则），**不依赖 agent 自觉**。这正是痛点3 的工程解——00-explore §1.3 已指出"层1 checkpoint 写入应挂 Hook 而非靠 agent 自觉"。

### 2.5 与 autopilot/ralph 的复用边界

| 组件 | 复用方式 | 边界 |
|------|---------|------|
| **autopilot pipeline 骨架** | 直接用 6 阶段架构（expansion→planning→execution→qa→validation→complete）作为层1 驱动器主循环 | 不动其 PipelineConfig/PipelineStageAdapter（层2 泛化它，见 §3） |
| **autopilot QA 护栏** | 直接用（5轮/同错3次停）作为层1 护栏二的基础 | 扩展为读 `last_progress_hash` 而非只看测试错（venture 节点不一定有测试） |
| **autopilot state 体系** | checkpoint.json 在其上**加字段**（§2.1），不替换 | 保留原字段确保 autopilot 自身逻辑不破 |
| **autopilot ralplan 短路** | **改逻辑**：从"glob 文件存在"改为"读 direction.current()" | 这是痛点4 的直接修复点 |
| **ralph progress.txt 语义** | 继承追加式 trace 思想 + `filesChanged`/`learnings` 字段名 | 不复用文件（§2.2 已论证），独立 trace.ndjson |
| **ralph getProgressContext()** | 继承"注入下一轮"思想 | 改为读 trace.ndjson 最近 N 条注入 |
| **ralph PRD 驱动模型** | 不复用（user story→passes:true 模型 ≠ venture node→artifact 模型） | — |
| **ralph-loop（裸 while）** | 不用（无独立 state，靠 git+FS，太脆弱） | 层1 需要结构化 state，ralph-loop 不够 |
| **ultrawork（并行引擎）** | 层2 调度原语用，层1 不用 | ultrawork 是并行+路由，不是持久化/验证循环 |

**一句话**：层1 = autopilot（骨架+QA护栏+state 扩展）+ ralph（trace 语义继承）+ 新建（direction 指针 + Hook 写入层 + venture 扩展字段）。**不推翻任何现有机制，只补三块**。

### 2.6 与 OMC 现有 state 体系（.omc/state/）的整合/隔离边界

OMC 现有 state 散落：`.omc/state/checkpoints/`（痛点3 证据）、`.omc/state/sessions/`、`.omc/ralph/`、`.omc/plans/`、`.omc/notepad.md`、`.omc/project-memory.json`。

**决策：隔离为主，单向桥接为辅。**

- **隔离**：venture 状态全部在 `.venture/state/`，**不写回 `.omc/`**。理由：OMC state 是通用 harness 状态（多项目共享语义），venture 是业务流水线状态（强领域语义），混在一起会污染 OMC 的通用性。单一真相源原则要求 venture 状态有自己的"家"。
- **单向桥接**：层1 SessionStart hook 可**读** OMC 的 `.omc/state/` 做"环境感知"（如读 active_modes 判断是否在 autopilot 内），但**不写**。venture 的 checkpoint 不回灌 OMC。
- **共存模型**：两套 state 并行——OMC 管"harness 在跑什么模式"，venture 管"业务做到哪、方向是啥"。agent 读时各取所需，写时各回各家。

**为什么不全量整合进 OMC**：
1. OMC 是插件级通用层，给一个特定业务（venture）加专用字段会污染其通用 API。
2. venture 的 direction 指针、8节点 DAG 状态是强领域概念，不属于通用 harness。
3. 隔离让 venture 可独立演进、独立测试、独立卸载，不绑死 OMC 版本。

**风险与缓解**：两套 state 可能让 agent 困惑"读哪个"。缓解：层1 接口契约 V1（§1.2）规定 venture 状态走 `.venture/state/`，Hook 注入时明确标注来源；skill 文档里写死"venture 状态只读 .venture/state/"。

---

## 3. 层2骨架：7种workflow × 5质量模式 × 3执行形状

### 3.1 可配置枚举建模（泛化 autopilot PipelineConfig）

autopilot 的 `PipelineConfig` 可跳过 stage（00-explore §2）。层2 把它泛化为"节点级 workflow 声明"：

```jsonc
// 层2 编排层接收的声明（每个 venture 节点一份）
{
  "nodeId": "judge",
  "workflowType": "ExplorePlanDoReview",   // 7选1
  "qualityMode": "JudgePanel",              // 5选1
  "shape": "parallel",                      // 3选1（pipeline/parallel/loop-until-dry）
  "contract6": {                            // cc-loop 循环合同6要素
    "TRIGGER": "judge 节点入口",
    "SCOPE": "对计划做 VC 7维评判",
    "ACTION": "venture-judge /deep + 3案例如证",
    "BUDGET": "50k tokens / 5轮",
    "STOP": "评判卡生成 + completeness critic 通过",
    "REPORT": ".venture/artifacts/v2/04-judgment-card.md"
  },
  "agents": ["venture-judge", "completeness-critic"],
  "routing": {                              // cc-orch 编排合同扩展
    "on_success": "→ 产品设计节点",
    "on_block": "→ human gate",
    "on_fail": "RECOVERY: 降级到 /judge（轻量）"
  }
}
```

### 3.2 三轴正交组合

| 维度 | 来源 | 取值 | 作用 |
|------|------|------|------|
| **WorkflowType（执行形状7）** | 00-explore §5 用户7种workflow | Executor / PlanDo / ExplorePlanDo / ExplorePlanDoReview / LoopPlanner / DiscoveryLoop / GateReview | 决定节点"长什么样"（几阶段、有无 review） |
| **QualityMode（质量模式5）** | cc-orch L86-151 | Adversarial / JudgePanel / LoopUntilDry / MultiModalSweep / CompletenessCritic | 决定节点"怎么保证质量"（几人审、循环到干） |
| **Shape（代码模式3）** | cc-orch L155-183 | pipeline / parallel / loop-until-dry | 决定节点"怎么调度 agent"（串/并/循环） |

**正交性论证**：00-explore §5 已指出"现有5模式是质量保证模式，7种是任务执行形状，二者正交"。本方案再加 shape 第三轴（调度原语），三轴独立组合。例：judge 节点 = ExplorePlanDoReview（形状）× JudgePanel（质量）× parallel（调度——3方案并行起草）。

### 3.3 编排层（ecc 范式 + cc-orch 合同扩展）

继承 cc-orch 编排合同扩展（orchestration-guide.md L243-251）的 `AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY`：

- **AGENTS**：venture-judge / deep-research / venture-judge 的 completeness-critic / 新建的 persona-builder / requirement-builder（补缺口节点）。
- **ROUTING**：每个节点入口读 `direction.current()` + `checkpoint.current_node` 决定派哪个 agent。
- **MERGE**：parallel 质量模式的 N 方案由 judge 节点嫁接（cc-orch 模式2）。
- **CONFLICT**：跨 worktree 走 cc-loop Stage4 SOP（FIFO+rebase），venture 流水线串行为主，冲突少。
- **RECOVERY**：节点连续 K 轮不过闸 → 标 BLOCKED → 降级（如 /deep → /judge 轻量）或 human gate。

**ecc 借鉴边界**（00-explore §6）：不引入 ecc 的 262 技能，只借鉴"节点化 + agent 路由 + 产物传递"的 harness 编排范式，用 cc-orch 已有体系落地。

---

## 4. 层3骨架：8节点 DAG + 产物契约 + human gate + 缺口补法

### 4.1 8节点 DAG

```
[01]商业调查 ──┐
              ├─→ [03]计划 ──→ [04]judge ──→ ◆ HUMAN GATE ◆ ──→ [05]产品设计
[02]竞品 ─────┘                                                      │
                                                                     ↓
                                            [06]用户画像 ─→ [07]需求 ─→ [08]UIUX
```

- 01/02 并行（层2 shape:parallel）→ 03 汇总计划。
- 04 judge → venture-judge /deep（主力）或 /judge（轻量降级）。
- ◆ HUMAN GATE ◆ = D2 唯一人工节点（探索→计划→judge 后确认方向）。其余全自动串联。
- 05→06→07→08 串行（产物依赖链）。

### 4.2 产物契约（每节点输出路径 + 格式）

| 节点 | 产物路径 | 格式 | 验证闸（可证伪） |
|------|---------|------|----------------|
| 01 商业调查 | `.venture/artifacts/v{n}/01-research.md` | Markdown | 含≥3个数据源链接 |
| 02 竞品 | `02-competitor.md` | Markdown | 含≥3个竞品对比表 |
| 03 计划 | `03-plan.md` | Markdown + frontmatter(direction_version) | 含MUST/MUST NOT/HOW TO VERIFY（cc-goal 模板） |
| 04 judge | `04-judgment-card.md` | venture-judge 评判卡格式 | VC 7维评分齐全 |
| 05 产品设计 | `05-product-design.md` | Markdown | 含核心功能列表+MVP边界 |
| 06 用户画像 | `06-persona.md` | Markdown | 含≥2个画像（缺口节点，见§4.4） |
| 07 需求 | `07-requirements.md` | Markdown + 验收标准 | 每条需求有HOW TO VERIFY（缺口节点） |
| 08 UIUX | `08-uiux-spec.md` + 可选 HTML | Markdown / HTML | 含信息架构+关键页面线框 |

**统一约定**：所有产物路径含 `v{n}` 段，绑定 `direction_version`——痛点4 解药的物理体现（旧版本文件物理隔离在新版本目录外）。

### 4.3 human gate 位置（D2）

唯一 gate 在 judge 之后（00-explore D2："探索→计划→judge 后人工确认方向"）：
- judge 出评判卡 → 暂停循环（层1 Stop hook 不阻，因为是设计内暂停）。
- 用户确认 → 若方向不变，`checkpoint.current_node` 推进到 05。
- 用户换方向 → `direction.set({version:n+1})` → 旧 v{n} 物理保留但 status:superseded → 从 01 重新跑（或从用户指定节点续）。

### 4.4 用户画像/需求缺口节点补法（00-explore §4 缺口）

两节点无专用技能：
- **用户画像**：新建轻量 skill `persona-builder`，或降级用 `deep-interview`（深度访谈生成画像）+ `deep-research`（市场画像补充）。MVP 用降级。
- **需求**：新建轻量 skill `requirement-builder`，或降级用 `gsd-add-backlog`（已有）+ `deep-interview`。每条需求强制 cc-goal L4 格式（MUST + HOW TO VERIFY）。

**不阻塞**：缺口节点用降级方案先跑通流水线，后续迭代再建专用 skill。

---

## 5. 度量（Claude 实施者，禁人天/人周）

| 维度 | 度量 | 目标值 / 闸 |
|------|------|------------|
| **token 预算（单次完整流水线）** | 4文件 state 读写 + 8节点 agent 调用 | ≤ 500k tokens（checkpoint 护栏三 cap） |
| **单节点 token** | 每节点 contract6.BUDGET | 商业调查≤80k / judge≤50k / UIUX≤100k |
| **轮次** | 单节点迭代 | ≤10（护栏一 max_iteration） |
| **无进展检测** | 连续同 `progressHash` | ≤3 次同 hash → 停（护栏二） |
| **skill 配置** | 层1 需新建 skill 数 | 2（direction-manager + venture-checkpoint-writer，封装 Hook 调用） |
| **skill 配置** | 层1 复用现有 skill | autopilot + ralph（语义）+ cc-loop/goal/config/orchestration（方法论） |
| **Hook 配置** | settings.json 新增 hook 数 | 4（PostToolUse/Stop/PreCompact/SessionStart） |
| **可验证闸1** | checkpoint.json 非空 | `jq '.current_task' .venture/state/checkpoint.json` 非空 ≠ 痛点3 的 `{}` |
| **可验证闸2** | direction 原子性 | 换方向后 `jq '.current_version'` 立即返回新值，旧产物 status:superseded |
| **可验证闸3** | trace 留痕 | 每节点完成后 `wc -l trace.ndjson` 递增 |
| **可验证闸4** | 跨压缩恢复 | compact 后 SessionStart 能从 `continue_from` 续跑，不丢 current_node |
| **可验证闸5** | 痛点4 修复 | 换方向后 grep 历史 trace，新节点全部读 v{n+1} 路径，零 v{n} 残留读取 |

---

## 6. 自评（给对抗验证当靶子）

### 6.1 三个强点

1. **痛点3、4 用同一机制（单一真相源）统一解决**，而非两个补丁。checkpoint 补字段灭痛点3，direction 指针灭痛点4，二者共享 `.venture/state/` 目录和 Hook 写入层——架构内聚，不散。
2. **复用边界清晰、迁移成本可控**：autopilot 骨架不动、ralph 语义继承、只新建 direction 指针 + Hook 层 + 2个封装 skill。不推翻现有 OMC 体系，可验证闸全部用 `jq`/`wc`/`grep` 这类零依赖工具。
3. **Hook 强制写入从机制上消灭"agent 自觉"问题**：PostToolUse/Stop/PreCompact/SessionStart 四个时机覆盖了"工具后/想停时/压缩前/恢复时"全部关键点，cc-config 模式4（Stop 阻过早停）已有原型，工程可行性强。

### 6.2 三个最易失败的假设（对抗验证靶子）

1. **假设：Hook 能可靠捕获 venture 语义的 trace**。风险：PostToolUse matcher 是 `Write|Edit`，但 venture 节点的"进展"可能不产生文件写（如 judge 节点纯推理产评判卡在内存里再一次性 Write，中间轮无文件变更 → trace 全是空 `filesChanged` → 护栏二误判无进展）。**靶子**：trace 的 `progressHash` 该基于什么算？若基于文件内容，纯推理节点会误触发无进展停。

2. **假设：单一指针 direction.json 的原子切换在 Windows 上可靠**。风险：方案说"写临时文件+rename"，但 Windows 的 MoveFile+REPLACE_EXISTING 在文件被占用时会失败（如另一个进程在读）。venture 长会话里 SessionStart hook 读 direction 时正好 human gate 在写 → 竞态。**靶子**：Windows 原子 rename 的真实可靠性？要不要加文件锁或重试？

3. **假设：隔离 `.venture/state/` 与 `.omc/state/` 不会让 agent 困惑**。风险：OMC 的 autopilot/ralph 自己会写 `.omc/state/`，venture 又写 `.venture/state/`，两套 state 描述重叠概念（如"当前任务"），agent（尤其 subagent）可能读错家。**靶子**：两套 state 的"单一真相源"是不是自相矛盾？隔离的收益（不污染 OMC 通用性）是否抵得过"agent 读错"的风险？要不要改成 venture 状态寄生在 OMC state 的一个 namespace 下？

---

（方案1 完。全文落盘于 `10-plan-1-state-centric.md`，待对抗验证攻击 §6.2 三靶。）
