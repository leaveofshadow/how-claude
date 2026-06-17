---
run: 2026-06-16-layer2-workflow-engine
phase: 2
artifact: plan
faction: alpha（保守派 / 最小通用）
title: 层2 工作流引擎方案 α——单 DAG-loop + 声明式转移表（最小通用，首发 cc-venture）
author: α 保守派判官（Claude Code + 已装 skills 实施者视角）
created: 2026-06-16
status: draft
stance: |
  P1 最懒 + 生产落地优先 优先于 通用性。
  抽象最小：pipeline-state 只表达「当前节点/gate 状态/进度/迭代计数」；
  DAG 拓扑用声明式 JSON（节点列表 + 转移表），先不抽象运行时边/条件分支原语。
  loop 粒度 = 单 DAG-loop（一个大 loop 驱动整条流水线，每轮读 pipeline-state→执行当前节点→写回→推进）。
  通用 = 留扩展点（节点配置化 + 转移表可改），不预实现边/子图/并行扇出。
  最快让 cc-venture 跑通，泛化后置。
evidence_sources:
  - .2pp/2026-06-16-layer2-workflow-engine/00-explore.md（Phase 0 全结论）
  - .2pp/2026-06-16-venture-automation-architecture/00-charter.md（硬约束）
  - .claude/skills/cc-runtime/references/state-schema.md（层1 契约 frozen-v1，§5/§6/§7）
  - .2pp/2026-06-16-venture-automation-architecture/50-decision.md §2（层3 8 节点 DAG）
  - .claude/skills/cc-loop/references/loop-guide.md（循环合同 + 三护栏 + /loop 三变体）
  - .claude/skills/cc-orchestration/references/orchestration-guide.md（决策树 + 编排循环五字段）
  - .claude/skills/cc-runtime/scripts/shift-direction.js（direction.set 现成实现）
---

# 层2 工作流引擎方案 α（保守派 / 最小通用）

> **一句话立场**：层2 是一张「声明式 DAG 转移表 + 一个自我推进的单 loop」——脚本骨架管「该走哪个节点」（What），loop 管「怎么把当前节点拉起来跑」（How），agent 管「这个节点实质做什么」（Who）。抽象只到「节点 + 转移表」二原语为止，先不碰运行时边/条件分支/子图/并行扇出。**先让 cc-venture 跑通，泛化后置**——未跑通就抽象通用 = 制造无法验证的复杂度（α 派第一信条）。

---

## §1 架构总览

**一句话定位**：层2 = 层1 状态原语（frozen-v1 四文件）与层3 业务 DAG（cc-venture 8 节点）之间的「状态机骨架」——把「当前在哪个节点 / 下一步去哪 / 卡在哪个 gate」从对话上下文里搬到磁盘 + 声明式配置里，让 7×24 断点续传可复现。

### 组件图

```
                         ┌─────────────────────────────────────────┐
                         │           层2 工作流引擎（α）            │
                         │                                         │
   声明式配置（静态）    │  ┌─────────────┐   ┌──────────────────┐ │
   ┌──────────────┐  ───▶│  │ dag.json    │   │ pipeline-state   │ │
   │ venture/     │      │  │ 节点列表 +   │   │ .json（运行态）  │ │
   │ dag.json     │      │  │ 转移表       │   │ 当前节点/gate/   │ │
   └──────────────┘      │  │ （What）    │   │ iter/进度        │ │
                         │  └──────┬──────┘   └────────┬─────────┘ │
                         │         │ 读取拓扑          │ 读写      │
                         │         ▼                   ▼          │
   动态推进（运行时）    │  ┌──────────────────────────────────────┐│
   ┌──────────────┐  ───▶│  │   单 DAG-loop（/loop + ScheduleWakeup）│
   │ /loop        │      │  │   每轮：读 pipeline-state            ││
   │ （How·驱动器）│      │  │     → 查 dag.json 找当前节点          ││
   └──────────────┘      │  │     → 分派给节点 agent（Who）        ││
                         │  │     → 校验产物契约                    ││
                         │  │     → 写回 pipeline-state + 推进      ││
                         │  └────────────────┬─────────────────────┘│
                         └───────────────────┼─────────────────────┘
                                             │ 经 skill 调
                                             ▼
        ┌────────────────────────────────────────────────────────────┐
        │   层1 cc-runtime（frozen-v1，本次只读 + 调 direction.set）  │
        │   direction.json / checkpoint.json / tasks.tree.json /     │
        │   trace.ndjson  ← shift-direction.js 封装 INV-1 三件套      │
        └────────────────────────────────────────────────────────────┘
                                             ▲ 产出产物
                                             │
        ┌────────────────────────────────────────────────────────────┐
        │   层3 cc-venture（首发验证场景，规格延后）                    │
        │   N1→N2→N3→HG1→N4→HG2→N5→N6⇄N7→N8                        │
        └────────────────────────────────────────────────────────────┘
```

### 数据流（一轮 loop 迭代的时序）

```
1. /loop 触发（CronCreate durable 或 ScheduleWakeup 自步进）
   │
2. loop 主体读 pipeline-state.json → {current_node, gate_status, iter}
   │
3. 查 dag.json[ current_node ] → 得节点定义（agent 配方 / 产物契约 / 下一跳转移表）
   │
4. 判定当前节点状态：
   ├─ gate_status=="awaiting"  → 不推进，发面板给 boss，停等（H6 注入）
   ├─ 节点未完成                → 调节点 agent skill 执行实质工作（Who）
   └─ 节点完成                  → 校验产物契约 → 查转移表得下一跳
   │
5. 写回 pipeline-state.json（推进 current_node / iter++ / 更新进度）
   │  （pipeline-state 是层2 自有状态，层1 四文件不动）
   │
6. 若发生「换向」（boss 在 HG 选了换向 / 放弃）→ 调 shift-direction.js
   │  （层1 INV-1 三件套由脚本封装，层2 不直写 checkpoint/trace）
   │
7. 若还需继续 → ScheduleWakeup 安排下一轮（自步进）；否则 /loop 停止
```

**关键边界**（α 派严守）：层2 只写**自己的** `pipeline-state.json`；对层1 四文件，**只读 + 经 skill 调 `direction.set`**（state-schema §5 唯一可调写接口，shift-direction.js 已封装 INV-1）。这一条同时满足层1「技能不常驻、实际写=脚本/Hook」的身份定论（00-explore §1.B 末段）。

---

## §2 pipeline-state.json schema（第四个状态文件 · α 最小集）

> **派系立场**：α 主张 pipeline-state 字段最小化——只装「能让 loop 知道现在该干啥」的信息。DAG 拓扑（节点列表/转移表）放静态 `dag.json`，**不**塞进运行态文件，否则每次拓扑调整都要改运行态 + 担心迁移。β/γ 若把拓扑塞运行态，是过度工程。

### 2.1 schema（α 最小字段集）

```jsonc
{
  "schema_version": 1,                         // pipeline-state 自身 schema 版本（独立于层1 frozen-vN）
  "dag_ref": "venture/dag.json",               // 指向所用的 DAG 拓扑配置（可换 = 通用扩展点）
  "pipeline_id": "venture-2026-06-16-run-01",  // 本次流水线运行实例 id（一次 venture 评测 = 一个 id）
  "direction_version": 2,                      // 当前绑定的层1 方向版本（INV-1 扩展点，见 §7）

  // ── 当前位置（loop 每轮第一眼看的三个字段）──
  "current_node": "N3",                        // dag.json 中的节点 id
  "gate_status": "active",                     // "active" | "awaiting" | "resolved_continue" | "resolved_shift" | "resolved_abort"
  "iteration": 2,                              // 当前节点内迭代轮次（套循环合同护栏一）

  // ── 进度（P1 最懒面板的数据源）──
  "progress": {
    "completed_nodes": ["N1", "N2"],           // 已完成节点 id 列表
    "percent": 25,                             // 0-100（completed/total * 100，粗粒度够面板用）
    "tokens_used": 48000,                      // 本次 pipeline 累计 token（预算护栏三）
    "tokens_cap": 500000
  },

  // ── gate 决策缓存（HG awaiting 时 loop 停等的依据）──
  "pending_gate": {                            // null 表示无待决 gate
    "gate_id": "HG1",
    "entered_at": "2026-06-16T11:00:00Z",
    "panel_ref": ".venture/artifacts/v2/gate-panels/HG1.md",  // 已重编码的决策面板路径
    "options": ["continue", "shift", "abort"]  // charter P1 三动词
  },

  // ── 子循环状态（N6⇄N7 互锁专用，其他节点为 null）──
  "subloop": {                                 // null 表示当前节点无子循环
    "type": "interlock",
    "round": 1,                                // 互锁第几轮（M2 MAX_ITER=3）
    "max_round": 3,
    "last_signal": null                        // N6/N7 上一轮的收敛信号
  },

  // ── 续跑锚点（跨 session）──
  "resume_anchor": "pipeline:venture-2026-06-16-run-01,node:N3,iter:2",
  "updated_at": "2026-06-16T11:05:00Z"
}
```

### 2.2 字段语义表

| 字段 | 类型 | 语义 | 谁写 | α 取舍说明 |
|------|------|------|------|-----------|
| `schema_version` | number | pipeline-state schema 版本 | loop 写 | 独立于层1 frozen-vN；α 只升自己不拖累层1 |
| `dag_ref` | string | DAG 拓扑配置路径 | 初始化定 | **拓扑与运行态分离**——换 DAG 不动运行态 |
| `pipeline_id` | string | 流水线实例 id | 初始化定 | 一次 venture 评测一个 id，便于归档 |
| `direction_version` | number | 绑定的层1 方向版本 | 经 shift-direction 间接触发 | INV-1 扩展点（§7 详述） |
| `current_node` | string | 当前节点 id | loop 每轮写 | loop 第一眼读这个 |
| `gate_status` | enum | gate 状态机 | loop 写 | active=跑 / awaiting=停等 boss / resolved_* = boss 已决 |
| `iteration` | number | 节点内迭代 | loop 写 | 套循环合同护栏一 |
| `progress.completed_nodes` | string[] | 已完成节点 | loop 推进时写 | α 用粗粒度列表，不算节点内步数 |
| `progress.percent` | number | 总进度 | loop 推导 | completed/total，够面板 |
| `progress.tokens_used/cap` | number | 预算 | loop 累加 | 护栏三 |
| `pending_gate` | object\|null | 待决 gate | loop 进 HG 时写 | 面板路径 + 三动词，charter P1 |
| `subloop` | object\|null | 子循环状态 | loop 写 | α 只为 N6⇄N7 预留一个槽，不泛化成子图原语 |
| `resume_anchor` | string | 续跑锚点 | loop 写 | 跨 session 续跑 |

### 2.3 与 direction.json / checkpoint.json 的职责切分（α 派关键边界）

| 状态文件 | 职责 | 谁写 | α 边界裁决 |
|---------|------|------|-----------|
| **direction.json**（层1） | 业务**方向**版本（v1→v2 换向）+ awaiting_human/gate | shift-direction.js（INV-1 封装） | 层2 **只读 + 经 skill 调 set**；不在 direction 里塞节点级信息（粒度不对：方向是粗的，节点是细的） |
| **checkpoint.json**（层1） | session 断点快照（autopilot 字段 + venture 扩展 current_node/iter） | Hook（基线层 compact-snapshot） | 层2 **不直写**；checkpoint.current_node 与 pipeline-state.current_node 是**冗余镜像**，由 H2/compact 同步，层2 只读 checkpoint 做交叉校验 |
| **tasks.tree.json**（层1） | TaskList 同构任务树 | Hook | 层2 只读；不把 DAG 节点塞 tasks（DAG 是流水线拓扑，task 是执行清单，两套语义） |
| **pipeline-state.json**（层2 新增） | **DAG 流转运行态**（当前节点/gate/iter/进度/子循环） | **loop 显式写** | 层2 唯一自己写的文件；和层1 三文件正交，不抢 direction/checkpoint 的活 |

> **α 派一句话裁决**：pipeline-state 不复用 direction.json（粒度不同），不内嵌进 checkpoint.json（checkpoint 是 session 级快照，pipeline 是流水线级运行态，生命周期不同——一次 session 可能跨多个 pipeline 节点，一个 pipeline 也可能跨多个 session）。**新增独立文件，正交解耦**。这一条同时回答 00-explore §1.F 灰度3。

### 2.4 示例 JSON（cc-venture 跑到 N3 计划中）

```jsonc
{
  "schema_version": 1,
  "dag_ref": "venture/dag.json",
  "pipeline_id": "venture-2026-06-16-run-01",
  "direction_version": 2,
  "current_node": "N3",
  "gate_status": "active",
  "iteration": 2,
  "progress": {
    "completed_nodes": ["N1", "N2"],
    "percent": 25,
    "tokens_used": 48000,
    "tokens_cap": 500000
  },
  "pending_gate": null,
  "subloop": null,
  "resume_anchor": "pipeline:venture-2026-06-16-run-01,node:N3,iter:2",
  "updated_at": "2026-06-16T11:05:00Z"
}
```

---

## §3 DAG 原语抽象（α 派的抽象层次：节点 + 转移表，到此为止）

> **派系立场（核心）**：α 抽象**二原语**——`节点（node）` + `转移表（transitions）`。**不**抽象运行时边对象、条件分支求值器、子图、并行扇出。这些以后需要时再加（留扩展点）。现在抽象 = 在 cc-venture 没跑通前臆造抽象，违反「先跑通再泛化」。

### 3.1 dag.json schema（声明式配置，静态）

```jsonc
{
  "dag_id": "venture-v1",
  "version": 1,
  "description": "cc-venture 8 节点评测流水线（50-decision §2.1）",

  // ── 原语一：节点列表 ──
  "nodes": [
    {
      "id": "N1",
      "name": "调查",
      "agent_skill": "venture-judge",        // 实质执行交给哪个 skill（Who）
      "product_contract": {                  // 产物契约（50-decision §2.1，层2 校验）
        "out_path": ".venture/artifacts/v{dir}/01-research.md",
        "out_schema_ref": "venture/contracts/research.md"
      },
      "guardrails": {                         // 节点级循环合同三护栏（cc-loop §三）
        "max_iteration": 5,
        "no_progress_streak_cap": 3,
        "budget_tokens_cap": 80000
      },
      "is_gate": false
    }
    // ... N2-N8 同结构；HG1/HG2 见下
  ],

  // ── 原语二：转移表（from → conditions → to）──
  // α 派：转移表是静态声明，不是运行时求值器。条件用「字段匹配字符串」，loop 解释执行。
  "transitions": [
    {
      "from": "N1",
      "to": "N2",
      "condition": "product_ok",             // 内置条件枚举：product_ok / signal_green / signal_yellow / signal_red / gate_resolved_continue / gate_resolved_shift / gate_resolved_abort / failure
      "description": "N1 产物契约通过 → 进 N2"
    },
    {
      "from": "N3",
      "to": "HG1",
      "condition": "product_ok",
      "description": "N3 计划完成 → 进 HG1 等 boss"
    },
    {
      "from": "HG1",
      "to": "N4",
      "condition": "gate_resolved_continue"
    },
    {
      "from": "HG1",
      "to": "N1",
      "condition": "gate_resolved_shift",
      "description": "boss 选换向 → 回 N1 重新调查（经 shift-direction 换向）"
    },
    {
      "from": "HG1",
      "to": "END",
      "condition": "gate_resolved_abort"
    }
    // ... 完整 8 节点 + 2 gate 转移表见 §9
  ],

  // ── 终态 ──
  "start_node": "N1",
  "end_nodes": ["END"]
}
```

### 3.2 内置 condition 枚举（α 只定义 7 个，不开放自定义求值）

| condition | 触发时机 | α 取舍 |
|-----------|---------|--------|
| `product_ok` | 节点产物契约校验通过 | 主路径 |
| `product_fail` | 产物契约校验失败 | 进 failure 路由（ extractor 无输入 → signal_unknown，50-decision §2.5 missing#7） |
| `signal_green/yellow/red/unknown` | N4 extractor 输出的 jsonld signal（50-decision §2.2） | N4→N5 自动路由 |
| `gate_resolved_continue/shift/abort` | boss 在 HG 选了三动词之一（charter P1） | HG 出口 |
| `interlock_converged` | N6⇄N7 互锁收敛（M2） | 子循环出口 |

> **α 派刻意不做的事**（留扩展点，标注「以后做」）：
> - ❌ 不抽象「运行时边对象」（edge as first-class object）——转移表里每条是静态行，不是对象。
> - ❌ 不抽象「条件求值器」（condition DSL）——只用枚举字符串，loop 内 if-else 解释。
> - ❌ 不支持「子图」（subgraph）——N6⇄N7 互锁用 §2.1 的 `subloop` 字段 + 转移表回环表达，不引入子图嵌套。
> - ❌ 不支持「并行扇出」（fan-out）——cc-venture 是线性的，并行扇出是 β/γ 的臆想需求。
>
> **诚实标注**：以上 4 个「不做」就是 α 与 β/γ 的分歧核心。α 认为它们在 cc-venture 跑通前都是**无法验证的复杂度**（00-explore §2 设计共识3：durable 自建印证必要，但「自建多复杂」要按需）。

### 3.3 通用性扩展点（α 留的口子，不预实现）

「通用」在 α 派的定义 = 以下 3 个扩展点，**现在只留接口不实现**：

1. **dag_ref 可换**（§2.1）：pipeline-state.dag_ref 指向哪个 dag.json 由初始化决定，换 DAG = 换配置文件，不改 loop 代码。
2. **节点 agent_skill 可配**（§3.1）：每个节点的 `agent_skill` 字段是字符串，换 skill = 换字符串。
3. **转移表可改**（§3.1）：transitions 是 JSON 数组，加节点/改跳转 = 改数组。

> 这 3 个扩展点足够让层2 从「cc-venture 专用」演进到「能跑第二条流水线」——但**第二条流水线出现前不动手**（YAGNI + P1 最懒）。

---

## §4 loop 驱动器设计（单 DAG-loop 粒度）

> **张力 A 的 α 调和**：loop 粒度 = **单 DAG-loop**（一个大 loop 驱动整条流水线），**不是**每节点一个 loop（β 倾向），**也不是**每会话一个 loop（γ 倾向）。理由：cc-venture 是线性 DAG，单 loop 足够；多 loop = 多份循环合同 + 多份护栏 = 复杂度爆炸，且跨 loop 状态同步是新的不变量噩梦。

### 4.1 单 DAG-loop 的循环合同（套 cc-loop §二六要素）

```yaml
TRIGGER:  "/loop（无间隔，自步进）触发；或 CronCreate durable 跨 session 保活"
SCOPE:    "当前 pipeline_id 的整条 DAG（dag_ref 指向的 dag.json）"
ACTION:   |
  每轮：
    1. 读 pipeline-state.json
    2. 若 gate_status=="awaiting" → 渲染 gate 面板发 boss，停等（不 ScheduleWakeup）
    3. 否则查 dag.json[current_node] → 调 agent_skill 执行
    4. 校验产物契约
    5. 查转移表得下一跳 → 写回 pipeline-state（推进 current_node / iter++）
    6. 若 current_node ∈ end_nodes → 停止 loop
    7. 否则 ScheduleWakeup 安排下一轮
BUDGET:   "progress.tokens_cap=500000；单节点 max_iteration=5；总轮次 ≤ 60（8 节点 × 5 轮 + 2 gate + 余量）"
STOP:     "current_node==END / gate_resolved_abort / tokens超cap / max_iteration触顶 / 连续3轮无进展"
REPORT:   "每轮写 pipeline-state.updated_at + gate 面板（HG 时）+ 终态时写 pipeline 总结到 artifacts/v{dir}/pipeline-summary.md"
```

### 4.2 三护栏（cc-loop §三，α 直接套）

| 护栏 | 在 pipeline-state 的字段 | 触发动作 |
|------|------------------------|---------|
| 一·最大迭代 | `iteration` vs dag.json[node].guardrails.max_iteration | 触顶 → 标 `gate_status:"awaiting"` + 面板提示「节点卡住，需介入」 |
| 二·无进展 | `progress.percent` 连续 N 轮不变（N=3） | 标 awaiting + 面板提示「流水线停滞」 |
| 三·预算上限 | `progress.tokens_used` vs `tokens_cap` | 触顶 → 标 awaiting + 面板提示「预算耗尽，建议 abort 或加预算」 |

> **α 派刻意复用层1 checkpoint.guardrails 的语义**（state-schema §1.1）——但**不写回 checkpoint**（层2 不直写层1 文件）。护栏状态在 pipeline-state 里独立维护，checkpoint.guardrails 由 H2/compact 镜像。两份护栏语义一致、写者分离。

### 4.3 ScheduleWakeup 用法（cc-loop §五决策树）

cc-venture 任务特征 = **不确定工作量的迭代**（每个节点做完才知下一步），按 cc-loop §五决策树 → 选 **ScheduleWakeup（动态自步进）**，**不**选 CronCreate（CronCreate 适合轮询外部状态，cc-venture 是内生推进）。

```
/loop /venture-pipeline-step
  → 每轮跑完一个节点 → ScheduleWakeup(delaySeconds=60) 安排下一轮
  → 60s 在 cc-loop §六缓存热区（60-270s），保持上下文热，下一轮读 pipeline-state 快
```

**反模式警告**（cc-loop §十一）：**不用 300s**（冷启动 + 没省频率）；**不用整点分钟**。α 派固定 60s 自步进。

**跨 session 保活**（charter 7×24）：session 断了 → pipeline-state 在磁盘 → 下个 session 的 loop 第一轮读 `resume_anchor` 续跑。**不依赖 loop 进程常驻**——这呼应 00-explore §2 设计共识4（原生 Workflow 单会话不自带跨 session 持久，层2 = Workflow + 层1 状态 + 推进器）。

### 4.4 HG awaiting 时 loop 怎么停（C1 修订对接）

50-decision §1.3 C1 已定：HG 不靠 exit2 阻塞（四重退化），靠 `direction.json: {status:"awaiting_human", gate:"HG1"}` + H6 SessionStart 注入。α 派对接：

- loop 进 HG 节点 → 写 `pipeline-state.gate_status="awaiting"` + `pending_gate={gate_id, panel_ref, options}`
- **loop 自己不再 ScheduleWakeup**（不安排下一轮）→ loop 自然停（cc-loop §五：ScheduleWakeup 是 loop 自己安排的，不安排 = 停）
- boss 决定后 → skill 调 shift-direction（若 shift/abort）或直接写 `gate_status="resolved_continue"`（若 continue）→ loop 被 boss 重新 `/loop` 触发 → 读 resolved 状态 → 查转移表推进

> **α 派关键洞察**：HG 的「停」不靠 exit2，靠「loop 不自我调度」+「状态落盘」。这和层1 基线层 0 新 hook 完全兼容（00-explore §2 灰度8 外部回答）。

---

## §5 脚本骨架（确定性状态机住哪）

> **张力 A 的 What 部分**：脚本骨架 = dag.json（拓扑）+ 转移表解释器（住 venture-pipeline skill）。α 派把「确定性」限定在**转移表查表**这一件事——节点实质执行交给 agent skill（不确定性），转移决策是查表（确定性）。

### 5.1 脚本骨架的职责（α 最小集）

```
venture-pipeline skill（脚本骨架，纯 Node fs + JSON 查表）
├── 读 pipeline-state.json              （状态读取）
├── 读 dag.json[current_node]           （拓扑查询）
├── 查 transitions[] 找匹配 condition   （转移决策 = 唯一确定性逻辑）
├── 写 pipeline-state.json              （状态推进，原子写套用 init-state.js 的 atomicWriteJSON）
└── 触发 shift-direction.js             （仅 gate_resolved_shift/abort 时，复用层1 现成腿）
```

### 5.2 转移表解释器（α 派的「状态机」就这一个函数）

```javascript
// venture-pipeline/scripts/advance.js（伪代码，示意查表逻辑）
function nextTransition(dag, currentNode, signal) {
  // signal 来自上一节点产物契约校验 / gate 决策 / extractor 输出
  const candidates = dag.transitions.filter(t => t.from === currentNode);
  // α 派：condition 是枚举字符串，if-else 解释，不搞 DSL
  const hit = candidates.find(t => t.condition === signal);
  if (!hit) {
    // 无匹配 = 路由黑洞，标 awaiting 让 boss 介入（不全自动崩溃）
    return { action: 'await', reason: `no transition for ${currentNode}+${signal}` };
  }
  return { action: 'advance', to: hit.to };
}
```

> **α 派诚实标注**：这个解释器 30 行代码。β/γ 若搞「运行时边对象 + 条件求值器」会是 300+ 行 + 一套 DSL 测试。**未跑通前 270 行的复杂度无验证手段**——这是 α 反对过度工程的实证。

### 5.3 gate 触发逻辑住哪（00-explore §1.F 灰度2）

α 答：**住转移表**。N3 的转移 `N3 →product_ok→ HG1` 是静态声明。loop 跑完 N3 校验产物 → 查转移表 → 命中 `product_ok` → 跳 HG1。**不需要 agent 读 checkpoint 自判「我该进 gate 了」**——查表是确定的，agent 自判是不确定的。

> 这一条直接回答灰度2：gate 触发是**显式状态机（转移表）**，不是 agent 自判。

---

## §6 与层1 接口（如何调 direction.set 驱动换向）

### 6.1 α 派的唯一调用路径

层2 经 venture-pipeline skill 调层1，**只调一个接口**（state-schema §5）：`direction.set`，且**只经 shift-direction.js**（已封装 INV-1 三件套 + 归档 + trace，00-explore §1.E 末行）。

```
venture-pipeline skill
   │
   │ 仅当 gate_status ∈ {resolved_shift, resolved_abort} 时
   ▼
node shift-direction.js --reason "<boss 决策记录>"
   │
   │ shift-direction.js 内部已做：
   ├─ 升 direction.current_version（v→v+1）
   ├─ 原子写 direction.json（superseded_paths + history）
   ├─ 原子写 checkpoint.json（INV-1 + 重置 progress）
   ├─ 原子写 tasks.tree.json（INV-1 + 新空树）
   ├─ 追加 trace.ndjson（INV-4 带新版本）
   └─ 归档旧方向目录（痛点4 ENOENT 拦截）
   │
   ▼
venture-pipeline 收到换向结果 → 写 pipeline-state：
   ├─ direction_version = 新版本（INV-1 扩展，§7）
   ├─ current_node = dag.start_node（换向 = 从头跑）
   ├─ iteration = 0, progress 重置
   └─ gate_status = "active"
```

### 6.2 α 派刻意不直调的层1 接口（state-schema §5）

| 接口 | α 是否调 | 理由 |
|------|---------|------|
| `checkpoint.write(partial)` | ❌ 不调 | §5 禁止（层2/3 不可直写，实际写=Hook） |
| `trace.append(entry)` | ❌ 不调 | §5 禁止 |
| `direction.set` | ✅ 经 shift-direction 调 | §5 唯一允许的写接口 |
| `direction.current()` | ✅ 只读 | §5 允许 |
| `state.snapshot()` | ✅ 只读 | §5 允许 |

> **α 派边界纪律**：层2 对层1 是「只读 + 一写（经脚本）」。任何直写 checkpoint/trace 的冲动 = 违反层1 身份定论（技能不常驻，实际写=Hook），α 派拒绝。

---

## §7 四文件 INV 扩展（INV-1 三→四文件 · frozen-v1→v2 迁移 · 向后兼容）

> **张力 C 的 α 调和**：新增 pipeline-state 必然触碰 INV-1（三文件版本一致 → 四文件）。α 派主张**最小触碰 + 严格向后兼容**——基线层 18 测试一条不破。

### 7.1 INV-1 重定义（三→四文件）

**原 INV-1**（state-schema §6）：
```
checkpoint.direction_version == direction.current_version == tasks.tree.direction_version
```

**扩展 INV-1'（α 提案）**：
```
checkpoint.direction_version
  == direction.current_version
  == tasks.tree.direction_version
  == pipeline-state.direction_version   ← 新增第四项
```

### 7.2 frozen-v1 → frozen-v2 迁移（α 最小变更协议）

按 state-schema §7.3 变更门判定：

| 变更类型 | α 判定 | 理由 |
|---------|--------|------|
| 新增 pipeline-state.json 文件 | **层2 own，不进层1 schema** | pipeline-state 是层2 文件，层1 schema（state-schema.md）**不收录它**——层1 仍 frozen-v1，只描述自己的三文件 |
| INV-1 扩展第四项 | **层1 schema minor 升 v2** | INV 是跨文件不变量，pipeline-state 加入一致性强约束，属 INV 语义扩展（§7.3：改 INV 语义 = major；但 α 主张这是**新增一项**不删旧项 = 可争议为 minor） |

**α 派裁决**：为安全起见，按 **major 升 frozen-v2** 处理（state-schema §7.3：改字段语义/INV 重定义 = major），触发：
1. state-schema.md 升 `status: frozen-v2`，§6 INV-1 加第四项 + 注释「pipeline-state 由层2 维护」
2. 重跑 70-requirements §1 schema 验收（层1 不破的硬证据）
3. 通知层3 重新对齐（层3 此刻规格延后，对齐成本=0）

### 7.3 向后兼容：基线层 18 测试不破（α 派头号约束）

**风险**：shift-direction.js 现在写 INV-1 三件套（direction/checkpoint/tasks，见源码 §「构造新 checkpoint」「构造新 tasks」）。加 pipeline-state 第四件后，shift-direction 要不要也写 pipeline-state？

**α 派裁决**：**shift-direction.js 不改，不写 pipeline-state**。理由：

- shift-direction 是层1 脚本，职责是「换方向 + 三件套一致」（state-schema §5）。pipeline-state 是层2 文件，**层1 不感知层2**（隔离原则，state-schema §0 隔离为主）。
- pipeline-state.direction_version 的同步由**层2 自己负责**：venture-pipeline skill 调完 shift-direction 后，读 shift-direction 返回的 `to` 版本，写回 pipeline-state.direction_version。
- 这样 shift-direction 零改动 → **基线层 18 测试一条不破**（基线-C 单测只验三件套，不涉及 pipeline-state）。

**INV-1' 的维护责任划分**：

| 文件 | 谁写 direction_version | 何时写 |
|------|----------------------|--------|
| direction.json | shift-direction.js | 换向时（已实现） |
| checkpoint.json | shift-direction.js | 换向时（已实现） |
| tasks.tree.json | shift-direction.js | 换向时（已实现） |
| **pipeline-state.json** | **venture-pipeline skill** | **换向后读 shift-direction 返回值写回** |

> **α 派诚实标注风险**：INV-1' 的第四项由层2 维护，**不在层1 Hook/脚本覆盖范围内**——若层2 skill 忘了写，INV-1' 会破。缓解：venture-pipeline skill 初始化时强校验 `pipeline-state.direction_version == direction.current_version`，不一致则报错停等。这是 α 派接受的「层2 自管一致性」代价（vs β 把 pipeline-state 塞进层1 Hook 自动同步——但那要改层1 Hook = 破 0 新 hook 基线，α 拒绝）。

### 7.4 迁移步骤（α 派落地顺序）

```
1. state-schema.md 升 frozen-v2：§6 INV-1 加第四项 + §0 四文件总览加 pipeline-state 行（标注「层2 own」）
2. 重跑 70-requirements §1（验层1 三文件 schema 不破，18 测试应全绿）
3. 写 venture-pipeline/scripts/init-pipeline.js：初始化 pipeline-state.json（默认值见 §2.1）
4. 写 venture-pipeline skill：含 §5 转移表解释器 + §6 调 shift-direction + §7.3 INV-1' 校验
5. 写 venture/dag.json：cc-venture 8 节点拓扑（§9 详述）
6. 端到端：/loop /venture-pipeline-step 跑 N1→N2→N3→HG1，验 pipeline-state 推进 + INV-1' 一致
```

---

## §8 三张力处理（A/B/C 各一段 · α 派调和）

### 张力 A（loop × 脚本）：α 调和为「单 DAG-loop + 转移表查表」

**张力**：脚本骨架管调度 vs /loop 自调度，谁主谁次？

**α 调和**：**脚本=骨架(What) / loop=驱动器(How) / agent=节点(Who)**——三角色不重叠。
- What（dag.json + 转移表）：静态声明「节点列表 + 转移条件」，住磁盘，可 diff 可审计。
- How（单 DAG-loop）：每轮读 pipeline-state → 查 What → 调 Who → 写回。loop 是驱动器，不持有拓扑（拓扑在 dag.json）。
- Who（节点 agent_skill）：每个节点的实质执行，纯不确定性 agent 工作。

**loop 粒度 = 单 DAG-loop**（§4.1），不分每节点一个 loop。理由：线性 DAG 单 loop 足够；多 loop = 多份循环合同 + 跨 loop 状态同步噩梦。**α 质疑 β**：若 β 主张「每节点一个 loop」，请论证「为什么 N1 的 loop 合同和 N3 的不同」——cc-venture 8 节点护栏语义同构（都是 max_iter + 无进展 + 预算），分 loop = 8 倍配置无新价值。

### 张力 B（通用 × 验证）：α 调和为「通用骨架 + 专用首发，泛化后置」

**张力**：通用引擎 vs cc-venture 未跑通，先抽象还是先跑通？

**α 调和**：**通用骨架 = §3.3 的 3 个扩展点（dag_ref 可换 / agent_skill 可配 / 转移表可改），首发 = cc-venture 8 节点**。α 派的「通用」定义极窄——**能换配置跑第二条流水线**就叫通用，**不**要求支持子图/并行/条件求值器。

**首发可证伪验证**（α 派验收点）：cc-venture 跑通 N1→N8 + 2 HG + N6⇄N7 互锁，pipeline-state 正确推进，INV-1' 一致。**跑不通这条，谈通用是空话**。

**α 质疑 γ**：若 γ 主张「先抽象运行时边/条件分支」，请指出 cc-venture 哪个节点需要「运行时动态加边」或「条件表达式求值」——8 节点全是静态转移，γ 的抽象无首发场景验证 = 制造无法验证的复杂度（00-explore §2 设计共识3 反向应用：durable 自建必要，但「自建多复杂」要按需，不是越通用越好）。

### 张力 C（四文件迁移）：α 调和为「层2 own + INV-1' minor 触碰 + 基线层零改动」

**张力**：新增 pipeline-state + INV-1 四文件，如何不破 frozen-v1 + 基线层 18 测试？

**α 调和**（§7 详述）：三层隔离——
1. **pipeline-state 是层2 文件，不进层1 schema**（层1 state-schema.md 只描述自己的三文件）。
2. **INV-1 扩展第四项 = 层1 schema minor/major 升 v2**，但 shift-direction.js **零改动**（不写 pipeline-state）。
3. **INV-1' 第四项由层2 skill 维护**，层2 自管一致性 + 初始化强校验。

**基线层 18 测试不破的硬保证**：shift-direction.js 不改 → 基线-C 单测（验三件套）全绿；init-state.js 不改 → 基线-A/B 单测全绿。**α 派把「不破基线层」当头号约束**——这是 P1 最懒 + 生产落地优先的直接体现（基线层是已验证的腿，破它 = 自找麻烦）。

---

## §9 cc-venture 首发映射（8 节点 DAG 用 α 原语表达）

> 把 50-decision §2.1 的 8 节点 + 2 HG + N6⇄N7 互锁，全用 §3 的「节点 + 转移表」二原语表达。验证 α 抽象层次够不够。

### 9.1 节点列表（dag.json.nodes）

| id | name | agent_skill | is_gate | α 备注 |
|----|------|-------------|---------|--------|
| N1 | 调查 | venture-judge | false | 销售部，charter 组织架构 |
| N2 | 竞品 | venture-judge | false | 销售部 |
| N3 | 计划 | cc-2pp / cc-goal | false | 决策部 |
| HG1 | 人工门1 | （boss） | **true** | charter P1 三动词 |
| N4 | judge | venture-judge + venture-judge-extractor | false | 决策部，M1 红队对抗 |
| HG2 | 人工门2 | （boss） | **true** | 三轴送人工（M3 放弃自动 merge） |
| N5 | 产品设计 | （缺口，待层3 补 venture-product） | false | 产品部 |
| N6 | 画像 | venture-persona | false | 销售部，M2 互锁 |
| N7 | 需求 | venture-requirements | false | 产品部，M2 互锁 |
| N8 | UIUX | （缺口，待层3 补 venture-uiux） | false | 产品部 |
| END | 终态 | — | false | — |

### 9.2 转移表（dag.json.transitions，完整）

```jsonc
[
  // 主路径
  { "from": "N1", "to": "N2", "condition": "product_ok" },
  { "from": "N2", "to": "N3", "condition": "product_ok" },
  { "from": "N3", "to": "HG1", "condition": "product_ok" },

  // HG1 三动词（charter P1）
  { "from": "HG1", "to": "N4", "condition": "gate_resolved_continue" },
  { "from": "HG1", "to": "N1", "condition": "gate_resolved_shift", "description": "经 shift-direction 换向后回 N1" },
  { "from": "HG1", "to": "END", "condition": "gate_resolved_abort" },

  // N4 judge + extractor（50-decision §2.2 C1）
  { "from": "N4", "to": "N5", "condition": "signal_green" },
  { "from": "N4", "to": "HG2", "condition": "signal_yellow", "description": "🟡 送人工（M3 放弃自动 merge）" },
  { "from": "N4", "to": "HG2", "condition": "signal_red" },
  { "from": "N4", "to": "HG2", "condition": "signal_unknown", "description": "extractor 失败降级（missing#7）" },

  // HG2 三动词
  { "from": "HG2", "to": "N5", "condition": "gate_resolved_continue" },
  { "from": "HG2", "to": "N1", "condition": "gate_resolved_shift" },
  { "from": "HG2", "to": "END", "condition": "gate_resolved_abort" },

  // N5 → N6⇄N7 互锁（M2）
  { "from": "N5", "to": "N6", "condition": "product_ok" },

  // N6⇄N7 互锁（M2 MAX_ITER=3 单调收敛）
  { "from": "N6", "to": "N7", "condition": "product_ok", "description": "subloop.round++" },
  { "from": "N7", "to": "N6", "condition": "interlock_retry", "description": "未收敛，subloop.round++，round<3" },
  { "from": "N7", "to": "N8", "condition": "interlock_converged", "description": "收敛或 round==3 强制以当前 persona 为准（M2）" },

  // N8 → END
  { "from": "N8", "to": "END", "condition": "product_ok" }
]
```

### 9.3 2 个 HG 停等（C1 awaiting 对接）

HG1/HG2 节点的 `is_gate: true`。loop 跑到 gate 节点 → 不调 agent_skill（gate 没有 skill，boss 是「agent」）→ 直接写 `gate_status:"awaiting"` + `pending_gate` → 渲染面板（charter P1 重编码：信号 + top RedFlag + 推荐动作，非原始 dump）→ loop 停。boss 决定后写 `resolved_*` → loop 重启查转移表。

### 9.4 N6⇄N7 互锁套循环合同（M2 MAX_ITER=3）

α 派用 §2.1 的 `subloop` 字段 + 转移表回环表达互锁，**不引入子图原语**：

- 进 N6 → 写 `subloop={type:"interlock", round:1, max_round:3}`
- N6→N7 转移：`subloop.round` 不变（同一轮内 N6→N7）
- N7 完成校验收敛：
  - 收敛 → `condition:"interlock_converged"` → N8
  - 未收敛且 `round < 3` → `condition:"interlock_retry"` → 回 N6，`round++`
  - `round == 3` → 强制收敛（M2 单调收缩，50-decision §2.4）→ N8

**循环合同护栏**（cc-loop §三套到 subloop）：
- 护栏一：`subloop.round` vs `max_round:3`（M2 硬上限）
- 护栏二：`subloop.last_signal` 连续不变 = 无进展
- 护栏三：互锁迭代计入 `progress.tokens_used`（50-decision §2.5 m2）

> **α 派诚实标注**：N6⇄N7 互锁是 α 抽象层次的**边界用例**——它需要「转移表回环 + subloop 计数器」。α 用 `subloop` 单字段 + 回环转移表达，**没有**抽象成通用子图。若未来有第二个互锁场景，再考虑子图原语。**这是 α 与 γ 的边界争议点**：γ 可能主张「互锁 = 子图，应抽象子图原语」；α 反驳「一个用例不构成抽象理由，subloop 字段够用」。

---

## §10 所需 skills 清单（每个标在哪步用）

| skill | 用在哪步 | α 用途说明 |
|-------|---------|-----------|
| **venture-pipeline**（层2 核心，本次新建） | §4-§7 全程 | loop 驱动器 + 转移表解释器 + pipeline-state 读写 + 调 shift-direction |
| **cc-runtime**（层1，已装） | §6 §7 | 提供 shift-direction.js（direction.set 封装）+ state-schema 契约 + init-state.js 的 atomicWriteJSON 复用 |
| **cc-loop**（已装） | §4.1 §4.2 §9.4 | 循环合同六要素 + 三护栏模板 + ScheduleWakeup 决策（cc-loop §五） |
| **cc-orchestration**（已装） | §1 §4 | Workflow = 脚本决定下一步（决策树）+ 编排循环五字段（α 只用 ROUTING/MERGE/RECOVERY，CONFLICT 暂不用因线性 DAG 无并行） |
| **cc-goal**（已装） | §3.1 节点产物契约 | 每节点退出条件 = 终态条件设计（cc-goal 五层模型，节点级套用） |
| **cc-config**（已装） | §2 落地层 | pipeline-state.json 落 `.venture/state/`（与层1 隔离为主，state-schema §0） |
| **cc-2pp**（已装，本次元技能） | 全程 | 本次方案就是 cc-2pp 判官小组产物 |
| **venture-judge**（层3，延后） | §9.1 N1/N2/N4 | 调查/竞品/judge 节点 agent_skill |
| **venture-judge-extractor**（层3，延后） | §9.1 N4 | markdown 卡 → jsonld signal（50-decision §2.2 C1） |
| **venture-persona**（层3，延后） | §9.1 N6 | 画像节点 |
| **venture-requirements**（层3，延后） | §9.1 N7 | 需求节点 |
| **venture-product / venture-uiux**（层3 缺口） | §9.1 N5/N8 | charter D10 覆盖度盘点：产品部真空，待层3 补 |

> **α 派诚实标注**：层2 实施只依赖**已装 skills**（venture-pipeline 新建 + cc-runtime/cc-loop/cc-orchestration/cc-goal/cc-config 已装）。层3 skills（venture-*）延后，不阻塞层2 骨架落地——层2 可用「stub agent_skill」先跑通转移表，等层3 skill 上线再换字符串（§3.3 扩展点2）。

---

## §11 工作量估算（Claude 实施者度量：token / 轮次 / skill 配置 / 验证）

> **度量口径**（Prompt 约束3）：禁人天/人周。用 Claude Code 实施者的真实成本度量。

| 工作项 | token 估算 | 轮次 | skill 配置 | 验证复杂度 |
|--------|-----------|------|-----------|-----------|
| state-schema.md 升 frozen-v2（§7.1-7.2） | ~3k | 2 轮（改 + 重跑 70-req §1） | cc-runtime | 低（18 测试应全绿） |
| venture-pipeline/scripts/init-pipeline.js（§7.4 步3） | ~2k | 1 轮 + 1 轮单测 | cc-runtime（复用 atomicWriteJSON） | 低 |
| venture-pipeline/scripts/advance.js（§5.2 转移表解释器） | ~2k | 1 轮 + 1 轮单测 | — | 低（30 行查表） |
| venture-pipeline SKILL.md（§4-§6 流程文档化） | ~6k | 2 轮（写 + 校对） | cc-loop/cc-orchestration | 中（文档+配方） |
| venture/dag.json（§9 拓扑配置） | ~2k | 1 轮 + 1 轮校验 | cc-goal（产物契约） | 低（JSON 声明） |
| venture-pipeline-step loop prompt（§4.1 合同） | ~3k | 2 轮（写 + 试跑） | cc-loop | 中（循环合同调参） |
| INV-1' 一致性校验（§7.3） | ~2k | 1 轮 + 1 轮单测 | cc-runtime | 中（跨文件校验） |
| 端到端验证（N1→HG1 stub 跑通） | ~8k | 3-4 轮（跑 + 调 + 再跑） | venture-pipeline + cc-runtime | 高（集成验证） |
| **合计** | **~28k token** | **~13-15 轮** | **1 新建 + 5 已装** | 中-高 |

**对比 50-decision §2.5 m3 重估**：原估 venture-pipeline ~25k token / 3-4 会话。α 派估 ~28k token / 13-15 轮（≈3-4 会话，每会话 4-5 轮）——**与原估吻合**，α 没超预算。

**α 派 vs β/γ 预算对比**（α 主张）：
- α（最小通用）：~28k token
- β（运行时边对象 + 条件求值器）：估 +15k（DSL 设计 + 测试）= ~43k
- γ（子图 + 并行扇出）：估 +25k = ~53k

> α 质疑：β/γ 多花的 15-25k token 换的抽象，**在 cc-venture 跑通前无验证场景**。P1 最懒要求选 α。

---

## §12 风险清单（含致命弱点 · α 派自我拷问）

### 致命弱点（α 派主动暴露，留给 β/γ 攻击）

| ID | 风险 | 等级 | α 派的诚实回应 |
|----|------|------|---------------|
| **L1** | **subloop 字段是 N6⇄N7 专用 hack，非通用**——第二个互锁场景出现时要改 schema | 高 | **承认**。α 的赌注是「cc-venture 跑通前不会有第二个互锁场景」。若赌错，subloop → 子图原语的演进成本 ≈ 重写 advance.js + dag.json schema，可控（~5k token）。α 认为这个赌注值得：现在抽象子图 = 无场景验证的复杂度。 |
| **L2** | **INV-1' 第四项由层2 维护，层1 Hook 不覆盖**——层2 skill 忘写则 INV-1' 破 | 高 | **承认**。缓解：init-pipeline.js 强校验 + advance.js 每轮校验 `pipeline-state.direction_version == direction.current_version`，不一致则 awaiting。这是 α 接受的「层2 自管一致性」代价。β 方案（层1 Hook 自动同步）要改层1 Hook = 破 0 新 hook 基线，α 拒绝。**两害相权取 L2**。 |
| **L3** | **condition 枚举只有 7 个，新场景要改 advance.js 加 if 分支**——非真正「配置化」 | 中 | **部分承认**。α 的 condition 是枚举字符串，加新 condition = 改 advance.js（~5 行）+ 改 dag.json。vs β 的 DSL（运行时求值，不改代码）。α 主张：7 个 condition 覆盖 cc-venture 全部转移，新场景频率低，改 5 行 < 维护 DSL 测试套。 |

### 一般风险

| ID | 风险 | 等级 | 缓解 |
|----|------|------|------|
| M1 | loop 跨 session 续跑时，pipeline-state 与 checkpoint.current_node 冗余镜像可能不一致 | 中 | advance.js 每轮交叉校验 `pipeline-state.current_node == checkpoint.current_node`，不一致以 pipeline-state 为准（pipeline-state 是层2 真相源）+ 写 trace 告警 |
| M2 | HG 面板渲染质量（charter P1 重编码）依赖层3 venture-judge-extractor，层3 延后 | 中 | 层2 骨架先用 stub 面板（raw signal + 三动词），层3 extractor 上线后升级面板 |
| M3 | ScheduleWakeup 60s 自步进在长流水线（8 节点 × 5 轮 = 40 轮 × 60s = 40min）可能撞 Anthropic 速率限制 | 中 | 监控 tokens_used 速率，撞限则 ScheduleWakeup 自动拉长 delay（动态退避，cc-loop §五 ScheduleWakeup 自步进语义支持） |
| M4 | dag.json 转移表写错（路由黑洞）导致 loop 卡 awaiting | 低 | advance.js 黑洞检测（§5.2 已含）+ awaiting 面板提示 boss 修 dag.json |
| M5 | 层3 缺口节点（N5 产品设计 / N8 UIUX）无 skill，层2 跑到此处卡住 | 中 | charter D10 已标「产品部真空，待层3 补」。层2 骨架用 stub agent_skill 先跑通转移，层3 skill 上线后换字符串（§3.3 扩展点2） |

### α 派不视为风险的（预辨 β/γ 可能攻击点）

- **「α 不支持并行扇出」**——cc-venture 是线性 DAG（50-decision §2.1），无并行需求。并行扇出是 β/γ 的臆想，α 不背锅。
- **「α 不支持条件表达式」**——7 个 condition 枚举覆盖 cc-venture 全部转移（§9.2 验证）。条件表达式是 γ 的臆想。
- **「α 的 subloop 不通用」**——见 L1，α 已诚实承认并给出演进路径。

---

## §13 α 派一句话总结（给编排者评分用）

**层2 = 一张声明式 dag.json（节点 + 转移表）+ 一个自我推进的单 DAG-loop + 一个层2 自有的 pipeline-state.json（最小字段集）**。抽象只到二原语，子图/并行/条件求值器全部后置到「第二条流水线出现时」。cc-venture 8 节点 + 2 HG + N6⇄N7 互锁全用这二原语表达（§9 验证）。基线层 18 测试零改动（§7.3 保证）。工作量 ~28k token / 13-15 轮，与 50-decision 原估吻合。

**α 派的核心赌注**：cc-venture 跑通前不抽象通用运行时原语。赌赢了 = 最快落地 + 最少复杂度；赌输了 = subloop/condition 演进成本可控（~10k token）。**两害相权，α 选最小通用**。

---

**evidence_sources 复核**（Prompt 约束5）：
- §1 架构图：00-explore §1.B（层1 四文件）+ §1.C（层3 DAG）+ 50-decision §1.7（基线层转向）
- §2 pipeline-state：state-schema §0-§4（四文件契约）+ 00-explore §1.F 灰度3（状态边界）
- §3 DAG 原语：50-decision §2.1（8 节点）+ 00-explore §2 设计共识3（durable 自建按需）
- §4 loop：cc-loop §二（六要素）+ §三（三护栏）+ §五（决策树）+ §十一（反模式 300s）
- §5 脚本骨架：cc-orchestration「Workflow=脚本决定」+ 00-explore §1.F 灰度1/2
- §6 层1 接口：state-schema §5（接口契约）+ shift-direction.js 源码（INV-1 封装）
- §7 INV 扩展：state-schema §6（INV-1）+ §7.3（变更门）+ 50-decision §1.7（基线层 18 测试）
- §8 张力：00-explore §1.F（8 灰度点）+ §2（外部收敛方向）
- §9 cc-venture 映射：50-decision §2.1-2.5（8 节点 + C1/M1/M2/M3）
- §10 skills：charter 组织架构（5 部门）+ 50-decision §3（技能树）
- §11 工作量：50-decision §2.5 m3（venture-pipeline 重估）
- §12 风险：00-explore §1.F（灰度点）+ charter P1（最懒）
