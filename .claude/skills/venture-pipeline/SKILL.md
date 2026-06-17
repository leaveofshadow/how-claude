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

**P1 最懒：≤200 字符，boss 一眼可决策**（60-impl-plan §6.1 验证闸 M3-面板要求四要素 ≤200 字符）。

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
