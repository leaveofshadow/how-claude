---
run: 2026-06-16-venture-automation-architecture
phase: 4
artifact: impl-plan
title: 层1 cc-runtime 实施计划（编排契约）
author: 编排者（research 后定稿）
created: 2026-06-16
status: draft
direction_version: 1
inputs:
  - 50-decision.md（层1 裁决 + C1/C2/M1-M4/G1-G3 条款）
  - 10-plan-1-state-centric.md（四文件 schema 嫁接源 §2.1-2.3）
  - 10-plan-2-hook-driven.md（8 Hook 主导方向）
  - research 实读：compact-snapshot-write.js / compact-snapshot-restore.js / gsd-context-monitor.js / gsd-read-guard.js / settings.json
---

# 60-impl-plan：层1 cc-runtime 实施计划（编排契约）

> **文档性质**：Phase4 层1 的编排契约（schema + Hook + 装配 + 验收），非可执行代码。代码骨架在 §3/§9 给关键片段（C2 要求附真实脚本范式）。完整脚本与保姆级验收在执行阶段产出，本文件是「写什么 + 怎么落地 + 如何验证」的合同。

---

## 0. 范围 · 事实锚 · 前置

### 0.1 范围（仅层1）
- **做**：四文件 state schema（嫁接方案1 §2.1-2.3）+ Hook 写入层（方案2 主导，C1/C2 修订）+ 装配协议（G3）+ 前置实验（G1）+ 失效告警（G2）。
- **不做**：层2 工作流引擎、层3 cc-venture 流水线、venture-judge-extractor、hcc-org 部门协议（均延后，见 50-decision §3/§3.5）。
- **解的痛点**：痛点3（执行不更新任务记录/无 checkpoint/无 trace）+ 痛点4（方向切换仍读旧文件）。

### 0.2 事实锚（research 已读，禁止虚构）
| 事实源 | 已读内容 | 用途 |
|--------|---------|------|
| `compact-snapshot-write.js` | 4 块提取 + stdin 10s 超时 + session_id 防护 + exit0 放行 + `.disable` 开关 + prune 最旧 | H5/H7/H8 新 hook 的**安全骨架模板** |
| `compact-snapshot-restore.js` | `source==='compact'` 门控 + `hookSpecificOutput.additionalContext` 注入 + 去 YAML frontmatter | H6 SessionStart 注入范式 |
| `gsd-context-monitor.js` | 读 `/tmp/claude-ctx-{session_id}.json` + 35%/25% 阈值 + debounce 5 + additionalContext 注入 | **正交性证据**：gsd=上下文健康，非 checkpoint/trace |
| `gsd-read-guard.js` | PreToolUse Write\|Edit + advisory 注入（不 exit2）+ 仅目标文件已存在时 | **正交性证据**：gsd=read-first 建议，非方向拦截 |
| `settings.json` 钩子阵列 | 各事件现有 hook 数 + matcher（见 §1.1） | **G3 matcher 叠加约束**的唯一依据 |

### 0.3 前置 gate（50-decision §1.6，本 plan 逐条回应）
`[x]C1` §4 ｜ `[x]C2` §4+§9 ｜ `[ ]G1` §6（实验设计）｜ `[ ]M2` §5 ｜ `[ ]G2` §7 ｜ `[ ]G3` §8。

---

## 1. 与现有基础设施的边界（G3 前置：matcher 叠加 + 正交 + 复用）

### 1.1 matcher 叠加核算（性能硬约束，research 实测）

每事件 hook 数（cc-runtime 落地前 → 后）：

```
事件                   现有 hook                                          +cc-runtime   写延迟增量(Win Node冷启)
─────────────────────────────────────────────────────────────────────────────────────────────────────────
PreToolUse  Read       (无)                                               +H1           ~80ms ★痛点4
PreToolUse  Write|Edit gsd-prompt-guard + gsd-read-guard + gsd-workflow-guard  +0          (H1 只 Read，不碰 Write|Edit)
PostToolUse Write|Edit gsd-context-monitor + gsd-phase-boundary              +H2(合并H3)  ~80ms ★痛点3
Stop                   wechat-notify                                      +H4          ~80ms
PreCompact            compact-snapshot-write                              +H5          ~80ms
SessionStart(compact) compact-snapshot-restore + gsd-check-update + gsd-session-state  +H6  ~80ms
SubagentStop           (无)                                               +H7          ~80ms ★G4
UserPromptSubmit       (无)                                               +H8          ~80ms ★方向探测
```

**结论**：matcher 叠加**最热点 = PostToolUse Write|Edit**（落地后 3 个 hook）。每次写文件多 ~80ms×3 Node 冷启动。这是 G3 装配协议必须优化的点（§8 给合并/惰性方案）。其余事件增量 ≤1，可接受。

> **对裁决 8 Hook 的工程收敛（基于 §1.1 事实）**：裁决 §1.1 列 H2/H3 两个 PostToolUse hook。research 表明 PostToolUse Write|Edit 已 2 个 hook（gsd），再加 2 会变 4 个——写延迟翻倍。**收敛：H2/H3 合并为单一 `cc-runtime-progress.js`**（一个脚本同时写 trace + 同步 tasks.tree + 更新 checkpoint 进度，§3.2）。8 Hook → 7 Hook，功能不减，matcher 叠加受控。理由记入风险登记。

### 1.2 gsd 正交性定论（research 已证实）
- **gsd ≠ 层1**：grep gsd-* 全目录，**零命中** checkpoint/direction/trace/stagnation。gsd 是 GSD 工作流框架（phase boundary / context monitor / read-guard / workflow-guard / commit-validate），管「GSD 流程合规 + 上下文健康 + read 循环防护」，**不管断点续传**。
- **共存模型**：gsd 管「harness 在跑什么 GSD 阶段 + 上下文还剩多少」，cc-runtime 管「业务做到哪 + 方向是啥 + trace 留了什么」。两套并行，**功能无重叠**，但 matcher 物理叠加（§1.1）——这是**唯一**的真实约束，由 G3（§8）解决。

### 1.3 复用 vs 新建（H5/H6 范式收窄定论）
裁决 C2 说「H5/H6 在现有 compact-snapshot 钩子上扩展」。research 后**精细化**：
- **不合并进 compact-snapshot 脚本**。理由：compact-snapshot 是**通用** compact 恢复（所有项目受益，输出 `.claude/compact-snapshots/`），cc-runtime checkpoint 是 **venture 业务**断点（输出 `.venture/state/`）。合并污染通用性，违反单一真相源（方案1 §2.6 隔离为主）。
- **范式复用（C2 的真实含义）**：H5/H6 是**独立新 hook**，但骨架拷贝 compact-snapshot 的安全防护（stdin 超时 / session_id 防护 / exit0 / `.disable` 开关 / prune）。C2「附真实脚本片段」= §9 给这些骨架的真实来源片段。

> 这是编排者对裁决 C2 的解释性收敛（不改裁决方向，只明确「扩展」=范式复用≠代码合并），记入风险登记 R7 供 reviewer 核验。

---

## 2. 四文件 state schema（契约，嫁接方案1 §2.1-2.3 + C1 修订）

> 存储根：`.venture/state/`（方案1 §2.6 隔离为主，不写回 `.omc/`）。所有 schema 字段来自方案1 §2.1-2.3 实读，C1 修订字段标注 `[C1]`。

### 2.1 checkpoint.json（autopilot 兼容 + venture 扩展 + C1 修订）
```jsonc
{
  // === autopilot 原字段（保留，零迁移） ===
  "created_at": "2026-06-16T10:00:00Z",
  "trigger": "stop" | "precompact" | "sessionstart",
  "active_modes": { "autopilot": "execution", "venture": "node:judge" },
  "todo_summary": { "pending": 3, "in_progress": 1, "completed": 4 },
  "wisdom_exported": false,
  "background_jobs": { "active": [], "recent": [], "stats": null },

  // === venture 扩展（方案1 §2.1，痛点3 补丁） ===
  "current_node": "judge",
  "current_task": "评判卡生成 v2",
  "explore_paths": [".venture/artifacts/v2/01-research.md", ".venture/artifacts/v2/02-competitor.md"],
  "plan_path": ".venture/artifacts/v2/03-plan.md",
  "progress_percent": 37,
  "iteration": 5,
  "last_progress_hash": "sha256:ab12cd",   // 护栏二指纹（M1：基于 node+iter+step 三元组，非文件 hash）
  "direction_version": 2,
  "direction_path": ".venture/state/direction.json",
  "trace_ref": ".venture/state/trace.ndjson",
  "guardrails": {
    "max_iteration": 10,
    "no_progress_streak": 0,                // 连续 N 次同 hash → BLOCKED（C1：标在 checkpoint，非 exit2）
    "budget_tokens_used": 125000,
    "budget_tokens_cap": 500000
  },
  "continue_from": "node:judge,task:评判卡生成 v2,iter:5",

  // === C1 修订新增（痛点3 兜底迁 PreCompact + human gate awaiting） ===
  "stagnation_count": 0,                    // [C1] 连续无进展轮次，H5 累加，≥阈值标 BLOCKED
  "health": "ok" | "stagnant_warn" | "blocked"  // [C1] H5/H4 写，H6 读后注入提示
}
```

### 2.2 trace.ndjson（每行一 JSON，追加写，方案1 §2.2）
```jsonc
{"ts":"2026-06-16T10:01:00Z","session":"<sid>","direction_version":2,"node":"research","iter":1,"step_index":3,"action":"write","tool":"Write","filesChanged":[".venture/artifacts/v2/01-research.md"],"learnings":["市场A有3个竞品"],"progressHash":"sha256:ab12","progress_delta":0.2,"tokensUsed":15000}
{"ts":"...","node":"research","iter":2,"action":"reasoning","tool":"Think","filesChanged":[],"learnings":[],"reasoning_step":"假设X验证","progressHash":"sha256:ab12","progress_delta":0}
//  ↑ M1：新增 reasoning_step 类型 + step_index，推理节点无文件变动不算 stagnation
```

### 2.3 direction.json（方案1 §2.3 单一指针 + C1 awaiting 字段）
```jsonc
{
  "current_version": 2,
  "current_path": ".venture/artifacts/v2/",
  "current_plan": ".venture/artifacts/v2/03-plan.md",
  "set_at": "2026-06-16T10:30:00Z",
  "set_reason": "用户在 judge 后确认转向市场B",
  "status": "active" | "awaiting_human",     // [C1] awaiting_human 时 H6 注入「等待 continue」
  "gate": null | "HG1" | "HG2",              // [C1] 标记当前停在哪个 human gate
  "superseded_paths": [],                    // [痛点4] H1 拦截读这些路径下的文件（H1 读此字段）
  "history": [
    { "version": 1, "path": ".venture/artifacts/v1/", "status": "superseded",
      "superseded_by": 2, "superseded_at": "...", "superseded_reason": "..." }
  ]
}
```
**原子性**（方案1 §2.3 + M4）：写临时文件 + rename。Windows 用 `fs.renameSync`（Node 跨平台封装 MOVEFILE_REPLACE_EXISTING）。M4 竞态缓解见 §5。

### 2.4 tasks.tree.json（方案1 §2.1 反向引用，最小 schema）
方案1 未详述，本 plan 补最小契约（TaskList 序列化 + direction 绑定）：
```jsonc
{
  "direction_version": 2,
  "updated_at": "...",
  "tasks": [
    { "id": "T1", "subject": "调研市场A", "status": "completed",
      "node": "research", "blockedBy": [] }
    // ... status: pending|in_progress|completed；与 TaskList 同构
  ]
}
```
H2/H3 合并 hook（§3.2）每次 PostToolUse 后同步此文件——这是**痛点3「不更新任务记录」的机制级解**。

### 2.5 接口契约 V1（层2/层3 → 层1，方案1 §1.2）
| 方法 | 输入 | 强制机制 |
|------|------|---------|
| `checkpoint.write(partial)` | 部分字段 | H4 Stop + H5 PreCompact |
| `trace.append(entry)` | trace 行 | H2 PostToolUse |
| `direction.set(newDir)` | {version,reason,supersedePath} | H8 探测 → skill 确认 |
| `direction.current()` | — | H6 SessionStart 注入 |
| `state.snapshot()` | — | H6 SessionStart |

**原则**（方案1 §1.2）：层1 是唯一写者的代理（实际写=Hook），层2/3 只读。机制上消灭「agent 记得更新但忘了」（痛点3）+「重读旧文件」（痛点4）。

---

## 3. 七 Hook 落地形态（H2/H3 合并，基于 research 修订）

> 全部 Hook 遵守六原则（方案2 §3.1）：①静默 exit0 ②stdin 10s 超时 ③session_id 防护 ④字段结构 try/catch ⑤additionalContext 注入 ⑥纯 Node fs（C2 补：禁任何 SDK 子进程）。

### 3.1 H1 — PreToolUse Read（新建，痛点4 机制级拦截）
- **matcher**：`Read`（research 实测：当前 Read **无** PreToolUse hook，新增零叠加）。
- **机制**：读 `direction.json` 的 `superseded_paths[]`；若 Read 目标 file_path 命中 → 注入 additionalContext「⚠️ 此文件属于已废弃方向 v{N}，当前有效方向 v{M}（{current_plan}）。请改读当前方向产物。」**不 exit2**（C1：不用 block）。
- **Bash 兜底**（M2）：H1 拦不住 Bash 读旧文件，由 H6 SessionStart 方向提示纠偏。
- **世界最好维度**（P3）：方向切换后零误读——做到「换方向即换源」的最强一维。

### 3.2 H2/H3 合并 — PostToolUse Write|Edit|Bash（cc-runtime-progress.js，痛点3）
- **matcher**：`Write|Edit|MultiEdit|Bash`（与 gsd-context-monitor 同 matcher，叠加变 3 hook，§1.1 热点）。
- **机制（一个脚本三件事）**：
  1. `trace.append`：解析 tool_input 的 file_path/old_string/new_string/content → 写 trace.ndjson 行（§2.2）。
  2. 同步 `tasks.tree.json`：启发式匹配 tool_input 到 task subject → 更新 status。
  3. 增量更新 `checkpoint.json`：progress_percent / iteration / last_progress_hash（M1 三元组）/ tokensUsed 累加。
- **无 exit**（PostToolUse 已完成，exit 无意义；只写文件）。
- **M2 MCP 补全**：matcher 显式加已知 MCP 文件工具名（`mcp__*__write`/`edit` 等实跑后补全清单）。
- **性能优化**（G3）：脚本启动检查 `.venture/state/` 是否存在，不存在（非 venture 项目）立即 exit0，零成本。

### 3.3 H4 — Stop（追加 wechat-notify，C1 降级为尽力提示闸）
- **matcher**：无 matcher（Stop 全局）。
- **机制**：写 `checkpoint.write({trigger:"stop"})`；查 tasks.tree.json 有 pending → **注入 additionalContext 提示**「⚠️ 还有 {N} 个 pending 任务：{list}。若确需停止请明确说明。」**不 exit2**（C1 三重退化：block cap / UI 误显示 / 偶发无视——Stop 不当确定性闸）。
- **C1 联动**：连续 M 轮（H4 计数）Stop 时仍 pending → 在 checkpoint 标 `health:"blocked"`，H6 SessionStart 注入强提示。
- **M 阈值**：保守取 3（方案2 §4 采纳，非 1 轮，避免误阻塞烦用户）。

### 3.4 H5 — PreCompact（独立新 hook，范式复用 compact-snapshot-write）
- **matcher**：无 matcher（PreCompact 全局，现仅 compact-snapshot-write 1 个，+1 可接受）。
- **机制**：①全量快照 checkpoint（含 continue_from）②计算 stagnation：对比 trace 尾部 progressHash 与上次 checkpoint → 累加 `stagnation_count`；≥阈值标 `health:"stagnant_warn"`/`"blocked"`。③**永远 exit0 放行**（compact-snapshot-write.js 原注释：「绝不阻塞 compact，exit2 会导致请求失败」）。
- **C1 核心**：痛点3 兜底从 Stop 迁到此处——exit0 无 block cap，确定性强于 Stop exit2。

### 3.5 H6 — SessionStart source=compact（独立新 hook，范式复用 compact-snapshot-restore）
- **门控**：`data.source !== 'compact'` 立即 exit0（compact-snapshot-restore.js 范式：仅 compact 后注入，非 initial/resume/clear）。
- **机制**：读 state.snapshot() → `hookSpecificOutput.additionalContext` 注入（compact-snapshot-restore 范式）：
  ```
  【层1 断点续传】
  当前方向：v{M} {current_plan}（{set_reason}）
  续跑锚点：{continue_from}
  最近 trace：{最近 10 条摘要}
  健康状态：{health} {若 blocked：⚠️ 连续 {stagnation_count} 轮无进展，需人工介入或换向}
  {若 status==awaiting_human：⏸️ 等待你对 {gate} 的决定（继续/换向/放弃）}
  ```
- **世界最好维度**（P3）：compact 后一行恢复——做到「跨压缩零状态丢失」的最强一维。

### 3.6 H7 — SubagentStop（新建，G4 方向注入）
- **matcher**：无 matcher（SubagentStop 现无 hook，全新）。
- **机制**：subagent 返回前注入 direction 版本 + VENTURE_TRACE_FILE 路径提示，确保 subagent 读对方向、写对 trace（M3：委派 subagent 时用 `VENTURE_TRACE_FILE` 环境变量指定落点，省跨目录回收）。

### 3.7 H8 — UserPromptSubmit（新建，方向变更探测）
- **matcher**：无 matcher（UserPromptSubmit 现无 hook，全新）。
- **机制**：轻量关键词扫描（「换方向/重来/转向/推翻」）→ 命中时注入 additionalContext「检测到方向变更意图，建议先 `direction.set` 再继续，避免读旧文件（痛点4）。当前方向 v{M}。」**advisory，不阻塞**。
- **去抖**（M2 类比 gsd debounce 5）：连续命中只在首次提示，避免烦用户。

---

## 4. C1 / C2 修订落地（50-decision §1.3-1.4）

### 4.1 C1（exit2 三重退化 → 去阻塞化）
| 原方案2 | C1 修订落地（本 plan） |
|---------|---------------------|
| H4 Stop exit2 阻塞过早停 | H4 改 additionalContext 提示（§3.3），exit0 |
| 痛点3 兜底靠 Stop exit2 | 兜底迁 H5 PreCompact 标 `health:"blocked"`（§3.4），exit0 |
| human gate 靠 Stop exit2 阻塞 | 改 direction.json `status:"awaiting_human"` + H6 注入（§3.5），agent 自然停等输入 |

**净效果**：层1 全链路**零 exit2**，彻底规避 block cap / UI 误显示 / 偶发无视三重退化。确定性靠「状态文件 + SessionStart 注入」而非「阻塞」。

### 4.2 C2（compact-snapshot 范式收窄）
- **范式定位**（收窄）：H5/H6 的安全骨架（§9）= compact-snapshot 范式样板；H1/H2/H4/H7/H8 独立设计 + 独立验证（每 hook 单测）。
- **成本重估**：2 范式复用（H5/H6 各 ~1 轮）+ 5 独立新建（各 3-4 轮含调试）≈ **21-22 轮**（H2/H3 合并省 1 个，比裁决 26 轮再省）。
- **真实脚本片段**：见 §9。
- **纯 Node fs 约束**：所有 hook `require('fs')` + `require('path')` only，禁 SDK 子进程（compact-snapshot-write.js 验证可行）。

---

## 5. M1-M4 缓解落地（50-decision §1.5）

| ID | 缓解 | 落地点 |
|----|------|--------|
| **M1** progressHash 误判推理节点 | 基于 `(node, iter, step_index)` 三元组，非文件 hash；trace 增 `reasoning_step` 类型 | §2.2 trace 字段 + §3.2 hash 计算 |
| **M2** matcher 漏配 MCP + Bash 绕过 | H2 matcher 加 MCP 文件工具名（实跑补全）；Bash 读旧文件由 H6 方向提示兜底 | §3.2 + §3.1 Bash 兜底 |
| **M3** 三套 state 并存 | subagent 用 `VENTURE_TRACE_FILE` 环境变量指定 trace 落点 | §3.6 H7 |
| **M4** Windows rename 竞态 | direction 写「临时文件 + `fs.renameSync`」（Node 跨平台 REPLACE_EXISTING）；H6 读时容忍瞬时缺失（catch ENOENT → 用上次缓存） | §2.3 + §3.5 |

---

## 6. G1 前置实验设计（block cap 阈值实测，Phase4 第一任务）

> **目的**：C1 已让层1 零 exit2，但 G1 仍需实测——验证「确实不需要 exit2」+ 为未来其他场景（如层3 流水线硬停）标定 cap。

### 6.1 实验步骤
1. **造测试 Stop hook**：`~/.claude/hooks/_g1-block-cap-probe.js`，逻辑 = 读计数文件，<N 时 exit2 + additionalContext，≥N 时 exit0。
2. **隔离运行**：临时 settings（`_g1-probe-settings.json`）只挂此 hook，禁用其余（避免污染）。
3. **递增 N**：N=1,2,3... 跑同一「故意未完成的任务」，观察 harness 行为：第几次出现 (a) rate-limit 日志 (b) hook 被忽略 (c) 正常放行。
4. **记录**：cap 阈值 T_block + 退化形态（三重退化哪一种先现）。

### 6.2 判据
- **若 T_block ≥ 5**：exit2 在层1 备用可行（但 C1 已选不依赖，记录备用）。
- **若 T_block < 3**：坐实 C1 决策正确（exit2 不可靠），层1 永不用 exit2。
- **产出**：`docs/superpowers/specs/2026-06-16-block-cap-probe-result.md`（实测数据 + 结论）。

### 6.3 通过标准
G1 实验完成 = 记录到 T_block + 退化形态 + 结论写入 70-requirements §验收。**阻塞**层1 其它 hook 实施吗？**不阻塞**——C1 已让层1 不依赖 exit2，G1 是「验证+标定」非「门禁」。但列为第一任务（最快获取事实）。

---

## 7. G2 失效降级告警（hook 静默失效无感）

> compact-snapshot/gsd 都「静默 exit0」——hook 崩了无人知。G2 补可观测性。

### 7.1 机制
- 每个 hook catch 块写一行错误到 `.venture/state/hook-health.ndjson`：`{ts,hook,error}`。
- **连续 N=3 次**同 hook 错误 → H6 SessionStart 注入告警「⚠️ {hook} 连续 {N} 次失败（{error}），层1 状态可能不准。检查脚本或临时 `.disable`。」
- **微信通知**（复用现有 wechat hook 范式）：连续失败达阈值 push 一次（不刷屏，复用 wechat-notify 机制）。

### 7.2 设计约束
- 告警自身不能崩——hook-health.ndjson 写失败也静默（双层 try/catch）。
- 不阻塞主流程（告警永远是 additionalContext / push，非 exit2）。

---

## 8. G3 装配协议（技能 → settings.json，matcher 叠加优化）

> 核心问题：cc-runtime 是「教配方的技能」还是「常驻 hook」？charter 身份张力定论（50-decision §3）= **技能教配方，hook 由装配落地，技能不常驻**。

### 8.1 三态装配协议
```
态1【诊断】  用户/agent 触发 cc-runtime skill → SKILL.md 诊断（长会话丢状态？读错方向？）
              → 给「配方」（该挂哪些 hook + schema 初始化命令）
态2【装配】  agent 按 cc-runtime/references/hook-templates/ 拷贝脚本到 ~/.claude/hooks/
              + 在 settings.json 追加 hook 条目（合并 matcher，不覆盖现有）
              + 初始化 .venture/state/ 四文件
态3【运行】  hook 常驻 settings.json 驱动；cc-runtime skill 完成装配后可卸载（不常驻上下文）
态4【卸载】  项目结束 → 从 settings.json 移除 cc-runtime 条目（保留 .venture/state/ 作存档）
```

### 8.2 matcher 叠加优化（§1.1 热点）
- **PostToolUse Write|Edit 合并**：cc-runtime 不新增独立 PostToolUse hook 叠在 gsd 上，而是**评估能否合并进 gsd-context-monitor**？**否**（隔离边界，方案1 §2.6）。保持独立 H2，但脚本内做「非 venture 项目早退」（§3.2）→ 非 venture 零成本。
- **装配时清单**：G3 协议要求装配后输出「matcher 叠加核算表」（复用 §1.1），让 boss 一眼看到落了几个 hook、热点在哪（P1 最懒 + P2 重编码成可读面板）。

### 8.3 settings.json 落地（装配产物示例，非本 plan 直接写）
```jsonc
// 装配时追加到现有 settings.json（不覆盖现有 gsd/compact-snapshot/wechat 条目）
{
  "PreToolUse":  [{ "matcher": "Read", "hooks": [{ "type":"command","command":"node ~/.claude/hooks/cc-runtime-direction-guard.js" }] }],
  "PostToolUse": [{ "matcher": "Write|Edit|MultiEdit|Bash", "hooks": [{ ...,"command":"node ~/.claude/hooks/cc-runtime-progress.js" }] }],
  "Stop":        [{ "hooks": [{ ...,"command":"node ~/.claude/hooks/cc-runtime-stop-check.js" }] }],
  "PreCompact":  [{ "hooks": [{ ...,"command":"node ~/.claude/hooks/cc-runtime-snapshot.js" }] }],
  "SessionStart":[{ "source":"compact", "hooks": [{ ...,"command":"node ~/.claude/hooks/cc-runtime-resume.js" }] }],
  "SubagentStop":[{ "hooks": [{ ...,"command":"node ~/.claude/hooks/cc-runtime-subagent-direction.js" }] }],
  "UserPromptSubmit":[{ "hooks": [{ ...,"command":"node ~/.claude/hooks/cc-runtime-direction-probe.js" }] }]
}
```
> **注意**：实际装配**合并进现有 matcher 数组**（如 PostToolUse 已有 gsd 条目，追加而非新建数组）。本 plan 不直接改 settings.json——装配由 cc-runtime skill 在态2 执行（G3 协议）。直接改 settings.json 属「重大改动」，需 boss 确认（用户偏好）。

---

## 9. 安全防护范式（C2 真实脚本片段，拷贝自 compact-snapshot-write.js）

> H5/H7/H8 新 hook 的骨架——以下片段实读自 `compact-snapshot-write.js`，是 C2「附真实脚本片段」的兑现。

```js
// 片段1：stdin 10s 超时守卫 + JSON 解析（所有 hook 必备）
let raw = '';
const timeout = setTimeout(() => process.exit(0), 10000);  // 永远 exit0 放行
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => {
  clearTimeout(timeout);
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }   // 字段结构识别 try/catch
  main(data);
});

// 片段2：session_id 路径遍历防护（H5/H6 写文件按 session_id 分目录时必备）
const sid = data.session_id || '';
if (/[/\\]|\.\./.test(sid)) process.exit(0);   // 拒绝路径分隔符/.. 遍历

// 片段3：.disable 开关 + 静默失败（hook 可被项目临时禁用）
const cwd = data.cwd || process.cwd();
if (fs.existsSync(path.join(cwd, '.venture', 'hooks.disable'))) process.exit(0);
try { /* 业务逻辑 */ } catch (e) { /* G2: 写 hook-health.ndjson */ } finally { process.exit(0); }

// 片段4：SessionStart 注入范式（拷贝自 compact-snapshot-restore.js）
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: '【层1 断点续传】\n' + clean   // 去 YAML frontmatter 后注入
  }
}));
```

---

## 10. 实施顺序 · 里程碑（原子步骤）

```
M0  G1 前置实验（§6）           [1-2 轮]  产出 block-cap-probe-result.md
M1  schema 冻结（§2 四文件）     [1 轮]    .venture/state/ 初始化脚本 + schema 文档
M2  H5/H6 范式 hook（§3.4-3.5） [2 轮]    痛点3 兜底 + compact 恢复，最先见效
M3  H2 进度 hook（§3.2）        [3-4 轮]  痛点3 核心（trace + tasks + checkpoint）
M4  H1 方向守卫（§3.1）         [2-3 轮]  痛点4 机制级拦截
M5  H4 Stop 提示（§3.3）        [1-2 轮]  C1 降级版
M6  H7/H8 辅助（§3.6-3.7）      [2-3 轮]  G4 方向注入 + 变更探测
M7  G2 健康告警（§7）           [1-2 轮]  可观测性
M8  G3 装配协议（§8）           [2-3 轮]  cc-runtime skill SKILL.md + hook-templates/
M9  70-requirements 验收（§13） [1 轮]    保姆级验收 + 长会话实战
────────────────────────────────────────
合计 ≈ 16-22 轮（与 C2 重估 21-22 轮一致；M0 不阻塞可并行）
```

**里程碑验收门**：M2 后 = compact 不丢状态（痛点3 之一解）；M4 后 = 方向切换不读旧（痛点4 解）；M9 后 = 层1 全可用。

---

## 11. 共存矩阵（compact-snapshot / gsd / cc-runtime）

| 维度 | compact-snapshot | gsd-* | cc-runtime |
|------|------------------|-------|------------|
| 职责 | 通用 compact 恢复 | GSD 流程合规 + 上下文健康 | venture 业务断点续传 |
| 状态位置 | `.claude/compact-snapshots/` | `.omc/state/` + `/tmp/claude-ctx-*.json` | `.venture/state/` |
| 写 OMC？ | 否 | 是（自家） | 否（隔离，方案1 §2.6） |
| 读 OMC？ | 否 | 是 | 可读（环境感知，不写） |
| matcher 叠加点 | PreCompact(1) + SessionStart(1) | 全事件 | 见 §1.1 |
| 失效影响 | compact 后无快照 | GSD 流程/上下文告警失灵 | 痛点3/4 复现 |

**冲突点**：无功能冲突（正交）。唯一共担 = matcher 物理叠加（§1.1），由 G3（§8）装配清单透明化。

---

## 12. 世界最好维度标注（charter P3）

| 产出 | 力求世界最好的一维 |
|------|------------------|
| H6 SessionStart 恢复 | 「跨压缩零状态丢失」——一行续跑锚点恢复全部上下文 |
| H1 方向守卫 | 「换方向即换源」——机制级消灭误读旧文件 |
| direction.json 原子切换 | 「方向切换零竞态」——临时文件+rename，Windows 兼容 |
| G3 装配清单（§8.2） | 「boss 一眼看穿 hook 叠加」——matcher 核算面板 |

---

## 13. 验收标准（→ 70-requirements 详化）

层1 ACCEPT = 以下全部通过（保姆级用例在 70-requirements）：

- [ ] **G1**：block cap 实测记录到 T_block + 退化形态（§6）
- [ ] **痛点3 解**：长会话（触发 compact）后，checkpoint/trace 完整，SessionStart 一行恢复续跑点
- [ ] **痛点4 解**：direction 切 v2 后，Read v1 文件被 H1 注入废弃提示；agent 改读 v2
- [ ] **C1**：层1 全链路零 exit2，Stop/PreCompact 均 exit0 放行
- [ ] **C2**：H5/H6 用 compact-snapshot 范式骨架；H1/H2/H4/H7/H8 各有独立单测
- [ ] **M1-M4**：trace reasoning_step 不误判停滞；Bash 读旧有 H6 兜底；VENTURE_TRACE_FILE 指定落点；Windows rename 无竞态
- [ ] **G2**：hook 连续失败 3 次触发告警（SessionStart + 微信）
- [ ] **G3**：cc-runtime skill 走完诊断→装配→运行三态；settings.json matcher 叠加清单产出
- [ ] **收益指向**（charter 阶段标准）：层1 落地后，层3 流水线的 pause/resume/方向切换基础设施齐备——回答「这如何指向收益」= 解锁 venture 流水线跑出可变现方向的能力
- [ ] **性能**：PostToolUse Write|Edit 热点（3 hook）写延迟增量 < 300ms（§1.1 实测验收）

---

## 风险登记（本 plan 新增/修订）

| ID | 风险 | 等级 | 缓解 |
|----|------|------|------|
| R7 | H5/H6「扩展」解释为范式复用≠代码合并（§1.3）——与裁决 C2 字面「扩展」有张力 | 中 | reviewer 核验；若要求字面合并，成本+1 轮但污染通用性 |
| R8 | H2/H3 合并为单 hook（8→7）偏离裁决字面 8 Hook | 低 | 功能不减，matcher 叠加受控；记入供裁决者确认 |
| R9 | tasks.tree.json schema 方案1 未详述，本 plan 补最小契约（§2.4）| 低 | 执行阶段与 TaskList 同构验证 |
| R10 | Windows Node 冷启 ~80ms/hook 为估算，未实测 | 中 | M2 后实测 PostToolUse 热点延迟，超 300ms 则评估合并 gsd |

（R1-R6 见 50-decision §5，不重复）
