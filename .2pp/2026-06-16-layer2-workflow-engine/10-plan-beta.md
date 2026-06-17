---
run: 2026-06-16-layer2-workflow-engine
phase: 2
artifact: plan
faction: beta
faction_name: 平衡派 / 中庸
title: 层2 工作流引擎架构方案（β 平衡派）——四原语 DAG + 每阶段一 loop + pipeline-state 解耦
author: 判官 β agent
created: 2026-06-16
status: draft
inputs:
  - 00-explore.md（Phase 0 全结论）
  - 00-charter.md（硬约束 P1-P4 + 单机/单人/单 Claude/7×24）
  - state-schema.md frozen-v1（四文件契约 + INV-1..6）
  - 50-decision.md §2（层3 8 节点 DAG）+ §3（hcc 技能树）+ §1.7（基线层转向）
  - cc-loop loop-guide.md（循环合同六要素 + 护栏三件套 + 决策树）
  - cc-orchestration orchestration-guide.md（Workflow pipeline + 编排循环五字段）
  - cc-goal goal-guide.md（终态条件五层模型 + 自评三轮）
  - cc-config config-systems-guide.md（六层配置 + 锚文件体系）
  - shift-direction.js（direction.set 现成实现）
---

# 层2 工作流引擎 · β 平衡派方案

> **派别立场**：通用性与首发落地平衡。DAG 中等抽象（四原语：node/edge/human_gate/loop_back）。loop 粒度=每阶段一 loop（HG 前后分段）。pipeline-state 独立 schema 版本号，与 direction_version 解耦。通用骨架可表达 cc-venture + 未来流水线，但节点内容由专用 skill 填。
>
> **主动批评锚点**：α（"配置化≠通用，转移表硬编码换流水线要重写"）；γ（"全抽象图引擎对单人单机过度，维护成本爆炸"）。本方案在两个极端之间走中道。

---

## 1. 架构总览

### 一句话定位

**层2 = 一个由 pipeline-state.json 驱动的、由脚本骨架（确定性状态机）+ /loop 驱动器（跨 session 拉起下一节点）+ agent（节点实质执行）三方协作的通用 DAG 引擎；它消费层1 的四文件状态原语，把抽象的 DAG 拓扑（node/edge/human_gate/loop_back 四原语）转译成 direction.set 调用，驱动层3 的 8 节点流水线流转。**

### 组件图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          层2 工作流引擎（β 设计）                          │
│                                                                          │
│  ┌─────────────────────┐      ┌──────────────────────┐                  │
│  │ ① 脚本骨架 (What)    │      │ ② loop 驱动器 (How)   │                  │
│  │ pipeline-engine.js  │◀────│ /loop venture-advance │                  │
│  │ 确定性状态机：        │ 读/写 │ 每阶段一 loop：         │                  │
│  │  - 读 pipeline-state │      │  - 读当前 stage        │                  │
│  │  - 应用转移函数       │      │  - 调骨架推进一个节点    │                  │
│  │  - 触发 gate/loop_back│     │  - 套循环合同护栏       │                  │
│  │  - 输出下一节点       │      │  - ScheduleWakeup 续跑  │                  │
│  └──────────┬──────────┘      └───────────┬──────────┘                  │
│             │ 写 pipeline-state.json       │ 调                          │
│             ▼                              ▼                            │
│  ┌──────────────────────────────────────────────────────┐               │
│  │ pipeline-state.json（第四个状态文件，独立 schema 版本） │               │
│  │  - current_node / current_stage / iteration           │               │
│  │  - completed_nodes[]（历史）                          │               │
│  │  - awaiting_human: {gate, since}                      │               │
│  │  - loop_back_state: {active, iter, max}               │               │
│  │  - pipeline_version（独立演进）+ direction_version（引用）│            │
│  └──────────────────────┬───────────────────────────────┘               │
│                         │ 读                                            │
│  ┌──────────────────────▼───────────────────────────────┐               │
│  │ ③ 节点 agent (Who) ── venture-* skills / cc-* 方法论    │              │
│  │   N1 调查 → N2 竞品 → ... 由专用 skill 填实质执行       │              │
│  └──────────────────────┬───────────────────────────────┘               │
│                         │ 调 direction.set 推进                          │
└─────────────────────────┼───────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│          层1 cc-runtime（地基 frozen-v1，本方案 INV-1 扩展四文件）          │
│  checkpoint.json / trace.ndjson / direction.json / tasks.tree.json       │
│  接口：direction.set({version, reason, supersedePath}) ── shift-direction.js│
└─────────────────────────────────────────────────────────────────────────┘
                          ▲ 驱动
┌─────────────────────────┼─────────────────────────────────────────────┐
│  层3 cc-venture（首发验证场景，节点内容由 venture-* skills 填）            │
│  8 节点 DAG：N1→N2→N3→HG1→N4→HG2→N5→N6⇄N7→N8                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 数据流（一次节点推进）

```
1. /loop venture-advance 触发（CronCreate durable 或 ScheduleWakeup）
2. loop 驱动器读 pipeline-state.json → current_node = "N3", iteration = 1
3. loop 驱动器读 direction.current() → status = "active"（非 awaiting）
4. loop 调骨架 node.execute(current_node, input_from_direction_path)
   └─ 骨架内分派给对应 venture-* skill（N3 = 决策部，调 cc-2pp/cc-goal）
   └─ skill agent 执行实质（写产物到 .venture/artifacts/v{N}/03-plan.md）
5. 节点完成 → skill 调 exit_check（cc-goal 五层模型自评，见 §4）
   └─ 通过 → 调骨架 transition(current_node) → 算出下一节点
6. 骨架写 pipeline-state.json：completed_nodes += [N3], current_node = "HG1"
   └─ HG1 是 human_gate → pipeline-state.awaiting_human = {gate:"HG1"}
   └─ 骨架调 direction.set 换向？❌ 否。HG 不换向，只置 status:awaiting_human
   └─ 骨架直接写 direction.json（或经 shift-direction 微调 gate 字段）
7. loop 驱动器读到 awaiting_human → 不再 ScheduleWakeup，停等
8. boss 决定后调 /venture-resume HG1 continue
   └─ skill 调 direction.set status:active → 骨架清 awaiting_human
   └─ loop 驱动器重新 ScheduleWakeup 续跑下一 stage
```

**关键设计选择**（β 派立场）：
- 脚本骨架管**拓扑确定性**（转移表 + gate 触发 + loop_back 条件住代码），不管节点内容。
- loop 驱动器管**跨 session 拉起**（ScheduleWakeup + 循环合同护栏），不管拓扑。
- agent 管**节点实质**（venture-* skills），不管编排。
- 三方职责清晰：What（骨架）/ How（loop）/ Who（agent）。

---

## 2. pipeline-state.json schema

### 2.1 设计原则

β 派把 pipeline-state 定位为**层2 私有的工作流状态**，与层1 的三文件（direction/checkpoint/tasks.tree）职责正交：

| 文件 | 职责 | 谁写 | 层2 关系 |
|------|------|------|---------|
| `direction.json` | **业务方向**（单一真相源，换向即版本+1，旧方向归档） | shift-direction.js | 层2 读它判断当前方向产物路径；层2 不直接改业务版本 |
| `checkpoint.json` | **断点快照**（autopilot 通用，含 current_node 但语义粗） | compact-snapshot hook | 层2 的 pipeline-state 是它的细化（pipeline-state.current_node 是权威） |
| `tasks.tree.json` | **任务树**（与 TaskList 同构） | compact-snapshot hook | 层2 不依赖，pipeline-state.completed_nodes 是更细粒度 |
| **`pipeline-state.json`** | **工作流拓扑态**（当前节点/stage/迭代/HG 等待/loop_back） | **层2 脚本骨架** | **本方案新增，第四个状态文件** |

**为什么独立文件而非塞 checkpoint**（反驳"内嵌派"）：
1. checkpoint 是 autopilot 通用快照（§1.2 含 background_jobs/wisdom_exported 等 venture 无关字段），混入工作流态污染通用契约。
2. checkpoint 写者是 compact-snapshot hook（H4/H5），频率低（stop/compact 时）；pipeline-state 写者是层2 骨架，频率高（每节点推进）。两者写时机不同，混文件有写竞态（M4 Windows rename 问题）。
3. 解耦后 pipeline-state 可独立 schema 版本演进，不阻塞层1 frozen-v1（见 §7）。

### 2.2 schema（v1，β 派冻结提案）

```jsonc
{
  // ── 版本（独立于 direction_version，§7 解耦核心）──
  "schema_version": 1,                         // pipeline-state 自身 schema 版本
  "pipeline_version": 3,                        // 本工作流的版本（换工作流重置）
  "direction_version": 2,                       // 引用层1 业务方向版本（INV-1 扩展四文件一致）
  "pipeline_id": "cc-venture",                  // 工作流类型标识（通用骨架的关键，§3）

  // ── 当前态 ──
  "current_node": "N3",                         // 当前节点 id（DAG 拓扑中的位置）
  "current_stage": "pre_hg1",                   // 当前 stage（β 派三段：pre_hg1/mid_hg/judge/post_hg2）
  "iteration": 1,                               // 当前节点内迭代轮次（同 checkpoint.iteration 但权威）
  "status": "running",                          // "running" | "awaiting_human" | "loop_back_active" | "completed" | "abandoned"

  // ── 历史与进度 ──
  "completed_nodes": [                          // 已完成节点历史（按完成顺序）
    { "node": "N1", "finished_at": "2026-06-16T10:00Z", "artifact": ".venture/artifacts/v2/01-research.md" },
    { "node": "N2", "finished_at": "2026-06-16T10:15Z", "artifact": ".venture/artifacts/v2/02-competitor.md" }
  ],
  "progress_percent": 37,                       // 0-100，按 completed_nodes / total_nodes 算

  // ── HG 等待态（β 派 HG 停等核心）──
  "awaiting_human": {                           // null 当 status != awaiting_human
    "gate": "HG1",                              // "HG1" | "HG2"
    "since": "2026-06-16T10:30Z",
    "decision": null,                           // null | "continue" | "shift" | "abandon"（boss 填）
    "panel_path": ".venture/artifacts/v2/hg1-panel.md"  // P1 最懒：重编码后的决策面板
  },

  // ── loop_back 状态（N6⇄N7 互锁等回环原语）──
  "loop_back_state": {                          // null 当无活跃回环
    "loop_id": "n6_n7_lockstep",                // 回环标识
    "iter": 1,                                  // 当前回环迭代
    "max_iter": 3,                              // M2 单调收敛上限
    "active_edge": "N6→N7",                     // 当前在回环的哪条边
    "converged": false                          // 是否已收敛（iter 达 max 强制 true）
  },

  // ── 通用骨架挂钩（§3 表达力边界）──
  "pending_transitions": [],                    // 待应用的转移（骨架调度用）
  "last_transition_at": "2026-06-16T10:00Z",

  // ── 审计 ──
  "created_at": "2026-06-16T09:00Z",
  "updated_at": "2026-06-16T10:00Z",
  "set_reason": "N2 完成，骨架推进到 N3"
}
```

### 2.3 字段表

| 字段 | 类型 | 语义 | 写者 | 时机 |
|------|------|------|------|------|
| `schema_version` | number | pipeline-state 自身 schema 版本（§7.3 变更门） | 骨架 init | init 时定 |
| `pipeline_version` | number | 本工作流版本（换工作流重置，独立于 direction） | 骨架 | 工作流启动 |
| `direction_version` | number | 引用层1 业务方向版本（INV-1 四文件一致） | 骨架 | 跟随 direction.set |
| `pipeline_id` | string | 工作流类型（"cc-venture" / "thesis-pipeline" / "repo-analysis"） | 骨架 init | init 时定 |
| `current_node` | string | DAG 当前节点 id | 骨架 transition | 每次转移 |
| `current_stage` | enum | β 三段 stage（pre_hg1/mid_hg1_hg2/post_hg2） | 骨架 | 跨 HG 时变 |
| `iteration` | number | 当前节点迭代轮次 | 骨架 | 每轮 +1 |
| `status` | enum | running/awaiting_human/loop_back_active/completed/abandoned | 骨架 | 节点/HG/回环边界 |
| `completed_nodes[]` | array | 已完成节点历史（含产物路径） | 骨架 | 节点完成时 append |
| `progress_percent` | number | 进度（completed/total） | 骨架 | 每次转移 |
| `awaiting_human` | object\|null | HG 等待态（gate/since/decision/panel_path） | 骨架 | 进 HG 时写，出 HG 时清 |
| `loop_back_state` | object\|null | 回环态（loop_id/iter/max_iter/active_edge/converged） | 骨架 | 进回环时写，收敛时清 |
| `pending_transitions` | array | 待应用转移（调度用，通常空） | 骨架 | 调度边界 |
| `set_reason` | string | 本次写入理由（审计） | 骨架 | 每次 write |

### 2.4 与 direction/checkpoint 职责切分（核心证据）

切分依据来自 state-schema.md §3（direction 是单一真相源）+ §1（checkpoint 是断点快照）：

```
问题：谁管"当前在哪个节点"？
  direction.json ❌ —— direction 管"业务方向"（v1→v2 换向），不管"在 N3 还是 N4"
  checkpoint.json ⚠️ —— 有 current_node 字段（§1.2）但语义粗（autopilot 通用快照），且写者是 hook 不是骨架
  pipeline-state.json ✅ —— current_node 是权威，骨架是唯一写者

问题：谁管"HG 等待"？
  direction.json ⚠️ —— §3.3 已有 status:awaiting_human + gate 字段（C1 修订）
    → β 派选择：direction.status/gate 作"全局开关"（agent 自然停等输入的机制）
    → pipeline-state.awaiting_human 作"工作流细节"（gate 是 HG1 还是 HG2 + decision 状态 + panel 路径）
    → 两者协同：层2 写 direction.status=awaiting_human 触发 agent 停等；层2 写 pipeline-state.awaiting_human 记工作流细节

问题：谁管"换向"？
  direction.json ✅ —— shift-direction.js 是唯一入口（§5 接口），层2 经 skill 调
  pipeline-state.json ❌ —— 不管业务版本，只引用 direction_version 做一致性校验
```

**关键不变量**（β 派新增，见 §7 INV-1 扩展）：
- `pipeline-state.direction_version` == `direction.current_version`（引用一致）
- `pipeline-state.current_node` ⊆ DAG 节点集（拓扑合法性）
- `pipeline-state.status == "awaiting_human"` ⟺ `direction.status == "awaiting_human"`（HG 态双文件协同）

---

## 3. DAG 原语抽象（β 派四原语）

### 3.1 为什么是四原语（不是三也不是五）

**β 派立场**：α 派的"配置化转移表"（假设节点全用配置表达）和 γ 派的"全抽象图引擎"（假设要支持任意子图嵌套/条件分支/并行 fan-out）都过度。

**对层3 cc-venture 8 节点 DAG 的最小完备分析**（证据：50-decision §2.1）：
- N1→N2→N3：普通有向边 ✅ 需要 **edge** 原语
- HG1/HG2：人工门 ✅ 需要 **human_gate** 原语（不同于普通 node，有停等语义）
- N6⇄N7：互锁回环（M2 MAX_ITER=3）✅ 需要 **loop_back** 原语（不同于普通 edge，有迭代上限）
- N1-N8：每个都是执行单元 ✅ 需要 **node** 原语

四个原语覆盖层3 全部拓扑结构，无冗余。多一个（如 γ 派的"子图 subgraph"）对单人单机是过度工程（charter 单机约束）；少一个（如 α 派把 human_gate 塞进 node 的特殊状态）会丢失停等语义的显式表达（agent 难以一致地处理）。

### 3.2 四原语 schema

```jsonc
// node 原语：DAG 执行单元
{
  "id": "N3",
  "type": "node",
  "skill": "cc-2pp",                    // 节点实质执行的 skill（层3 专用 skill 填）
  "skill_method": "plan",               // skill 内方法（plan/judge/design/...）
  "department": "decision",             // hcc 部门（charter 组织架构）
  "input_contract": {                   // 输入产物契约（50-decision §2.1 层2 校验）
    "required_artifacts": [".venture/artifacts/v{N}/02-competitor.md"],
    "schema": "competitor-analysis-v1"
  },
  "output_contract": {                  // 输出产物契约
    "produces": ".venture/artifacts/v{N}/03-plan.md",
    "schema": "venture-plan-v1"
  },
  "exit_condition": {                   // 退出条件（cc-goal 五层模型，§4 详）
    "must": ["03-plan.md 存在", "含三段：调查结论/竞品结论/计划"],
    "verify": ["grep -q '调查结论' 03-plan.md", "grep -q '计划' 03-plan.md"],
    "level": "L3"
  }
}

// edge 原语：普通有向边（确定性转移）
{
  "id": "E_N1_N2",
  "type": "edge",
  "from": "N1",
  "to": "N2",
  "condition": "always",                // 确定性边：from 完成即 to
  "transition_function": "advance"      // 骨架内置 advance（current_node=to, iteration=1）
}

// human_gate 原语：人工门（停等语义）
{
  "id": "HG1",
  "type": "human_gate",
  "after_node": "N3",                   // N3 完成后进入 HG1
  "before_node": "N4",                  // HG1 决定 continue 后到 N4
  "panel_builder_skill": "venture-hg-panel",  // P1 最懒：把 N1-N3 产物重编码成决策面板
  "verbs": ["continue", "shift", "abandon"],  // charter P1 三动词
  "on_decision": {                      // 决策路由
    "continue": "advance_to(N4)",
    "shift": "call direction.set + reset pipeline-state",
    "abandon": "set status=abandoned"
  },
  "timeout_wakeup": {                   // m1 durable
    "mechanism": "CronCreate",
    "durable": true,
    "interval": "*/13 * * * *"          // 避整点（cc-loop 反模式）
  }
}

// loop_back 原语：回环（N6⇄N7 互锁）
{
  "id": "LB_n6_n7",
  "type": "loop_back",
  "nodes": ["N6", "N7"],                // 参与回环的节点
  "direction": "lockstep",              // 单调收敛（M2：N6 仅收窄 segment 不新增）
  "max_iter": 3,                        // M2 上限
  "convergence_check": "persona_segment_unchanged",  // 收敛判据
  "on_converge": "advance_to(N8)",      // 收敛 → 出回环到 N8
  "on_max_iter": "force_converge_with_current_persona",  // M2 第4轮强制以当前为准
  "guardrails": {                       // 套循环合同护栏（cc-loop 三件套）
    "max_iteration": 3,
    "no_progress_streak": 2,
    "budget_tokens_cap": 100000
  }
}
```

### 3.3 表达力边界（β 派明确划界）

**能表达的**：
- 线性 DAG（N1→N2→N3）✅
- 含人工门的 DAG（HG1/HG2）✅
- 含局部回环的 DAG（N6⇄N7）✅
- 多 stage 分段（pre_hg1/mid/post_hg2）✅

**不能表达的**（β 派主动放弃，反驳 γ）：
- ❌ 并行 fan-out（如 N1 同时分派 3 个调查 agent）—— cc-venture 是串行 DAG（50-decision §2.1 无并行节点），并行由节点内 skill 自行用 Subagent（cc-orchestration 决策树）
- ❌ 条件分支（如 signal==green 走 N5，signal==red 走 HG2）—— 实际是 human_gate.on_decision 的特例，用 HG 原语表达（M3 已定放弃自动 merge，三轴送 HG2 人工）
- ❌ 子图嵌套（如 N4 内含完整子流水线）—— 单人单机过度，N4 内部用 venture-judge + extractor 两 skill 串行调即可
- ❌ 动态拓扑（运行时加节点）—— charter 单 Claude 约束，拓扑由专用 skill 静态定义

**这个边界是 β 派的核心立场**：四原语覆盖层3 全部需求，不过度抽象。γ 派要的"全表达力图引擎"对 OPC（charter 单人单机）是维护成本爆炸（每加一个原语要维护转移函数/gate 触发/回环条件三套逻辑）；α 派的"配置化"把节点塞配置表，换流水线（如论文写作流水线）要重写整个转移表，不通用。

---

## 4. loop 驱动器设计（每阶段一 loop）

### 4.1 loop 粒度选择：每阶段一 loop

**β 派立场**：loop 粒度=**每 stage 一个 loop**，不是"整条流水线一个 loop"（α 派过度聚合，HG 期间 loop 空转浪费）也不是"每节点一个 loop"（γ 派过度拆分，8 个 loop 维护爆炸）。

**三 stage 划分**（基于 HG 分段，证据 50-decision §2.1）：

```
Stage A "pre_hg1"：N1→N2→N3          一个 loop（venture-loop-pre-hg1）
Stage B "judge"：  N4（HG2 前）        一个 loop（venture-loop-judge）—— HG1 决定后启动
Stage C "post_hg2"：N5→N6⇄N7→N8      一个 loop（venture-loop-post-hg2）—— HG2 决定后启动
HG1/HG2：awaiting_human 停等，无 loop（ScheduleWakeup 不激活）
```

**为什么三段而非一段**（反驳 α "一个 loop 跑全程"）：
1. HG 期间 loop 空转会撞循环合同护栏（cc-loop §三 护栏一最大迭代），浪费 token。
2. HG 决策（continue/shift/abandon）是 stage 边界天然断点，loop 在此自然终止/重启。
3. 每个 stage 的循环合同可独立配 BUDGET（pre_hg1 调查预算 < post_hg2 设计预算）。

**为什么三段而非八段**（反驳 γ "每节点一 loop"）：
1. 8 个 loop = 8 份循环合同 + 8 份 PROMPT.md 锚文件（cc-config §锚文件），维护成本爆炸。
2. 节点间转移是确定性的（edge 原语 condition:always），不需要 loop 边界。
3. 节点内迭代（如 N6⇄N7 回环）由 loop_back 原语内部处理，不需要外层 loop。

### 4.2 loop 驱动器执行流程（以 Stage A 为例）

```
/loop venture-loop-pre-hg1   ← CronCreate durable:true，间隔动态（ScheduleWakeup 自步进）

每轮迭代（套 cc-loop 循环合同六要素）：

TRIGGER: ScheduleWakeup（动态间隔，§4.4 缓存窗口）
SCOPE:   Stage A 节点（N1/N2/N3），读 pipeline-state.current_stage == "pre_hg1"
ACTION:
  1. 读 pipeline-state.json → current_node, iteration, status
  2. 若 status == "awaiting_human" → 停止本 loop（HG 期间不空转），等 /venture-resume
  3. 若 status == "completed" || current_stage != "pre_hg1" → loop 自然终止
  4. 调骨架 node.execute(current_node)
     └─ 骨架分派 venture-* skill（N1=venture-investigate, N2=venture-competitor, N3=cc-2pp plan）
     └─ skill agent 执行实质，写产物到 .venture/artifacts/v{N}/
  5. skill 调 exit_check（cc-goal 五层自评，§4.3）
     └─ 未通过 → pipeline-state.iteration += 1，ScheduleWakeup 续跑（护栏：max_iteration）
     └─ 通过 → 调骨架 transition(current_node)
        └─ 骨架算下一节点（N1→N2→N3→HG1）
        └─ 若下一是 human_gate：
           - 写 pipeline-state.awaiting_human = {gate:"HG1", panel_path:...}
           - 写 direction.status = "awaiting_human", gate = "HG1"（经 skill 调，非直写）
           - panel_builder_skill 生成 hg1-panel.md（P1 最懒重编码）
           - loop 终止（不再 ScheduleWakeup）
        └─ 若下一是普通 node：
           - 写 pipeline-state.current_node = next, iteration = 1
           - ScheduleWakeup 续跑下一轮
BUDGET:  每次 50k tokens, 3 个 sub-agent 上限（cc-loop 护栏三）
STOP:    current_stage 变 pre_hg1 之外，或 HG1 进入，或 max_iteration 撞顶
REPORT:  每轮 append trace（层1 trace.ndjson，经 skill 显式调，非 hook）
```

### 4.3 节点退出条件（cc-goal 五层模型应用）

每个 node 原语的 `exit_condition` 字段套 cc-goal goal-guide.md §二 五层模型。β 派要求**至少 L3（有约束）**，关键节点（HG 前）要求 **L4（自验证）**。

**自评三轮**（goal-guide §三 Step 3，每个节点 exit_check 执行）：
1. **可证伪性**：exit_condition.must 每条必须有 verify 命令（grep/test/curl）
2. **原子性**：must 条件独立可验证（一个失败不阻塞其他）
3. **最弱依赖**：找出最可能失败的验证步骤，定回退路径（如 N4 extractor 失败 → signal:unknown 走 HG2，非空产物骗过校验，证据 50-decision §2.5 missing#7）

**N3 退出条件示例**（L4 自验证）：
```yaml
exit_condition:
  must:
    - "03-plan.md 存在"
    - "含三段标题：调查结论/竞品结论/计划"
    - "计划段含至少 3 个可执行 action item"
  must_not:
    - "不含 TODO 占位符"
    - "不引用 v{N-1} 旧方向产物"   # 痛点4 防护
  verify:
    - "test -f .venture/artifacts/v2/03-plan.md"
    - "grep -q '调查结论' 03-plan.md"
    - "grep -q '竞品结论' 03-plan.md"
    - "grep -c '^- \\[ \\]' 03-plan.md | grep -q '[3-9]'"   # 至少3个action
  level: L4
  weakest_link: "action item 计数（grep 正则可能误匹配）"
  fallback: "计数<3 → iteration+=1，skill 重写计划段"
```

### 4.4 HG 停等与 ScheduleWakeup 恢复

**HG 停等机制**（β 派双层设计，协同层1 C1 修订）：

```
进入 HG1：
  1. 骨架检测 N3 完成 + transition 算出下一是 HG1
  2. 骨架写 pipeline-state: status="awaiting_human", awaiting_human={gate:"HG1",...}
  3. 骨架经 skill 调 direction 字段更新（status:awaiting_human, gate:HG1）
     └─ 注意：不调 direction.set 换向（业务方向没变），只改 status/gate 字段
     └─ shift-direction.js 需扩展一个 update-status 子命令（§5）
  4. panel_builder_skill（venture-hg-panel）把 N1-N3 产物重编码成 hg1-panel.md
     └─ P1 最懒：信号 + top RedFlag + 推荐动作（charter §0.5 P1 映射）
  5. loop 驱动器读到 awaiting_human → 不 ScheduleWakeup，本 stage loop 终止

HG1 期间（boss 决策窗口）：
  - 无 loop 空转（省 token，避免护栏误触）
  - m1 CronCreate durable 检查 pipeline-state.awaiting_human.decision 是否被填
    └─ 间隔 */13（避整点，cc-loop 反模式），仅读文件不执行业务
  - boss 调 /venture-resume HG1 continue（或 shift/abandon）

恢复（boss 决定 continue）：
  1. /venture-resume skill 读 decision=continue
  2. skill 调 direction status:active, gate:null（经骨架 update-status）
  3. 骨架写 pipeline-state: status="running", awaiting_human=null, current_node="N4", current_stage="judge"
  4. 触发 Stage B loop（venture-loop-judge）启动 —— 新的 ScheduleWakeup
```

**关键设计**：HG 期间**不依赖 hook**（符合层1 基线层 0 新 hook，50-decision §1.7）。恢复靠 boss 显式调 `/venture-resume` skill，不靠 SessionStart 自动拉起（避免误触发）。

---

## 5. 脚本骨架设计（确定性状态机）

### 5.1 骨架住什么、不住什么

**骨架住**（确定性，代码表达）：
- 转移函数 `transition(current_node)` → 算下一节点（查 DAG 拓扑表）
- gate 触发条件 `should_enter_gate(current_node, completed)` → bool
- loop_back 条件 `should_loop_back(current_node, loop_back_state)` → bool
- 产物契约校验 `validate_contract(node, artifacts)` → bool（50-decision §2.1 层2 校验职责）
- pipeline-state 读写（唯一写者）

**骨架不住**（不确定性，交给 agent/skill）：
- 节点实质执行（venture-* skills）
- 退出条件判定（cc-goal 自评，skill 内做）
- HG 决策（boss）
- panel 内容生成（venture-hg-panel skill）

### 5.2 骨架模块结构（pipeline-engine.js）

```
.claude/skills/venture-pipeline/scripts/
├── pipeline-engine.js          ← 骨架主模块（层2 核心）
│   ├── readPipelineState()     ← 读 pipeline-state.json
│   ├── writePipelineState(partial)  ← 原子写（M4 rename）
│   ├── transition(currentNode) ← 转移函数（查拓扑表）
│   ├── shouldEnterGate(node)   ← gate 触发
│   ├── shouldLoopBack(node)    ← 回环条件
│   ├── validateContract(node, artifacts)  ← 产物契约校验
│   ├── updateDirectionStatus(status, gate)  ← 经 skill 调 direction（不换向）
│   └── execute(node)           ← 分派给 venture-* skill
├── dag-definitions/            ← DAG 拓扑定义（通用骨架的关键，§3）
│   ├── cc-venture.json         ← 层3 8 节点 DAG（首发）
│   ├── thesis-pipeline.json    ← 未来：论文写作流水线
│   └── repo-analysis.json      ← 未来：repo 分析流水线
└── venture-resume.js           ← HG 恢复入口（boss 调）
```

### 5.3 转移函数（确定性，查表不写死）

**反驳 α 派"配置化不通用"**：β 派的转移函数**查 DAG 定义文件**（dag-definitions/*.json），不是硬编码在 pipeline-engine.js。换流水线只换 dag-definition，骨架代码零修改。

```javascript
// pipeline-engine.js transition（伪代码）
function transition(currentNode, dagDef) {
  // dagDef 从 pipeline-state.pipeline_id 加载对应 json
  const edges = dagDef.edges.filter(e => e.from === currentNode);
  if (edges.length === 0) return { type: 'completed' };
  if (edges.length > 1) throw new Error('β 骨架不支持分支，分支用 human_gate.on_decision');

  const edge = edges[0];
  if (edge.type === 'edge') {
    return { type: 'advance', to: edge.to };
  }
  if (edge.type === 'human_gate') {
    return { type: 'enter_gate', gate: edge.id };
  }
  if (edge.type === 'loop_back') {
    return { type: 'enter_loop_back', loop: edge };
  }
  throw new Error(`未知 edge type: ${edge.type}`);
}
```

### 5.4 gate 触发与回环条件

```javascript
// gate 触发：当前节点的出边是 human_gate
function shouldEnterGate(currentNode, dagDef) {
  return transition(currentNode, dagDef).type === 'enter_gate';
}

// 回环条件：当前节点在 loop_back.nodes 内 且 未收敛
function shouldLoopBack(currentNode, dagDef, loopBackState) {
  const lb = dagDef.loop_backs.find(l => l.nodes.includes(currentNode));
  if (!lb) return false;
  if (!loopBackState) return true;  // 首次进入
  if (loopBackState.converged) return false;
  if (loopBackState.iter >= lb.max_iter) {
    // M2 强制收敛
    return { forceConverge: true };
  }
  return true;
}
```

---

## 6. 与层1 接口

### 6.1 调 direction.set 驱动换向

**β 派严格区分两种 direction 操作**：

| 操作 | 何时用 | 入口 | pipeline-state 副作用 |
|------|--------|------|---------------------|
| **direction.set 换向**（业务方向变 v→v+1） | HG 决策=shift，或 abandon 后重启 | shift-direction.js --reason | direction_version 跟随 +1，pipeline-state 重置（新工作流） |
| **direction.update-status**（只改 status/gate，不换向） | HG 进入/退出 | shift-direction.js 新增子命令（§5.2） | pipeline-state.direction_version 不变 |

**为什么 HG 不换向**（反驳"HG 即换向"误解）：
- direction.set 是**业务方向**变更（charter P4 创新决策点），语义重（旧方向归档、版本+1、checkpoint 重置）。
- HG 的 continue 决策**不改业务方向**（还在同一 venture 方向内推进），只改工作流节点位置。
- 只有 HG 的 shift/abandon 决策才触发 direction.set（shift=换市场方向，abandon=放弃整个 venture）。

**接口调用链**（层2 → 层1，证据 state-schema.md §5）：
```
层2 骨架 / skill
  └─ 经 cc-runtime skill 调 direction.set（层3 节点经 skill 唯一可调的写接口）
     └─ shift-direction.js 执行（基线-C 已实现，18/18 测试）
        └─ 原子写 direction.json + checkpoint.json + tasks.tree.json（INV-1 三件套）
        └─ 追加 trace shift 事件（INV-4）
        └─ 归档旧方向目录（痛点4 ENOENT 拦截）
```

### 6.2 pipeline-state 与 INV-1 四文件协同

**层2 只读层1 三文件 + 写层1 经 skill**：
- 读 direction.current() → 获取 current_path（产物根目录）
- 读 checkpoint.continue_from → 续跑锚点（跨 session 恢复）
- 读 trace.ndjson → 回放历史（调试用）
- 写 direction（仅经 skill 调 direction.set 或 update-status）

**层2 独占写 pipeline-state.json**：
- 骨架是唯一写者（§5.1）
- 原子写（M4 rename，复用 init-state.js 的 atomicWriteJSON）
- 落 .venture/state/pipeline-state.json（与三文件同目录，隔离原则一致）

---

## 7. 四文件 INV 扩展（frozen-v1→v2 迁移）

### 7.1 INV-1 三→四文件重定义

**原 INV-1**（state-schema.md §6）：
```
checkpoint.direction_version == direction.current_version == tasks.tree.direction_version
```

**β 派扩展 INV-1（v2）**：
```
checkpoint.direction_version
  == direction.current_version
  == tasks.tree.direction_version
  == pipeline-state.direction_version          ← 新增第四文件
```

**新增不变量**（β 派提案，进 state-schema.md §6）：

| ID | 不变量 | 校验时机 |
|----|--------|---------|
| **INV-1**（扩展） | 四文件 direction_version 一致 | 每次 direction.set 后 |
| **INV-7**（新） | `pipeline-state.current_node` ∈ DAG 节点集（拓扑合法性） | 骨架每次 write 前 |
| **INV-8**（新） | `pipeline-state.status == "awaiting_human"` ⟺ `direction.status == "awaiting_human"` 且 `direction.gate == pipeline-state.awaiting_human.gate` | HG 进入/退出时 |
| **INV-9**（新） | `pipeline-state.loop_back_state.converged == true` ⟹ `loop_back_state.iter >= max_iter` 或收敛判据满足 | 回环每轮 |

### 7.2 pipeline_version 解耦设计（β 派核心立场）

**问题**：direction_version 是**业务方向**版本（每次换市场/换 venture 方向 +1）；pipeline-state 需要自己的**工作流**版本（同一 venture 方向内，工作流可能多次启动/重置）。两者语义不同。

**β 派解法**：
- `pipeline-state.pipeline_version`：工作流版本，独立递增（工作流启动时 +1，与 direction 无关）
- `pipeline-state.direction_version`：引用层1 业务版本（跟随 direction.set，做 INV-1 一致性校验）
- 两者解耦：同一 direction_version 下可有多个 pipeline_version（如 HG abandon 后重启工作流，direction 没变但 pipeline 重置）

**示例**：
```
direction v2（市场B方向）
  └─ pipeline v1（首次启动）→ 跑到 N4 失败 → abandon
  └─ pipeline v2（重启）→ 跑通  ← direction 还是 v2，pipeline 升 v2
  └─ boss 决定 shift 到市场C → direction.set → direction v3
     └─ pipeline v1（新方向首次）← direction v3, pipeline 重置 v1
```

### 7.3 frozen-v1→v2 迁移（向后兼容，基线层 18 测试不破）

**变更性质判定**（state-schema.md §7.3 变更门）：
- 新增 pipeline-state.json 文件 = **major**（新文件 + INV-1 扩展 + INV-7/8/9 新增）
- 但对**已有三文件 schema 零修改**（direction/checkpoint/tasks.tree 字段不变）

**β 派迁移策略**（最小破坏）：
1. **state-schema.md 升 frozen-v1 → frozen-v2**：
   - §0 四文件总览加 pipeline-state.json 行
   - §6 INV-1 扩展 + 加 INV-7/8/9
   - §5 接口表加 `pipeline-state.write(partial)` 行（骨架可调，非 hook）
   - 新增 §5.x pipeline-state.json schema 章节（本方案 §2 内容）
2. **init-state.js 扩展**：首次初始化时多写一个 pipeline-state.json（默认值见 §7.4）
3. **shift-direction.js 扩展**：新增 `--update-status` 子命令（HG 进入/退出用，不换向）
4. **基线层 18 测试**：**全部保持通过**（关键约束）
   - 测试只校验三文件 schema，不涉及 pipeline-state → 新增文件不影响
   - shift-direction.js 换向逻辑不变，只加子命令 → 原测试通过
   - 新增 pipeline-state 测试（独立测试文件，不混入基线层测试）

**向后兼容保证**（证据：state-schema.md §7.1 schema 版本由文档承载）：
- 旧读代码（层1 基线层）不读 pipeline-state → 不受影响
- 新读代码（层2 骨架）读 pipeline-state，缺失时给默认值（init-state 保证存在）
- 旧 direction.json schema 零修改 → 层3 旧读代码不破

### 7.4 pipeline-state.json 初始化默认值（init-state.js 扩展依据）

```jsonc
{
  "schema_version": 1,
  "pipeline_version": 1,
  "direction_version": 1,
  "pipeline_id": null,                  // 首次为 null，工作流启动时填
  "current_node": null,
  "current_stage": null,
  "iteration": 0,
  "status": "idle",                     // 初始 idle，工作流启动变 running
  "completed_nodes": [],
  "progress_percent": 0,
  "awaiting_human": null,
  "loop_back_state": null,
  "pending_transitions": [],
  "last_transition_at": null,
  "created_at": "<init 时间>",
  "updated_at": "<init 时间>",
  "set_reason": "初始化"
}
```

---

## 8. 三张力处理（β 派调和）

### 张力 A（loop×脚本）：脚本骨架管调度 vs /loop 自调度

**β 派调和**："脚本=骨架(What) / loop=驱动器(How) / agent=节点(Who)"，loop 粒度=**每 stage 一 loop**。

- **骨架管拓扑确定性**（转移函数/gate 触发/回环条件住代码，§5），保证可复现（cc-orchestration Workflow 定义：脚本决定下一步）。
- **loop 管跨 session 拉起**（ScheduleWakeup + 循环合同护栏，§4），保证 7×24（charter 约束）。
- **agent 管节点实质**（venture-* skills，§9），保证质量（charter P3 世界最好）。
- **loop 粒度=stage**：HG 前后天然分段（pre_hg1/judge/post_hg2 三 loop），HG 期间无 loop 空转。既不聚合（α 一 loop 跑全程 HG 空转撞护栏）也不拆分（γ 八 loop 维护爆炸）。

**反驳 α**：α 的"脚本全管调度"假设单 session 内跑完全程，但 charter 7×24 要求跨 session，纯脚本无 ScheduleWakeup 拉不起来。
**反驳 γ**：γ 的"loop 全管调度"假设 loop 内动态决定拓扑，但 cc-venture 是确定性 DAG（50-decision §2.1），动态决定是过度能力，且 loop 撞护栏会丢拓扑态。

### 张力 B（通用×验证）：通用引擎 vs cc-venture 未跑通

**β 派调和**："通用骨架（四原语）+ 专用首发（cc-venture dag-definition）"，抽象层次=**四原语中等抽象**。

- **骨架代码通用**（pipeline-engine.js 不管具体节点，只管 node/edge/human_gate/loop_back 四原语转移）。
- **DAG 定义专用**（dag-definitions/cc-venture.json 由 venture-pipeline skill 提供，含节点-skill 映射）。
- **首发可证伪验证**（cc-goal L4 自验证，§4.3）：cc-venture 跑通 = pipeline-state 推进 N1→N8 + 2 HG 停等/恢复 + N6⇄N7 回环收敛，全部有 trace 可回放。
- **未来扩展**：换流水线（论文写作/repo 分析）只换 dag-definition json，骨架零修改（§5.3 查表设计）。

**反驳 α**：α 的"配置化转移表"看似通用，实则转移表硬编码节点 id（如 N1→N2），换流水线要重写整表，不通用。β 派的转移函数查 dag-definition json，json 是数据不是代码，换流水线只换数据。
**反驳 γ**：γ 的"全抽象图引擎"（支持子图/分支/并行）对 OPC 单人单机过度。cc-venture 无并行节点（50-decision §2.1），分支用 human_gate.on_decision 表达，子图用 skill 内串行调。每多一个原语要维护转移/gate/回环三套逻辑，维护成本爆炸（charter 单 Claude 约束下，维护者是同一个 Claude，认知负荷是硬约束）。

### 张力 C（四文件迁移）：新增 pipeline-state + INV-1 四文件

**β 派调和**：pipeline-state **独立 schema 版本号**，与 direction_version 解耦；frozen-v1→v2 迁移**向后兼容**（基线层 18 测试不破）。

- **独立 schema_version**（pipeline-state.schema_version=1，与 state-schema.md 的 frozen-vN 解耦演进，§7.2）。
- **direction_version 引用**（pipeline-state 引用层1 业务版本做 INV-1 一致性，但不 owned 它）。
- **pipeline_version 独立**（工作流版本，同一 direction 下可多次重置，§7.2 示例）。
- **迁移最小破坏**（§7.3）：三文件 schema 零修改，只新增第四文件 + INV-1 扩展 + INV-7/8/9，基线层 18 测试全通过（测试不涉及 pipeline-state）。
- **shift-direction.js 扩展而非重写**：加 --update-status 子命令（HG 用），换向逻辑不变，原测试通过。

**反驳 α**：α 的"pipeline-state 塞 checkpoint"会污染 autopilot 通用快照（§2.1 论证），且写竞态（hook 写 vs 骨架写）。
**反驳 γ**：γ 的"pipeline-state 内嵌复杂工作流历史（含每次转移的 diff）"对单人单机过度，trace.ndjson 已是执行记忆（层1 INV-2），pipeline-state 只需当前态 + completed_nodes 索引，不需要存全量历史。

---

## 9. cc-venture 首发映射（8 节点 DAG 用 β 四原语表达）

### 9.1 dag-definitions/cc-venture.json

```jsonc
{
  "pipeline_id": "cc-venture",
  "version": 1,
  "total_nodes": 8,
  "stages": ["pre_hg1", "judge", "post_hg2"],
  "nodes": [
    { "id": "N1", "type": "node", "skill": "venture-investigate", "department": "sales",
      "stage": "pre_hg1", "exit_condition": { /* L4 自验证，调查报告含市场/痛点/规模 */ } },
    { "id": "N2", "type": "node", "skill": "venture-competitor", "department": "sales",
      "stage": "pre_hg1", "exit_condition": { /* L4，竞品矩阵 ≥3 家 */ } },
    { "id": "N3", "type": "node", "skill": "cc-2pp", "skill_method": "plan", "department": "decision",
      "stage": "pre_hg1", "exit_condition": { /* L4，§4.3 示例 */ } },
    { "id": "N4", "type": "node", "skill": "venture-judge", "department": "decision",
      "stage": "judge", "sub_skills": ["venture-judge-extractor"],  // C1 修订：extractor 转格式
      "exit_condition": { /* L4，judgment-card.md + jsonld signal */ },
      "adversarial": {  // M1 红队对抗
        "blue_team": "venture-judge",
        "red_team": "venture-red-reviewer",
        "divergence_threshold": 0.3,
        "on_divergence": "force_yellow"
      } },
    { "id": "N5", "type": "node", "skill": "venture-product-design", "department": "product",
      "stage": "post_hg2", "exit_condition": { /* L4，产品设计文档 */ },
      "routing": {  // extractor signal 路由
        "signal_green": "advance",
        "signal_yellow": "advance_with_warning",
        "signal_red": "redirect_to_HG2",
        "signal_unknown": "redirect_to_HG2"  // missing#7
      } },
    { "id": "N6", "type": "node", "skill": "venture-persona", "department": "sales",
      "stage": "post_hg2", "exit_condition": { /* L4，画像含 segment */ } },
    { "id": "N7", "type": "node", "skill": "venture-requirements", "department": "product",
      "stage": "post_hg2", "exit_condition": { /* L4，需求文档 */ } },
    { "id": "N8", "type": "node", "skill": "venture-uiux", "department": "product",
      "stage": "post_hg2", "exit_condition": { /* L4，UIUX 设计稿 */ } }
  ],
  "edges": [
    { "id": "E1", "type": "edge", "from": "N1", "to": "N2", "condition": "always" },
    { "id": "E2", "type": "edge", "from": "N2", "to": "N3", "condition": "always" },
    { "id": "E3", "type": "edge", "from": "N3", "to": "HG1", "condition": "always" },  // 进 HG1
    { "id": "E4", "type": "edge", "from": "HG1", "to": "N4", "condition": "decision==continue" },
    { "id": "E5", "type": "edge", "from": "N4", "to": "HG2", "condition": "always" },  // 进 HG2
    { "id": "E6", "type": "edge", "from": "HG2", "to": "N5", "condition": "decision==continue" },
    { "id": "E7", "type": "edge", "from": "N5", "to": "N6", "condition": "always" },
    // N6→N7→N6 回环由 loop_back 原语表达，见 loop_backs
    { "id": "E8", "type": "edge", "from": "N7", "to": "N8", "condition": "loop_back_converged" }
  ],
  "human_gates": [
    { "id": "HG1", "type": "human_gate", "after_node": "N3", "before_node": "N4",
      "panel_builder_skill": "venture-hg-panel",
      "verbs": ["continue", "shift", "abandon"],
      "on_decision": {
        "continue": "advance_to(N4)",
        "shift": "call direction.set",
        "abandon": "set status=abandoned"
      },
      "panel_input_nodes": ["N1", "N2", "N3"]  // P1 重编码源
    },
    { "id": "HG2", "type": "human_gate", "after_node": "N4", "before_node": "N5",
      "panel_builder_skill": "venture-hg-panel",
      "verbs": ["continue", "shift", "abandon"],
      "on_decision": { /* 同 HG1 */ },
      "panel_input_nodes": ["N4"],  // M3 三轴 🟢🟡🔴 + top-2 RedFlag 原样送（放弃自动 merge）
      "include_signal_unknown": true  // missing#7
    }
  ],
  "loop_backs": [
    { "id": "LB_n6_n7", "type": "loop_back", "nodes": ["N6", "N7"],
      "direction": "lockstep",  // M2 单调收敛：N6 仅收窄 segment
      "max_iter": 3,
      "convergence_check": "persona_segment_unchanged_between_iter",
      "on_converge": "advance_to(N8)",
      "on_max_iter": "force_converge_with_current_persona",
      "guardrails": { "max_iteration": 3, "no_progress_streak": 2, "budget_tokens_cap": 100000 }
    }
  ]
}
```

### 9.2 8 节点流转用 β 四原语覆盖验证

| 层3 拓扑 | β 原语 | 表达 |
|---------|--------|------|
| N1→N2→N3 线性 | edge × 2 | E1/E2 condition:always |
| N3→HG1 人工门 | human_gate | HG1 after_node:N3 |
| HG1→N4 决策转移 | human_gate.on_decision | decision==continue → N4 |
| N4→HG2 人工门 | human_gate | HG2 after_node:N4 |
| HG2→N5 决策转移 | human_gate.on_decision | decision==continue → N5 |
| N5→N6→N7 线性 | edge × 2 | E6/E7 |
| **N6⇄N7 互锁回环** | **loop_back** | LB_n6_n7 max_iter:3（M2） |
| N7→N8 回环收敛后 | edge（condition:loop_back_converged） | E8 |

**覆盖度**：8 节点 + 2 HG + 1 loop_back，全部用 β 四原语表达，无遗漏无冗余。

### 9.3 N6⇄N7 互锁的 loop_back 套循环合同（M2 MAX_ITER=3）

证据：50-decision §2.4 M2（显式绑定 MAX_ITER=3，第4轮强制以当前 persona 为准；互锁改单向——N6 仅允许收窄 segment 不允许新增，单调收缩保证收敛）。

**loop_back 原语套 cc-loop 循环合同**（loop-guide.md §二 六要素）：

```yaml
# LB_n6_n7 回环的循环合同（β 派映射）
TRIGGER: N6 或 N7 完成，且 loop_back_state.converged == false
SCOPE:   N6/N7 两节点（pipeline-state.loop_back_state）
ACTION:
  - N6 完成（画像 segment 收窄）→ 调骨架 transition → 进 N7
  - N7 完成（需求文档基于新 persona）→ 调骨架 transition
    └─ 检查 convergence_check（persona_segment 是否本轮与上轮一致）
    └─ 一致 → converged=true → 出回环到 N8
    └─ 不一致 → loop_back_state.iter += 1 → 回 N6
BUDGET:  100k tokens（M2 m2 度量预算计入互锁迭代）
STOP:    converged==true，或 iter >= max_iter（3）
         └─ on_max_iter: force_converge_with_current_persona（M2 第4轮强制）
REPORT:  每轮 append trace（层1 trace.ndjson）
GUARDRAILS（cc-loop 三件套）:
  - max_iteration: 3（M2）
  - no_progress_streak: 2（连续2轮 segment 无变化 → 强制收敛）
  - budget_tokens_cap: 100000
```

---

## 10. 所需 skills 清单

| Skill | 用在哪步 | 用途 |
|-------|---------|------|
| **venture-pipeline**（层2 核心，新建） | §1 骨架 + §5 脚本 + §9 DAG 定义 | pipeline-engine.js 骨架 + dag-definitions/ + venture-resume.js |
| **cc-runtime**（层1，已存在） | §6 接口 + §7 INV 扩展 | direction.set / direction.current() / state.snapshot() 调用入口 |
| **cc-loop**（方法论，已存在） | §4 loop 驱动器 + §9.3 N6⇄N7 回环 | 循环合同六要素 + 护栏三件套 + ScheduleWakeup 决策树 |
| **cc-goal**（方法论，已存在） | §4.3 节点退出条件 | 五层模型 + 自评三轮（可证伪/原子/最弱依赖） |
| **cc-orchestration**（方法论，已存在） | §1 三方协作 + §9.1 N4 对抗 | Workflow pipeline 定义 + 编排循环五字段 + 对抗验证模式 |
| **cc-config**（方法论，已存在） | §4.2 loop 锚文件 + §7 schema 落地 | 六层配置 + 锚文件体系（PROMPT.md/AGENTS.md） |
| **cc-2pp**（方法论，已存在） | §9.1 N3 节点 | plan 方法（判官小组 + 对抗验证） |
| **venture-investigate**（层3，新建） | §9.1 N1 | 市场调查实质执行 |
| **venture-competitor**（层3，新建） | §9.1 N2 | 竞品分析实质执行 |
| **venture-judge**（层3，新建） | §9.1 N4 蓝队 | 评判卡生成（markdown emoji） |
| **venture-judge-extractor**（层3，C1 修订新建） | §9.1 N4 子 skill | markdown 卡 → jsonld signal |
| **venture-red-reviewer**（层3，M1 新建） | §9.1 N4 红队 | 对抗验证，分歧>阈值强制🟡 |
| **venture-hg-panel**（层3，新建） | §4.4 HG panel + §9.1 HG1/HG2 | P1 最懒：产物重编码成决策面板 |
| **venture-persona**（层3，新建） | §9.1 N6 | 用户画像（segment 收窄） |
| **venture-requirements**（层3，新建） | §9.1 N7 | 需求文档 |
| **venture-product-design**（层3，新建） | §9.1 N5 | 产品设计 |
| **venture-uiux**（层3，新建） | §9.1 N8 | UIUX 设计稿 |

**层2 本方案直接依赖**（骨架实现）：venture-pipeline + cc-runtime + cc-loop + cc-goal + cc-orchestration + cc-config。
**层3 首发依赖**（节点实质）：上述所有 venture-* skills（部分已列 50-decision §3 技能树延后清单）。

---

## 11. 工作量估算（Claude 度量）

> **度量单位**：token / 轮次 / skill 配置复杂度 / 验证复杂度（Prompt 注入约束 3：禁人天/人周）。

### 11.1 层2 骨架实现（venture-pipeline skill）

| 子任务 | token 估算 | 轮次 | skill 配置 | 验证 |
|--------|-----------|------|-----------|------|
| pipeline-engine.js 骨架（read/write/transition/gate/loop_back/validate） | ~12k | 4-5 轮 | 1 个新 skill（venture-pipeline） | 单测：转移函数/gate 触发/回环条件各 3+ 用例 |
| dag-definitions/cc-venture.json | ~3k | 1 轮 | 配置文件（非 skill） | schema 校验 + 拓扑合法性（INV-7） |
| venture-resume.js（HG 恢复入口） | ~4k | 2 轮 | 同 venture-pipeline skill 子命令 | 端到端：HG1 continue/shift/abandon 三路径 |
| shift-direction.js 扩展 --update-status | ~3k | 1-2 轮 | 扩展现有 cc-runtime script | 单测：update-status 不换向 + INV-8 协同 |
| state-schema.md frozen-v1→v2 迁移 | ~5k | 2 轮（含基线层 18 测试回归） | 文档更新 | 基线层 18 测试全通过 + 新增 pipeline-state 测试 |
| **小计** | **~27k** | **10-12 轮** | **1 新 skill + 1 script 扩展** | **~15 单测 + 3 端到端** |

### 11.2 loop 驱动器（3 个 stage loop）

| 子任务 | token | 轮次 | skill 配置 | 验证 |
|--------|-------|------|-----------|------|
| venture-loop-pre-hg1（N1-N3 + HG1 进入） | ~6k | 3 轮 | 1 个 loop skill（或 /loop prompt 模板） | 端到端：N1→N2→N3→HG1 停等 |
| venture-loop-judge（N4 + HG2 进入） | ~5k | 2-3 轮 | 同上 | 端到端：N4 蓝红队 + extractor + HG2 |
| venture-loop-post-hg2（N5→N6⇄N7→N8） | ~7k | 3-4 轮 | 同上 | 端到端：N6⇄N7 回环收敛（max_iter=3） |
| **小计** | **~18k** | **8-10 轮** | **3 loop 模板** | **3 端到端** |

### 11.3 层3 节点 skills（首发最小集）

> 注：层3 skills 规格延后（50-decision §2.6），此处只估层2 验证所需的最小桩。

| 子任务 | token | 轮次 | 验证 |
|--------|-------|------|------|
| 8 节点 venture-* skills（最小可跑桩，exit_condition 满足即可） | ~20k | 6-8 轮 | 每节点 exit_check 通过 |
| venture-hg-panel（P1 重编码面板） | ~4k | 2 轮 | HG1/HG2 panel 含信号+RedFlag+推荐动作 |
| venture-judge-extractor（C1 emoji 解析） | ~5k | 2-3 轮 | emoji 稳健解析（锚定结构化位置） |
| **小计** | **~29k** | **10-13 轮** | **8 节点 + 2 panel + extractor** |

### 11.4 总估算

| 维度 | 估算 |
|------|------|
| **总 token** | ~74k（层2 骨架 27k + loop 18k + 层3 桩 29k） |
| **总轮次** | ~28-35 轮（跨多个 session，7×24 断点续跑） |
| **新 skill 配置** | 1 个层2 核心 skill（venture-pipeline）+ 8+ 层3 节点 skills + 1 HG panel skill + 1 extractor |
| **script 扩展** | shift-direction.js 加 --update-status 子命令 |
| **文档迁移** | state-schema.md frozen-v1→v2（INV-1 扩展 + INV-7/8/9） |
| **验证复杂度** | ~15 单测（骨架）+ 3 端到端（loop）+ 8 节点 exit_check + 基线层 18 测试回归 |

**对比 50-decision §2.5 m3 重估**（venture-pipeline ~25k token / 3-4 会话）：β 派估算略高（27k 骨架 + 18k loop = 45k 层2 部分），因 β 派显式拆出 loop 驱动器为独立工作量（α/γ 可能合并估）。合理范围。

---

## 12. 风险清单（含致命弱点）

### 12.1 致命弱点（β 派自承认，供对抗验证攻击）

| ID | 风险 | 等级 | β 派缓解 | 残余风险 |
|----|------|------|---------|---------|
| **F1** | **四原语边界可能不够**：若层3 后续需要并行 fan-out（如 N1 同时调查 3 个市场），β 派主动放弃的"并行原语"会成为阻塞 | **高** | cc-venture 当前是串行 DAG（50-decision §2.1 无并行）；并行由节点内 skill 用 Subagent（cc-orchestration 决策树） | 若未来 venture 需 DAG 级并行，需加第五原语（架构扩展点） |
| **F2** | **pipeline-state 与 direction 双写竞态**：HG 进入时层2 同时写 pipeline-state（骨架）和 direction.status（经 skill），两文件写非原子 | **高** | 顺序写：先 pipeline-state（awaiting_human）再 direction（status:awaiting_human）；INV-8 校验兜底；M4 rename 各自原子 | 极端情况（写 pipeline-state 后崩溃）direction 未更新，INV-8 失败需手动修复 |
| **F3** | **loop 驱动器依赖 ScheduleWakeup 跨 session**：CronCreate durable 跨 session，但 charter 单机笔记本可能休眠，loop 不触发 | **中** | m1 durable:true + 休眠恢复后 cron 补触发；HG 恢复靠 boss 显式 /venture-resume（不依赖 loop） | 笔记本长时间休眠期间工作流停滞（非数据丢失，仅延迟） |

### 12.2 中等风险

| ID | 风险 | 等级 | 缓解 |
|----|------|------|------|
| M1 | loop_back 收敛判据（persona_segment_unchanged）定义模糊，可能误判收敛 | 中 | cc-goal 自评三轮·最弱依赖：明确 segment 比较算法（字段级 diff），fallback force_converge |
| M2 | N4 红队对抗（M1）分歧阈值 0.3 无经验依据 | 中 | 首发跑 3-5 个 venture 方向校准阈值；可配置（dag-definition 内） |
| M3 | HG panel 重编码质量（P1 最懒）依赖 venture-hg-panel skill 质量 | 中 | venture-hg-panel 套 cc-2pp 两阶段设计（探索→方案），panel 本身经判官+对抗 |
| M4 | shift-direction.js 扩展 --update-status 可能引入回归（基线层 18 测试） | 中 | TDD：先写 update-status 单测，再实现；基线层测试回归门 |
| M5 | state-schema.md frozen-v1→v2 迁移若失误，阻塞层3（§7.3 major 变更门） | 中 | 迁移前 G1 式前置实验：在隔离分支跑全量基线测试 + 新 pipeline-state 测试 |

### 12.3 低风险 / 监控点

| ID | 风险 | 等级 | 监控 |
|----|------|------|------|
| L1 | pipeline-state.json 文件膨胀（completed_nodes 累积） | 低 | 单 venture 方向最多 8 节点，换方向重置；监控文件大小 |
| L2 | trace.ndjson 因层2 每节点 append 膨胀 | 低 | 层1 已有 trace，层2 复用不新增；定期 compact（层1 基线层） |
| L3 | dag-definitions/ 多流水线文件管理（通用性带来的） | 低 | 命名约定 + pipeline_id 索引；首发只 cc-venture.json |

---

## 附录 A：β 派 vs α vs γ 核心分歧对照

| 维度 | α 派（配置化） | **β 派（本方案）** | γ 派（全抽象） |
|------|--------------|------------------|--------------|
| DAG 原语 | 转移表配置（节点全配置） | **四原语 node/edge/human_gate/loop_back** | 全抽象图（含子图/分支/并行） |
| loop 粒度 | 一 loop 跑全程 | **每 stage 一 loop（3 个）** | 每节点一 loop（8 个） |
| pipeline-state | 塞 checkpoint | **独立文件 + schema_version 解耦** | 内嵌复杂历史 |
| 通用性 | 假通用（换流水线重写转移表） | **真通用（查 dag-definition json）** | 过通用（OPC 维护爆炸） |
| β 批评 α | "配置化≠通用" | — | — |
| β 批评 γ | — | — | "全抽象对单人单机过度" |

---

## 附录 B：证据来源索引

| 声明 | 证据来源 |
|------|---------|
| 四文件 schema frozen-v1 | state-schema.md §0-§4 |
| INV-1 三文件不变量 | state-schema.md §6 |
| direction.set 是层3 唯一写接口 | state-schema.md §5 |
| 8 节点 DAG + HG + M1/M2/M3 | 50-decision.md §2.1-2.4 |
| HG awaiting_human 机制（C1） | state-schema.md §3.3 + 50-decision §1.3 |
| 基线层 0 新 hook + 18/18 测试 | 50-decision §1.7 |
| 循环合同六要素 + 护栏三件套 | cc-loop loop-guide.md §二/§三 |
| ScheduleWakeup vs CronCreate 决策树 | cc-loop loop-guide.md §五 |
| Workflow = 脚本决定下一步 | cc-orchestration orchestration-guide.md §核心决策 |
| 编排循环五字段（AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY） | cc-orchestration §编排循环 |
| 终态条件五层模型 + 自评三轮 | cc-goal goal-guide.md §二/§三 |
| 锚文件体系（VISION/CLAUDE/AGENTS/PROMPT） | cc-config config-systems-guide.md §锚文件 |
| shift-direction.js 现成实现（INV-1 + 归档 + trace） | shift-direction.js §主流程 |
| charter P1-P4 + 单机/单人/单 Claude/7×24 | 00-charter.md §根原则 + §部署约束 |
| Phase 0 灰度点 1/3/8 收敛方向 | 00-explore.md §2 对灰度点的外部回答 |

---

**方案完毕。β 平衡派立场：四原语中等抽象 + 每阶段一 loop + pipeline-state 解耦，在 α（配置化假通用）和 γ（全抽象过度）之间走中道，通用骨架可表达 cc-venture + 未来流水线，首发用 cc-venture 可证伪验证。**
