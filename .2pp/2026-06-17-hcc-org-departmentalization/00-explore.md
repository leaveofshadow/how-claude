# 00-explore.md —— hcc-org 部门化 2pp Phase 0a 内部探索

> 生成日期：2026-06-17 · 来源：Explore agent(haiku) 只读扫描 how-claude 项目 `.claude/skills/` 全部 SKILL.md + 层1 cc-runtime + 层2 venture-pipeline 接口契约 + charter 组织架构。编排者落盘。

---

## 一、技能清单

项目根 `.claude/skills/` 下共 **11 个技能目录**（8 方法论 + 1 路由器 + 层1 cc-runtime + 层2 venture-pipeline）。

| 技能 | name (frontmatter) | 触发词（正文「触发条件」） | 核心职责（一句话） | 对外接口（脚本/命令/状态文件） | 路由器? |
|------|-------------------|--------------------------|-------------------|------------------------------|--------|
| **cc-2pp** | `cc-2pp` | `2pp`/`两阶段`/`两步`/`复杂设计`/`重度设计`/`对抗设计`/`判官小组`/`judge panel`/`对抗验证` | 充分探索→多方案生成→对抗验证→裁决输出→实施计划（设计决策加速器） | 工作产物落盘到 `.2pp/{YYYY-MM-DD}-{slug}/`（00-explore / 10-plan / 20-attack / 30-score / 40-synthesis / 50-decision / 60-impl-plan / 70-requirements）；视角库 `references/2pp-guide.md`；动态视角目录 `agents-custom/` | ❌ |
| **cc-config** | `cc-config` | `CLAUDE.md`/`rules`/`规则`/`指令`/`不听话`/`不遵守`/`hooks`/`agents`/`settings`/`配置`/`优化配置`/`权限` | 配置系统专家：六层配置体系选择 + CLAUDE.md 诊断 | 读 settings.json / CLAUDE.md；深度参考 `references/config-systems-guide.md` | ❌ |
| **cc-context** | `cc-context` | `上下文太长`/`compact`/`clear`/`记忆丢失`/`上下文`/`持久化`/`context`/`窗口`/`token`/`压缩` | 上下文管理专家：防溢出/防遗忘/防冲刷 + 持久化策略 | 深度参考 `references/context-health-guide.md` | ❌ |
| **cc-goal** | `cc-goal` | `goal`/`目标`/`任务描述`/`需求描述`/`怎么描述需求`/`目标不清晰`/`需求模糊`/`终态条件`/`end state`/`goal condition`/`/goal` | 终态条件设计专家：把模糊需求变成 L4 自验证 /goal 条件（Detect→Elevate→Critique→Output） | 输出可粘贴 `/goal` 条件；深度参考 `references/goal-guide.md` | ❌ |
| **cc-loop** | `cc-loop` | `loop`/`循环`/`自动化`/`定时`/`监控`/`轮询`/`定期`/`CronCreate`/`ScheduleWakeup`/`提醒`/`定时任务`/`loop engineering`/`循环工程`/`设计循环`/`ralph`/`babysit`/`循环合同`/`护栏` | Loop Engineering 核心课：从 prompter 变 loop designer（五阶段演进 + worktree SOP + 循环合同 6 问 + 护栏三件套） | 深度参考 `references/loop-guide.md`；与 CronCreate/ScheduleWakeup 原生能力衔接 | ❌ |
| **cc-memory** | `cc-memory` | `审查记忆`/`记忆审查`/`记忆太多`/`记忆混乱`/`记忆优化`/`三层记忆`/`notepad`/`memory`/`记忆管理`/`记住`/`遗忘` | 记忆系统审查专家：五层记忆系统（内置文件/OMC Notepad/OMC Project Memory/claude-mem/Remember）健康审查 + 清理 | 调用 `notepad_read`/`notepad_stats`/`project_memory_read` 工具；读 `.remember/`；深度参考 `references/memory-review-guide.md` | ❌ |
| **cc-orchestration** | `cc-orchestration` | `subagent`/`workflow`/`多agent`/`编排`/`并行`/`team`/`团队`/`Agent`/`协调`/`分工` | 编排决策专家：subagent/workflow/team 三模式决策树 + 多 Agent 协作架构 | 深度参考 `references/orchestration-guide.md` | ❌ |
| **cc-scanner** | `cc-scanner` | `审查技能`/`推荐技能`/`技能组合`/`我要做`/`工作流`/`开发流程`/`技能推荐`/`技能审查`/`scan`/`知识库` | 技能知识库管理：6 源扫描（个人/项目/官方/CLI/OMC/自定义）+ 场景推荐 + 更新检测 | 产出 `.claude/skills-kb.json` + `.claude/skills-kb.md`；`bunx skills ls --json` / `bunx skills check`；读 installed_plugins.json；深度参考 `references/scanner-guide.md` | ❌ |
| **claude-coach** | `claude-coach` | `最佳实践`/`怎么让Claude更好`/`不知道`/`不确定`/`帮我选`/或用户表达挫败 | **路由器**：诊断用户问题，路由到 8 个专业子技能（不自己做实质工作） | 路由表（SKILL.md 正文）；子技能索引；无独立脚本 | ✅ **是** |
| **cc-runtime** | `cc-runtime` | frontmatter description 含「层1 cc-runtime 状态运行时教练」+ 痛点3/4；正文无独立「触发条件」段（定位为层1 地基工具，被层3 和 charter 协议层调用） | **运维部核心工具**：层1 状态运行时地基，解决痛点3（不更新任务记录/compact 失忆）+ 痛点4（换向后读旧文件） | 脚本 `scripts/init-state.js`（初始化四文件，幂等 + `--force`）+ `scripts/shift-direction.js`（换向 + 归档，`--reason`/`--to`/`--dry-run`）+ `scripts/compact-snapshot-e2e.test.js`；状态契约 `references/state-schema.md`（frozen-v1）；产出 `.venture/state/{checkpoint.json, direction.json, trace.ndjson, tasks.tree.json}`；全局 hook `~/.claude/hooks/compact-snapshot-write.js` Block⑤ | ❌ |
| **venture-pipeline** | `venture-pipeline` | frontmatter `trigger`: `venture-pipeline`/`层2 引擎`/`层2 编排`/`pipeline-state`/`advance-node`/`resolve-hg`/`DAG 推进`/`HG 停等`/`awaiting_human` | 层2 工作流引擎：DAG 数据驱动编排（三原语 node/edge/loop_back + 嫁接1 独占 pipeline-state HG 停等） | 脚本 `scripts/{pipeline-state.js, advance-node.js, resolve-hg.js, venture-resume.js, load-graph.js}`；命令 `commands/venture-resume.md`；schema `references/{dag-schema.md, pipeline-state-schema.md, architecture-overview.md, persona-signal.md, pipeline-guide.md}`；数据 `dag.json`（3 节点最小拓扑）+ `dag.placeholder.json`（8 节点占位）；状态 `.venture/state/pipeline-state.json`（8 字段） | ❌ |

**路由器链路**：`claude-coach`（总入口）→ 8 个 cc-* 子技能（cc-loop/cc-goal/cc-orchestration/cc-config/cc-context/cc-scanner/cc-memory/cc-2pp）。cc-runtime 和 venture-pipeline 是**层1/层2 工程产物**，不在 claude-coach 路由表内（被层3 venture 流水线和 charter 协议层直接调用）。

---

## 二、层1 cc-runtime state 四文件 schema

存储根：`.venture/state/`（与 `.omc/` 隔离）。schema frozen-v1 由 M1 冻结，是层1 与层3 的**共同边界**。

### 2.1 checkpoint.json —— 断点快照（续跑锚点）

| 关键字段 | 语义 |
|---------|------|
| `current_node` / `current_task` | 业务做到哪（层3 写） |
| `explore_paths` / `plan_path` | 关键产物路径 |
| `progress_percent` (0-100) | 进度（单调不减，除非换向） |
| `iteration` | 当前节点迭代轮次 |
| `direction_version` | **必须与 direction.current_version 一致（INV-1）** |
| `last_progress_hash` | 进度指纹（基于 `(node, iter, step_index)` 三元组，非文件 hash——防误判纯推理节点） |
| `guardrails` | 循环合同三件：`max_iteration` / `no_progress_streak` / `budget_tokens_used` / `budget_tokens_cap` |
| `continue_from` | 续跑锚点（H6 注入核心，规范格式 `node:<n>,task:<t>,iter:<i>`） |
| `stagnation_count` / `health` | [C1] 兜底机制；health 状态机 `ok → stagnant_warn → blocked`（**状态标记 + 提示，非 exit2 阻塞**，G1 闭合） |
| autopilot 原字段 | `created_at`/`trigger`/`active_modes`/`todo_summary`/`wisdom_exported`/`background_jobs`（零迁移保留） |

**写者**：H4 Stop / H5 PreCompact。**读者**：H6 SessionStart / 层3。

### 2.2 trace.ndjson —— 执行轨迹（每行一独立 JSON，追加写）

| 必填字段 | 语义 |
|---------|------|
| `ts` / `session` | 时间戳 / 会话 id |
| `direction_version` | **该行写入时的方向版本（INV-4）** |
| `node` / `iter` / `step_index` | 流水线节点 / 节点内迭代 / 本轮步骤序号 |
| `action` | `write`/`edit`/`bash`/`reasoning`/`read` |
| `tool` | Write/Edit/Bash/Think/... |
| `filesChanged` / `learnings` | 变动文件 / 学到的事实（均可空数组） |
| `progressHash` / `progress_delta` / `tokensUsed` | 进度指纹 / 进度增量 / token 消耗 |

**写者**：H2 PostToolUse（基线层下未装 H2，由 compact-snapshot Block⑤ 兜底）。**读者**：H6 / 层3 回放。

### 2.3 direction.json —— 方向指针（单一真相源）

| 关键字段 | 语义 |
|---------|------|
| `current_version` | 当前方向版本（全局递增，每次换向 +1） |
| `current_path` / `current_plan` | 当前方向产物根目录 / 当前计划文件（初始 null） |
| `set_at` / `set_reason` | 本版本设置时间 / 换向理由 |
| `status` / `gate` | [C1 嫁接1] **永远 `active` / `null`**（shift-direction.js line 126-127 硬编码——HG 语义已迁移到 pipeline-state.json） |
| `superseded_paths` | [痛点4] 已废弃方向路径（基线层靠物理归档让旧路径 ENOENT 自然拦截） |
| `history` | 所有历史版本（版本化审计链） |

**写者**：**仅 shift-direction.js**（C1 核心约束）。**读者**：H1/H6/层3/pipeline-state.js init（纯读 current_version）。

### 2.4 tasks.tree.json —— 任务树（与 TaskList 同构）

| 关键字段 | 语义 |
|---------|------|
| `direction_version` | 任务树绑定的方向版本（换向时新建空任务树，INV-1） |
| `tasks[].id` / `subject` / `status` | 与 TaskList 对齐（INV-5） |
| `tasks[].node` / `blockedBy` | 任务所属节点 / 依赖任务 id 数组 |

**写者**：H2 PostToolUse（启发式匹配 tool_input 到 task subject）。**读者**：H4/H6。

### 2.5 跨文件不变量（INV-1..6，契约的约束力）

| ID | 不变量 |
|----|--------|
| **INV-1** | `checkpoint.direction_version` == `direction.current_version` == `tasks.tree.direction_version` |
| INV-2 | `checkpoint.trace_ref` 指向实际存在的 trace.ndjson |
| INV-3 | `direction.status == awaiting_human` ⟹ checkpoint.health 应反映 gate 等待 |
| **INV-4** | trace 每行的 `direction_version` == 该行写入时的 `direction.current_version` |
| INV-5 | `tasks.tree.tasks[]` 与 TaskList 输出同构 |
| INV-6 | `checkpoint.todo_summary` 计数 == tasks.tree 各 status 统计 |

### 2.6 cc-runtime 脚本用途

| 脚本 | 用途 | 关键约束 |
|------|------|---------|
| `scripts/init-state.js` | 初始化 `.venture/state/` 四文件（幂等 + `--force`）+ 提供 `atomicWriteJSON`（临时文件 + rename，Windows MOVEFILE_REPLACE_EXISTING）供层2 复用 | C2：纯 Node fs+path，禁 SDK 子进程 |
| `scripts/shift-direction.js` | 方向换向 + 旧方向物理归档（痛点4 机制腿）：升版本 / 归档 `.venture/artifacts/v_old/` → `.venture/archived/v_old/` / 原子更新三文件（INV-1）/ 追加 trace shift（INV-4） | `--reason` 必填 / `--to` 必须 > 当前版本 / `--dry-run`；**唯一 direction.json 写者** |
| `scripts/compact-snapshot-e2e.test.js` | compact-snapshot 端到端测试 | — |
| 全局 hook `~/.claude/hooks/compact-snapshot-write.js` Block⑤ | PreCompact 扩展：读 `.venture/state/`（direction + checkpoint + pipeline-state）写进 compact 快照；非 venture 项目 venture=null 不输出（向后兼容） | 0 新 hook，扩展已有 |

---

## 三、层2 venture-pipeline 接口

### 3.1 脚本矩阵（4 脚本各司其职 + 1 解析器）

| 脚本 | 用途 | 关键接口 |
|------|------|---------|
| `scripts/load-graph.js` | 解析 dag.json → 内存图（节点/边/loop_backs + graph_hash）；遇 `subgraph`/`fan_out` 字位 `implemented:false` 报未实现（C5） | `computeGraphHash(dag)` → 64 位 sha256 hex（确定性：递归排序键 → stringify → sha256）；仅 fs+path+crypto |
| `scripts/pipeline-state.js` | 层2 状态文件管理（M1）：init 锚定 dag.json / read 读状态 / set-hg 触发 HG 停等 / verify graph_hash 校验 | **C1 硬约束**：set-hg **绝对禁止** require/read/write direction.json；init 只读 current_version（纯读） |
| `scripts/advance-node.js` | 引擎核心（M2）：推进一拍，返回 8 种 action 枚举 | 复用 load-graph.computeGraphHash + pipeline-state.cmdSetHg/cmdRead + cc-runtime.atomicWriteJSON；**禁 spawn direction.set** |
| `scripts/resolve-hg.js` | 解除 HG 停等并推进越过 edge（M3）：boss 决策"继续"后调用 | 复用 advance-node.findOutEdges/handleLoopBack；**禁 child_process / 读写 direction.json** |
| `scripts/venture-resume.js` | 断点续传（M4）：读双源（pipeline-state.current_node 权威 + checkpoint.continue_from 提供 iter）+ graph_hash 漂移校验（C6） | **C1**：direction_version 从 pipeline-state 读，绝不碰 direction.json；B 假设：会话级断点续传 |

### 3.2 命令（slash）

| 命令 | 用途 |
|------|------|
| `commands/venture-resume.md` (`/venture-resume`) | 断点续传：步骤1 调 venture-resume.js resume 恢复（C6 漂移拒绝/未进起点提示）；步骤2 套 /loop 继续 advance-node 推进（action=advance→下一拍 / awaiting_human→停 loop 报告 boss / blocked→记录继续 / completed→退出） |

### 3.3 schema 文件

| 文件 | 内容 |
|------|------|
| `references/dag-schema.md` | DAG 三原语：node（id/type:task\|human_gate\|merge\|loop/skill/exit_condition）+ edge（from/to/condition:{signal:green\|yellow\|red\|unknown, awaiting_human:bool, gate:HG1\|HG2 条件必填}）+ loop_back（from/to/max_iter/converge_field）；字位预留 subgraph/fan_out（C5）；graph_hash 算法（C6） |
| `references/pipeline-state-schema.md` | pipeline-state.json **8 字段契约**（direction_version/current_node/frontier/iteration/status:active\|awaiting_human/gate:null\|HG1\|HG2/graph_hash/history）；§4 嫁接1 状态职责（双文件正交 + 写者隔离 C1）；§6 与层1 协同边界 |
| `references/architecture-overview.md` | 三层总览（层1 cc-runtime 地基 / 层2 venture-pipeline 引擎 / 层3 cc-venture 业务延后）+ 状态文件体系 + 脚本矩阵数据流 + DAG 拓扑 + 里程碑进度 + M5 loop_back 收敛语义改造（A 方案） |
| `references/persona-signal.md` | N6⇄N7 互锁 signal 收敛判据（M5）：signal 四态结构化 jsonld（**非自由文本**）+ 字段级比对收敛（delta < DELTA_THRESHOLD=0.1）+ MAX_ITER=3 强制收敛（驳 off-by-one） |
| `references/pipeline-guide.md` | 深度参考（数据驱动哲学 / 推进模型 / 嫁接1 / gate 来源 / loop_back / HG 生命周期 / 断点续传 / cc-loop 衔接 / 反模式） |

### 3.4 dag.json + dag.placeholder.json 结构

**dag.json**（M0 最小合法 DAG，3 节点）：
```
N1 ──green──> N2 ──green+awaiting_human(gate:HG1)──> N3 ──red(self-loop)──> N3
```
节点 skill 全 `placeholder`（C7）。loop_backs 为空。

**dag.placeholder.json**（M5 R5.1 占位拓扑，8 节点，对应层3 venture 流水线）：
```
N1 启动 → N2 机会识别 → N3 方案 ─HG1(awaiting_human)─▶ N4 原型 ─HG2(awaiting_human)─▶ N5 验证
       → N6 产品化 ⇄ N7 迭代优化 (loop_back N7→N6 max_iter=3, A 方案收敛后取 N7→N8 出口) → N8 规模化
```
- 节点语义映射 venture 业务：N1 启动 / N2 机会识别 / N3 方案 / N4 原型 / N5 验证 / N6 产品化 / N7 迭代优化 / N8 规模化
- HG1 = N3→N4（方案→原型 boss 决策）；HG2 = N4→N5（原型→验证 boss 决策）
- loop_back：`{from:N7, to:N6, max_iter:3, converge_field:signal}`（persona 收窄互锁）
- 全部 skill=`placeholder`（C7：占位跑通 ≠ 业务跑通，待层3 填真实 skill）

### 3.5 状态文件契约：pipeline-state.json（8 字段，嫁接1 独占 HG 停等）

| 字段 | 取值 | 说明 |
|------|------|------|
| `direction_version` | int ≥1 | 绑定方向版本（R2.5 换向监测源） |
| `current_node` | 节点 id \| null | 引擎当前节点（init=null） |
| `frontier` | 节点 id[] | 可达下一节点集合 |
| `iteration` | int ≥0 | loop_back 收敛计数 |
| `status` | `active` \| `awaiting_human` | **独占 HG 停等语义**（嫁接1，与 direction.json 正交） |
| `gate` | null \| HG1 \| HG2 | 当前停等闸门（与 status 联动） |
| `graph_hash` | 64 位 sha256 hex | dag.json 确定性哈希（C6 防静默漂移） |
| `history` | 事件数组 | 审计链（init/set_hg/advance/resolve_hg，含 from/to/reason） |

**写者隔离表（C1）**：`direction.json` 仅 shift-direction.js 可写；`pipeline-state.json` 由 pipeline-state.js + advance-node.js + resolve-hg.js 写。所有"是否 HG 停等"判断 → 读 **pipeline-state.status**（非 direction.status）。

**advance-node.js 返回的 8 种 action 枚举**：`enter`（null→nodes[0]）/ `advance`（流转 green\|yellow）/ `awaiting_human`（HG 停等，优先于 signal 分支）/ `ask_hg`（signal=unknown）/ `blocked`（signal=red）/ `converged`（loop_back 达 max_iter，A 方案取非 loop_back 出口推进）/ `completed`（无 out-edge 到终点）/ `direction_shift_reset`（R2.5 监测换向重置）。

---

## 四、5 部门 → 现有技能映射现状

对照 `00-charter.md` §组织架构的 5 部门表（charter 已自评覆盖度，此处核实 + 补充缺口细节）：

| 部门 | venture 节点 | charter 工具箱技能 | 现状 | 缺口/说明 |
|------|------------|------------------|------|----------|
| **决策部** | N3 计划 / N4 judge / HG | cc-2pp / cc-goal / cc-orchestration | ✓ **厚实** | cc-2pp 已是成熟判官小组（6 视角 + 对抗验证 + 落盘契约）；cc-goal 五层终态条件；cc-orchestration 三模式决策树。三者已在 claude-coach 路由表闭环。无缺口。 |
| **产品部** | N5 设计 / N7 需求 / N8 UIUX | cc-loop / 产品设计技能（新建） | ❌ **真空** | cc-loop 是循环工程方法论（非产品技能）。N5 产品设计 / N7 需求挖掘 / N8 UIUX 设计**无对应技能**。charter 明确标注"产品部 ❌ 真空，待层3 启动补齐"。无 venture-product / venture-uiux 类技能。 |
| **开发部** | 实施（执行计划） | executor / cc-loop | ⚠️ **中等** | charter 写"executor"——项目内**未见独立的 executor 技能目录**（可能指 Claude 原生 general-purpose agent 或 OMC autopilot/ralph）。cc-loop 提供 worktree SOP + 循环合同 + 护栏，是开发编排方法论。缺：代码质量/测试/重构等开发专项技能（依赖外部 skill 生态如 superpowers:* 系列，非本项目技能）。 |
| **运维部** | 层1 运行时（贯穿） | cc-runtime / cc-config / cc-context | ✓ **厚实** | cc-runtime 已闭合基线层（18/18 测试，四文件 frozen-v1 + init-state/shift-direction + compact-snapshot Block⑤）。cc-config 六层配置 + CLAUDE.md 诊断。cc-context 上下文健康。三者覆盖 7×24 保活/state/trace/Hook 全链路。无缺口。 |
| **销售部** | N1 调查 / N2 竞品 / N6 画像 | venture-judge / 销售技能（新建） | ❌ **真空** | charter 写"venture-judge"——**本项目 `.claude/skills/` 下无 venture-judge 目录**（它是系统级 installed skill，frontmatter 见 skills 清单：创业评估师，融合有序创业24步法 + VC投研7维）。但 N1 调查 / N2 竞品分析 / N6 用户画像 / **收益转化/市场验证**无本项目技能承接。charter 明确标注"销售部 ❌ 真空"。 |

**覆盖度汇总**（与 charter §组织架构自评一致）：
- ✓ 厚实：决策部（3 技能）、运维部（3 技能）
- ⚠️ 中等：开发部（1 方法论 + 依赖外部 agent/skill）
- ❌ 真空：产品部（0 业务技能）、销售部（1 外部 skill，无本项目承接）

---

## 五、对 hcc-org 设计的关键发现

### 5.1 charter 已定调 A 工具箱模型（部门 = 协作协议层，技能 = 跨部门工具箱）

`00-charter.md` §组织架构已明确裁决（D10 → A 工具箱模型）：
> 部门 = **协作协议层**（新增 `hcc-org/`，定义职责 + plan/review 流程 + 交接协议 + 信息源），技能 = **跨部门工具箱**（现有 cc-*/venture-* 原位保留，按需调用）。**重构≈0，不破坏 50-decision 技能树。**

这意味着 hcc-org Phase 2 的设计空间**不是重新组织技能**，而是设计**部门间的协作协议**（职责边界 + plan/review 流程 + 交接协议 + 信息源契约）。现有 11 个技能原位保留为工具箱。

### 5.2 部门协作协议的物理基础已就绪（层1 state + 层2 direction）

charter §组织架构定义的部门协作协议：
> 部门间不直接对话，通过层1 产物契约（state）+ 方向指针（direction）+ 执行记忆（trace）交换上下文。

层1 四文件（checkpoint/direction/trace/tasks.tree）+ 层2 pipeline-state 已闭合，**这正是部门间异步协作的物理媒介**：
- `direction.json` = 跨部门方向共识（谁在哪个版本方向上工作）
- `trace.ndjson` = 跨部门执行记忆（谁做了什么，带 direction_version + node）
- `checkpoint.json` = 跨部门续跑锚点（continue_from 规范格式）
- `pipeline-state.json` = 跨部门 HG 停等（awaiting_human + gate）

hcc-org 协议层**无需新建状态文件**，只需定义"哪个部门读/写哪个字段的哪部分"的协议规则。

### 5.3 现有技能触发机制：frontmatter trigger + claude-coach 路由（双重入口）

现有 11 技能的加载有**两条路径**：
1. **frontmatter trigger 关键词触发**（cc-2pp/cc-loop 等在 description 内嵌 Triggers，Claude 自动激活）——这是 cc-* 方法论的主入口。
2. **claude-coach 路由器分诊**（用户说"最佳实践/帮我选"→ claude-coach → 路由表 → 子技能）。

**cc-runtime 和 venture-pipeline 不在 claude-coach 路由表**——它们是工程产物，被层3 venture 流水线和 charter 协议层**直接调用**（脚本 + 状态文件契约），不走自然语言路由。

**对 hcc-org 的张力**：5 独立部门目录若各自带 SKILL.md + trigger 关键词，可能与现有 cc-* 技能**重复触发**（如"决策部"trigger 含"judge/方案"会与 cc-2pp 冲突）。**解法**：hcc-org 应定位为**协议层**（无业务 trigger，仅定义部门职责 + 交接规则），而非技能层——避免与工具箱技能的 trigger 竞争。这与 charter A 模型一致。

### 5.4 协作协议雏形已存在于 cc-2pp（agent 写文件，编排者读文件做真综合）

cc-2pp SKILL.md「假设4 一等公民」定义的协作模式：
> agent = 独立思考的 Claude，把完整产出**写到文件**；编排者 = 做真综合判断的 Claude，**读 agent 写的文件**；文件 = 交接层。

这正是**部门间协作协议的原型**：每个部门（agent 角色）产出落盘到约定路径，下游部门读文件接力。hcc-org 可复用此模式：部门 A 产出 → 落盘到 `.venture/artifacts/v{n}/` 约定文件名 → 部门 B 读该文件继续。**协作协议 = 文件命名约定 + 字段契约 + 方向版本绑定**。

### 5.5 venture 节点 → 部门映射已有占位（dag.placeholder.json 8 节点）

dag.placeholder.json 的 8 节点已隐含部门归属：
- N1 启动 / N2 机会识别 → **销售部**（调查/竞品）
- N3 方案 → **决策部**（计划）
- HG1 → **决策部**（judge gate）
- N4 原型 → **开发部**（实施）
- HG2 → **决策部**（judge gate）
- N5 验证 → **产品部**（设计验证）/ **销售部**（市场验证）
- N6 产品化 / N7 迭代优化 → **产品部**（产品设计/UIUX/需求）+ **开发部**（实施）
- N8 规模化 → **销售部**（收益转化）

层3 cc-venture 启动时，每个节点的 `skill` 字段从 `placeholder` 替换为真实 skill 名——**hcc-org 协议层应定义"节点 skill 如何按部门归属被路由/装配"**，而非新建业务技能。

### 5.6 产品部/销售部真空是层3 问题，不阻塞 hcc-org 协议层

charter 明确：产品部/销售部 ❌ 真空"待层3 启动补齐，**不阻塞层1 先行**"。同理不阻塞 hcc-org 协议层先行。hcc-org 的设计应**预留产品部/销售部的协议接口**（定义它们读/写哪些状态字段、交接什么文件），但**业务技能的填充留给层3**。这与 charter P1 最懒一致：先搭协议骨架，业务技能按需补。

### 5.7 关键约束：所有层2 脚本禁碰 direction.json（C1 嫁接1）

层2 全部脚本（pipeline-state/advance-node/resolve-hg/venture-resume）头部均声明 C1 硬约束：**绝对禁止 require/read/write direction.json**（init 只读 current_version 纯读例外）。direction.json 唯一写者是 shift-direction.js。

**对 hcc-org 的张力**：若"决策部"部门协议要触发换向，**必须经 shift-direction.js**，不能绕过。hcc-org 协议层应定义"决策部判定换向 → 调 shift-direction.js --reason"的流程，而非自己写 direction.json。这保证了 INV-1..6 不变量不被破坏。

### 5.8 度量约束：禁人天，用 token/轮次/skill 配置/验证复杂度

cc-2pp SKILL.md「Prompt 注入约束」明确：实施者 = Claude + skills，工作量估算**禁用"人天/人周/人月"**，必须用 token 成本 / 上下文轮次 / skill 配置成本 / 验证复杂度 / 依赖风险。dag-schema.md 也标注"度量：会话·token（C4，禁人天）"。

**对 hcc-org 的张力**：部门协作协议中的"工作量/产能/SLA"不能用"部门人手/排期"表述，必须用 Claude 实施者度量。5 部门都是 Claude 分饰（charter §部署约束"单 Claude"），部门间协作成本 = token + 上下文轮次 + 文件交接开销，非"跨部门沟通成本"。

---

---

## 六、Phase 0b 外部探索：协作协议设计的业界范式校正

> 来源（web，4 轮收敛）：
> - [Hierarchical Agent Systems: Manager, Specialist（Ruh.ai）](https://www.ruh.ai/blogs/hierarchical-agent-systems)
> - [Handoffs — Docs by LangChain](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs)
> - [What Should Agents Say? Action-state Communication（arXiv）](https://arxiv.org/html/2606.05304v1)
> - [Rethinking organizational design in the age of agentic AI（MIT Tech Review）](https://www.technologyreview.com/2026/05/26/1137584/rethinking-organizational-design-in-the-age-of-agentic-ai/)

### 6.1 charter"部门间不直接对话，经 state 交换" = 业界标准 state-driven handoffs（验证正确）

LangChain Handoffs 核心机制：**工具更新一个 state variable（如 `current_step`/`active_agent`），系统读它调整行为**（换配置或路由到不同 agent）。charter 的"经 state/direction/trace 交换上下文"与此**完全同构**——业界验证了 charter 这条路的正确性。hcc 协作协议 = state variable 驱动行为切换的落地，物理基础（层1 四文件 + 层2 pipeline-state）正是该机制的实现。

### 6.2 关键质问：5 独立目录 vs 单 agent 动态配置（BOSS 选择 vs 业界推荐）

LangChain 明确：handoffs 有两种实现，**单 agent + middleware（动态配置）比多 agent subgraph 更简单，推荐用于多数场景**；后者只在需要 bespoke 实现（reflection/retrieval 步骤）时用。
- BOSS 选的"5 独立部门技能目录" ≈ 多 agent subgraph（每部门独立 skill 节点）
- 但 hcc 的部门**不是同 agent 换 prompt**，而是 Claude 分饰 5 个有本质不同职责+信息源+plan/review 流程的角色——更接近 Ruh 的 **Specialist 分工**（领域专家/委托禁用/领域工具）
- **结论**：5 独立目录在"角色边界清晰性"上是对的（Ruh 反模式#2：边界不清致 duplicate work + gaps），站得住；代价是 LangChain 警告的复杂度（多节点 context engineering）。**此取舍正是 Phase 2 judge panel 该验证 ROI 的核心分歧点**——5 独立 vs "hcc-org 总则 + 单 agent 动态切换" 可作为 α/β 方案分化。

### 6.3 context passing 铁律 → hcc 部门交接协议

LangChain 教训：subgraph handoff **不传完整历史**（bloat + 干扰接收 agent），只传 **handoff pair**（触发消息 + 确认消息）；需更多 context 就在交接消息里 summarize。
→ hcc 部门交接 = 上游产物文件 + 一份结构化交接说明（state 字段 `direction_version`/`node`/`iter`），**不灌完整 trace**。与 cc-2pp"agent 写文件/编排者读文件" + cc-runtime direction_version 绑定完全一致。

### 6.4 RACI 责任矩阵（charter 部门表缺的维度）

Ruh 反模式#2 的解法：explicit role descriptions + **responsibility matrix**（Responsible 做 / Accountable 拍板 / Consulted 咨询 / Informed 知情）。charter 部门表只列"职责+节点+信息源+工具"，**缺 RACI 维度**——每个 venture 节点/状态字段/产物，哪个部门 R/A/C/I。hcc 5 部门 SKILL.md 应含 RACI 表，否则部门边界模糊（Ruh 头号失败模式）。

### 6.5 委托循环防护 → review 驳回 plan 的回环上限

Ruh 反模式#3：禁用非 manager 委托 + 最大委托深度 + 循环检测。hcc 的 N6⇄N7 已有 max_iter=3 收敛（persona-signal），但**部门间 plan→review→驳回→重 plan 的回环需定义上限**（类似 force_converge / cc-loop 护栏三件套），否则 plan/review 死循环。映射到 checkpoint.guardrails.max_iteration。

### 6.6 成本乘法 + 度量对齐

Ruh：委托是**乘法级 LLM 调用**（3-5x 单 agent 成本）。hcc 5 部门 × plan+review 双能力 = 每节点可能 3-5 次 agent 调用。charter 已有 token 度量约束（禁人天），但需把"部门协作开销"显式纳入 `checkpoint.guardrails.budget_tokens_cap` 护栏（max_proceed + budget 双闸）。

### 6.7 三层角色模型可借鉴

Ruh 三层：**Manager**（编排/无工具/纯协调）→ **Specialist**（领域专家/委托禁用）→ **Worker**（原子执行）。映射 hcc：
- 决策部 ≈ Manager（HG 拍板/换向，**经 shift-direction.js** 不直接写 state——Ruh"manager 无工具"原则）
- 产品/开发/销售部 ≈ Specialist（领域执行，各自领域工具箱）
- 运维部 ≈ 横切 Manager+Worker（保活 + state 读写，是其他部门的运行时地基）

> ⚠️ Ruh"Manager 无工具"与 charter"决策部触发换向"需协调：决策部不直写 direction.json（C1 约束），而是**判定→调 shift-direction.js**——决策部"有工具"但工具是层1 脚本而非业务技能，符合 Ruh 精神。

---

**探索结论（融合 0a 内部 + 0b 外部）**：hcc-org 的设计空间是**协作协议层**（部门职责 + RACI + plan/review 流程 + 交接协议 + 信息源契约），物理基础（层1 state + 层2 direction/pipeline-state）已就绪且与业界 state-driven handoffs 同构，协作模式原型（cc-2pp agent 写文件/编排者读文件 + handoff pair 不灌历史）可复用。产品部/销售部业务技能真空是层3 问题，不阻塞协议层先行。

**Phase 2 核心裁决点（0a+0b 共同指向）**：
1. **5 独立目录 vs hcc-org 总则+单 agent 动态切换**（0b §6.2 LangChain 质问）——judge panel α/β 分化
2. **共享协作协议总则的物理放置**（0a §5.3/5.4）——hcc-org/ 新根目录 vs cc-runtime references vs 5 目录内嵌
3. **RACI 矩阵是否进 SKILL.md**（0b §6.4）——边界清晰性的关键
4. **trigger 竞争规避**（0a §5.3）——hcc 协议层无业务 trigger，避免与 cc-* 工具箱竞争
5. **plan/review 回环上限**（0b §6.5）+ **协作 token 预算护栏**（0b §6.6）

---

## 七、Phase 0c 需求确认结论（BOSS 全选推荐项）

三维决策表（BOSS 已裁决，Phase 2 judge panel 在此范围内分化，不重开已决策项）：

| 维度 | BOSS 选择 | 落地含义 |
|------|-----------|----------|
| **交付范围** | 协议层完整骨架（推荐项） | 5 个部门 SKILL.md 各含：部门职责 + RACI + plan/review 双流程 + 交接协议 + 信息源契约 + 工具箱映射 + 缺口技能占位。**不新建业务技能**（产品部/销售部真空留给层3，P1 最懒） |
| **DAG 对接** | 映射但不装配（推荐项） | dag.placeholder.json 保持 placeholder，**不动层2已定稿拓扑**（C7/C1 不破）。hcc 协议层只定义「部门↔节点映射规则」（哪个节点归哪个部门），不替换 placeholder→真实 skill（装配留层3 cc-venture） |
| **协作预算** | 完整双能力 + 预算护栏（推荐项） | 每部门 plan（规划）+ review（审查）双能力全保留；护栏双闸：`checkpoint.guardrails.budget_tokens_cap`（token 预算上限）+ `max_iteration`（plan→review 驳回回环上限，0b §6.5/6.6） |

留给 Phase 2 judge panel 裁决的 3 设计张力（BOSS 未决策，留给判官小组分化 + 对抗验证）：

1. **共享协作协议的物理放置**：① hcc-org/ 新根（1 协议总则 SKILL.md + 5 部门引用，DRY）② cc-runtime/references/（层1 地基 owns 协议，复用 state-schema.md 先例）③ 5 部门目录内嵌（每部门自包含，references 交叉引用）
2. **5 独立目录 vs 单 agent 动态切换**（0b §6.2 LangChain 质问）：5 独立在角色边界清晰性上站得住（Ruh Specialist 分工），但 LangChain 警告多节点复杂度；单 agent + middleware 更简单但角色边界模糊——judge panel 必须验 ROI（token/轮次成本 vs 边界清晰收益）
3. **RACI 矩阵形态**（0b §6.4）：每部门 SKILL.md 内嵌 RACI 表 vs 独立 RACI 矩阵文档横切 5 部门

---

## 八、Phase 1 模式选择：模式 C（混合）

**依据**：BOSS #19 启动指令既定「判官 panel + 对抗验证」= 模式 C。Phase 0c 已确认范围/ROI，**不重新 AskUserQuestion**（违反 cc-2pp「不问已决策项」铁律）。

模式 C 4 步流程（Phase 2 执行点）：

- **Step 2a 判官小组起草**（3 个 opus agent 并行，派系围绕「共享协作协议放置」分化）：
  - **α 保守派** → `10-plan-alpha.md`：hcc-org/ 协议总则根目录（1 SKILL.md 定义协作总则 + RACI 总表 + 交接协议），5 部门子技能引用总则（DRY，贴近 charter §组织架构原提议；代价是 6 目录偏离「5 独立」名义）
  - **β 平衡派** → `10-plan-beta.md`：严格 5 独立部门目录 + 共享协议抽到 `cc-runtime/references/hcc-protocol.md`（层1 地基 owns 协议，已有 state-schema.md 先例，部门 SKILL.md 聚焦部门职责）
  - **γ 创新派** → `10-plan-gamma.md`：5 独立部门目录各内嵌完整协议（职责+RACI+plan/review+交接+信息源+工具映射全自包含，references 交叉引用避免硬重复，每部门独立加载运行）
- **Step 2b 评分 Top 2**（编排者读 3 方案，30-score.md，含完整度/ROI/可编排性维度）
- **Step 2c 对抗 3 攻击**（对 Top 2，20-attack-{A,B,C}.md，攻击者含 ROI + Claude 度量 + 可编排性向量）
- **Step 2d 综合裁决**（40-synthesis.md → 50-decision.md，进入 Phase 4）
