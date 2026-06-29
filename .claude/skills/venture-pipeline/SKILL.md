---
name: venture-pipeline
description: 层2 工作流引擎 —— DAG 数据驱动编排（三原语 node/edge/loop_back + 嫁接1 HG 独占 pipeline-state）。50-decision β' 裁决落地。
trigger:
  - venture-pipeline
  - 层2 引擎
  - 层2 编排
  - pipeline-state
  - advance-node
  - resolve-hg
  - DAG 推进
  - HG 停等
  - cc-venture
  - 层3 行动协议
  - orchestrate
  - set-signal
---

# venture-pipeline（层2 工作流引擎）

> DAG 数据驱动的节点推进引擎。引擎代码零分支硬编码，条件全在 dag.json.condition。

## 触发词速查表

| 触发词 | 路由到 |
|--------|--------|
| venture-pipeline / 层2 引擎 / DAG 推进 | 本技能（命令面板） |
| pipeline-state / advance-node / resolve-hg | 本技能（命令面板） |
| HG 停等 / awaiting_human | 本技能（HG 面板 + resolve-hg） |
| 层2 编排 / 工作流引擎 | 本技能（架构概述） |

## 命令面板

所有命令在项目根目录执行。状态文件落 `<cwd>/.venture/state/pipeline-state.json`（与层1 direction.json 同目录，职责正交）。

### 1. `node pipeline-state.js init [--dag <p>] [--root <dir>]`

- **用途**：锚定 dag.json 初始化 pipeline-state.json（计算 graph_hash 写入，绑定 direction_version）。
- **调用**：首次启用引擎，或 dag.json 改拓扑后重新锚定。
- **返回关键字段**：`{ ok, command:'init', path, state:{ status:'active', gate:null, graph_hash, current_node:null, ... } }`。
- **何时用**：项目首次接入引擎 / 改了 dag.json 节点或边 / verify 报 graph_hash 漂移后。
- **证据**：pipeline-state.js cmdInit（line 100-128），默认值 status:active/gate:null（嫁接1）。

### 2. `node pipeline-state.js read [--root <dir>]`

- **用途**：读当前引擎状态（会话开始 / 每次 advance 后 / HG 面板渲染前必读）。
- **调用**：无侵入读，不改变状态。
- **返回关键字段**：`{ ok, command:'read', state:{ status, gate, current_node, frontier, iteration, direction_version } }`。
- **何时用**：每次 advance/resolve-hg/set-hg 之后；会话开始；渲染 HG 面板前。
- **证据**：pipeline-state.js cmdRead（line 132-139）。文件不存在 exit 1（提示先 init）。

### 3. `node pipeline-state.js set-hg --gate HG1|HG2 [--root <dir>]`

- **用途**：手动触发 HG 停等（写 status:awaiting_human + gate:HG{n}，追加 history）。
- **调用**：需要 boss 介入但 advance 未自动触发时（如 boss 主动要求审查当前节点）。
- **返回关键字段**：`{ ok, command:'set-hg', from:{...}, to:{ status:'awaiting_human', gate } }`。
- **何时用**：boss 主动要停等 / 测试 HG 流程 / advance 因 signal 评估未停但业务需人工。
- **C1 硬约束**：此命令**绝对禁止**碰 direction.json（pipeline-state.js line 13-16, 144-183 全程不读写 direction.json）。

### 4. `node pipeline-state.js verify [--dag <p>] [--root <dir>]`

- **用途**：graph_hash 校验（C6 防静默漂移）。重算当前 dag.json 的 hash 比对 state.graph_hash。
- **调用**：怀疑 dag.json 被手工改动 / CI 闸 / advance 前自检。
- **返回**：匹配 → exit 0 + `{ match:true }`；不匹配 → exit 1 + stderr「graph_hash 不匹配：dag=<新> state=<旧>」。
- **何时用**：dag.json 改动后未 init 就 advance 前 / 定期拓扑一致性检查。
- **证据**：pipeline-state.js cmdVerify（line 187-210），不匹配抛 GRAPH_HASH_DRIFT exit 1（line 205-209, 240-244）。

### 5. `node advance-node.js advance [--dag <p>] [--root <dir>]`

- **用途**：推进一拍（引擎核心）。从 current_node 取 outEdges[0] 评估，决定流转/停等/收敛/到达终点。
- **返回 action 枚举**（关键）：
  - `enter` — current_node 从 null 定位到 nodes[0]（line 245-253）
  - `advance` — 流转 from→to（signal=green/yellow，line 426-436）
  - `awaiting_human` — HG 停等触发，current_node 不推进（line 314-321）
  - `ask_hg` — signal=unknown 走 HG 询问（line 340-348）
  - `blocked` — signal=red 停等不流转（line 363-371）
  - `converged` — loop_back 达 max_iter 收敛（line 391-400）
  - `completed` — 无 out-edge 到达终点（line 272-278）
  - `direction_shift_reset` — R2.5 监测到 direction 换向，重置推进态（line 210-218）
- **何时用**：循环每拍 / boss 想推进 / /loop 调度触发。
- **关键顺序**：awaiting_human 检查（line 294）优先于 signal 分支——一旦 edge.awaiting_human=true 直接 triggerHG 不看 signal。

### 6. `node resolve-hg.js resolve [--dag <p>] [--root <dir>] [--gate HG1|HG2]`

- **用途**：boss 决策后解除 awaiting_human 并推进越过当前 edge（current_node → edge.to）。
- **调用**：advance 返回 awaiting_human/ask_hg 后，boss 决策通过/拒绝该 gate。
- **前置**：pipeline-state.status 必须 = awaiting_human（否则无停等可解除）。
- **返回**：`{ ok, command:'resolve', from:{ status:'awaiting_human', gate }, to:{ status:'active', gate:null, current_node:<推进后> } }`。
- **何时用**：boss 在 HG 面板决策「通过」后 / 测试 HG 解除流程。
- **C1 约束**：只写 pipeline-state.json（解除 awaiting_human + 流转），禁碰 direction.json（HG 决策 ≠ 换向）。
- **注**：resolve-hg.js 属 M3-T1（与本 SKILL 同里程碑并行开发）。命令契约依据 advance awaiting_human 返回 + 70-requirements R3.1。

## SessionStart 行为约定（方案 C 软面板，核心）

> **这是文档约定，不是真 hook**。SKILL.md 指令让 Claude 在会话开始 + 每次 advance/resolve-hg/set-hg 之后，主动 `node pipeline-state.js read` 读 `.venture/state/pipeline-state.json` 并按 status 显示对应面板。

### 何时读

- 会话开始（SessionStart）
- 每次 `advance-node.js advance` 之后
- 每次 `resolve-hg.js resolve` 之后
- 每次 `pipeline-state.js set-hg` 之后

### status=awaiting_human → 显示 HG 面板

**P1 总结：≤200 字符，boss 一眼可决策**（60-impl-plan §6.1 验证闸 M3-面板要求四要素 ≤200 字符）。

四要素：当前节点 / 待决策 gate / 推荐动作 / 状态。

```
┌─ venture HG ─────────────────────────┐
│ 节点: N2   gate: HG1   状态: 停等    │
│ 动作: resolve-hg resolve --gate HG1  │
│       (通过) 或 set-hg 调整          │
└──────────────────────────────────────┘
```

ASCII 面板模板（Claude 渲染时填入实际值）：

```
┌─ venture HG ──────────────────────────┐
│ 节点: <current_node>                  │
│ gate: <HG1|HG2>      状态: 停等       │
│ 动作: resolve-hg resolve --gate <g>   │
│       （通过推进）或 set-hg --gate <g>│
└───────────────────────────────────────┘
```

### status=active → 显示进度面板

**≤200 字符**。四要素：当前节点 / frontier / iteration / 进度。

```
┌─ venture 进度 ───────────────────────┐
│ 节点: N2   iter: 0   状态: 推进中    │
│ frontier: [N3]                       │
│ 动作: node advance-node.js advance   │
└──────────────────────────────────────┘
```

ASCII 面板模板：

```
┌─ venture 进度 ───────────────────────┐
│ 节点: <current_node>  iter: <n>      │
│ frontier: [<next1>,<next2>]          │
│ 动作: node advance-node.js advance   │
└──────────────────────────────────────┘
```

### 跨会话 / compact 后恢复

本约定是软面板（SKILL.md 指令驱动，非真 hook）。跨会话或 compact 后的恢复由**层1 compact-snapshot 机制 Block⑤ 扩展**保障：compact-snapshot-write.js 的 readVentureState 读 pipeline-state.json 写进 snapshot，SessionStart 恢复时 Claude 看到 snapshot 里的 venture 状态，再 read 确认渲染面板。

（Block⑤ 扩展属 M3-T2，与本 SKILL 同里程碑并行。当前 compact-snapshot-write.js 在 cc-runtime/scripts/ 下，扩展点为 readVentureState 函数。）

## 架构概述

层2 工作流引擎 = **三原语**（node/edge/loop_back）+ **dag.json 数据驱动** + **pipeline-state.json 独占 HG 停等**（嫁接1）+ **shift-direction.js 零改动**。

```
direction.json      ← 层1 业务方向指针（frozen-v1 零改动，永远 status:active/gate:null）
                       ↑ shift-direction.js line 126-127 硬编码
pipeline-state.json ← 层2 新增：独占 HG 停等（status:active|awaiting_human）+ 节点推进
dag.json            ← 数据驱动拓扑（三原语，换 DAG 不改引擎代码）
```

**核心理念一句话**：引擎代码零分支硬编码，条件全在 `dag.json.condition`（signal 管流转 + awaiting_human 管停等，两字段正交）。

三原语：
- **node** — 业务单元（绑定 skill，exit_condition 可证伪）
- **edge** — 流转（HG 折叠为 awaiting_human:true 的特殊 edge，不单列原语）
- **loop_back** — 收敛回环（max_iter 强制收敛，防 N6⇄N7 死循环）

字位预留：subgraph / fan_out（reserved:true, implemented:false，load-graph 遇即报未实现，C5）。

双文件协同（嫁接1）：direction.json 永远 active/null（业务方向）；pipeline-state.json 独占 awaiting_human/gate（引擎推进）。两者写者隔离（C1）：direction.json 仅 shift-direction.js 可写；pipeline-state.json 由 pipeline-state.js + advance-node.js + resolve-hg.js 写。

## cc-venture 行动协议（层3 强制，R4 流程护栏）

> layer-3 cc-venture 业务 DAG（`dag.venture.json`，10 节点 N1→N2→N3→N3.5需求→N3.6架构设计─HG1─→N4─HG2─→N5→N6⇄N7→N8）的执行约定：用上面 layer-2 命令面板的 `venture-resume.js` / `advance-node.js` 跑业务主线。本节是 [v2-R4] fail-safe 流程护栏——强制 4 步，防 agent 跳 set-signal 导致主线卡死。

### 行动协议（强制，不准跳）

每个节点的执行循环必须严格按以下 4 步，**不准跳过任何一步**：

1. **读指令**
   ```bash
   node .claude/skills/venture-pipeline/scripts/venture-resume.js orchestrate \
     --dag .claude/skills/venture-pipeline/dag.venture.json --root .venture/state
   ```
   → 看 stdout 指令卡的「该激活的 skill / 完成判据 / 完成后你必须做（逐字 set-signal + advance 命令）」。

2. **执行 skill**：照指令卡激活 skill（venture-sales-judge `/judge` / `/compete`，hcc-decision 七维评分等），产出 artifact 到 `.venture/artifacts/<node>-*.md`（须含 dag 该节点 exit_condition 关键词，可证伪）。

3. **set-signal**（普通段 edge 唯一写者）
   ```bash
   node .claude/skills/venture-pipeline/scripts/venture-resume.js set-signal \
     --edge <from>:<to> --signal green \
     --artifact .venture/artifacts/<node>-*.md \
     --dag .claude/skills/venture-pipeline/dag.venture.json --root .venture/state
   ```
   ↑ `--artifact` 必填，文件不存在 → exit 1（R5 防零产出骗验收）。**这一步不准跳**。

4. **advance**
   ```bash
   node .claude/skills/venture-pipeline/scripts/advance-node.js advance \
     --dag .claude/skills/venture-pipeline/dag.venture.json --root .venture/state
   ```
   → 推进到下一节点，回到第 1 步读下一个节点的指令卡。

⚠️ **漏第 3 步直接 advance → 普通段 signal 留 unknown → advance 触发 ask_hg 停等卡死（无自动恢复）**。普通段 edge（N1→N2 / N2→N3 / N3→N3.5 / N3.5→N3.6 / N5→N6 / N6→N7 / N7→N6 / N7→N8）signal 初值=unknown，advance-node.js 遇 unknown 走 HG 询问分支（line 325），主线推不动。解卡唯一方式：补跑 set-signal 改 green，再 advance。

### HG 越闸（不准 set-signal，R3 死字段）

HG edge（N3.6→N4 gate=HG1 / N4→N5 gate=HG2，`awaiting_human:true`）的 signal 是**死字段**——advance 命中 awaiting_human 先于 signal 评估（advance-node.js line 294），set-signal 改 HG edge → exit 1（拒改死字段）。agent 到 HG 节点自动停等（status:awaiting_human）→ 报告 boss → 等 boss 决策后调 resolve-hg 越闸，**不准自己跳**：

```bash
node .claude/skills/venture-pipeline/scripts/resolve-hg.js resolve \
  --gate HG1|HG2 --dag .claude/skills/venture-pipeline/dag.venture.json --root .venture/state
```

### set-signal 串行约束（R6）

⚠️ set-signal 是 **read-modify-write**（读 dag → 改普通段 edge.signal → 重算 graph_hash → 改 state.graph_hash → 写双文件），**必须串行调用**（同 dag 同 root 不可并行）。7×24 单机串行场景下无实际并发；真冲突由 graph_hash 漂移检测暴露（resume/verify 报错，C6）。

### orchestrate 输出强制提示

orchestrate 指令卡的「完成后你必须做」段必须**逐字列出当前节点的 set-signal + advance 命令**（含具体 `--edge from:to` / `--artifact 路径` / `--dag 路径`），让 agent 复制粘贴即可执行，不留「agent 自己想命令」的歧义空间。实现见 venture-resume.js cmdOrchestrate（M2，R2.1-验证2 测试覆盖逐字命令断言）。

## cc-2pp 衔接（N3.6 架构设计节点 + 变更回溯 + 视角组 + 自动调，2026-06-29）

cc-2pp 与 pipeline 两种衔接：
1. **N3.6 架构设计节点**（2026-06-29 插）：N3.5 需求 PRD → **N3.6 架构设计（cc-2pp 激活，产 55-architecture.md：系统架构图/模块/接口契约/数据模型/部署/选型定稿）** → N4 原型。cc-2pp 作节点激活，强制产出架构设计文档（web2 教训：选型止步、跳架构设计致粗糙）。exit_condition 查六块关键词。
2. **切面**（重大决策自动调）：大变更走视角组探索 → 调 cc-2pp 重做。

### 变更检测 + 分级（M2）
pipeline 监控实施（cc-loop 验证闸挂 / 流转阻塞 / 用户标记）→ 变更分级：
- **小变更**（局部/单点，不碰架构）→ cc-loop 内 TDD，不回溯
- **中变更**（跨模块/技术栈不变）→ 改局部 plan（60/70），不回 Phase 0/2
- **大变更**（技术不 fit / 架构假设错 / 核心需求变）→ 视角组探索 + 调 cc-2pp 重做

### monitor 漂移检测（M2 实现设计，2026-06-29）

**用户不显式声明变更**——monitor 主动漂移检测（baseline vs current 对比），不只被动等用户说。

| 漂移类型 | baseline | current signal | 检测 |
|---|---|---|---|
| 需求漂移 | 70-requirements + 50-decision | 用户当前输入/新需求文档 | 语义对比（Claude 分类）|
| 技术漂移 | 60-impl-plan 技术选型 | git diff 技术栈文件 | diff 对比 + Claude 判断 |
| 架构漂移 | 60-impl-plan 架构设计 | git diff 接口/结构文件 | diff 量 + 接口变更（机械）|
| 实施信号 | — | checkpoint.stagnation_count ≥ K | 机械（验证闸挂 = 技术不 fit 隐式信号）|

**机械（monitor.js）+ 语义（Claude）分工**：
- monitor.js 做可机械检测的（git diff --stat 量 + 接口文件变更 + stagnation_count + 读 baseline 50/60/70 摘要）
- 编排者 Claude 做语义分类（读 monitor.js 输出的漂移材料 → 分类需求/技术/架构漂移 → 触发分级）
- 不把语义塞进脚本规则（变更语义复杂，规则覆盖不全）

**实现形态**（P1 轻量，事件触发非 daemon）：monitor.js 事件触发（用户输入/验证闸挂/advance-node 流转时调用），输出漂移材料给编排者 Claude 分类。

**已实现**（task #41，`scripts/monitor.js`，18/18 PASS）：

```
node monitor.js --run <run-dir> [--since <commit>] [--root <dir>] [--stagnation-k <N>]
```
- `--run` baseline 决策目录（读 50/60/70 摘要）；`--since` git diff 基线（默认 HEAD = working tree，含 untracked 新文件）；`--root` 项目根；`--stagnation-k` 阻塞线（默认 3）

**机械边界**（关键）：monitor.js 只做客观机械检测——diff 量 + 文件分类（接口 `contract|interface|api|schema|dag|index` / 技术栈 `package.json|go.mod|dag.*.json`）+ stagnation≥K → 输出 `mechanical_hints`（`architecture_drift_signal` / `tech_drift_signal` / `implementation_stall_signal` / `no_drift_detected`）。**语义分类（需求/技术漂移 + 小/中/大量级分级）= `needs_semantic_classification: true`，留编排者 Claude**（不把语义塞脚本规则）。约束（C2 调整）：child_process **仅** execSync 调 `git diff`/`git ls-files`（只读）；禁 spawn skill/禁 vm/eval/禁写 state；跨 skill 只读 cc-runtime `checkpoint.stagnation_count`。

**触发时机 + 分级路由**（编排者 Claude 调 monitor → 读 hints → 语义分类 → 路由）：
- 调 monitor 的 3 时机：① 用户输入新需求/技术变更/架构重构意向 ② 验证闸挂（cc-loop signal=fail/stagnation）③ 大 diff 流转后
- monitor hints → 分级映射（机械粗筛，语义确认后路由）：
  - `no_drift_detected` → 继续 TDD 推进（无漂移）
  - `generic_drift_signal`（有变更无机械特征）→ 编排者语义量级判断（小/中/大，看 diff_lines_total + 项目规模）
  - `tech_drift_signal`（技术栈文件变，量小）→ 中变更：改局部 plan（60/70），不回 Phase 0/2
  - `architecture_drift_signal`（接口/契约文件变）→ 倾向大变更：视角组探索 + 调 cc-2pp 重做
  - `implementation_stall_signal`（stagnation≥K 验证闸挂）→ 技术不 fit 隐式信号 → 调 cc-2pp 重做技术选型
  - 需求漂移（用户输入 vs 70/50 语义对比）→ 语义判：小调需求 / 中改 plan / 大重做
- ★ hints 是机械粗筛，最终分级由编排者 Claude 语义判断（对比 baseline + 项目规模），不机械套规则

### 视角组探索 + 调 cc-2pp（M3）
大变更触发：
```
视角组 Agent（复用 cc-2pp _roles/perspective-*.md 视角库，DRY 不另建）
  → parallel 探索变更影响（架构/产品/UIUX/测试/运维各视角）
  → pipeline 编排者聚合
  → 调 cc-2pp Phase 0（探索产出作 00-explore 输入）
  → cc-2pp 跑 Phase 2/4 → 新 50/60/70 → pipeline 消费（exit_condition）
```
★ 视角组仅大变更 spawn（按需）；视角库 cc-2pp owns，pipeline 复用。

### 重大决策自动调 cc-2pp（M4）
pipeline 节点遇重大决策（score_2pp≥5 或节点显式标记 `auto_2pp: true`）→ 自动触发 cc-2pp（双入口之一）。cc-2pp 产新 plan → pipeline 消费（exit_condition）→ 流转。

### 衔接契约（三层正交）
- **pipeline** = 全流程编排 + 变更检测/分级 + 视角组聚合 + 调 cc-2pp
- **cc-2pp** = 计划执行器（领域无关切面），被 pipeline 调 / 被用户手动调
- **cc-loop** = 执行原语（跑通节点/里程碑）
- **视角库** = cc-2pp owns（`_roles/perspective-*.md`），pipeline 复用（DRY）

## 当前状态

- **M0** dag.json schema + load-graph.js（解析 + 字位报未实现 + graph_hash）✅
- **M1** pipeline-state.js（init/read/set-hg/verify）+ schema ✅
- **M2** advance-node.js 引擎核心（R2.1-R2.5：流转/signal四态/loop_back收敛/HG触发/换向监测）✅
- **M3** SKILL.md 正文 + pipeline-guide.md + resolve-hg.js（本里程碑）✅
- **M4** venture-resume.js + /venture-resume slash（断点续传，B 假设）→ `.2pp/2026-06-16-layer2-workflow-engine/70-requirements.md` R4.1-R4.4
- **M5** 占位 dag.placeholder.json（8 节点）+ persona-signal.md（结构化 signal 收敛判据）→ `70-requirements.md` R5.1-R5.4

M4/M5 实施编排详见 `.2pp/2026-06-16-layer2-workflow-engine/60-impl-plan.md` §3 / §5。

## 参考文档（read 而非注入）

- [references/pipeline-guide.md](references/pipeline-guide.md) —— 深度参考（数据驱动哲学 / 推进模型 / 嫁接1 双文件协同 / gate 来源 / loop_back 收敛 / HG 生命周期 / 断点续传 B 假设 / cc-loop 循环合同衔接 / 反模式）
- [references/pipeline-state-schema.md](references/pipeline-state-schema.md) —— pipeline-state.json 8 字段契约（§4 嫁接1 状态职责 / §六 协同边界）
- [references/dag-schema.md](references/dag-schema.md) —— DAG 三原语 schema（§一 gate 编号来源 R2.0 / §三 graph_hash C6 / §四 最小合法 DAG 示例）
