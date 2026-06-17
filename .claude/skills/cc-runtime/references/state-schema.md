---
doc: state-schema
layer: 1 (cc-runtime)
status: frozen-v1
frozen_by: M1
created: 2026-06-16
sources:
  - 60-impl-plan.md §2（schema 草稿源）
  - 10-plan-1-state-centric.md §2.1-2.3（四文件原始设计）
  - 50-decision.md §1.3-1.4（C1/C2 修订条款）
change_protocol:
  minor: 向后兼容地新增字段（层1/层3 旧读代码不破）
  major: 移除字段 / 改字段语义 / 改文件格式（须重跑 70-requirements §1，并通知层3 重新对齐）
---

# 层1 cc-runtime 状态 schema（冻结 v1）

> **定位**：这是层1 cc-runtime 的状态契约，**也是层3 cc-venture 流水线的接口冻结点**（50-decision §2.6 层3 ACCEPT 前置：direction.json / trace.ndjson schema 稳定）。M1 冻结后，层1 七 Hook 严格按此读写，层3 八节点也按此读写——schema 是层1 与层3 的共同边界。
>
> **存储根**：`.venture/state/`（与 `.omc/` 隔离，方案1 §2.6「隔离为主、单向桥接」）。cc-runtime 只写 `.venture/`，可读 `.omc/` 做环境感知，**绝不写回 `.omc/`**。
>
> **隔离原则**：venture 业务状态不污染通用工具——compact-snapshot 输出 `.claude/compact-snapshots/`，gsd 输出 `.omc/state/`，cc-runtime 输出 `.venture/state/`。三套并存，功能正交（60-impl-plan §11 共存矩阵）。

---

## 0. 四文件总览

| 文件 | 角色 | 写者（Hook） | 读者 | 格式 | 原子性 |
|------|------|-------------|------|------|--------|
| `checkpoint.json` | 断点快照（续跑锚点） | H4 Stop / H5 PreCompact | H6 SessionStart / 层3 | JSON | 整体重写（临时文件 + rename）|
| `trace.ndjson` | 执行轨迹（每动作一行） | H2 PostToolUse | H6 / 层3 回放 | NDJSON（每行一独立 JSON）| 追加 append |
| `direction.json` | 当前方向指针（单一真相源） | H8 探测 → skill 确认 | H1 / H6 / 层3 | JSON | 原子重写（M4，临时文件 + rename）|
| `tasks.tree.json` | 任务树（与 TaskList 同构） | H2 PostToolUse | H4 / H6 | JSON | 整体重写 |

---

## 1. checkpoint.json —— 断点快照

断点快照。`Stop` / `PreCompact` / `SessionStart` 时写入，SessionStart 注入续跑锚点（痛点3 的「不丢状态」核心）。

### 1.1 schema（冻结 v1）

```jsonc
{
  // ── autopilot 原字段（保留，零迁移，方案1 §2.1）──
  "created_at": "2026-06-16T10:00:00Z",          // ISO8601
  "trigger": "stop",                              // "stop" | "precompact" | "sessionstart"
  "active_modes": { "autopilot": "execution", "venture": "node:judge" },
  "todo_summary": { "pending": 3, "in_progress": 1, "completed": 4 },
  "wisdom_exported": false,
  "background_jobs": { "active": [], "recent": [], "stats": null },

  // ── venture 扩展（方案1 §2.1，痛点3 补丁）──
  "current_node": "judge",                        // 当前流水线节点
  "current_task": "评判卡生成 v2",                 // 当前任务描述
  "explore_paths": [".venture/artifacts/v2/01-research.md"],
  "plan_path": ".venture/artifacts/v2/03-plan.md",
  "progress_percent": 37,                         // 0-100
  "iteration": 5,                                 // 当前节点迭代轮次
  "last_progress_hash": "sha256:ab12cd",          // 护栏二指纹（M1：基于 node+iter+step 三元组）
  "direction_version": 2,                         // 必须与 direction.current_version 一致（INV-1）
  "direction_path": ".venture/state/direction.json",
  "trace_ref": ".venture/state/trace.ndjson",
  "guardrails": {
    "max_iteration": 10,                          // 循环合同·护栏一：最大迭代数
    "no_progress_streak": 0,                      // 连续 N 次同 hash 计数
    "budget_tokens_used": 125000,                 // 循环合同·护栏三：已用预算
    "budget_tokens_cap": 500000                   // 预算上限
  },
  "continue_from": "node:judge,task:评判卡生成 v2,iter:5",  // 续跑锚点（H6 注入核心）

  // ── C1 修订新增（痛点3 兜底迁 PreCompact + human gate awaiting）──
  "stagnation_count": 0,                          // [C1] 连续无进展轮次，H5 累加
  "health": "ok"                                  // [C1] "ok" | "stagnant_warn" | "blocked"
}
```

### 1.2 字段语义

| 字段 | 类型 | 语义 | 写时机 |
|------|------|------|--------|
| `created_at` | string(ISO8601) | 本次快照时间 | 每次 write |
| `trigger` | enum | 触发本次写入的 Hook | H4/H5/H6 |
| `active_modes` | object | 各编排模式当前阶段 | write 时快照 |
| `todo_summary` | object | 任务计数（与 tasks.tree 一致，INV-6） | H2 同步 |
| `current_node` / `current_task` | string | 业务做到哪 | H2 / 层3 |
| `explore_paths` / `plan_path` | string[] / string | 关键产物路径 | 层3 写 |
| `progress_percent` | number(0-100) | 进度（单调不减，除非换向） | H2 |
| `iteration` | number | 当前节点迭代轮次 | H2 |
| `last_progress_hash` | string | 进度指纹（M1 三元组，非文件 hash） | H2 |
| `direction_version` | number | 当前方向版本（INV-1 一致性） | 跟随 direction |
| `guardrails` | object | 循环合同三件护栏 | write 时累加 |
| `continue_from` | string | 续跑锚点（H6 注入） | 每次 write |
| `stagnation_count` | number | [C1] 连续无进展轮次 | H5 累加 |
| `health` | enum | [C1] 健康状态 | H5/H4 写，H6 读后注入 |

### 1.3 `health` 状态机（C1 核心）

```
ok ──(stagnation_count ≥ 警戒线 N_warn)──▶ stagnant_warn ──(≥ 阻塞线 N_block)──▶ blocked
                                                                                      │
                                            ◀──(有新进展，H2 重置 stagnation_count=0)──┘
```
- H5 PreCompact 累加 `stagnation_count` + 计算 `health`。
- H6 SessionStart 读 `health`，若 `blocked` 注入强提示「⚠️ 连续 {N} 轮无进展，需人工介入或换向」。
- **C1 关键**：`health:"blocked"` 是状态标记 + 提示，**不是 exit2 阻塞**（exit2 on Stop 四重退化，G1 闭合，详见 `docs/superpowers/specs/2026-06-16-block-cap-probe-result.md`）。

---

## 2. trace.ndjson —— 执行轨迹

每行一独立 JSON，追加写（H2 PostToolUse）。痛点3「无 trace」的机制级解——所有工具调用留痕。

### 2.1 行 schema（每行一 JSON）

```jsonc
// 普通动作行（Write/Edit/Bash）
{"ts":"2026-06-16T10:01:00Z","session":"<sid>","direction_version":2,"node":"research","iter":1,"step_index":3,"action":"write","tool":"Write","filesChanged":[".venture/artifacts/v2/01-research.md"],"learnings":["市场A有3个竞品"],"progressHash":"sha256:ab12","progress_delta":0.2,"tokensUsed":15000}

// 推理行（Think，无文件变动，M1）
{"ts":"...","session":"<sid>","direction_version":2,"node":"research","iter":2,"step_index":1,"action":"reasoning","tool":"Think","filesChanged":[],"learnings":[],"reasoning_step":"假设X验证","progressHash":"sha256:cd34","progress_delta":0,"tokensUsed":8000}
```

### 2.2 字段语义

| 字段 | 必填 | 语义 |
|------|------|------|
| `ts` | ✅ | 时间戳（ISO8601） |
| `session` | ✅ | 会话 id |
| `direction_version` | ✅ | 该行写入时的方向版本（INV-4） |
| `node` | ✅ | 流水线节点 |
| `iter` | ✅ | 节点内迭代轮次 |
| `step_index` | ✅ | 本轮内步骤序号（M1 三元组的第三维） |
| `action` | ✅ | `write` / `edit` / `bash` / `reasoning` / `read` |
| `tool` | ✅ | 工具名（Write/Edit/Bash/Think/...） |
| `filesChanged` | ✅ | 变动文件路径数组（可为空） |
| `learnings` | ✅ | 本步学到的事实（可空数组） |
| `progressHash` | ✅ | 进度指纹 |
| `progress_delta` | ✅ | 本步进度增量（0-1） |
| `tokensUsed` | ✅ | 本步 token 消耗 |
| `reasoning_step` | ⬜ | 推理步骤描述（仅 `action:"reasoning"`） |

### 2.3 M1 进度指纹（护栏二，防误判推理节点）

**问题**：若 `progressHash` 基于文件内容 hash，纯推理（Think，无文件变动）会被误判为「停滞」（痛点3 误报）。

**解**：`progressHash` 基于 **`(node, iter, step_index)` 三元组**，非文件 hash。
- 每个新三元组 → 新 hash → `stagnation_count` 不累加。
- 同三元组重复（agent 原地打转）→ hash 不变 → `stagnation_count` 累加。
- `progress_delta` 对推理行可为 0（推理不一定推进进度，但确实在工作）。

---

## 3. direction.json —— 方向指针（单一真相源）

当前方向的唯一指针。痛点4「读旧文件」的核心——H1 读此文件的 `superseded_paths` 拦截旧方向读取。

### 3.1 schema（冻结 v1）

```jsonc
{
  "current_version": 2,
  "current_path": ".venture/artifacts/v2/",
  "current_plan": ".venture/artifacts/v2/03-plan.md",
  "set_at": "2026-06-16T10:30:00Z",
  "set_reason": "用户在 judge 后确认转向市场B",
  "status": "active",                  // "active" | "awaiting_human"  [C1]
  "gate": null,                        // null | "HG1" | "HG2"          [C1]
  "superseded_paths": [                // [痛点4] H1 拦截读这些路径下的文件
    ".venture/artifacts/v1/"
  ],
  "history": [
    { "version": 1, "path": ".venture/artifacts/v1/", "status": "superseded",
      "superseded_by": 2, "superseded_at": "2026-06-16T10:30:00Z",
      "superseded_reason": "用户确认转向市场B" }
  ]
}
```

### 3.2 字段语义

| 字段 | 类型 | 语义 |
|------|------|------|
| `current_version` | number | 当前方向版本（全局递增） |
| `current_path` | string | 当前方向产物根目录 |
| `current_plan` | string \| null | 当前计划文件（待 N3 产出，初始 null） |
| `set_at` | string | 本版本设置时间 |
| `set_reason` | string | 换向理由（boss 决策记录） |
| `status` | enum | [C1] `active` 运行中 / `awaiting_human` 等 boss 决定 |
| `gate` | enum \| null | [C1] 当前停在哪个 human gate（HG1/HG2） |
| `superseded_paths` | string[] | [痛点4] 已废弃方向路径（H1 拦截读） |
| `history` | object[] | 所有历史版本（版本化审计链） |

### 3.3 human gate awaiting（C1 核心）

旧方案靠 Stop exit2 阻塞 agent 等 boss 决定。C1 修订：
- judge 节点结束 → `status:"awaiting_human"`, `gate:"HG2"`。
- H6 SessionStart 注入「⏸️ 等待你对 HG2 的决定（继续/换向/放弃）」。
- agent **自然停等输入**（没有新指令就不推进），不靠 exit2 阻塞。
- boss 决定后 → skill 调 `direction.set` → `status` 回 `active`。

### 3.4 原子写协议（M4，Windows 竞态防护）

**问题**：Windows 上 `fs.writeFile` 直接覆盖正在被读的文件会 EPERM / 读到半写状态。

**解**（M4）：写「临时文件 + `fs.renameSync`」。
```
1. 写 direction.tmp.json（完整内容）
2. fs.renameSync('direction.tmp.json', 'direction.json')  // Node 跨平台 MOVEFILE_REPLACE_EXISTING
```
- rename 是原子操作，读者要么看到旧版要么看到新版，**不会看到半写中间态**。
- H6 读时容忍瞬时缺失：`catch (ENOENT) → 用上次缓存`（rename 极短窗口的兜底）。

---

## 4. tasks.tree.json —— 任务树（与 TaskList 同构）

痛点3「不更新任务记录」的机制级解——H2 每次 PostToolUse 同步此文件，使之与 TaskList 实时一致。

### 4.1 schema（冻结 v1）

```jsonc
{
  "direction_version": 2,
  "updated_at": "2026-06-16T10:05:00Z",
  "tasks": [
    { "id": "T1", "subject": "调研市场A", "status": "completed",
      "node": "research", "blockedBy": [] }
    // status: "pending" | "in_progress" | "completed"
    // 与 TaskList 输出同构（INV-5）
  ]
}
```

### 4.2 字段语义

| 字段 | 语义 |
|------|------|
| `direction_version` | 任务树绑定的方向版本（换向时新建空任务树，INV-1） |
| `updated_at` | 最后同步时间 |
| `tasks[].id` | 任务 id（与 TaskList 对齐） |
| `tasks[].subject` | 任务标题 |
| `tasks[].status` | 状态（同 TaskList） |
| `tasks[].node` | 任务所属节点 |
| `tasks[].blockedBy` | 依赖任务 id 数组 |

### 4.3 同步规则（H2）

- H2 启发式匹配 `tool_input` 到 task subject（如 Write 文件路径含某 task 关键词 → 更新该 task status）。
- 匹配规则：路径子串 / subject 关键词命中（执行阶段细化，60-impl-plan §3.2）。
- 换向（direction version 升）→ 新建空 tasks.tree（旧任务随旧方向作废）。

---

## 5. 接口契约 V1（层2/层3 → 层1）

| 方法 | 输入 | 强制机制（实际写者） | 层2/3 可直接调？ |
|------|------|---------------------|-----------------|
| `checkpoint.write(partial)` | 部分字段 | H4 Stop + H5 PreCompact | 否（由 Hook 触发） |
| `trace.append(entry)` | trace 行 | H2 PostToolUse | 否 |
| `direction.set(newDir)` | {version, reason, supersedePath} | H8 探测 → skill 确认 | **是**（层3 节点经 skill 调） |
| `direction.current()` | — | H6 SessionStart | 是（只读） |
| `state.snapshot()` | — | H6 SessionStart | 是（只读） |

**原则**（方案1 §1.2）：层1 是唯一写者的代理（**实际写 = Hook**），层2/3 只读 + 经 skill 调 `direction.set`。机制上消灭：
- 「agent 记得更新但忘了」（痛点3）—— H2 自动写 trace/tasks/checkpoint
- 「重读旧文件」（痛点4）—— H1 自动拦截 superseded_paths

---

## 6. 不变量（跨文件一致性约束，契约的约束力）

层1 正确性的硬约束。任何 Hook 实现违反不变量 = bug。层3 可依赖这些不变量做路由。

| ID | 不变量 | 校验时机 |
|----|--------|---------|
| **INV-1** | `checkpoint.direction_version` == `direction.current_version` == `tasks.tree.direction_version` | 每次 write 后 |
| **INV-2** | `checkpoint.trace_ref` 指向实际存在的 trace.ndjson | 初始化时定，不变 |
| **INV-3** | `direction.status == "awaiting_human"` ⟹ `checkpoint.health` 应反映 gate 等待（不标 ok 混淆） | direction.set 时 |
| **INV-4** | trace 每行的 `direction_version` == 该行写入时的 `direction.current_version`（换向后新行带新版本） | H2 写每行时 |
| **INV-5** | `tasks.tree.tasks[]` 与 `TaskList` 输出同构（id/status/subject 对齐） | H2 同步后 |
| **INV-6** | `checkpoint.todo_summary` 计数 == tasks.tree 各 status 统计 | H2 同步后 |

> 这些不变量是 M1 冻结的核心交付物之一——它们定义了「状态一致」的精确含义，也是 70-requirements §1（schema 验收）的判据来源。

---

## 7. 版本化与变更协议

### 7.1 文件 schema 版本
- 四文件本身**不带 schema_version 字段**（避免读旧文件时版本不匹配的复杂性）。
- schema 版本由**本文档**（state-schema.md）的 `status: frozen-vN` 承载。
- 升级路径：本文档 minor 新增字段 → 层1/层3 读代码须对缺失字段给默认值（向后兼容）。

### 7.2 direction 版本（业务层）
- `direction.current_version` 是**业务方向**版本，独立于 schema 版本。
- 每次换向 +1，旧版本进 `history`。

### 7.3 变更门
- **minor**（加字段）：本文档更新 + init-state.js 补默认值 + 重跑 70-requirements §1.1/1.2。不阻塞层3。
- **major**（删字段/改语义/改格式）：本文档升 frozen-vN + **全量重跑 70-requirements §1** + 通知层3 重新对齐接口。**阻塞层3 启动**直到层1 重验通过。

---

## 8. 初始化默认值（init-state.js 依据）

首次初始化 `.venture/state/` 四文件时，各字段默认值（init-state.js 严格照此）：

**checkpoint.json**（首版）：
```jsonc
{
  "created_at": "<init 时间>", "trigger": "sessionstart",
  "active_modes": { "venture": "init" },
  "todo_summary": { "pending": 0, "in_progress": 0, "completed": 0 },
  "wisdom_exported": false,
  "background_jobs": { "active": [], "recent": [], "stats": null },
  "current_node": null, "current_task": null,
  "explore_paths": [], "plan_path": null,
  "progress_percent": 0, "iteration": 0, "last_progress_hash": null,
  "direction_version": 1,
  "direction_path": ".venture/state/direction.json",
  "trace_ref": ".venture/state/trace.ndjson",
  "guardrails": { "max_iteration": 10, "no_progress_streak": 0,
                  "budget_tokens_used": 0, "budget_tokens_cap": 500000 },
  "continue_from": null,
  "stagnation_count": 0, "health": "ok"
}
```

**trace.ndjson**：空文件（0 字节，首行由 H2 写）。

**direction.json**（首版）：
```jsonc
{
  "current_version": 1,
  "current_path": ".venture/artifacts/v1/",
  "current_plan": null,
  "set_at": "<init 时间>", "set_reason": "初始化",
  "status": "active", "gate": null,
  "superseded_paths": [], "history": []
}
```

**tasks.tree.json**（首版）：
```jsonc
{
  "direction_version": 1,
  "updated_at": "<init 时间>",
  "tasks": []
}
```
