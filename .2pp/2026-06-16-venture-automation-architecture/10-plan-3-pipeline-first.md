---
run: 2026-06-16-venture-automation-architecture
phase: 2
plan: 3
title: 方案3 — 流水线优先（venture 业务产物契约为系统之魂）
视角: 产品组（opus）—— venture 业务流水线优先
created: 2026-06-16
status: draft
direction_version: 1
---

# 方案3：流水线优先 — 业务产物契约是系统之魂，运行时是执行器

> **一句话核心切入**：先把 8 节点 venture 流水线 + 每节点产物契约钉死，让运行时（层1 checkpoint/trace）和编排（层2 workflow）都退居为流水线的**执行器与传送带**——业务连贯性和产物可消费才是系统真正的复利资产，技术运行时服务于它。
>
> **关键信念**：换方向、跑偏、丢上下文都不可怕；可怕的是"产物断了"——下游节点拿不到合规的输入 artifact，整条流水线就退化成一堆孤立的对话。所以**先契约、后运行时**。

---

## 1. 全景三层架构 + 层间接口契约 + 数据流

### 1.1 架构图（ASCII art）

```
╔════════════════════════════════════════════════════════════════════════════╗
║  层3  venture 业务流水线（系统之魂——产物契约在此定义）                        ║
║                                                                            ║
║   N1 商业调查 → N2 竞品 → N3 计划 → [HG1 pause] → N4 judge → [HG2 pause]     ║
║        → N5 产品设计 → N6 用户画像 ⇄ N7 需求 → N8 UIUX → DONE                ║
║                                                                            ║
║   每节点：{skill绑定, 输入schema, 输出artifact, 质量模式, workflow形状}        ║
║   HG1/HG2 = human gate（探索→计划→judge 后人工确认方向）                       ║
╚════════════════════════════════════════════════════════════════════════════╝
                                   │ 消费层3契约
                                   ▼ 接口契约：每节点声明 in_artifact / out_artifact
╔════════════════════════════════════════════════════════════════════════════╗
║  层2  harness 工作流引擎（传送带——按层3契约选执行形状+质量模式）                ║
║                                                                            ║
║   WorkflowShape 枚举(7) × QualityMode 枚举(5) → 每节点一个组合                ║
║   ecc 编排层：AGENTS / ROUTING / MERGE / CONFLICT / RECOVERY                 ║
║   pipeline / parallel / loop-until-dry 三种调度原语（cc-orchestration）       ║
╚════════════════════════════════════════════════════════════════════════════╝
                                   │ 落盘层2决定的状态
                                   ▼ 接口契约：checkpoint字段 + trace记录
╔════════════════════════════════════════════════════════════════════════════╗
║  层1  自主循环运行时（地基——痛点3/4全在此）                                    ║
║                                                                            ║
║   autopilot 可配 pipeline（骨架）+ ralph progress.txt（trace 扩字段）          ║
║   checkpoint：节点状态 + 当前任务 + 输入/输出产物路径 + 方向版本               ║
║   trace：每节点产物链（artifact_path[]），可回放整条流水线                      ║
║   方向指针：.venture/current-direction.md（单一指针，原子切换，痛点4解药）      ║
║   Hook 强制：Stop / PreCompact / PostToolUse → 写 checkpoint（痛点3解药）     ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### 1.2 层间接口契约（product 视角的核心——契约是层间唯一耦合面）

**层3 → 层2**：节点声明（层3 是业务权威，层2 只读不写）
```yaml
NodeContract:
  node_id: N4-judge
  bound_skill: venture-judge
  in_artifact_schema:         # 层3声明它需要什么输入
    required: [商业调查报告, 竞品矩阵, 计划方案]
    format: markdown
  out_artifact_schema:        # 层3声明它必产出什么
    type: judgment-card
    required_sections: [信号灯, 七维评分, RedFlags, 下一步行动]
    format: markdown + JSON-LD
  quality_mode: judge-panel   # 传给层2
  workflow_shape: parallel    # 传给层2
  human_gate_after: HG2       # 传给层1（决定是否 pause）
```

**层2 → 层1**：执行状态落盘（层2 执行完一个节点，层1 记账）
```yaml
ExecutionReport:              # 层2给层1的回执
  node_id: N4-judge
  status: completed | failed | paused
  out_artifact_path: .venture/run-{ver}/N4-judgment-card.md
  token_used: 8500
  iterations: 1
  next_node: N5-product-design
```

**层1 → 层3**：恢复时回放（compact 后层1 把"流水线现在到哪了"喂回层3）
```yaml
ResumeContext:                # 层1给层3的恢复包
  current_direction_version: 3
  completed_nodes: [N1, N2, N3, N4]    # 产物路径在 trace 里
  current_node: N5-product-design
  available_artifacts:                   # 层3可消费的上游产物清单
    - {node: N4, path: .venture/run-3/N4-judgment-card.md, schema: judgment-card}
```

**契约的product信念**：层3只要保证 in_artifact/out_artifact 的 schema 稳定，层1换存储、层2换 workflow 都不破坏业务——**契约是抗变化的唯一稳定面**。

### 1.3 数据流（业务产物在各层间的流动）

```
用户一句话想法
    │
    ▼
[N1 商业调查] 产物: investigation.md ──────────────────────┐
    │                                                      │ 全部产物流入
    ▼                                                      │ .venture/run-{ver}/
[N2 竞品] 产物: competitor-matrix.md ◄─ 并行可消费 N1 ───────┤ 作为下游输入
    │                                                      │ （trace 也记在这里）
    ▼                                                      │
[N3 计划] 产物: plan.md ◄─ 消费 N1+N2 ─────────────────────┤
    │                                                      │
    ▼ [HG1 pause] 人工看 N1/N2/N3 决定方向 ────────────────┤
    │                                                      │
    ▼                                                      │
[N4 judge] 产物: judgment-card.md(+json) ◄─ venture-judge │
    │      消费 N1/N2/N3 → 产出评判卡                       │
    ▼ [HG2 pause] 人工看评判卡决定走/换/停 ────────────────┤
    │                                                      │
    ▼                                                      │
[N5 产品设计] 产物: product-spec.md ◄─ 消费 N4 评判卡 ──────┤
    │                                                      │
    ▼                                                      │
[N6 用户画像] ◄┐                                          │
    │         │  N6 ⇄ N7 互锁：画像约束需求，需求反推画像  │
[N7 需求]    ◄┘  产物: persona.md / requirements.md ───────┤
    │                                                      │
    ▼                                                      │
[N8 UIUX] 产物: uiux-spec.md ◄─ 消费 N5/N6/N7 ─────────────┘
    │
    ▼
[DONE] 整条流水线产物可交付（投资deck / 产品文档 / 设计稿齐备）
```

---

## 2. 层3 业务流水线（本方案重点——前置详述）

### 2.1 8节点 DAG（顺序 / 分支 / 并行机会 / 每节点用哪个 skill）

```
                              ┌── N1 商业调查 ──┐
                              │   (parallel)    │
            用户一句话想法 ────┤                 ├──► 汇合
                              │   N2 竞品 ──────┘   (HG1前可并行)
                              └─────────────────┘
                                       │
                                       ▼
                              N3 计划（cc-2pp 探索→方案）
                                       │
                                  ╔══ HG1 ══╗  人工确认方向
                                  ╚════════╝
                                       │
                                       ▼
                              N4 judge（venture-judge）
                                       │
                                  ╔══ HG2 ══╗  人工看评判卡定走/换/停
                                  ╚════════╝
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
                   N5 产品设计              N6 用户画像 ◄──┐
                          │                         │       │ 互锁
                          │                         ▼       │
                          │                    N7 需求 ─────┘
                          │                         │
                          └────────────┬────────────┘
                                       ▼
                              N8 UIUX（消费 N5/N6/N7）
                                       │
                                       ▼
                                    DONE
```

| 节点 | 主 skill | 辅助 skill | 执行形态 | 并行机会 | 分支说明 |
|------|---------|-----------|---------|---------|---------|
| N1 商业调查 | venture-judge `/deep` | deep-research, anysearch | parallel(3路证据检索) | **与 N2 并行**（无依赖） | venture-judge 阶段二的"三项证据检索"天生 parallel |
| N2 竞品 | venture-judge `/compete` | gstack/investigate, deep-dive | parallel(直接/相邻/免费/高价4维) | **与 N1 并行** | venture-judge `/compete` 内部已并行 |
| N3 计划 | cc-2pp | gsd-plan-phase, ralplan | pipeline(Explore→Plan→Verify) | 内部对抗并行 | 2pp Phase 0→2→4 |
| **HG1** | — | — | **human gate pause** | — | 人工读 N1/N2/N3 决定方向 |
| N4 judge | **venture-judge `/judge`** | gstack/retro | parallel(三轴:创始人/投资人/一人公司) | 三轴可并行打分 | judge 节点主力，见 2.4 |
| **HG2** | — | — | **human gate pause** | — | 人工读评判卡决定走/换/停 |
| N5 产品设计 | gstack/design-consultation | web-design-guidelines, typography | pipeline | — | 消费评判卡的"下一步行动" |
| N6 用户画像 | **新建 venture-persona**（见 2.5）或 deep-interview 降级 | deep-research | pipeline | **与 N7 互锁迭代** | 缺口节点，见 2.5 |
| N7 需求 | **新建 venture-requirements**（见 2.5）或 gsd-add-backlog 降级 | deep-interview | pipeline | **与 N6 互锁迭代** | 缺口节点，见 2.5 |
| N8 UIUX | gstack/ui-phase | gstack/ui-review, typography | pipeline | — | 消费 N5/N6/N7 |

**product 视角的 DAG 纪律**：N1/N2 并行是流水线**唯一一次天然并行机会**（节省墙钟时间），其余串行——因为 venture 业务强因果（没有评判卡的产品设计是空中楼阁）。N6⇄N7 互锁是唯一允许的"非顺序"关系（画像和需求互相塑造）。

### 2.2 每节点产物契约（artifact schema——product 视角的核心交付）

> **契约信念**：下游节点拿到的必须是可以直接消费的结构化产物，不是一段对话回忆。schema 用"必需章节"（轻量框架，呼应 2pp-guide 不用刚性 JSON），但**必带一个 machine-readable 的 JSON-LD 头**供层2做契约校验。

#### N1 商业调查产物契约
```yaml
artifact: investigation.md (+ investigation.jsonld)
schema:
  required_sections:                    # markdown 必需章节
    - 一句话业务假设
    - 市场规模(TAM/SAM/SOM, 带[待验证]标注)
    - 目标用户初描
    - 付费路径假设
    - 已知不确定项
  jsonld_header:                        # 机器可读头，层2校验用
    "@type": investigation
    market_signals: [string]
    confidence: high|medium|low
consumer: N3(计划), N4(judge)
```

#### N2 竞品产物契约
```yaml
artifact: competitor-matrix.md (+ competitor-matrix.jsonld)
schema:
  required_sections:
    - 直接竞品(4列: 名字/收费/差异/可复制点)
    - 相邻替代
    - 免费替代
    - 高价替代
    - 竺争空白(谁都没做的)
  jsonld_header:
    "@type": competitor-matrix
    direct_competitors_count: int
    free_alternative_exists: bool
consumer: N3(计划), N4(judge), N8(UIUX 参考竞品设计)
```

#### N3 计划产物契约（直接复用 2pp 产物）
```yaml
artifact: plan.md (= 2pp 的 50-decision.md + 60-impl-plan.md 精简版)
schema:
  required_sections:
    - 选定方向(一句话)
    - 核心假设(3-5条, 可证伪)
    - 最小验证路径
    - 风险点
  jsonld_header:
    "@type": venture-plan
    direction_version: int              # 关键：换方向时 version+1，旧 plan 自动 superseded
consumer: N4(judge), 层1方向指针
```

#### N4 judge 评判卡产物契约（本方案重头戏——见 2.4）
```yaml
artifact: judgment-card.md (+ judgment-card.jsonld)
schema:
  required_sections:                    # venture-judge references/judgment-card.md 已定义
    - 信号灯(🟢/🟡/🔴) + 一句话判断
    - 三轴评分(创始人/投资人/一人公司)
    - 案例对标(成功+警示, 各拆解可复制/不可复制)
    - 七维评分表
    - RedFlags
    - 方法论锚点(24步法步骤号)
    - 下一步行动(本周验证 + 停损线)
  jsonld_header:
    "@type": venture-judgment-card
    signal: green|yellow|red            # 下游 HG2/N5 据此决策
    go_score: float                     # 综合分, <阈值 → 自动建议换方向
    stop_loss_line: string
consumer: HG2(人工), N5(产品设计), 层1(若 red → 触发换方向)
```

#### N5-N8 产物契约（节选关键字段）
```yaml
N5 产品设计: product-spec.md
  jsonld_header: {"@type": product-spec, core_features: [string], differentiator: string}
  consumer: N8

N6 用户画像: persona.md
  jsonld_header: {"@type": persona, segments: [string], jtbd: [string]}
  consumer: N7(互锁), N8

N7 需求: requirements.md
  jsonld_header: {"@type": requirements, must_have: [string], nice_to_have: [string], falsifiable: [string]}
  consumer: N8

N8 UIUX: uiux-spec.md
  jsonld_header: {"@type": uiux-spec, key_flows: [string], component_inventory: [string]}
  consumer: DONE(交付)
```

**product 信念落地**：每个 artifact 的 jsonld_header 就是**契约接口**。层2 在节点开始前校验 in_artifact 的 jsonld_header 字段齐全——不齐 = 流水线断点 = 不让节点开工。这把"产物契约"从口号变成可验证闸。

### 2.3 human gate 设计（探索→计划→judge 后 pause——product 视角的产品体验）

**为什么是这两道 gate（不是每节点都 gate）**：
- HG1（计划后）：方向定调。N1/N2/N3 是"侦察"，到这里用户第一次看到全景，必须确认"这个方向值得继续"——不然 N4 judge 白跑。
- HG2（judge 后）：生死决策。评判卡的 🟢/🟡/🔴 直接决定"走/谨慎验证/换方向"——这是流水线唯一的硬分叉点。

**pause/resume 状态机（product 视角：用户视角要简单）**：
```
流水线运行 ──► HG1 ──► [PAUSED] ──► 用户确认 ──► RESUME
                              │
                              ├─► 用户改向 ──► 方向版本+1 ──► 从 N3 重跑（N1/N2 产物保留，作为新方向输入）
                              └─► 用户放弃 ──► ARCHIVED（产物归档不删）

流水线运行 ──► HG2 ──► [PAUSED] ──► 用户看评判卡
                              │
                              ├─ 🟢 go     ──► RESUME → N5
                              ├─ 🟡 verify ──► RESUME → 回 N3 补验证假设（不换方向）
                              └─ 🔴 pivot  ──► 方向版本+1 → 回 N1（方向根本错了）
```

**暂停态存储（层1 落地）**：
```yaml
# .venture/pipeline-state.json（层1维护，原子写）
{
  "direction_version": 3,
  "pipeline_status": "PAUSED_AT_HG1",
  "paused_at_node": "N3-plan",
  "paused_reason": "awaiting_human_direction_confirm",
  "available_artifacts_at_pause": [
    "N1/investigation.md", "N2/competitor-matrix.md", "N3/plan.md"
  ],
  "resume_options": ["confirm_and_continue", "pivot_to_new_direction", "archive"]
}
```

**resume 的 product 体验（关键）**：
- 用户回来只需要在对话里说"继续" / "换方向到 X" / "放弃"——三种动词。
- 系统（层1）读 pipeline-state.json 的 resume_options，自动判断分支，不需要用户记"我在哪个 gate"。
- **痛点4 的真正解药**：pause 时当前方向版本锁死在 state；用户换方向 → version+1 → 旧版本的所有 plan/investigation 自动 superseded（jsonld_header 的 direction_version 字段不匹配 = 层2 拒绝消费）。**换方向不再靠 agent 记得忽略旧文件，靠契约版本号**。

### 2.4 judge 节点如何接入 venture-judge（本方案核心论证）

**入口选择（product 视角：哪个入口最适合流水线节点）**：

| 入口 | 输出 | 是否适合 N4 流水线节点 | 理由 |
|------|------|---------------------|------|
| `/judge` | 文本评判卡（最快） | **✅ 默认主力** | 流水线要的是结构化评判卡（下游 N5 消费），不需要 HTML PPT。最快、最契合约。 |
| `/report` | 卡 + HTML PPT | ⚠️ HG2 后可选 | 用户想看可视化报告时，HG2 后补跑 `/report`，但**不影响流水线**（卡是契约，PPT 是装饰）。 |
| `/deep` | 卡 + 24步引导 | ❌ 太重 | 24步是给人用的，流水线节点不需要。 |
| `/pitch` | HTML 路演 | ❌ 投资人场景专用 | 流水线不是路演。 |
| `/compete` | 竞争 + HTML | ❌ 已在 N2 用过 | N2 已消费竞争数据。 |
| `/cases` | 案例对标 + HTML | ❌ 已在 N1/4 内嵌 | venture-judge 阶段二已做案例匹配。 |

**结论**：N4 节点用 `/judge`（创始人轴默认），三轴评分作为内部 parallel 子任务（见下）。

**三轴的流水线化（关键创新）**：
venture-judge 的三轴（创始人/投资人/一人公司）原本是"用户选一个主轴"。**在流水线里改成"三轴都跑"**——因为下游产品设计和需求需要三个视角的综合判断，不只一个轴。

```yaml
N4 内部执行（层2 用 parallel 模式）:
  parallel:
    - 创始人轴评分: 权重 40/20/15/15/5/3/2 (SKILL.md L91-98)
    - 投资人轴评分: 阶段自适应权重 (L106-114)
    - 一人公司轴评分: 40/20/20/10/10 (L120-126)
  merge: venture-judge 的信号灯系统(L160-164)做最终仲裁
         三轴都🟢 → 🟢；任一🔴 → 🟡(降级,非直接🔴,留给HG2人判)
```

**评判卡 → 下游输入（product 信念的兑现点）**：
评判卡的 jsonld_header（signal/go_score/stop_loss_line）是 N5 产品设计的**直接输入**：
```yaml
N5 product-spec.md 的生成逻辑:
  if judgment.signal == green:
    core_features = judgment.下一步行动.本周验证项 → 转为产品功能
    differentiator = judgment.七维评分.解决方案维度的高分项
  elif signal == yellow:
    # N5 不开工, 回 N3 补验证假设
    pipeline.redirect(N3, reason: "yellow_signal_needs_assumption_validation")
  elif signal == red:
    # 不进 N5, 等 HG2 人工 pivot
    pipeline.pause(HG2)
```
**这就是"judge 节点的评判卡作为下游输入"的精确机制——评判卡不是一个结论，是流水线的路由控制信号**。

### 2.5 用户画像 / 需求 缺口节点怎么补（product 视角的缺口处理）

**product 信念**：缺口不能让流水线断。N6/N7 是 venture 流水线从"判断能不能做"跨到"具体做什么"的关键桥梁，必须有产物。

**方案：新建 2 个轻量 venture-* skill（而非降级 deep-interview）**

理由（为什么不降级 deep-interview）：
- deep-interview 是"通用访谈技能"，没有 venture 业务知识（不知道怎么从评判卡推导画像）。
- deep-research 是"外部检索"，不能凭空生成画像/需求。
- 流水线节点需要**消费上游 artifact + 产出标准 schema** 的专用 skill，通用工具做不到契约一致性。

**venture-persona（N6 用）设计骨架**：
```yaml
name: venture-persona
description: 从 venture-judge 评判卡 + N1 调查 + N5 产品spec 推导用户画像
inputs:
  - judgment-card.md (消费 N4)
  - investigation.md (消费 N1)
  - product-spec.md (消费 N5)
outputs:
  - persona.md (schema 见 2.2)
method:
  - 从评判卡的"目标用户初描" + 七维评分的"需求/问题"维度出发
  - 推导 2-3 个 persona segment
  - 每个 segment: 画像 + JTBD(任务) + 痛点 + 付费意愿(呼应一人公司轴)
  - 与 N7 互锁: 画像约束需求边界, 需求反向修正画像
reuse: venture-judge 的 knowledge/cases/ 做案例佐证(已有数据资产)
```

**venture-requirements（N7 用）设计骨架**：
```yaml
name: venture-requirements
description: 从用户画像 + 产品spec + 评判卡生成可证伪需求清单
inputs:
  - persona.md (消费 N6)
  - product-spec.md (消费 N5)
  - judgment-card.md (消费 N4 的"下一步行动")
outputs:
  - requirements.md (schema 见 2.2, must_have/nice_to_have/falsifiable 三段)
method:
  - 把评判卡"本周验证项"转为 must_have 需求
  - 把产品 spec 的核心功能转为 must_have
  - 每条需求附可证伪验证方法(呼应 cc-goal L4, 给 N8 UIUX 验收用)
  - 与 N6 互锁: 需求超画像边界 → 反推 N6 修正
```

**降级策略（product 务实面）**：
若用户不想造新 skill，N6/N7 降级为 `deep-interview + 模板化 prompt`——但**产物 schema 必须不变**（venture-persona/requirements 的 output schema 固定，deep-interview 只是执行体变了）。契约不降级，只执行体降级。这是 product 视角的底线：**流水线不断比执行质量更重要**。

---

## 3. 层1 深度设计（流水线优先视角下，运行时如何服务流水线）

> **product 视角的层1定位**：层1不是主角，是流水线的"账房先生 + 档案员"。checkpoint=记账（节点执行到哪），trace=归档（产物链可回放），方向切换=换账本（DAG 重置或分支）。

### 3.1 checkpoint = 节点执行状态（服务于流水线进度）

```yaml
# .venture/checkpoint.json（每节点完成后 Hook 强制写）
{
  "direction_version": 3,
  "pipeline_status": "RUNNING|PAUSED_AT_HG1|PAUSED_AT_HG2|DONE|ARCHIVED",
  "current_node": "N5-product-design",
  "completed_nodes": [
    {"node": "N1", "artifact": "investigation.md", "token": 4200, "iter": 1},
    {"node": "N2", "artifact": "competitor-matrix.md", "token": 3800, "iter": 1},
    {"node": "N3", "artifact": "plan.md", "token": 12000, "iter": 2},
    {"node": "N4", "artifact": "judgment-card.md", "token": 8500, "iter": 1}
  ],
  "human_gates": {
    "HG1": "passed (direction v3 confirmed at 2026-06-16T10:30Z)",
    "HG2": "passed (green signal, go)"
  },
  "budget_used_tokens": 28500,
  "budget_cap_tokens": 200000,
  "last_progress_hash": "a3f...",      # 无进展检测用: 连续3次同hash → 停
  "updated_at": "2026-06-16T11:00Z"
}
```

**对比痛点3现状（00-explore.md L84-99）**：
- 旧 checkpoint：`active_modes:{}`, `todo_summary:全0`，`pending:0` —— 全空。
- 新 checkpoint：`completed_nodes` 带产物路径+token+iter，`pipeline_status` 精确到节点，`human_gates` 记录通过状态。**节点级粒度，不是心跳快照**。

**写入时机（cc-config Hook 模式4 落地）**：
```
PostToolUse(skill=venture-*, 或 node 完成) → 写 checkpoint
Stop hook → 读 checkpoint, pipeline_status≠DONE → exit 2 阻止过早退出
PreCompact → checkpoint 已是最新(因 PostToolUse 已写), 额外把 pipeline-state.json 复制到 .venture/snapshot/
SessionStart → 读 checkpoint + current-direction.md, 重建流水线位置
```

### 3.2 trace = 每节点产物链（服务于流水线回放）

```yaml
# .venture/trace.jsonl（追加式, ralph progress.ts 模式扩展）
{"ts":"2026-06-16T10:00Z","node":"N1","action":"start","inputs":["user-idea"]}
{"ts":"2026-06-16T10:05Z","node":"N1","action":"complete","artifact":"investigation.md","learnings":["市场TAM数据需验证"]}
{"ts":"2026-06-16T10:05Z","node":"N2","action":"start","inputs":["investigation.md"]}
...
{"ts":"2026-06-16T10:30Z","node":"HG1","action":"human_passed","decision":"direction v3 confirmed"}
{"ts":"2026-06-16T10:45Z","node":"N4","action":"complete","artifact":"judgment-card.md","signal":"green"}
```

**对比痛点3（00-explore.md L78）**：ralph progress.txt 的 `{implementation,filesChanged,learnings}` 扩展为含 `{node,action,artifact,learnings,signal}` 的流水线语义 trace。**trace 现在是"业务产物链"，不是"代码改动链"**——product 信念：业务连贯性优先。

**trace 的产品价值**：用户任何时候问"我之前那个方向怎么走到这一步的"，读 trace.jsonl 即可完整回放——这是 product 视角下用户最想要的"业务记忆"。

### 3.3 方向切换 = DAG 重置或分支切换（服务于痛点4）

**痛点4根因（00-explore.md L102-106）**：换方向后旧 plan/investigation 被重读，因为无版本标记。

**product 视角的解药：方向指针 + 产物版本双保险**

```yaml
# .venture/current-direction.md（单一指针, 原子写）
---
direction_version: 3
direction_statement: "面向独立开发者的 AI 写作 SaaS"
superseded_version: 2
superseded_reason: "HG2 判定 v2 的 B2B 方向付费意愿不足"
created_at: 2026-06-16T10:31Z
current_pipeline_node: N5
---
```

**切换机制（两层防护）**：
1. **指针层（层1）**：换方向 → 原子更新 current-direction.md 的 direction_version。所有节点启动前先读这个版本号。
2. **契约层（层3）**：每个 artifact 的 jsonld_header 带.direction_version。下游消费前校验：`artifact.direction_version == current.direction_version`，不匹配 → 层2 拒绝消费 + 提示"此产物来自旧方向 v2，已 superseded"。

**切换的三种语义（product 视角：不是所有换向都重跑全部）**：
| 切换类型 | 触发 | DAG 处理 | 产物处理 |
|---------|------|---------|---------|
| 微调（同方向改细节） | HG1 用户确认时改 plan | 从 N3 重跑 | N1/N2 保留复用 |
| Pivot（评判卡 🔴） | HG2 | 方向版本+1，从 N1 重跑 | 旧版本全归档(不删) |
| 放弃 | 用户主动 | ARCHIVED | 全部归档到 .venture/archive/v{n}/ |

**痛点4彻底解药**：不再靠"agent 记得忽略旧文件"——靠 direction_version 契约校验。旧文件还在（不丢业务记忆），但层2 自动拒绝消费它们。

---

## 4. 层2 骨架（7种 workflow × 5种质量模式，每节点用哪种组合）

### 4.1 7种 workflow 枚举 + 每节点的选择

| Workflow 形状（cc-orchestration 对应） | 用在哪个节点 | 理由 |
|---------------------------------------|------------|------|
| 1. Executor(Input→Execute→Output) | N5, N8 | 单步产出，无迭代 |
| 2. Plan-Do(Goal→Plan→Execute) | N3(部分) | 计划即执行 |
| 3. ExplorePlan-Do | **N3 主力** | cc-2pp 全流程就是这形状 |
| 4. ExplorePlan-DoReview | N3 的对抗验证 | 2pp Phase 2 对抗 |
| 5. Loop Planner(迭代到 passes) | N6⇄N7 互锁 | 画像↔需求迭代收敛 |
| 6. Discovery Loop(循环至干) | N1, N2 的证据检索 | venture-judge 三项检索天生循环至干 |
| 7. (parallel 多视角) | **N1/N2 并行, N4 三轴** | cc-orch 模式1/2 |

### 4.2 5种质量模式 × 每节点选择

| 质量模式（cc-orchestration） | 用在哪个节点 | 理由 |
|----------------------------|------------|------|
| 1. 对抗验证 | N3 计划 | 2pp 对抗验证就是这模式 |
| 2. 判官小组 | **N4 judge 本身就是判官** | venture-judge 三轴 = 判官小组实例 |
| 3. 循环至干 | N1, N2 | 证据检索直到无新发现 |
| 4. 多模式扫描 | N1 商业调查 | 多角度证据(TAM/竞品/案例) |
| 5. 完整性批评 | HG2 前自检 | 评判卡"还漏什么" |

### 4.3 每节点 Workflow × Quality 组合表（product 视角的编排决定）

| 节点 | Workflow 形状 | 质量模式 | skill | 备注 |
|------|-------------|---------|-------|------|
| N1 商业调查 | parallel(7) | 多模式扫描(4) + 循环至干(3) | venture-judge `/deep` + deep-research | 三项证据并行 |
| N2 竞品 | parallel(7) | 循环至干(3) | venture-judge `/compete` | 4维竞品并行 |
| N3 计划 | ExplorePlan-DoReview(4) | 对抗验证(1) | cc-2pp | 2pp 内置对抗 |
| HG1 | — | — | — | human pause |
| N4 judge | parallel(7) | **判官小组(2)** | venture-judge `/judge` 三轴 | judge 即判官 |
| HG2 | — | 完整性批评(5) | — | human pause 前自检 |
| N5 产品设计 | Executor(1) | — | gstack/design-consultation | 单步 |
| N6 用户画像 | Loop Planner(5) | — | venture-persona(new) | 与 N7 互锁 |
| N7 需求 | Loop Planner(5) | — | venture-requirements(new) | 与 N6 互锁 |
| N8 UIUX | Executor(1) | — | gstack/ui-phase | 单步 |

### 4.4 ecc 编排层（AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY 落地）

```yaml
# .venture/orchestration-contract.yaml（层2 配置, 泛化自 autopilot PipelineConfig）
AGENTS:
  N1: [venture-judge-deep, deep-research]
  N2: [venture-judge-compete]
  N3: [cc-2pp]
  N4: [venture-judge-judge × 3轴]   # parallel 实例
  N5: [gstack-design]
  N6: [venture-persona]
  N7: [venture-requirements]
  N8: [gstack-ui-phase]

ROUTING:
  default: sequential
  parallel_groups:
    - [N1, N2]                       # 无依赖并行
    - N4 内部三轴 parallel
  interlock: [N6, N7]                # 互锁迭代

MERGE:
  N1+N2 → N3: 两个 artifact 都传给 cc-2pp 作为 explore 输入
  N4 三轴 → 评判卡: venture-judge 信号灯系统仲裁

CONFLICT:
  N6⇄N7 互锁冲突: 以"画像约束需求"为优先(画像是需求的上游), 需求超界 → 回 N6 修正
  HG pivot: 方向版本+1, 走 CONFLICT-FIFO(旧版本先归档)

RECOVERY:
  节点失败: retry 2 次 → 标记 FAILED → 跳过(标注)继续, 不阻塞整条流水线
  HG 超时(用户不回): pipeline_status 保持 PAUSED, 7天后提醒(呼应 CronCreate 7天上限)
  budget 超限: pipeline_status=PAUSED_BUDGET, 等用户加预算或缩减范围
```

---

## 5. 度量（Claude 实施者视角——禁人天/人周）

### 5.1 全流水线一次跑通的预算（token / 轮次 / skill 配置）

| 节点 | skill | 预估 token | 轮次 | 备注 |
|------|-------|-----------|------|------|
| N1 商业调查 | venture-judge `/deep` + deep-research | ~15k | 3-5(并行) | 三项证据检索 |
| N2 竞品 | venture-judge `/compete` | ~8k | 2-3(并行,与N1同时) | 4维竞品 |
| N3 计划 | cc-2pp | ~30k | 6-10(含对抗) | 2pp Phase 0→2→4 |
| HG1 | — | 0 | 0(人工) | — |
| N4 judge | venture-judge `/judge` | ~12k | 3(三轴并行) | 评判卡 |
| HG2 | — | 0 | 0(人工) | — |
| N5 产品设计 | gstack-design | ~10k | 2 | product-spec |
| N6 用户画像 | venture-persona | ~8k | 2-3(互锁) | persona |
| N7 需求 | venture-requirements | ~8k | 2-3(互锁) | requirements |
| N8 UIUX | gstack-ui-phase | ~12k | 3 | uiux-spec |
| **合计（一次跑通）** | | **~103k token** | **~23-32 轮** | 不含 HG 人工等待 |

**预算上限（循环合同 BUDGET）**：
```yaml
BUDGET:
  token_cap: 200000                  # 全流水线, 含 retry
  iteration_cap_per_node: 5          # 单节点最多5轮(无进展检测兜底)
  web_search_cap: 15轮               # cc-2pp 技术选型搜索上限
  parallel_slots: 2                  # N1/N2 并行, worktree SOP 槽位≤2
```

**成本换算（给用户的体感）**：~103k token ≈ 一次深度咨询的费用量级，产出 8 个结构化 artifact + 2 次 human gate 决策。product 视角的 ROI：用户花两次确认（HG1/HG2）拿到一份完整的 venture 决策+产品+设计资产包。

### 5.2 可验证闸（每节点的 STOP 条件——cc-goal L4 落地）

| 节点 | 可验证闸（可证伪） |
|------|------------------|
| N1 | investigation.md 含 5 个必需章节 + jsonld_header.market_signals 非空 |
| N2 | competitor-matrix.md 含 4 类竞品 + jsonld_header.direct_competitors_count ≥ 0 |
| N3 | plan.md direction_version 匹配 + 核心假设 ≥ 3 条且每条可证伪 |
| N4 | judgment-card.md 信号灯 ∈ {🟢,🟡,🔴} + 七维评分表完整 |
| N5 | product-spec.md core_features ≥ 1 + differentiator 非空 |
| N6 | persona.md segments ≥ 1 + jtbd ≥ 1 |
| N7 | requirements.md must_have ≥ 1 + 每条有可证伪验证 |
| N8 | uiux-spec.md key_flows ≥ 1 + component_inventory ≥ 1 |

**闸的实现（层2 执行）**：每节点完成后，层2 读 artifact 的 jsonld_header + 必需章节，grep 校验。不过闸 → retry（最多5轮）→ 仍不过 → 标记 FAILED + 标注 + 流水线继续（product 信念：流水线不断 > 单节点完美）。

### 5.3 skill 配置清单（实施者要装/造什么）

| skill | 状态 | 动作 |
|-------|------|------|
| venture-judge | ✅ 已装 | N1/N2/N4 直接用 |
| deep-research | ✅ 已装 | N1 辅助 |
| cc-2pp | ✅ 已装 | N3 直接用 |
| gstack/design-consultation | ✅ 已装 | N5 直接用 |
| gstack/ui-phase | ✅ 已装 | N8 直接用 |
| **venture-persona** | ❌ 缺口 | **新建**（见 2.5） |
| **venture-requirements** | ❌ 缺口 | **新建**（见 2.5） |
| **venture-pipeline**（编排 skill） | ❌ 缺口 | **新建**：封装层2编排逻辑（读 orchestration-contract.yaml → 驱动 8 节点） |

**新建 skill 的工作量（Claude 度量）**：
- venture-persona / venture-requirements：各 ~5k token 起草 SKILL.md + 复用 venture-judge 数据资产，1 会话可成。
- venture-pipeline（编排核心）：~15k token，需封装 autopilot pipeline 泛化 + ecc 编排合同，2-3 会话。

---

## 6. 自评

### 6.1 三个强点

1. **产物契约是抗变化的稳定面**（product 核心信念落地）：层3 的 in/out artifact schema + jsonld_header 把"业务连贯性"变成可校验的契约接口。层1 换存储、层2 换 workflow，只要契约不变，业务不断。这直接对抗痛点4（产物断裂）——下游靠 direction_version 校验，不靠 agent 记忆。

2. **judge 评判卡作为路由控制信号**（venture-judge 接入的精确机制）：评判卡的 signal/go_score 不只是结论，是 N5 是否开工、HG2 是否 pivot 的控制信号。这把 venture-judge 从"独立工具"变成"流水线的中枢神经"——评判卡的 jsonld_header 驱动 DAG 分支。这是 product 视角独有的洞察（其他视角会把 judge 当终点，product 把它当路由器）。

3. **human gate 产品体验极简**（3 个动词：继续/换向/放弃）：pause/resume 状态机把复杂的 pipeline 状态收敛成用户视角的 3 个动词，pipeline-state.json 自动判断分支。痛点4 的解药（direction_version 契约）对用户透明——用户只说"换方向到 X"，版本号自动+1，旧产物自动 superseded。这是 product 视角对"用户体验 > AI 情绪"原则的兑现。

### 6.2 三个最易失败假设

**假设1（业务侧高风险）：judge 误判传错下游**
- 假设：评判卡的 signal 准确反映方向可行性，N5 据此开工或 redirect。
- 失败场景：venture-judge 三轴评分因案例库偏差（150+案例以独立开发者为主）对某方向给出假🟢，N5 基于错误 signal 开工，HG2 时用户才发现方向不对——浪费 N5-N8 的 token。
- 缓解：HG2 是兜底（人工看评判卡定走/换/停），但若用户过度信任 🟢 不细看，风险传导。**product 视角的诚实**：judge 节点不是金标准，是"加速器+减速器"，HG2 的人工判断才是终审。

**假设2（契约侧风险）：产物契约不匹配**
- 假设：每节点 artifact 的 jsonld_header 字段稳定，下游能消费。
- 失败场景：venture-persona（新建 skill）产出的 persona.md jsonld_header 字段与 N7 venture-requirements 期望的不一致（比如 persona 写 segments，requirements 读 segment_list）——契约不匹配，层2 校验失败，流水线断在 N7。
- 缓解：contract 先行——venture-persona/requirements/pipeline 三个新 skill 的 schema 必须在层3 契约表（2.2）里先定义死，skill 实现服从契约。**product 信念的反面风险**：契约好，但契约本身设计错（字段命名/类型），整条链断。需要 contract review gate。

**假设3（体验侧风险）：human gate 体验差导致用户放弃**
- 假设：用户会在 HG1/HG2 主动回来确认，pause/resume 流畅。
- 失败场景：HG1 pause 后用户忙别的事，7 天后（CronCreate 上限）pipeline 状态丢失，或用户回来发现要重新理解 N1/N2/N3 产物成本高，干脆放弃——整条流水线半途而废。
- 缓解：pause 时给用户极简摘要（"方向 X，3 个产物已就绪，回'继续'即可"），resume 时自动回放 trace 摘要（不要求用户重读全部产物）。**product 视角的临界点**：human gate 是流水线的"用户接触面"，体验差 = 流水线死。HG 设计的投入（摘要/回放/3动词）不是花哨，是流水线存活率的工程必要。

---

## 附：与 Loop Engineering 的衔接（product 视角）

```
本方案(层3契约定义) 
    ↓
cc-2pp 已用于 N3（内置衔接）
    ↓
cc-goal：每节点的可验证闸 = L4 终态条件（5.2 的闸表）
    ↓
cc-loop：层1 autopilot pipeline = 循环执行体，STOP = 节点闸通过
    ↓
cc-orchestration：层2 = 编排合同扩展实例（AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY）
```

本方案处于 Loop Engineering Stage 4-5 之间：Stage 4（编排循环监督多 agent）已落地（层2 parallel/pipeline），Stage 5（全自动 Gas Town）未到——HG1/HG2 的人还在循环外关键节点把关。**product 视角的阶段判断**：venture 业务（涉及真金白银方向决策）不该全自动，HG 是产品价值不是技术妥协。
