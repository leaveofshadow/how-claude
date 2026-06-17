---
run: 2026-06-16-layer2-workflow-engine
phase: 2
artifact: plan
faction: gamma（创新派 / 激进通用）
title: 层2 工作流引擎 · 完整通用 DAG 执行引擎方案
author: γ 创新派判官（opus）
created: 2026-06-16
status: draft-for-adversarial
stance: P3 世界最好（一维即可）+ P4 超越不取代 · 通用引擎优先
inputs:
  - 00-explore.md（Phase 0 全结论）
  - 00-charter.md（硬约束 + 根原则）
  - state-schema.md（层1 frozen-v1 契约）
  - 50-decision.md §2（层3 8 节点 DAG 规格）
  - cc-loop loop-guide.md（循环合同）
  - cc-orchestration orchestration-guide.md（编排循环五字段）
  - shift-direction.js（direction.set 现成实现）
---

# 层2 工作流引擎方案（γ 创新派）

> **一句话定位**：层2 = 一个**纯 Node fs 的通用 DAG 执行引擎**（图声明文件 + 拓扑序计算 + frontier 调度），以 `pipeline-state.json` 作图执行状态，以 `/loop + ScheduleWakeup` 作通用运行时驱动器，把层1 的状态原语驱动成层3 任意拓扑的 DAG 流转。cc-venture 是引擎的第一个 instance，零硬编码。

> **派系立场（γ）**：P3 要求"世界最好（一维即可）"——层2 选定的世界最好维度 = **表达力**（一个引擎能跑任意 DAG：线性/分支/回环/并行/子图，而非只能跑 cc-venture 的 8 节点链）。P4 要求"超越不取代"——引擎超越单流水线，但不取代 boss 在 gate 的判断。主动批评 α（配置化假通用）和 β（四原语不够，未来返工）。

---

## 1. 架构总览

### 1.1 一句话定位（同上，重申核心）

**层2 = 通用 DAG 执行引擎（脚本骨架）+ 通用运行时（loop 驱动器）+ 节点 skill 映射（agent 执行）**。引擎与流水线解耦：引擎不认识"venture"，只认识 node/edge/gate/loop_back/subgraph/fan_out 六原语；cc-venture 用一个 `.venture/pipelines/venture.dag.json` 声明文件把自己装进引擎。

### 1.2 组件图（ASCII）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        层2 工作流引擎（γ）                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  A. 图声明层（What · 静态）                                   │   │
│  │    *.dag.json —— 节点 + 边 + gate + loop_back + subgraph     │   │
│  │    （cc-venture 是其中一个文件，引擎不认识业务语义）           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │ load + validate                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  B. 引擎核心（骨架 · 确定性状态机 · 纯 Node fs）              │   │
│  │    dag-engine.js                                              │   │
│  │    ├─ loadGraph(dagPath)        读声明 + schema 校验           │   │
│  │    ├─ topoSort(graph)           Kahn 算法拓扑排序              │   │
│  │    ├─ computeFrontier(state)    可执行集（入度=0 且未完成）    │   │
│  │    ├─ evalEdge(edge, ctx)       条件分支求值（signal 路由）   │   │
│  │    ├─ triggerGate(gateId)       写 direction.awaiting_human    │   │
│  │    ├─ applyLoopBack(edge, iter) 回环收敛（MAX_ITER 单调）      │   │
│  │    ├─ enterSubgraph(subId)      子图递归（独立 frontier）      │   │
│  │    ├─ fanOut/fanIn              并行扇出 + 屏障汇合             │   │
│  │    └─ advance(node, result)     写 pipeline-state + 推进      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              │ read/write                       ▲ read               │
│              ▼                                  │                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  C. 图执行状态（pipeline-state.json · 第四个状态文件）         │   │
│  │    frontier[] / in_flight[] / completed[] / graph_version    │   │
│  │    node_status{} / iter_counters{} / subgraph_stack[]        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              ▲ read frontier                  │ write back           │
│              │                                ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  D. 通用运行时（How · loop 驱动器）                           │   │
│  │    /loop + ScheduleWakeup（自我推进）                         │   │
│  │    loop tick:                                                │   │
│  │      1. state.snapshot() 读 pipeline-state                   │   │
│  │      2. computeFrontier() 选可执行节点                        │   │
│  │      3. 对每个 frontier 节点 → 调 direction.set 切到该节点    │   │
│  │      4. agent（skill 映射）执行节点实质                       │   │
│  │      5. advance() 写回 pipeline-state                        │   │
│  │      6. 若有未完成节点 → ScheduleWakeup 自我续跑              │   │
│  │      7. 若全完成 或 awaiting_human 或预算耗尽 → 停            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼ dispatch（Who）                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  E. 节点执行层（Who · agent · skill 映射）                    │   │
│  │    node.skill → /venture-judge /venture-persona /cc-2pp ...   │   │
│  │    每节点读 in_schema 产物 → 跑 skill → 产 out_schema 产物    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ direction.set（经 skill 调层1）
┌─────────────────────────────────────────────────────────────────────┐
│  层1 cc-runtime（地基 · frozen-v1→v2）                                │
│    checkpoint / trace / direction / tasks.tree / + pipeline-state    │
│    INV 分层：direction 系（方向语义）+ pipeline 系（图执行语义）       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 数据流（单次 loop tick）

```
loop tick 触发（ScheduleWakeup 或 /loop 手动）
  │
  ├─► 1. 读 pipeline-state.json（frontier / in_flight / completed）
  │      读 direction.json（status 是否 awaiting_human → 是则停）
  │
  ├─► 2. dag-engine.computeFrontier(graph, state)
  │      = { 入度=0 且 status≠completed 且 非子图阻塞 的节点集 }
  │
  ├─► 3. 取 frontier 第一个节点 N（或并行多个，见 §4）
  │      经 skill 调 direction.set({current_node: N, ...})
  │      → checkpoint.current_node 同步（H2 或显式脚本）
  │
  ├─► 4. agent 加载 N.skill → 读 N.in_schema 产物 → 执行 → 产 N.out_schema 产物
  │      trace.ndjson 自动记（H2）或显式 append
  │
  ├─► 5. dag-engine.advance(N, result)
  │      pipeline-state: completed[] += N, node_status[N]=done
  │      evalEdge: 若 N 是 gate 前驱 → triggerGate（写 direction.awaiting_human）
  │                若 N 是 loop_back 源 → applyLoopBack（iter++ 或收敛退出）
  │                若 N 是 fan_out 源 → 标记扇出子节点全部 ready
  │
  ├─► 6. 检查终止：
  │      全完成 → 写 direction.completed，loop 停
  │      awaiting_human → loop 停，等 boss
  │      budget 耗尽 / max_iter 触发 → loop 停，写 health:blocked
  │      否则 → ScheduleWakeup(delaySeconds=120) 自我续跑
  │
  └─► 7. trace 记 loop_tick 事件（action: loop_tick, node: N, delta）
```

### 1.4 三段分工（脚本/loop/agent）—— 张力 A 的调和锚

| 层 | 角色 | 职责 | 证据来源 |
|----|------|------|---------|
| **脚本骨架**（dag-engine.js） | **What**（确定性拓扑） | 图声明加载、拓扑序、frontier 计算、条件求值、gate 触发、回环收敛、子图递归、fan_out/fan_in | orchestration-guide「Workflow = 脚本决定下一步、整个编排可复现」+ charter P2「DAG = 转换编排」 |
| **loop 驱动器**（/loop + ScheduleWakeup） | **How**（运行时推进） | 跨 session 把下一节点拉起来、自我调度、护栏（max_iter/budget/no_progress） | loop-guide §五 ScheduleWakeup「动态自步进」+ §一 Stage4「supervisor reads state → dispatches → repeats」 |
| **节点 agent**（skill 映射） | **Who**（实质执行） | 读 in 产物 → 跑业务 skill → 产 out 产物 | charter「单 Claude，所有 agent 角色 = Claude 分饰（subagent/skill）」 |

> **γ 派对张力 A 的核心主张**：loop 粒度 = **每 tick 推进一个 frontier 节点（或一组并行 fan_out 节点）**，不是每 tick 推进一个 task 或一步推理。节点是 loop 的原子单位。理由：节点是 DAG 图的最小可调度单元（orchestration-guide Workflow 语义），task 是节点内部的细分（归 agent 管），推理步是 agent 内部的（归 skill 管）。loop 只管"把下一个图节点拉起来"。

---

## 2. pipeline-state.json schema（第四个状态文件）

### 2.1 设计原则

- **职责单一**：pipeline-state 只管"图执行状态"（哪些节点完成/在跑/待跑/阻塞），**不管方向语义**（那是 direction.json 的）、**不管断点快照**（那是 checkpoint.json 的）、**不管任务树**（那是 tasks.tree.json 的）。
- **引擎中立**：字段名不含 "venture"——用 `node_status` 而非 `venture_node_status`，让引擎能跑任意 DAG。
- **图版本独立**：`graph_version` 独立于 `direction_version`（见 §7 分层 INV）。

### 2.2 schema（冻结提案 v2-pipeline）

```jsonc
{
  // ── 图标识 ──
  "graph_id": "venture-v1",                    // 图声明文件标识（对应 .venture/pipelines/venture.dag.json）
  "graph_version": 1,                          // 图结构版本（声明文件改了就 +1，独立于 direction_version）
  "graph_hash": "sha256:abc123",               // 声明文件内容 hash（检测声明漂移）
  "loaded_at": "2026-06-16T10:00:00Z",         // 本图版本加载时间

  // ── 拓扑执行状态（引擎核心）──
  "node_status": {                             // 每节点状态
    "N1_research": "completed",
    "N2_competitor": "completed",
    "N3_plan": "completed",
    "HG1": "awaiting_human",
    "N4_judge": "pending",
    "N5_design": "pending",
    "N6_persona": "pending",
    "N7_requirements": "pending",
    "N8_uiux": "pending"
  },                                           // enum: pending | in_flight | completed | awaiting_human | blocked | skipped

  "frontier": ["N4_judge"],                    // 当前可执行集（入度=0 且 status=pending），引擎每 tick 重算
  "in_flight": [],                             // 正在执行（agent 已拉起未写回）
  "completed": ["N1_research", "N2_competitor", "N3_plan"],  // 已完成集（单调递增，除非换向重置）

  // ── 回环 / 子图 / 并行 计数器 ──
  "iter_counters": {                           // 每个含 loop_back 的节点对的迭代次数
    "N6_persona<->N7_requirements": 2          // N6⇄N7 互锁当前第 2 轮（MAX_ITER=3）
  },
  "subgraph_stack": [],                        // 子图递归栈（每层 {sub_id, parent_node, frontier_at_entry}）
  "fan_out_groups": {                          // 扇出组状态
    // "FO1": { spawned: ["N6a","N6b","N6c"], completed: [], barrier: "fan_in_N6" }
  },

  // ── 与层1 的桥接 ──
  "direction_version": 2,                      // 绑定的方向版本（INV 跨层一致性，见 §7）
  "current_node": "HG1",                       // 当前活跃节点（与 checkpoint.current_node 一致，INV-P2）
  "last_advanced_at": "2026-06-16T10:30:00Z",  // 最后一次节点推进时间
  "last_tick_hash": "sha256:def456",           // 上次 loop tick 的状态指纹（无进展检测）

  // ── 引擎健康（独立于 checkpoint.health，管的是图执行健康）──
  "engine_health": "ok",                       // "ok" | "stagnant_warn" | "blocked" | "completed"
  "no_progress_ticks": 0,                      // 连续无 frontier 变化的 tick 数
  "budget_tokens_used": 125000,                // 引擎级预算（跨节点累计）
  "budget_tokens_cap": 2000000                 // 整个 DAG 的预算上限（远大于单节点）
}
```

### 2.3 字段语义表

| 字段 | 类型 | 语义 | 写者 | 读者 |
|------|------|------|------|------|
| `graph_id` | string | 图声明标识 | dag-engine.loadGraph | loop / agent |
| `graph_version` | number | 图结构版本（声明改了 +1） | dag-engine.loadGraph（检测到 hash 变） | loop（检测声明漂移） |
| `graph_hash` | string | 声明文件内容 hash | dag-engine.loadGraph | loop（一致性校验） |
| `node_status{}` | enum map | 每节点执行状态 | dag-engine.advance / triggerGate | loop.computeFrontier |
| `frontier[]` | string[] | 当前可执行集 | dag-engine.computeFrontier | loop（选下一节点） |
| `in_flight[]` | string[] | 正在执行未写回 | loop dispatch 前 / advance 后清 | loop（防重复 dispatch） |
| `completed[]` | string[] | 已完成集（单调） | dag-engine.advance | loop（终止判断） |
| `iter_counters{}` | number map | 回环迭代计数 | dag-engine.applyLoopBack | loop（MAX_ITER 护栏） |
| `subgraph_stack[]` | object[] | 子图递归栈 | dag-engine.enterSubgraph/exitSubgraph | loop（递归调度） |
| `fan_out_groups{}` | object map | 扇出组屏障状态 | dag-engine.fanOut/fanIn | loop（屏障等待） |
| `direction_version` | number | 绑定方向版本 | direction.set 联动 | INV-P1 跨层校验 |
| `current_node` | string | 当前活跃节点 | dag-engine.advance | INV-P2 与 checkpoint 一致 |
| `last_advanced_at` | ISO8601 | 最后推进时间 | advance | loop（超时检测） |
| `last_tick_hash` | string | tick 状态指纹 | loop tick | no_progress 检测 |
| `engine_health` | enum | 图执行健康 | loop tick 评估 | H6 SessionStart 注入 |
| `no_progress_ticks` | number | 连续无进展 tick | loop tick | 护栏二 |
| `budget_tokens_used/cap` | number | 引擎级预算 | loop tick 累加 | 护栏三 |

### 2.4 示例 JSON（cc-venture 跑到 HG1 时的真实快照）

```json
{
  "graph_id": "venture-v1",
  "graph_version": 1,
  "graph_hash": "sha256:a1b2c3",
  "loaded_at": "2026-06-16T09:00:00Z",
  "node_status": {
    "N1_research": "completed",
    "N2_competitor": "completed",
    "N3_plan": "completed",
    "HG1": "awaiting_human",
    "N4_judge": "pending",
    "N5_design": "pending",
    "N6_persona": "pending",
    "N7_requirements": "pending",
    "N8_uiux": "pending"
  },
  "frontier": [],
  "in_flight": [],
  "completed": ["N1_research", "N2_competitor", "N3_plan"],
  "iter_counters": {},
  "subgraph_stack": [],
  "fan_out_groups": {},
  "direction_version": 2,
  "current_node": "HG1",
  "last_advanced_at": "2026-06-16T10:30:00Z",
  "last_tick_hash": "sha256:face0",
  "engine_health": "ok",
  "no_progress_ticks": 0,
  "budget_tokens_used": 380000,
  "budget_tokens_cap": 2000000
}
```

### 2.5 与 direction / checkpoint / tasks.tree 职责切分

| 文件 | 管什么 | 不管什么 | γ 派切分理由 |
|------|--------|---------|-------------|
| **direction.json** | 方向语义（current_version / status / gate / superseded_paths） | 图拓扑、节点状态 | 方向是"业务往哪走"，图执行是"图跑到哪"——两个正交维度，混在一起会让换向（direction+1）误重置图执行（应只重置当前 frontier，不重置整个图历史） |
| **checkpoint.json** | 断点快照（continue_from / health / todo_summary） | 图拓扑、frontier 计算 | checkpoint 是"会话级续跑锚点"，pipeline-state 是"图级执行进度"——checkpoint 续跑时读 pipeline-state 恢复图位置，但 checkpoint 本身不存图 |
| **tasks.tree.json** | 任务树（节点内部的 task 细分，与 TaskList 同构） | 图拓扑、节点间流转 | tasks.tree 是"节点内部"（INV-5 与 TaskList 同构），pipeline-state 是"节点之间"——层级不同 |
| **pipeline-state.json**（新） | 图拓扑执行状态（frontier / completed / iter / subgraph） | 方向语义、断点快照、任务细分 | 引擎核心状态，独立于业务方向 |

> **关键切分**：`direction.gate` 和 `pipeline-state.node_status[HGx]="awaiting_human"` **同时写但语义不同**——direction.gate 是"方向层在等 boss 决定继续/换向/放弃"（业务语义），pipeline-state.node_status 是"图执行层这个 gate 节点处于等待态"（图执行语义）。两者由 `triggerGate` 原子联动（见 §5），但各自独立可读。

---

## 3. DAG 原语抽象（γ 派六原语）

### 3.1 六原语总表

γ 派主张层2 必须支持六原语才能"通用"（β 派四原语 node/edge/gate/loop_back 不够，无法表达子图嵌套和并行扇出，未来一定返工）：

| 原语 | schema 关键字段 | 表达力 | cc-venture 是否用到 |
|------|----------------|--------|-------------------|
| **node** | id / skill / in_schema / out_schema / budget | 图的基本执行单元 | ✅ 全部 8 节点 |
| **edge** | from / to / condition（可选） | 节点间流转 + 条件分支 | ✅ N4→N5 condition: signal==green |
| **human_gate** | id / prompt_template / verbs（continue/shift/abort） | 人工决策节点（写 awaiting_human） | ✅ HG1 / HG2 |
| **loop_back** | from / to / max_iter / converge_pred | 回环 + 收敛条件 | ✅ N7→N6 互锁 |
| **subgraph** | id / nodes[] / edges[] / entry / exit | 可嵌套子图（独立 frontier） | ⚠️ 首发不用，引擎支持 |
| **fan_out / fan_in** | source / targets[] / barrier / merge_strategy | 并行扇出 + 屏障汇合 | ⚠️ 首发不用，引擎支持 |

### 3.2 node 原语 schema

```jsonc
{
  "id": "N4_judge",
  "type": "node",
  "skill": "/venture-judge",                   // 执行该节点的 skill（agent 入口）
  "model": "opus",                              // 可选，覆盖默认
  "in_schema": {                                // 输入产物契约（层2 校验）
    "required_files": [".venture/artifacts/v2/03-plan.md"],
    "required_jsonld": ["judge_input"]
  },
  "out_schema": {                               // 输出产物契约（层2 校验，防残缺产物）
    "files": [".venture/artifacts/v2/04-judge-card.md"],
    "jsonld": { "signal": "green|yellow|red|unknown", "axis_scores": "object", "top_red_flags": "string[]" }
  },
  "budget": { "tokens_cap": 200000, "max_iter": 1 },
  "extractor": "/venture-judge-extractor",      // 可选：把 out 产物转 jsonld（C1 修订）
  "on_failure": "route_gate:HG2"                // 失败降级路由（missing#7：signal:unknown 走 HG2）
}
```

### 3.3 edge 原语 schema（含条件分支）

```jsonc
// 无条件边（默认流转）
{ "from": "N1_research", "to": "N2_competitor" }

// 条件边（N4→N5 仅 signal==green 自动路由；否则走 HG2）
{
  "from": "N4_judge",
  "to": "N5_design",
  "condition": "prev_out.signal == 'green'"
}

// 条件分支（多目标，引擎按 condition 求值选其一）
{
  "from": "N4_judge",
  "to": "HG2",
  "condition": "prev_out.signal in ['yellow','red','unknown']"
}
```

**条件求值**：`dag-engine.evalEdge(edge, ctx)` 中 `ctx` = 前驱节点的 out_schema 解析结果（jsonld）。条件表达式用受限 JS 子集（`prev_out.field == 'value'` / `in` / 逻辑与或），禁任意代码执行（安全）。

### 3.4 human_gate 原语 schema

```jsonc
{
  "id": "HG1",
  "type": "human_gate",
  "prompt_template": "gate/hg1-panel.md",       // 决策面板模板（P1 最懒：重编码成一眼可决策）
  "verbs": ["continue", "shift", "abort"],      // 三动词（50-decision §2.1）
  "input_nodes": ["N3_plan"],                   // 决策依据来自哪些节点产物
  "on_verb": {                                  // 每个 verb 的图执行后果
    "continue": "advance_to:N4_judge",
    "shift": "invoke:direction.set + reset_frontier",
    "abort": "mark_graph:aborted"
  }
}
```

**triggerGate 行为**（§5 详）：写 `direction.status=awaiting_human, gate=HG1` + `pipeline-state.node_status[HG1]=awaiting_human`，loop 停，等 boss。boss 决定后 skill 调 direction.set → on_verb 路由。

### 3.5 loop_back 原语 schema（回环 + 收敛）

```jsonc
{
  "type": "loop_back",
  "from": "N7_requirements",                    // 回环源（完成后可能回到 to）
  "to": "N6_persona",                           // 回环目标
  "max_iter": 3,                                // M2：MAX_ITER=3，第 4 轮强制收敛
  "converge_pred": "prev_out.persona_unchanged == true || iter >= max_iter",  // 收敛条件
  "counter_key": "N6_persona<->N7_requirements", // 对应 iter_counters 的 key
  "direction": "narrow_only"                    // M2：N6 仅允许收窄 segment，单调收缩
}
```

**applyLoopBack 行为**：N7 完成 → 检查 converge_pred → 未收敛则 iter_counters[key]++，把 N6 重新放回 frontier（status 回 pending）；收敛则不回环，N7→N8 正常流转。

### 3.6 subgraph 原语 schema（可嵌套子图）

```jsonc
{
  "id": "SG_judge_deep",
  "type": "subgraph",
  "nodes": ["N4a_blue_team", "N4b_red_team", "N4c_synthesize"],  // 子图内部节点
  "edges": [
    { "from": "N4a_blue_team", "to": "N4c_synthesize" },
    { "from": "N4b_red_team", "to": "N4c_synthesize" }
  ],
  "entry": "N4a_blue_team",                     // 子图入口
  "exit": "N4c_synthesize",                     // 子图出口（完成后回到父图）
  "parent_node": "N4_judge",                    // 父图中哪个节点展开为此子图
  "frontier_at_entry": []                       // 引擎填：进入子图时压栈父图 frontier
}
```

**enterSubgraph 行为**：父图节点 N4_judge → 若声明了 subgraph → 压栈当前 frontier 到 `subgraph_stack` → 切到子图节点集，独立计算 frontier → 子图 exit 完成 → 弹栈回父图，N4_judge 标 completed。

### 3.7 fan_out / fan_in 原语 schema（并行扇出 + 屏障）

```jsonc
{
  "type": "fan_out",
  "source": "N4_judge",                         // 扇出源
  "targets": ["N5_design_a", "N5_design_b", "N5_design_c"],  // 并行目标
  "group_id": "FO1",
  "barrier": {                                  // 屏障：所有 target 完成后才 fan_in
    "type": "fan_in",
    "merge_strategy": "judge_pick_best",        // 合并策略（judge 选最优）
    "merge_skill": "/venture-judge",
    "output_to": "N5_design_merged"
  },
  "concurrency_cap": 2                          // cc-loop Stage4：并发槽位 ≤ 2
}
```

**fanOut/fanIn 行为**：source 完成 → 所有 targets 标 ready（进 frontier）→ loop 一 tick 可 dispatch 多个（受 concurrency_cap 限制，cc-loop worktree SOP）→ 所有 targets completed → 触发 barrier 的 merge_skill 合并 → 产 merged 节点 → 父图继续。

### 3.8 表达力边界（γ 派诚实声明）

| 能表达 | 不能表达 |
|--------|---------|
| 线性 DAG（cc-venture 主链） | 动态图（运行时新增节点，需重载声明） |
| 条件分支（signal 路由） | 跨图引用（图 A 的节点依赖图 B 的产物——需显式 in_schema 声明文件路径） |
| 回环 + 收敛（N6⇄N7） | 无界循环（必须 max_iter，护栏强制） |
| 嵌套子图（judge 内部红蓝队） | 子图递归自引用（SG_A 内含 SG_A——schema 校验拒绝环引用） |
| 并行扇出 + 屏障汇合 | 流式管道（节点边产边消费——本引擎是批次屏障模型） |
| 人工门三动词 | 自然语言自由对话（gate 是结构化决策，非聊天） |

> **γ 派对 β 派的批评**：β 的四原语（node/edge/gate/loop_back）**无法表达 N4 judge 的红蓝队对抗**（需 subgraph 或 fan_out）、**无法表达未来"3 个独立方案并行起草"**（需 fan_out）。首发 cc-venture 可能不用，但引擎若不支持，未来加任何并行/嵌套都要改引擎核心——这才是真返工。γ 六原语一次性到位，首发只用前四个，后两个 reserved。

---

## 4. loop 驱动器设计（通用运行时）

### 4.1 loop 粒度定论（张力 A 核心）

**loop 粒度 = 每 tick 推进一个 frontier 节点（或一组 fan_out 并行节点）**。

| 候选粒度 | γ 评价 |
|---------|--------|
| 每 tick 推进一步推理 | ❌ 太细，loop 变成 ReAct，丧失图级视角 |
| 每 tick 推进一个 task | ❌ task 是节点内部，归 agent，loop 不该穿透 |
| **每 tick 推进一个 frontier 节点** | ✅ 节点是 DAG 最小可调度单元，loop 管节点间流转 |
| 每 tick 推进一个 gate | ❌ 太粗，gate 间可能有多个节点 |

**理由**（证据）：orchestration-guide「Workflow = 脚本决定下一步」——"下一步"的粒度 = 图节点（不是 task 不是推理步）。loop-guide §一 Stage4「supervisor reads state → dispatches agents」——dispatch 的单位是 agent（= 节点 skill）。

### 4.2 loop tick 算法（伪代码）

```python
def loop_tick():
    # 1. 读状态
    direction = read(direction.json)
    pipeline = read(pipeline-state.json)
    checkpoint = read(checkpoint.json)

    # 2. 终止检查（护栏）
    if direction.status == "awaiting_human":
        return STOP("等 boss 决定 gate")
    if pipeline.engine_health == "completed":
        return STOP("图全完成")
    if pipeline.no_progress_ticks >= MAX_NO_PROGRESS:
        write_health("blocked")
        return STOP("连续无进展，需介入")
    if pipeline.budget_tokens_used >= pipeline.budget_tokens_cap:
        write_health("blocked")
        return STOP("预算耗尽")

    # 3. 重算 frontier（图可能因 advance 变化）
    frontier = dag_engine.computeFrontier(graph, pipeline)

    if not frontier:
        # frontier 空但未完成 → 可能在等 fan_in 屏障或子图
        if pipeline.in_flight:
            return WAKEUP(120)  # 等在跑节点写回
        else:
            write_health("blocked")
            return STOP("frontier 空且无在跑，图卡死")

    # 4. 选节点（单节点或 fan_out 组）
    node = frontier[0]
    fan_group = get_fan_out_group(node)
    to_dispatch = [node] if not fan_group else fan_group.targets[:concurrency_cap]

    # 5. dispatch：经 skill 调 direction.set 切到节点
    for n in to_dispatch:
        mark_in_flight(n)
        skill_call("direction.set", {current_node: n, ...})  # 唯一层1 写接口

    # 6. agent 执行节点（skill 映射）
    for n in to_dispatch:
        skill = graph.nodes[n].skill
        result = agent_dispatch(skill, read_in_schema(n))  # Claude 分饰
        # 7. 写回
        dag_engine.advance(n, result)  # 更新 pipeline-state
        unmark_in_flight(n)

    # 8. 自我续跑
    if has_pending_nodes(pipeline):
        ScheduleWakeup(delaySeconds=pick_delay())
    else:
        write_health("completed")
```

### 4.3 ScheduleWakeup 用法（自我推进）

```yaml
# loop 驱动器自我调度（loop-guide §五 ScheduleWakeup）
TRIGGER: "/loop /venture-pipeline-step"（首发手动）或 autopilot 拉起
SCOPE:   当前 pipeline-state 的 frontier
ACTION:  上面 loop_tick 算法
BUDGET:  budget_tokens_cap=2000000（整个 DAG）
STOP:    图全完成 / awaiting_human / 无进展 N tick / 预算耗尽
REPORT:  每 tick 写 trace（action: loop_tick）+ pipeline-state 更新
GUARDRAILS:
  - max_iter: 整图 max_loops=50（防无限 tick）
  - no_progress: 连续 3 tick frontier 无变化 → blocked
  - budget: 2000000 tokens
ANCHORS:
  - .venture/pipelines/venture.dag.json（图声明，每 tick 重读）
  - pipeline-state.json（图执行状态，每 tick 读写）
  - direction.json（方向，每 tick 读）
```

**delaySeconds 选择**（loop-guide §六缓存窗口）：
- 节点执行后立即续跑（同 session 热缓存）→ `60s`（缓存热区）
- 跨 session 续跑（compact 后）→ `1200s`（冷但低频，等 boss 回来）
- 等 fan_in 屏障 → `270s`（缓存热区内最长安全等待）
- **禁用 300s**（loop-guide 反模式：冷启动没省频率）

### 4.4 并行节点如何驱动（fan_out）

fan_out 组的多个 target 节点在同一 tick 内 dispatch（受 concurrency_cap=2 限制，cc-loop Stage4 worktree SOP）。每个 target 独立执行，全部 completed 后触发 fan_in barrier 的 merge_skill。loop tick 检查 `fan_out_groups[FO1].completed.length == targets.length` → 触发 merge。

**并发槽位 ≤ 2**（证据：cc-loop worktree SOP「并发槽位 ≤ 2：同时活跃 worktree ≤ 2」）——单机资源约束，超 2 个并行上下文不可控。

### 4.5 子图如何驱动（subgraph 递归）

enterSubgraph 时压栈父图 frontier，切到子图节点集。子图有自己的 frontier（独立计算）。loop tick 检查 `subgraph_stack` 非空 → 优先推进栈顶子图的 frontier。子图 exit 完成 → 弹栈，父图节点标 completed，父图 frontier 重算。

**递归住哪**：递归逻辑在 `dag-engine.enterSubgraph/exitSubgraph`（脚本骨架），不在 loop（loop 只管"当前栈顶图的 frontier"）。这样 loop 本身是线性的（每次处理一个图层），递归复杂度封在引擎核心。

### 4.6 loop 与脚本骨架的边界（张力 A 调和）

| 职责 | 归 loop（运行时） | 归 dag-engine.js（骨架） |
|------|------------------|------------------------|
| 选下一节点 | ✅ tick 算法 step 4 | ❌ 只提供 computeFrontier |
| 跨 session 续跑 | ✅ ScheduleWakeup | ❌ 无状态 |
| 护栏（预算/迭代/无进展） | ✅ tick 检查 | ❌ 只提供 counter |
| 拓扑序计算 | ❌ | ✅ Kahn 算法 |
| 条件求值 | ❌ | ✅ evalEdge |
| gate 触发 | ❌ | ✅ triggerGate（写 direction+pipeline） |
| 回环收敛 | ❌ | ✅ applyLoopBack |
| 子图递归 | ❌ | ✅ enterSubgraph/exitSubgraph |
| fan_out/in 屏障 | ❌ | ✅ fanOut/fanIn |

> **调和结论**：loop 是"驱动器"（How，运行时推进 + 护栏），脚本是"骨架"（What，确定性拓扑逻辑）。loop 调脚本的纯函数（computeFrontier/evalEdge/advance），脚本不调 loop。单向依赖，可测性强。

---

## 5. 脚本骨架（dag-engine.js · 确定性状态机）

### 5.1 图声明文件（*.dag.json）

引擎不认识业务，只读声明文件。cc-venture 的声明在 §9。引擎核心代码（伪）：

```javascript
// dag-engine.js（纯 Node fs + path，C2 约束）
const fs = require('fs');

function loadGraph(dagPath) {
  const raw = JSON.parse(fs.readFileSync(dagPath, 'utf8'));
  validateSchema(raw);            // 六原语 schema 校验
  const graph = buildAdjacency(raw);  // 邻接表 + 入度表
  graph.topoOrder = kahnTopoSort(graph);  // 拓扑序（检测环）
  graph.hash = sha256(raw);
  return graph;
}

function computeFrontier(graph, pipelineState) {
  // 可执行集 = 入度=0（所有前驱 completed）且 status=pending 且 非子图阻塞
  const frontier = [];
  for (const node of graph.topoOrder) {
    if (pipelineState.node_status[node] !== 'pending') continue;
    const preds = graph.predecessors[node];
    if (preds.every(p => pipelineState.node_status[p] === 'completed')) {
      // 检查条件边：前驱的 condition 是否满足
      if (allEdgesSatisfied(graph, p, pipelineState)) {
        frontier.push(node);
      }
    }
  }
  return frontier;
}

function evalEdge(edge, ctx) {
  // 受限 JS 子集求值，ctx = 前驱 out_schema 解析
  return safeEval(edge.condition, ctx);  // 禁任意代码，只允 ==/in/&&/||
}

function triggerGate(gateId, graph, stateRoot) {
  // 原子联动：写 direction.awaiting_human + pipeline-state.node_status
  const dirPath = path.join(stateRoot, 'direction.json');
  const ppPath = path.join(stateRoot, 'pipeline-state.json');
  const dir = JSON.parse(fs.readFileSync(dirPath));
  const pp = JSON.parse(fs.readFileSync(ppPath));
  dir.status = 'awaiting_human';
  dir.gate = gateId;
  pp.node_status[gateId] = 'awaiting_human';
  pp.current_node = gateId;
  atomicWriteJSON(dirPath, dir);     // M4 原子写
  atomicWriteJSON(ppPath, pp);
}

function applyLoopBack(edge, pipelineState) {
  const key = edge.counter_key;
  const iter = (pipelineState.iter_counters[key] || 0) + 1;
  pipelineState.iter_counters[key] = iter;
  const converged = safeEval(edge.converge_pred, { prev_out: ..., iter, max_iter: edge.max_iter });
  if (!converged && iter < edge.max_iter) {
    pipelineState.node_status[edge.to] = 'pending';  // 回环：目标重新可执行
  }
  // 收敛或达 max_iter → 不回环，正常流转
}

function advance(node, result, graph, stateRoot) {
  const pp = read(stateRoot);
  pp.completed.push(node);
  pp.node_status[node] = 'completed';
  pp.last_advanced_at = now();
  pp.last_tick_hash = sha256(pp);
  // 检查后继边：是否触发 gate / loop_back / fan_out
  for (const edge of graph.outEdges[node]) {
    if (edge.type === 'human_gate') triggerGate(edge.to, graph, stateRoot);
    if (edge.type === 'loop_back') applyLoopBack(edge, pp);
    if (edge.type === 'fan_out') fanOut(edge, pp);
  }
  // 重算 frontier
  pp.frontier = computeFrontier(graph, pp);
  atomicWriteJSON(ppPath, pp);
}
```

### 5.2 拓扑序计算（Kahn 算法）

引擎 loadGraph 时跑 Kahn 算法算拓扑序，检测环（声明文件含环 → 拒绝加载，除非环是显式 loop_back）。拓扑序存在 `graph.topoOrder`，computeFrontier 按此序遍历保证确定性。

### 5.3 gate 触发住哪

`triggerGate` 在 dag-engine（脚本骨架），不在 loop。理由：gate 触发是图执行语义（"N3 完成后必进 HG1"），是确定性的，不该由运行时临时判断。loop tick 只检查 `direction.status==awaiting_human` → 停。

### 5.4 回环收敛住哪

`applyLoopBack` 在 dag-engine。理由：收敛条件（max_iter / converge_pred）是图声明的一部分，确定性求值。loop 只读 iter_counters 做护栏。

### 5.5 子图递归住哪

`enterSubgraph/exitSubgraph` 在 dag-engine。理由：子图拓扑是声明的一部分，压栈/弹栈是确定性状态机操作。loop 只看栈顶。

### 5.6 fan_out/fan_in 屏障住哪

`fanOut/fanIn` 在 dag-engine。理由：屏障条件（all targets completed）是图执行语义。loop 只 dispatch（受 concurrency_cap 限）。

> **骨架住什么的总原则**：所有"图结构决定的事"（拓扑序、条件、gate、回环、子图、屏障）都在 dag-engine.js（确定性、可复现、可单测）。loop 只管"把骨架算出的 frontier 拉起来跑 + 护栏"。这是 cc-orchestration「Workflow = 整个编排可复现」的兑现。

---

## 6. 与层1 接口

### 6.1 唯一写接口：direction.set（经 skill）

层2 驱动节点切换的**唯一**层1 写接口 = `direction.set`（state-schema §5）。层2 不直接写 checkpoint/trace/tasks（那是 Hook 的活，基线层 0 新 hook 原则）。

```javascript
// 层2 经 skill 调 direction.set（shift-direction.js 已实现）
// 触发：loop tick 选定 frontier 节点 N 时
skill_invoke("cc-runtime", "direction.set", {
  version: current_version,        // 通常不换向，保持同 version
  reason: `loop 推进到节点 ${N}`,
  supersedePath: null,             // 不归档（只有 shift/abort verb 才归档）
  // 扩展（v2-pipeline）：联动更新 current_node
  current_node: N
});
```

**关键**：shift-direction.js 现在只在**换向**（version+1）时调用。层2 推进节点**不换向**（同 version 内节点流转），需要一个**轻量推进接口** `direction.advance_node(node)`——只更新 `checkpoint.current_node` + `pipeline-state.current_node`，不升 version、不归档。这是 v2-pipeline 对层1 的 minor 扩展（§7）。

### 6.2 读接口（只读，层2 自由调）

| 接口 | 用途 |
|------|------|
| `direction.current()` | 读当前方向版本 + status（判断是否 awaiting_human） |
| `state.snapshot()` | 读 checkpoint（continue_from 续跑锚点） |
| `read(pipeline-state.json)` | 读图执行状态（frontier / completed） |

### 6.3 pipeline-state 与 INV 分层协同

层2 引入 pipeline-state 后，INV 从"三文件一致性"扩展为"分层不变量"（§7）。层2 的 dag-engine 在每次 advance 后校验 INV-P 系列（pipeline 系），direction.set 联动校验 INV-D 系列（direction 系）+ 跨层 INV-X（一致性约束）。

---

## 7. 四文件 INV 扩展（分层不变量 + frozen-v1→v2 迁移）

### 7.1 分层不变量设计（γ 派核心创新）

原 INV-1..6 是"三文件扁平一致性"。引入 pipeline-state 后，γ 派主张**分层**：direction 系管方向语义，pipeline 系管图执行语义，跨层约束管两者一致性。

#### INV-D 系（direction 系，原 INV-1/3/4 的归并 + 语义澄清）

| ID | 不变量 | 校验时机 |
|----|--------|---------|
| INV-D1 | `checkpoint.direction_version == direction.current_version == tasks.tree.direction_version == pipeline-state.direction_version`（四文件版本一致，原 INV-1 扩展） | 每次 write 后 |
| INV-D2 | `direction.status == "awaiting_human"` ⟹ `checkpoint.health` 反映 gate 等待（原 INV-3） | direction.set 时 |
| INV-D3 | trace 每行 `direction_version` == 写入时 current_version（原 INV-4） | H2 写每行时 |

#### INV-P 系（pipeline 系，新增，管图执行语义）

| ID | 不变量 | 校验时机 |
|----|--------|---------|
| INV-P1 | `pipeline-state.completed[]` 单调递增（除非 direction 换向重置）—— 已完成节点不退回 pending | dag-engine.advance 后 |
| INV-P2 | `pipeline-state.current_node == checkpoint.current_node`（图执行层与断点层的当前节点一致） | dag-engine.advance 后 |
| INV-P3 | `pipeline-state.frontier[]` ⊆ `{ n | node_status[n]=="pending" ∧ 入度=0 }`（frontier 只含可执行节点） | computeFrontier 后 |
| INV-P4 | 每个 `iter_counters[k] <= max_iter`（回环不超限，M2 护栏） | applyLoopBack 后 |
| INV-P5 | `pipeline-state.node_status[g] == "awaiting_human"` ⟹ `direction.gate == g`（gate 双写一致） | triggerGate 后 |
| INV-P6 | `subgraph_stack` 无环引用（子图不含自身） | loadGraph 时 |

#### INV-X 系（跨层一致性，新增）

| ID | 不变量 | 校验时机 |
|----|--------|---------|
| INV-X1 | `direction.current_version` 变化（换向）⟹ `pipeline-state` 重置 frontier + completed 清空（换向 = 新方向新图执行） | direction.set 换向分支 |
| INV-X2 | `pipeline-state.graph_hash == sha256(声明文件)`（声明漂移检测） | loadGraph 时 |
| INV-X3 | `pipeline-state.engine_health == "completed"` ⟹ `completed[] == 全部非 gate 节点`（完成态一致性） | advance 后 |

### 7.2 graph_version vs direction_version（γ 派关键区分）

- **direction_version**（业务层）：boss 换向时 +1（转向市场B）。换向 = 整个方向重来，pipeline-state 重置（INV-X1）。
- **graph_version**（图结构层）：声明文件 `venture.dag.json` 改了（加节点/改边）+1。图结构变化 ≠ 方向变化——可能同一方向换更细的图。graph_version 变 → 引擎重载图，但 completed 节点尽量保留（若 hash 兼容）。

**为什么独立**：若混用 direction_version 表达图结构变化，则"改图"会误触发"换向归档"（shift-direction 把 artifacts 归档）——但改图不该归档产物。两套版本号解耦这两个正交变化维度。

### 7.3 frozen-v1 → v2 迁移

**迁移性质**：minor（新增字段，不删不改语义）—— 符合 state-schema §7.3 minor 协议。

**迁移步骤**：
1. state-schema.md 升 `status: frozen-v2`，新增 §9「pipeline-state.json」章节 + INV-P/INV-X 章节。
2. init-state.js 补 pipeline-state.json 默认值（首次初始化时生成）。
3. shift-direction.js 扩展：换向时（version+1）联动重置 pipeline-state（INV-X1）。
4. 新增 `advance-node.js`（轻量推进，不换向）。
5. 重跑 70-requirements §1（schema 验收）+ 新增 pipeline-state 的验收项。

### 7.4 向后兼容（基线层 18 测试不破）

**关键约束**：基线层 18/18 测试（基线-A/B/C/D）必须全过。

**兼容策略**：
- pipeline-state.json 是**新增文件**，不修改现有四文件的任何字段语义。
- compact-snapshot-write.js Block⑤ 读 `.venture/state/` 时，**新增读 pipeline-state.json**（若存在），不存在则 `pipeline=null`（向后兼容：非层2 项目无此文件零影响）。
- shift-direction.js 换向时新增"重置 pipeline-state"逻辑，但用 `if (exists(pipeline-state.json))` 守卫——无此文件的旧项目走原逻辑。
- 基线层 18 测试的 fixtures 不含 pipeline-state.json，测试逻辑不变 → 18 测试原样通过。

**迁移验证**：跑基线层 18 测试 + 新增 pipeline-state 的单测（dag-engine 的 computeFrontier/evalEdge/triggerGate/applyLoopBack 单测）。

---

## 8. 三张力处理（γ 派调和）

### 8.1 张力 A（loop × 脚本）—— γ 派调和

**张力**：脚本骨架管调度 vs /loop 自调度，谁主谁次？

**γ 派调和**：**脚本 = 骨架（What）/ loop = 驱动器（How）/ agent = 节点（Who）**，三段正交分工（§1.4）。loop 粒度 = **每 tick 推进一个 frontier 节点**（§4.1）。loop 调脚本的纯函数（computeFrontier/evalEdge/advance），脚本不调 loop——单向依赖。loop 管"跨 session 把下一节点拉起来 + 护栏"，脚本管"图结构决定的所有确定性逻辑"。

**为什么不是纯脚本**：纯脚本无法跨 session（单会话脚本，无持久，证据：00-explore §2 官方 Workflows「不自带跨 session 持久化」）。loop + ScheduleWakeup 补这个缺口。

**为什么不是纯 loop**：纯 loop（ralph 式）把图逻辑放 PROMPT.md（chat context），认知漂移（证据：00-explore §2 Medium「编排逻辑移出 chat context 进 code」）。脚本骨架把图逻辑落盘，loop 只读不存图逻辑。

### 8.2 张力 B（通用 × 验证）—— γ 派调和

**张力**：通用引擎 vs cc-venture 未跑通，会不会通用是空谈？

**γ 派调和**：**通用骨架 + 专用首发**。引擎核心（dag-engine.js）通用（六原语 + 拓扑序 + frontier），cc-venture 是引擎的第一个 instance（一个 .dag.json 声明 + 节点 skill 映射）。首发可证伪验证 = **cc-venture 8 节点 DAG 用引擎跑通**（§9）。若 cc-venture 跑通，引擎的"通用性"被至少一个真实场景验证；若跑不通，引擎的缺陷暴露在首发而非未来。

**抽象层次定论**：引擎抽象到"六原语"（不过度抽象到"任意状态机"——那会失去 DAG 的拓扑序优势；不收敛到"venture 专用四节点"——那是 α 的假通用）。

**首发可证伪验证**（cc-goal 可证伪性）：
- 可证伪点 1：cc-venture.dag.json 能被 loadGraph 加载（schema 校验过）。
- 可证伪点 2：跑到 HG1 时 pipeline-state.frontier 与手算一致。
- 可证伪点 3：N6⇄N7 loop_back 在 iter=3 时收敛（MAX_ITER 护栏生效）。
- 可证伪点 4：direction.set 换向时 pipeline-state 重置（INV-X1）。

### 8.3 张力 C（四文件迁移）—— γ 派调和

**张力**：新增 pipeline-state + INV 扩展，会不会破 frozen-v1 + 基线层 18 测试？

**γ 派调和**：**minor 迁移（新增不删）+ 分层 INV + 向后兼容守卫**（§7）。pipeline-state 是新增文件，不碰现有四文件语义。INV 从扁平三文件扩展为分层（D 系/P 系/X 系），原 INV-1/3/4 归入 D 系语义不变。shift-direction.js 用 `if (exists)` 守卫新增逻辑。基线层 18 测试 fixtures 无 pipeline-state → 原样通过。

**graph_version 独立于 direction_version**（§7.2）—— γ 派关键创新，解耦"图结构变化"与"方向变化"两个正交维度，避免改图误触发归档。

---

## 9. cc-venture 首发映射（8 节点 DAG 用 γ 六原语表达）

### 9.1 venture.dag.json 声明文件

```jsonc
{
  "graph_id": "venture-v1",
  "version": 1,
  "description": "cc-venture 8 节点 DAG（层3 旗舰）",

  "nodes": [
    // ── 主链 8 节点 ──
    {
      "id": "N1_research", "type": "node",
      "skill": "/venture-judge",  // 复用调查能力（或新建 venture-research）
      "in_schema": { "required_files": [] },  // 起点，无前驱
      "out_schema": { "files": [".venture/artifacts/v2/01-research.md"] },
      "budget": { "tokens_cap": 150000, "max_iter": 1 }
    },
    {
      "id": "N2_competitor", "type": "node",
      "skill": "/venture-judge",
      "in_schema": { "required_files": [".venture/artifacts/v2/01-research.md"] },
      "out_schema": { "files": [".venture/artifacts/v2/02-competitor.md"] },
      "budget": { "tokens_cap": 150000, "max_iter": 1 }
    },
    {
      "id": "N3_plan", "type": "node",
      "skill": "/cc-2pp",  // 决策部：判官小组出计划
      "in_schema": { "required_files": ["01-research.md", "02-competitor.md"] },
      "out_schema": { "files": [".venture/artifacts/v2/03-plan.md"] },
      "budget": { "tokens_cap": 200000, "max_iter": 1 }
    },
    {
      "id": "HG1", "type": "human_gate",
      "prompt_template": "gate/hg1-panel.md",
      "verbs": ["continue", "shift", "abort"],
      "input_nodes": ["N3_plan"],
      "on_verb": {
        "continue": "advance_to:N4_judge",
        "shift": "invoke:direction.set + reset_frontier",
        "abort": "mark_graph:aborted"
      }
    },
    {
      "id": "N4_judge", "type": "node",
      "skill": "/venture-judge",  // 蓝队
      "in_schema": { "required_files": ["03-plan.md"] },
      "out_schema": {
        "files": [".venture/artifacts/v2/04-judge-card.md"],
        "jsonld": { "signal": "green|yellow|red|unknown" }
      },
      "extractor": "/venture-judge-extractor",  // C1 修订：markdown 卡 → jsonld
      "on_failure": "route_gate:HG2",  // missing#7：失败走 HG2
      "budget": { "tokens_cap": 250000, "max_iter": 1 }
      // M1 红队对抗：可用 subgraph 展开（红蓝队），首发简化为单节点
    },
    {
      "id": "HG2", "type": "human_gate",
      "prompt_template": "gate/hg2-panel.md",  // P1：重编码成决策面板（信号+RedFlag+推荐）
      "verbs": ["continue", "shift", "abort"],
      "input_nodes": ["N4_judge"],
      "on_verb": {
        "continue": "advance_to:N5_design",
        "shift": "invoke:direction.set",
        "abort": "mark_graph:aborted"
      }
    },
    {
      "id": "N5_design", "type": "node",
      "skill": "/cc-loop",  // 产品部：产品设计（缺口技能待补，首发用 cc-loop 占位）
      "in_schema": { "required_jsonld": ["judge_signal:green"] },
      "out_schema": { "files": [".venture/artifacts/v2/05-design.md"] },
      "budget": { "tokens_cap": 200000, "max_iter": 1 }
    },
    {
      "id": "N6_persona", "type": "node",
      "skill": "/venture-persona",  // 销售部：画像（缺口，新建）
      "in_schema": { "required_files": ["05-design.md"] },
      "out_schema": { "files": [".venture/artifacts/v2/06-persona.md"] },
      "budget": { "tokens_cap": 150000, "max_iter": 3 }  // M2：参与互锁
    },
    {
      "id": "N7_requirements", "type": "node",
      "skill": "/venture-requirements",  // 产品部：需求（缺口，新建）
      "in_schema": { "required_files": ["06-persona.md"] },
      "out_schema": { "files": [".venture/artifacts/v2/07-requirements.md"] },
      "budget": { "tokens_cap": 150000, "max_iter": 3 }
    },
    {
      "id": "N8_uiux", "type": "node",
      "skill": "/cc-loop",  // 产品部：UIUX（缺口，首发占位）
      "in_schema": { "required_files": ["07-requirements.md"] },
      "out_schema": { "files": [".venture/artifacts/v2/08-uiux.md"] },
      "budget": { "tokens_cap": 200000, "max_iter": 1 }
    }
  ],

  "edges": [
    // ── 主链 ──
    { "from": "N1_research", "to": "N2_competitor" },
    { "from": "N2_competitor", "to": "N3_plan" },
    { "from": "N3_plan", "to": "HG1" },          // gate 触发
    { "from": "HG1", "to": "N4_judge", "condition": "verb == 'continue'" },
    { "from": "N4_judge", "to": "HG2" },          // M3：放弃自动 merge，三轴送 HG2
    { "from": "HG2", "to": "N5_design", "condition": "verb == 'continue'" },
    { "from": "N5_design", "to": "N6_persona" },
    { "from": "N6_persona", "to": "N7_requirements" },
    { "from": "N7_requirements", "to": "N8_uiux", "condition": "loop_converged" }  // 收敛后流转
  ],

  "loop_backs": [
    {
      // M2：N6⇄N7 互锁，MAX_ITER=3 单调收敛
      "from": "N7_requirements",
      "to": "N6_persona",
      "max_iter": 3,
      "converge_pred": "prev_out.persona_unchanged == true || iter >= max_iter",
      "counter_key": "N6_persona<->N7_requirements",
      "direction": "narrow_only"
    }
  ],

  "subgraphs": [],      // 首发 reserved（N4 红队可未来展开）
  "fan_outs": [],       // 首发 reserved（多方案并行可未来用）

  "budget": {
    "tokens_cap": 2000000,  // 整个 DAG 预算
    "max_loops": 50         // 防 loop 无限 tick
  }
}
```

### 9.2 2 个 HG 的表达

HG1 / HG2 用 `human_gate` 原语（§3.4）。triggerGate 在 N3/N4 完成后由 dag-engine 触发（edge `to: HG1`）。boss 决定 verb 后，`on_verb` 路由（continue → 下游节点；shift → direction.set 换向 + reset frontier；abort → mark_graph aborted）。

### 9.3 N6⇄N7 互锁 = loop_back

N7 完成后 applyLoopBack 检查 converge_pred：未收敛且 iter<3 → N6 回 pending（回环）；收敛或 iter=3 → N7→N8 流转。iter_counters 跟踪轮次（M2 单调收敛护栏）。

### 9.4 节点 skill 映射（charter 5 部门对齐）

| 节点 | skill | charter 部门 | 状态 |
|------|-------|-------------|------|
| N1 research | /venture-judge（复用） | 销售部 | ✅ 已有 |
| N2 competitor | /venture-judge（复用） | 销售部 | ✅ 已有 |
| N3 plan | /cc-2pp | 决策部 | ✅ 已有 |
| N4 judge | /venture-judge + /venture-judge-extractor | 决策部 | ⚠️ extractor 新建（C1） |
| N5 design | /cc-loop（占位） | 产品部 | ❌ 缺口（charter D10 标注真空） |
| N6 persona | /venture-persona | 销售部 | ❌ 缺口（新建） |
| N7 requirements | /venture-requirements | 产品部 | ❌ 缺口（新建） |
| N8 uiux | /cc-loop（占位） | 产品部 | ❌ 缺口（charter D10 标注真空） |

> **诚实声明**：cc-venture 首发要跑通，需补 3 个缺口 skill（venture-persona/venture-requirements + 产品设计/UIUX）。引擎本身不依赖这些 skill——引擎只认声明文件的 `skill` 字段指向。首发可用占位 skill（cc-loop）验证引擎流转，业务 skill 后补。

---

## 10. 所需 skills 清单（每个标在哪步用）

| skill | 用在哪步 | 用途 |
|-------|---------|------|
| **cc-runtime** | §6 层1 接口 | 提供 direction.set / state.snapshot / shift-direction.js（层2 调层1 的唯一通道） |
| **cc-loop** | §4 loop 驱动器 + §9 N5/N8 占位 | loop 合同（TRIGGER/SCOPE/ACTION/BUDGET/STOP/REPORT）+ ScheduleWakeup 自调度 + 护栏三件套 |
| **cc-orchestration** | §1.4 三段分工 + §5 骨架设计 | Workflow 语义（脚本决定下一步）+ 编排循环五字段（AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY）+ fan_out 并发槽位 ≤2 |
| **cc-goal** | §8.2 首发可证伪验证 + 每节点退出条件 | 终态条件自评（可证伪性 + 原子性 + 最弱依赖）—— 每节点的 out_schema 即终态条件 |
| **cc-2pp** | §9 N3 plan 节点 + 本方案自身（判官小组） | 判官小组出方案 + 对抗验证（本方案就是 γ 派判官产出） |
| **cc-config** | §7 锚文件 + pipeline-state 落地层 | 六层配置（pipeline-state.json 落 `.venture/state/` = 层3 项目配置）+ 锚文件体系（dag.json 是图声明锚） |
| **cc-context** | §4.3 loop 跨 session 续跑 | 上下文健康（compact 后 loop 续跑的上下文恢复） |
| **venture-judge** | §9 N1/N2/N4 节点 | 评判卡生成（层3 业务 skill） |
| **venture-judge-extractor** | §9 N4 extractor | C1 修订：markdown 卡 → jsonld（新建） |
| **venture-persona** | §9 N6 节点 | 画像（新建，charter 销售部） |
| **venture-requirements** | §9 N7 节点 | 需求（新建，charter 产品部） |

---

## 11. 工作量估算（Claude 度量：token / 轮次 / skill 配置 / 验证）

> **约束**：禁人天/人周。用 Claude Code + skills 实施者度量（Prompt 注入约束 1/3）。

### 11.1 引擎核心（dag-engine.js）

| 子任务 | token | 轮次 | 验证 |
|--------|-------|------|------|
| loadGraph + schema 校验（六原语） | ~8k | 2 | 单测：合法/非法声明 |
| Kahn 拓扑序 + 环检测 | ~4k | 1 | 单测：链/树/环 |
| computeFrontier | ~5k | 2 | 单测：线性/分支/gate 阻塞 |
| evalEdge（受限 JS 子集） | ~6k | 2 | 单测：signal 路由 |
| triggerGate（联动 direction+pipeline） | ~5k | 2 | 单测：HG1/HG2 双写一致 |
| applyLoopBack（MAX_ITER 收敛） | ~5k | 2 | 单测：N6⇄N7 iter=3 收敛 |
| enterSubgraph/exitSubgraph | ~6k | 2 | 单测：父子图压栈弹栈 |
| fanOut/fanIn（屏障 + concurrency_cap） | ~6k | 2 | 单测：3 扇出 cap=2 排队 |
| **小计** | **~45k** | **15** | 8 组单测 |

### 11.2 pipeline-state.json + 迁移

| 子任务 | token | 轮次 | 验证 |
|--------|-------|------|------|
| schema 定稿 + state-schema.md v2 章节 | ~6k | 2 | 文档评审 |
| init-state.js 补 pipeline-state 默认值 | ~3k | 1 | 单测：初始化生成 |
| shift-direction.js 扩展（换向重置 pipeline） | ~4k | 2 | 单测：换向后 frontier 清空 |
| advance-node.js（轻量推进） | ~3k | 1 | 单测：同 version 推进 |
| INV-P/INV-X 校验函数 | ~5k | 2 | 单测：违反不变量报错 |
| 基线层 18 测试回归（向后兼容） | ~3k | 1 | 18 测试全过 |
| **小计** | **~24k** | **9** | 6 组单测 + 回归 |

### 11.3 loop 驱动器 + cc-venture 声明

| 子任务 | token | 轮次 | 验证 |
|--------|------|------|------|
| loop tick 算法（伪代码 → prompt） | ~5k | 2 | 手动跑 2 tick 观察 |
| ScheduleWakeup 配置 + delaySeconds 策略 | ~3k | 1 | 观察续跑 |
| venture.dag.json 声明文件 | ~4k | 2 | loadGraph 校验过 |
| cc-venture 端到端跑到 HG1（N1→N2→N3） | ~15k | 4 | 可证伪点 1/2 |
| N6⇄N7 loop_back 端到端（iter=3 收敛） | ~10k | 3 | 可证伪点 3 |
| 换向重置端到端（direction.set → pipeline 重置） | ~8k | 2 | 可证伪点 4 |
| **小计** | **~45k** | **14** | 端到端 4 可证伪点 |

### 11.4 总估

| 维度 | 估算 |
|------|------|
| **总 token** | ~114k（引擎 45k + 迁移 24k + loop/venture 45k） |
| **总轮次** | ~38 轮（含调试） |
| **skill 配置** | 引擎核心用 cc-runtime/cc-loop/cc-orchestration；验证用 cc-goal；业务节点用 venture-* |
| **验证复杂度** | 中高（8 组引擎单测 + 6 组迁移单测 + 4 端到端可证伪点 + 18 回归） |

> **对比 α/β**：γ 比四原语方案多 ~20k token（多 subgraph/fan_out 两原语 + 分层 INV），但换"未来加并行/嵌套零返工"。ROI 论证见 §12。

---

## 12. 风险清单（含致命弱点诚实自评）

### 12.1 致命弱点：通用引擎对单人单机是否过度？

**诚实自评**：γ 派的六原语引擎对**首发只跑 cc-venture 一条线性 DAG**的场景，确实**过度设计**——subgraph/fan_out 首发 reserved 不用，却要写它们的单测和递归/屏障逻辑（~12k token + 4 轮）。

**ROI 拷问**：通用引擎的 ROI > 重复造轮子吗？

**γ 派辩护**（必须经得起对抗）：
1. **第二个 instance 的边际成本**：若未来加任何并行（charter「多头注意力，并行合作」+ hcc 5 部门天然有并行需求）或嵌套（N4 judge 红蓝队对抗，50-decision M1 已要求），β 的四原语引擎需**改核心**（加原语 = 改 loadGraph/computeFrontier/advance 全套），γ 引擎只需**写声明文件**。改核心的返工成本 > 首发 12k token 的预留成本。
2. **可证伪性兜底**：首发 cc-venture 跑通即证明引擎核心（node/edge/gate/loop_back）正确，subgraph/fan_out 是同构扩展（同样的 frontier/advance 逻辑），风险可控。
3. **世界最好维度**（charter P3）：γ 选定"表达力"维度的世界最好——一个引擎跑任意 DAG。若降级为 α 的"配置化专用"，表达力维度丢失，违反 P3。

**但如果**对抗验证证明"未来 6 个月不会有第二个 DAG instance / 不会有并行需求"，则 γ 的 subgraph/fan_out 确实过度 → **应降级为 β 四原语 + 预留扩展点**（声明文件 schema 支持 subgraph/fan_out 字段但引擎首发不实现，lazy 实现）。这是 γ 派的诚实退路。

### 12.2 风险登记

| ID | 风险 | 等级 | 缓解 |
|----|------|------|------|
| R-γ1 | **通用引擎过度设计**（致命弱点，见上） | 高 | 首发 reserved subgraph/fan_out；若对抗证无第二 instance 则降级 β |
| R-γ2 | evalEdge 条件求值的受限 JS 子集边界模糊（安全 + 表达力） | 中 | 白名单操作符（==/in/&&/\|\|），禁 eval/Function；单测覆盖 |
| R-γ3 | loop × 脚本 × agent 三段分工的接口契约脆弱（谁该写什么） | 中 | §1.4 + §4.6 + §5.6 明确边界；每个写操作标写者；INV 校验 |
| R-γ4 | pipeline-state 与 direction/checkpoint 的双写竞态（triggerGate 同时写两文件） | 中 | M4 原子写（临时文件 + rename）；写顺序：direction 先 pipeline 后（direction 是真相源） |
| R-γ5 | graph_version 与 direction_version 混淆导致换向误重置图 | 中 | §7.2 明确区分；INV-X1 只在 direction_version 变时重置；单测覆盖 |
| R-γ6 | 基线层 18 测试回归失败（迁移破坏向后兼容） | 中 | §7.4 `if(exists)` 守卫；fixtures 无 pipeline-state；回归必跑 |
| R-γ7 | loop 跨 session 续跑时 pipeline-state 与 checkpoint 不同步（compact 后） | 中 | compact-snapshot Block⑤ 扩展读 pipeline-state；SessionStart 恢复 |
| R-γ8 | cc-venture 3 个缺口 skill（persona/requirements/design）阻塞首发端到端 | 中 | 首发用 cc-loop 占位验证引擎；业务 skill 后补（引擎不依赖） |
| R-γ9 | fan_out concurrency_cap=2 与 worktree SOP 的物理约束耦合（单机资源） | 低 | 首发不用 fan_out；reserved 时再耦合 worktree |
| R-γ10 | 分层 INV（D/P/X 三系）校验复杂度上升，debug 困难 | 中 | 每个 INV 独立单测；违反时报具体 INV-ID + 文件 + 字段 |

### 12.3 γ 派对 α/β 的主动批评

**批 α（配置化假通用）**：α 主张"配置化 + 专用"，但"换流水线重写"——若第二个 DAG（如 hcc 部门协作流）来了，α 要重写引擎。γ 的六原语引擎只需新声明文件。α 的"通用"是名义的，γ 的"通用"是结构的。

**批 β（四原语不够）**：β 的 node/edge/gate/loop_back 四原语**无法表达**：
- N4 judge 的红蓝队对抗（50-decision M1 要求）→ 需 subgraph 或 fan_out。
- charter「多头注意力，并行合作」→ 需 fan_out。
- 未来 hcc 5 部门协作的并行 → 需 fan_out。
β 首发"够用"，但第二个场景必返工。γ 一次性六原语，首发 reserved 后两个，边际成本 12k token 换零返工。

---

## 附：γ 派一句话总结

**层2 = 通用 DAG 执行引擎（六原语 + 拓扑序 + frontier 调度，纯 Node fs）+ 通用运行时（/loop + ScheduleWakeup，每 tick 推进一个 frontier 节点）+ 节点 skill 映射（agent 执行）**。pipeline-state.json 是第四个状态文件（图执行状态，graph_version 独立于 direction_version）。INV 分层（D 系方向 + P 系图执行 + X 系跨层）。cc-venture 是引擎第一个 instance（一个 venture.dag.json 声明）。诚实弱点：subgraph/fan_out 首发 reserved 可能过度，若对抗证无第二 instance 则降级 β 四原语 + 预留扩展点。
