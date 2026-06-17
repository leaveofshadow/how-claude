---
run: 2026-06-17-hcc-org-departmentalization
artifact: plan
faction: beta（平衡派）
core_thesis: 严格 5 独立部门目录 + 共享协作协议下沉 cc-runtime/references/hcc-protocol.md
created: 2026-06-17
status: draft
evidence_sources:
  - 00-explore.md（§一技能清单 / §二层1 state schema / §三层2接口 / §四部门映射 / §五 8 发现 / §六 0b 校正 / §七 BOSS 决策 / §八 模式 C）
  - 00-charter.md（§组织架构 D10=A 工具箱模型 / §部署约束 / §根原则 P1-P4）
  - cc-runtime/references/state-schema.md（§0 四文件总览 / §7 版本化协议 / 层1 owns references 先例）
---

# 10-plan-beta.md —— β 平衡派方案：5 独立部门目录 + 协议下沉层1

> 独立思考的一等公民产出。effort=max，不走捷径。事实声明带证据来源节号。

---

## 方案核心主张（一句话 + 200 字展开 β 下沉放置）

**一句话**：5 个部门目录严格独立（名实相符，BOSS 选了"5 独立"就真给 5 独立），但跨部门共享的协作总则、RACI 总表、交接协议**抽到 `cc-runtime/references/hcc-protocol.md`**——让层1 地基 owns 协议，部门 SKILL.md 只聚焦部门内职责。

**200 字展开（为何下沉层1）**：层1 cc-runtime 已有 `state-schema.md` 这个先例——状态 schema 是协议契约，frozen 在层1 references，层1 七 Hook 与层3 八节点共同读它（state-schema §0「schema 是层1 与层3 的共同边界」）。部门协作协议在物理上就是"对 state 四文件 + direction + pipeline-state 这些层1 产物的读写规则的封装"（explore §5.2「物理基础已就绪，无需新建状态文件」）。**协议与它所描述的状态 schema 同处一目录**是最低摩擦放置——部门加载 SKILL.md 时，读 state 字段和读读写规则在同一次 references 加载里完成，不必跨技能目录跳。代价是部门 SKILL.md 与协议物理分离（跨目录引用），但这个代价被"层1 是所有部门的共同地基"这个语义正当化：部门读协议不是"读别人的文档"，而是"读自己站立的地基"。这正是 β 派的核心论点——**协议不是某个部门的知识，是 5 个部门共同站立的地基共识**。

---

## 一、整体架构（β 目录结构 + ASCII 目录树）

### 1.1 设计抉择（与 α 派的分歧核）

charter hcc 三层总图用的是 `hcc-org/` 新根目录（charter §组织架构 三层总图代码块第 1 行）。**β 派不照搬这个目录**，而是将协作协议下沉到 cc-runtime/references。理由：

- charter 三层总图是**概念图**（组织层/工具层/地基层是抽象分层），不是**物理目录强制约束**。BOSS 在 explore §7 的三维决策里选的是"5 独立部门目录"，**没选"hcc-org/ 单根 + 5 部门引用"**（那是 α 的目录主张）。β 严格按 BOSS 选项落地：5 个独立目录，没有 hcc-org/ 这个第 6 目录。
- 协议物理放置是 explore §7 张力 1 留给判官小组的裁决点。BOSS 没决策它。β 选 cc-runtime/references，论证如方案核心主张。
- 这避免了"5 独立 vs 6 目录"的命名悖论（explore §八 α 派自承代价「6 目录偏离 5 独立名义」）。β 的 5 个目录字面就是 5，不多不少。

### 1.2 ASCII 目录树（β 独家设计）

```
.claude/skills/
│
├── hcc-decision/                      ← 决策部（N3/N4/HG；cc-2pp/cc-goal/cc-orchestration）
│   ├── SKILL.md                       ← 部门职责 + RACI(部门内) + plan/review + 交接 + 信息源 + 工具映射 + 缺口
│   └── references/
│       └── decision-deep-dive.md      ← 决策部深度参考（HG 拍板流程 / 换向触发 shift-direction.js 的调用契约）
│
├── hcc-product/                       ← 产品部（N5/N7/N8；cc-loop + 缺口占位）
│   ├── SKILL.md                       ← 部门职责 + RACI + plan/review + 交接 + 信息源 + 工具映射 + 缺口占位
│   └── references/
│       └── product-gap-placeholder.md ← 产品部业务技能真空占位（N5 设计/N7 需求/N8 UIUX，待层3 补齐）
│
├── hcc-dev/                           ← 开发部（实施；executor/cc-loop）
│   ├── SKILL.md                       ← 部门职责 + RACI + plan/review + 交接 + 信息源 + 工具映射 + 缺口
│   └── references/
│       └── dev-execution-sop.md       ← 开发执行 SOP（worktree / 循环合同 / 护栏三件套 落地）
│
├── hcc-ops/                           ← 运维部（层1贯穿；cc-runtime/cc-config/cc-context）
│   ├── SKILL.md                       ← 部门职责 + RACI + plan/review + 交接 + 信息源 + 工具映射 + 缺口
│   └── references/
│       └── ops-runtime-stewardship.md ← 运维部"运行时管家"深度参考（7×24 保活 / state 健康巡检 / Hook 故障排查）
│
├── hcc-sales/                         ← 销售部（N1/N2/N6；venture-judge + 缺口占位）
│   ├── SKILL.md                       ← 部门职责 + RACI + plan/review + 交接 + 信息源 + 工具映射 + 缺口占位
│   └── references/
│       └── sales-gap-placeholder.md   ← 销售部业务技能真空占位（N1 调查/N2 竞品/N6 画像/收益转化，待层3 补齐）
│
└── cc-runtime/                        ← 层1 地基（已存在）
    ├── SKILL.md                       ← （已存在，不变）
    ├── scripts/                       ← （已存在 init-state.js / shift-direction.js，不变）
    └── references/
        ├── state-schema.md            ← （已存在 frozen-v1，不变）
        └── hcc-protocol.md            ← 【β 新增】协作总则 + RACI 总表 + 交接协议 + state 读写规则
```

### 1.3 关键设计点

- **5 个 hcc-* 目录严格独立**，各带 SKILL.md + references/。BOSS 选的"5 独立部门目录"字面满足。
- **hcc-protocol.md 是唯一共享文件**，物理在 cc-runtime/references/。5 个部门 SKILL.md 在「交接协议」「RACI 引用」段统一指回 `cc-runtime/references/hcc-protocol.md`。
- **不新建 `hcc-org/` 第 6 目录**——这是与 α 的核心分歧（α 用 hcc-org/ 装协议总则，β 用 cc-runtime/references）。
- **现有 cc-runtime 脚本/schema 零改动**（C5/C6/C7 不破）。hcc-protocol.md 是**纯新增 references 文档**，不动 init-state.js / shift-direction.js 一行代码。
- **5 个部门 references/ 各带部门内深度参考**（如 decision-deep-dive.md 详述 HG 拍板调 shift-direction.js 的契约），跨部门共享的部分在 hcc-protocol.md，部门特有的在各自 references/。这是 β 的"内嵌 vs 共享"二分：**真正跨 5 部门共享的→层1；部门特有的→部门 references**。

### 1.4 触发词设计（规避 explore §5.3 trigger 竞争）

5 个部门 SKILL.md 的 frontmatter trigger **不含业务关键词**（如"judge"/"方案"/"循环"），只含部门路由词：

- hcc-decision: `hcc 决策部` / `HG 拍板` / `venture 方向裁决`
- hcc-product: `hcc 产品部` / `产品设计交接` / `UIUX 评审对接`
- hcc-dev: `hcc 开发部` / `venture 实施` / `plan 执行交接`
- hcc-ops: `hcc 运维部` / `state 健康巡检` / `venture 保活`
- hcc-sales: `hcc 销售部` / `市场调查交接` / `画像产出对接`

这些词与 cc-* 工具箱 trigger（如 cc-2pp 的"judge"/"对抗验证"）**正交不重叠**。部门 SKILL.md 在职责段说明"本部门使用 cc-2pp 做判官"——是工具箱调用关系，不是 trigger 竞争。这闭合 explore §5.3 的张力。

---

## 二、共享协作协议设计（cc-runtime/references/hcc-protocol.md）

### 2.1 为何层1 owns（β 核心论证）

| 论据 | 证据来源 |
|------|---------|
| 层1 references 已有放协议契约的先例（state-schema.md frozen-v1） | state-schema §0、§7.1 |
| 部门协作协议的物理基础是层1 四文件 + 层2 pipeline-state（无需新建状态文件） | explore §5.2 |
| 协议与 state-schema.md 同处一目录，部门读 state 字段时一并读读写规则，最低摩擦 | β 推论（基于 state-schema §0 共同边界定位） |
| 协议不是某部门的知识，是 5 部门共同站立的地基共识——地基 owns 它语义正当 | β 立场 |
| cc-runtime 已是其他部门的运行时地基（explore §6.7 运维部≈横切 Manager+Worker），协议放此处与运维部职责自洽 | explore §6.7 |

### 2.2 hcc-protocol.md 内容骨架（4 大块）

#### 块 1：协作总则（5 部门共同遵守）

```markdown
# hcc 协作协议总则

## 1.1 部门间不直接对话（charter §组织架构 协作协议）
部门间上下文交换经层1 产物契约，不经自然语言对话：
- direction.json = 跨部门方向共识（谁在哪个版本方向上工作）
- trace.ndjson = 跨部门执行记忆（谁做了什么，带 direction_version + node）
- checkpoint.json = 跨部门续跑锚点（continue_from 规范格式）
- pipeline-state.json = 跨部门 HG 停等（awaiting_human + gate）

证据：explore §5.2 已验证此路径与 LangChain state-driven handoffs 同构。

## 1.2 交接不灌完整 trace（0b §6.3 context passing 铁律）
部门 A → 部门 B 交接 = 上游产物文件 + 一份结构化交接说明（state 字段 direction_version/node/iter）。
不传完整 trace.ndjson（bloat + 干扰接收 agent）。需更多 context 在交接说明里 summarize。
这与 cc-2pp「agent 写文件/编排者读文件」+ cc-runtime direction_version 绑定完全一致。

## 1.3 direction_version 绑定（INV-1 强制）
所有部门产物的 direction_version 必须与 direction.current_version 一致（state-schema §6 INV-1）。
换向（shift-direction.js 升版本）后，旧版本产物归档，新版本方向上各部门从头接力。

## 1.4 plan/review 双能力（BOSS §协作预算 选「完整双能力」）
每部门具备 plan（规划）+ review（审查）双能力。
plan → 落盘到 .venture/artifacts/v{n}/约定文件名。
review → 读上游 plan 文件，产出 review 意见落盘，驳回则触发上游重 plan（回环上限见 §1.5）。

## 1.5 回环上限（0b §6.5 委托循环防护）
plan→review→驳回→重 plan 的回环上限 = checkpoint.guardrails.max_iteration（默认 10）。
达上限 → 强制收敛（取最近一版 plan + review 意见合并）或上报 HG（boss 决策）。
映射 cc-loop 护栏三件套（max_iteration / no_progress_streak / budget_tokens_cap）。
```

#### 块 2：RACI 总表（5 部门 × venture 节点/状态字段/产物）

RACI = Responsible（做）/ Accountable（拍板）/ Consulted（咨询）/ Informed（知情）。
来源：0b §6.4 Ruh 反模式#2 解法。

| 产物 / 节点 / 状态字段 | 决策部 | 产品部 | 开发部 | 运维部 | 销售部 |
|----------------------|--------|--------|--------|--------|--------|
| N1 启动（销售调查） | I | I | I | C | **R/A** |
| N2 机会识别（竞品） | C | I | I | I | **R/A** |
| N3 方案（决策计划） | **R/A** | C | C | I | C |
| HG1 拍板（N3→N4） | **R/A**（调 shift-direction.js） | I | I | C | I |
| N4 原型（开发实施） | I | C | **R/A** | C | I |
| HG2 拍板（N4→N5） | **R/A**（调 shift-direction.js） | C | I | C | C |
| N5 验证（产品设计 + 市场验证） | I | **R**（设计） | C | I | **A**（市场） |
| N6 产品化 | C | **R/A**（设计） | R（实施） | I | I |
| N7 迭代优化 | C | **R/A**（需求/UIUX） | R（实施） | I | C |
| N8 规模化（收益转化） | C | I | I | I | **R/A** |
| direction.json 写入 | 经 shift-direction.js（决策部触发） | — | — | C（监测） | — |
| pipeline-state.json HG 停等 | R（判定 HG） | — | — | C（监测） | — |
| checkpoint.json 续跑锚点 | I | I | I | **R/A**（层1 Hook 写） | I |
| trace.ndjson 执行记忆 | I | I | I | **R/A**（层1 Hook 写） | I |
| tasks.tree.json 任务树 | I | I | I | **R/A**（层1 Hook 写） | I |

**总表语义**：R/A 同列出现时，R 是执行者，A 是拍板者（charter P4「boss 在 gate 做创新决策」——HG1/HG2 的 A 最终是 boss，但部门协议层先由决策部 R/A 承接，boss 经 HG 介入）。

**部门内 RACI 细节**：每个部门 SKILL.md 在自己段落补"本部门内谁 R/A/C/I"（如决策部 SKILL.md 详述 N3 方案阶段，cc-2pp 做 R、cc-goal 做 C、cc-orchestration 做 I）。总表只给跨部门视图，部门表给部门内视图——这是 β 对张力 3（RACI 形态）的裁决（见 §七）。

#### 块 3：交接协议（文件命名约定 + 字段契约）

```markdown
# 部门交接协议

## 3.1 文件命名约定（基于 cc-2pp 一等公民假设4 + direction_version 绑定）
所有部门产物落盘到 `.venture/artifacts/v{direction_version}/`，文件名格式：
`{node_id}-{department}-{artifact_type}.md`

示例：
- N3 方案阶段决策部产出：`.venture/artifacts/v2/N3-decision-plan.md`
- N4 原型阶段开发部产出：`.venture/artifacts/v2/N4-dev-prototype.md`
- N6 产品化阶段产品部产出：`.venture/artifacts/v2/N6-product-design.md`

artifacts 根目录随 direction_version 切换（shift-direction.js 归档旧版本到 .venture/archived/v_old/）。

## 3.2 交接说明字段契约（不灌完整 trace，0b §6.3）
每次部门交接在产物文件头部带 YAML frontmatter：
---
direction_version: 2
node: N3
department: decision
artifact_type: plan
handoff_to: [dev, product]      # 下游部门
summary: "N3 方案已定，HG1 待 boss 拍板继续到 N4"
key_decisions: ["市场B 优先", "MVP 范围=核心3功能"]
open_risks: ["竞品X 近期发布"]
tokens_used: 45000
---
下游部门读 frontmatter 即可接力，不必读完整 trace。

## 3.3 HG 停等交接（决策部专有）
决策部判定 HG → 写 pipeline-state.json（经层2 pipeline-state.js set-hg，**不直写**，C1 约束）
→ status: awaiting_human, gate: HG1/HG2
→ checkpoint.json health 反映 gate 等待（INV-3）
→ H6 SessionStart 注入「⏸️ 等待你对 HG{X} 的决定」
boss 决定后 → 决策部调 shift-direction.js（继续/换向/放弃）
```

#### 块 4：state 字段读写规则（部门权限矩阵）

| 状态字段 | 决策部 | 产品部 | 开发部 | 运维部 | 销售部 | 实际写者（C1 强制） |
|---------|--------|--------|--------|--------|--------|-------------------|
| direction.current_version | 读 | 读 | 读 | 读 | 读 | shift-direction.js |
| direction.status/gate | 读 | 读 | 读 | 读 | 读 | shift-direction.js（HG 语义迁 pipeline-state，C1） |
| pipeline-state.status/gate | **经层2 写**（HG 判定） | — | — | 读（监测） | — | pipeline-state.js + advance-node.js + resolve-hg.js |
| checkpoint.* | 读 | 读 | 读 | **写（Hook）** | 读 | H4 Stop / H5 PreCompact |
| trace.ndjson 追加 | 读 | 读 | 读 | **写（Hook）** | 读 | H2 PostToolUse |
| tasks.tree.* | 读 | 读 | 读 | **写（Hook）** | 读 | H2 PostToolUse |
| .venture/artifacts/v{n}/* | 写（N3/HG） | 写（N5/N6/N7） | 写（N4/实施） | 读（巡检） | 写（N1/N2/N6/N8） | 各部门直接 Write |

**关键**：所有"state 字段写入"经层1 Hook 或层2 脚本，部门 SKILL.md 只描述"何时触发哪个 Hook/脚本"，不自己 fs.writeFile 状态文件（C1 写入隔离）。

---

## 三、5 部门 SKILL.md 设计

每个部门 SKILL.md 含 7 段：职责 + RACI(部门内) + plan 流程 + review 流程 + 交接协议(引用 hcc-protocol.md) + 信息源 + 工具箱映射 + 缺口技能占位。

### 3.1 决策部（hcc-decision）

**venture 节点**：N3 计划 / N4 judge / HG1 / HG2
**信息源**：知识库 + web（行业/竞品）（charter §组织架构 决策部行）

#### 3.1.1 职责
方向设定、可行性判断、judge（charter §组织架构）。具体：
- N3 方案阶段：用 cc-2pp 判官小组产出方案（多视角 + 对抗验证 + 落盘契约）
- HG1/HG2 拍板：判定是否进入下一节点，**经 shift-direction.js 触发换向/继续**（不直写 direction.json，C1）
- 换向触发：判定市场/方向变更 → 调 shift-direction.js --reason --to

#### 3.1.2 RACI（部门内）
- cc-2pp：N3 方案 R（判官小组起草 + 对抗验证）
- cc-goal：N3 方案 C（终态条件设计，把方案变成可验证 /goal）
- cc-orchestration：N3 方案 I（编排决策，判定是否需要 subagent/team）

#### 3.1.3 plan 流程
1. 读 hcc-protocol.md §1（协作总则）+ state-schema.md（state 字段语义）
2. 读 direction.current_version + pipeline-state.current_node（确认在 N3）
3. 调 cc-2pp 启动判官小组（Phase 0 explore → Phase 2 judge panel → Phase 4 落盘）
4. 产出落盘 `.venture/artifacts/v{n}/N3-decision-plan.md`（带 frontmatter，hcc-protocol §3.2）
5. 若需 HG → 调层2 pipeline-state.js set-hg（HG1），触发 awaiting_human

#### 3.1.4 review 流程
1. 读下游部门（开发部/产品部）的 plan 产物（如 N4-dev-prototype-plan.md）
2. 用 cc-2pp 对抗验证视角审查（ROI / 可行性 / Claude 度量）
3. 产出 review 意见落盘 `.venture/artifacts/v{n}/N4-decision-review.md`
4. 驳回 → 触发开发部重 plan（回环上限 max_iteration，hcc-protocol §1.5）

#### 3.1.5 交接协议
引用 `cc-runtime/references/hcc-protocol.md` §3。决策部特有：HG 拍板后调 shift-direction.js 的调用契约详见 `references/decision-deep-dive.md`。

#### 3.1.6 工具箱映射
cc-2pp（判官 + 对抗）/ cc-goal（终态条件）/ cc-orchestration（编排决策）。三者已在 claude-coach 路由表闭环（explore §四 决策部行）。

#### 3.1.7 缺口技能占位
无（决策部 ✓ 厚实，explore §四）。HG 拍板可视化（P1 最懒「boss 一眼可决策」）依赖层1 checkpoint 可视化，不算决策部缺口。

---

### 3.2 产品部（hcc-product）

**venture 节点**：N5 设计 / N7 需求 / N8 UIUX
**信息源**：本地产物 + 用户反馈（charter §组织架构 产品部行）

#### 3.2.1 职责
产品设计、UIUX、需求挖掘（charter §组织架构）。**业务技能真空**（explore §四 产品部 ❌）。

#### 3.2.2 RACI（部门内）
- cc-loop：N5/N6/N7 R（循环工程方法论，产品设计/需求/UIUX 的迭代收敛）
- 缺口占位（venture-product / venture-uiux，待层3 补齐）：N5 产品设计 / N7 需求挖掘 / N8 UIUX 设计的 R

#### 3.2.3 plan 流程
1. 读 hcc-protocol.md §1 + 上游决策部 N3-decision-plan.md（方案共识）
2. 读 direction.current_version + pipeline-state.current_node（确认在 N5/N6/N7）
3. **当前缺业务技能**：用 cc-loop 设计"产品设计迭代循环"（loop_back N7→N6 max_iter=3，persona-signal 收敛，explore §3.4）
4. 产出落盘 `.venture/artifacts/v{n}/N{X}-product-design.md`
5. 层3 补齐 venture-product/venture-uiux 后，替换 cc-loop 为业务技能

#### 3.2.4 review 流程
1. 读开发部 N4-dev-prototype.md（原型实现）
2. 审查产品符合度（设计 vs 实现）
3. 产出 review 意见落盘 `.venture/artifacts/v{n}/N4-product-review.md`
4. 驳回 → 触发开发部调整

#### 3.2.5 交接协议
引用 hcc-protocol.md §3。产品部特有：N6⇄N7 loop_back 收敛判据详见层2 persona-signal.md（signal 四态 + delta < 0.1 + MAX_ITER=3，explore §3.3）。

#### 3.2.6 工具箱映射
cc-loop（循环工程）。**业务技能缺口**详见 `references/product-gap-placeholder.md`。

#### 3.2.7 缺口技能占位
N5 产品设计 / N7 需求挖掘 / N8 UIUX 设计**无对应技能**（explore §四）。charter 明确"待层3 启动补齐，不阻塞层1 先行"。本部门 SKILL.md 预留协议接口（读写哪些 state 字段、交接什么文件），业务技能填充留层3。

---

### 3.3 开发部（hcc-dev）

**venture 节点**：实施（执行计划，N4 原型 + 各节点实施）
**信息源**：本地代码（charter §组织架构 开发部行）

#### 3.3.1 职责
按 plan 实施、交付（charter §组织架构）。**中等覆盖**（explore §四 开发部 ⚠️）。

#### 3.3.2 RACI（部门内）
- executor（Claude 原生 general-purpose agent 或 OMC autopilot/ralph）：实施 R
- cc-loop：实施编排 C（worktree SOP + 循环合同 + 护栏三件套）

#### 3.3.3 plan 流程
1. 读 hcc-protocol.md §1 + 决策部 N3-decision-plan.md（方案）+ 产品部 N{X}-product-design.md（设计）
2. 读 direction.current_version + pipeline-state.current_node（确认在 N4 或实施节点）
3. 用 cc-loop worktree SOP 创建隔离工作区
4. 拆解 plan 为 TaskCreate 任务（与 tasks.tree.json 同构，INV-5）
5. 实施 → 每步 H2 PostToolUse 自动写 trace + 更新 tasks.tree

#### 3.3.4 review 流程
1. 读自己实施产物（代码 + 提交）
2. 自审 + 可选调 OMC code-reviewer / superpowers:receiving-code-review
3. 产出 review 意见落盘（自审记录）
4. 决策部 review 驳回 → 重实施（回环上限 max_iteration）

#### 3.3.5 交接协议
引用 hcc-protocol.md §3。开发部特有：worktree SOP + 循环合同落地详见 `references/dev-execution-sop.md`。

#### 3.3.6 工具箱映射
executor（原生 agent）/ cc-loop（循环工程）。**外部 skill 依赖**：superpowers:* 系列（TDD / systematic-debugging / verification-before-completion），非本项目技能。

#### 3.3.7 缺口技能占位
代码质量/测试/重构专项技能依赖外部 skill 生态（explore §四 开发部）。本部门不新建，按需 cc-scanner 推荐外部 skill。

---

### 3.4 运维部（hcc-ops）

**venture 节点**：层1 运行时（贯穿所有节点）
**信息源**：本地 state/config（charter §组织架构 运维部行）

#### 3.4.1 职责
7×24 保活、state/trace/Hook 维护（charter §组织架构）。**厚实**（explore §四 运维部 ✓）。运维部是其他部门的运行时地基（explore §6.7 横切 Manager+Worker）。

#### 3.4.2 RACI（部门内）
- cc-runtime：state 四文件 + init-state/shift-direction + compact-snapshot R（层1 地基）
- cc-config：六层配置 + CLAUDE.md 诊断 C
- cc-context：上下文健康 C

#### 3.4.3 plan 流程
1. 读 hcc-protocol.md §1 + state-schema.md（运维部是 state 写者的代理，state-schema §5）
2. 读 checkpoint.health / direction.status / pipeline-state.status（巡检全局健康）
3. 用 cc-config 诊断配置问题 / cc-context 评估上下文健康
4. 产出运维报告落盘 `.venture/artifacts/v{n}/ops-health-report.md`

#### 3.4.4 review 流程
1. 读 trace.ndjson 回放（执行记忆审查）
2. 检查 INV-1..6 不变量是否被破坏（state-schema §6）
3. 检查 Hook 故障（H2/H4/H5/H6 是否正常触发）
4. 产出 review 意见，必要时调 cc-runtime 脚本修复

#### 3.4.5 交接协议
引用 hcc-protocol.md §3。运维部特有：7×24 保活 + state 健康巡检 + Hook 故障排查详见 `references/ops-runtime-stewardship.md`。

#### 3.4.6 工具箱映射
cc-runtime / cc-config / cc-context。三者覆盖 7×24 保活/state/trace/Hook 全链路（explore §四 运维部）。

#### 3.4.7 缺口技能占位
无（运维部 ✓ 厚实）。

#### 3.4.8 β 特殊论点：运维部是 hcc-protocol.md 的天然守护者
hcc-protocol.md 物理在 cc-runtime/references/，运维部用 cc-runtime 做 R——**运维部天然是协议的维护者**（读写规则变更经运维部审查，类似 state-schema frozen-v1 的变更门，state-schema §7.3）。这强化了"层1 owns 协议"的语义正当性。

---

### 3.5 销售部（hcc-sales）

**venture 节点**：N1 调查 / N2 竞品 / N6 画像 / N8 规模化
**信息源**：web + 知识库（案例）（charter §组织架构 销售部行）

#### 3.5.1 职责
画像、收益转化、市场验证（charter §组织架构）。**业务技能真空**（explore §四 销售部 ❌）。

#### 3.5.2 RACI（部门内）
- venture-judge（系统级 installed skill）：N1/N2 评估 R（创业评估师，融合有序创业24步法 + VC投研7维）
- 缺口占位（venture-sales，待层3 补齐）：N6 画像 / N8 收益转化 / 市场验证的 R

#### 3.5.3 plan 流程
1. 读 hcc-protocol.md §1 + direction.current_version（确认在 N1/N2/N6/N8）
2. N1/N2 用 venture-judge 启动调查/竞品评估
3. 产出落盘 `.venture/artifacts/v{n}/N{X}-sales-research.md`
4. **当前缺 N6 画像/N8 收益转化业务技能**：用 venture-judge 的案例库 + 知识库做近似，层3 补齐 venture-sales 后替换

#### 3.5.4 review 流程
1. 读决策部 N3-decision-plan.md（方案）
2. 审查市场可行性（用 venture-judge VC 投研7维）
3. 产出 review 意见落盘 `.venture/artifacts/v{n}/N3-sales-review.md`
4. 驳回 → 触发决策部重方案

#### 3.5.5 交接协议
引用 hcc-protocol.md §3。销售部特有：web 研究 + 知识库案例的产出格式详见 `references/sales-gap-placeholder.md`。

#### 3.5.6 工具箱映射
venture-judge（系统级 installed skill，非本项目 `.claude/skills/`，explore §四 销售部）。**业务技能缺口**详见 `references/sales-gap-placeholder.md`。

#### 3.5.7 缺口技能占位
N6 用户画像 / N8 收益转化 / 市场验证**无本项目技能承接**（explore §四）。charter 明确"待层3 启动补齐"。本部门 SKILL.md 预留协议接口，业务技能填充留层3。

---

## 四、部门协作协议落地（state 字段读写矩阵 + 交接文件命名 + direction_version 绑定 + 不灌完整 trace）

### 4.1 state 字段读写矩阵（落地版，细化 §2.2 块4）

| 状态字段 | 决策部触发时机 | 产品部触发时机 | 开发部触发时机 | 运维部触发时机 | 销售部触发时机 | 强制写者 |
|---------|--------------|--------------|--------------|--------------|--------------|---------|
| direction.current_version | 读（HG 后调 shift-direction.js 升版本） | 读 | 读 | 读（监测漂移） | 读 | shift-direction.js |
| pipeline-state.status/gate | 写（HG 判定，经 pipeline-state.js set-hg） | — | — | 读（监测） | — | pipeline-state.js + advance-node.js + resolve-hg.js |
| checkpoint.continue_from | 读（续跑） | 读 | 读 | 写（H4/H5 Hook） | 读 | H4 Stop / H5 PreCompact |
| trace.ndjson | 读（回放） | 读 | 读 | 写（H2 Hook） | 读 | H2 PostToolUse |
| tasks.tree.tasks[] | 读 | 读 | 读/写（TaskCreate） | 写（H2 Hook） | 读 | H2 PostToolUse + TaskCreate |
| .venture/artifacts/v{n}/* | 写（N3/HG） | 写（N5/N6/N7） | 写（N4/实施） | 读（巡检） | 写（N1/N2/N6/N8） | 各部门 Write |

### 4.2 交接文件命名约定（落地 hcc-protocol §3.1）

格式：`.venture/artifacts/v{direction_version}/{node_id}-{department}-{artifact_type}.md`

| 部门 | 产物类型 | 示例文件名 |
|------|---------|----------|
| 决策部 | plan / review / hg-decision | N3-decision-plan.md / N4-decision-review.md / HG1-decision-gate.md |
| 产品部 | design / requirement / uiux | N5-product-design.md / N7-product-requirement.md / N8-product-uiux.md |
| 开发部 | prototype / impl / test | N4-dev-prototype.md / N6-dev-impl.md / N4-dev-test.md |
| 运维部 | health-report / hook-audit | ops-health-report.md / ops-hook-audit.md |
| 销售部 | research / persona / conversion | N1-sales-research.md / N6-sales-persona.md / N8-sales-conversion.md |

### 4.3 direction_version 绑定（INV-1 强制落地）

- 所有产物文件 frontmatter 必含 `direction_version` 字段（hcc-protocol §3.2）
- 换向（shift-direction.js 升版本）→ 旧版本 artifacts 归档到 `.venture/archived/v_old/`（explore §2.3 superseded_paths 机制）
- 下游部门读产物前先校验 `direction_version` == `direction.current_version`（否则视为过期，触发重读新版本）

### 4.4 不灌完整 trace（0b §6.3 落地）

- 部门交接 = 产物文件（带 frontmatter）+ 可选 summarize 段
- **禁止**在交接说明里粘贴完整 trace.ndjson 内容
- 需更多 context → 在 frontmatter 的 `summary` / `key_decisions` / `open_risks` 字段 summarize
- 这与 cc-2pp「agent 写文件/编排者读文件」+ cc-runtime direction_version 绑定完全一致（explore §5.4 + 0b §6.3）

---

## 五、DAG 对接（部门↔节点映射，映射不装配，C7/C1 不破）

### 5.1 部门↔节点映射表（落地 explore §5.5）

| dag.placeholder.json 节点 | 归属部门 | 节点 skill（C7 placeholder） | 部门协议层定义 |
|--------------------------|---------|---------------------------|--------------|
| N1 启动 | 销售部 | placeholder | hcc-sales SKILL.md §3.5 |
| N2 机会识别 | 销售部 | placeholder | hcc-sales SKILL.md §3.5 |
| N3 方案 | 决策部 | placeholder | hcc-decision SKILL.md §3.1 |
| HG1（N3→N4） | 决策部 | placeholder（gate 类型） | hcc-decision SKILL.md §3.1.3 step5（调 pipeline-state.js set-hg） |
| N4 原型 | 开发部 | placeholder | hcc-dev SKILL.md §3.3 |
| HG2（N4→N5） | 决策部 | placeholder（gate 类型） | hcc-decision SKILL.md §3.1.3 step5 |
| N5 验证 | 产品部（设计）+ 销售部（市场） | placeholder | hcc-product §3.2 + hcc-sales §3.5（R 分摊，RACI 总表 N5 行） |
| N6 产品化 | 产品部（设计）+ 开发部（实施） | placeholder | hcc-product §3.2 + hcc-dev §3.3 |
| N7 迭代优化 | 产品部（需求/UIUX）+ 开发部（实施） | placeholder | hcc-product §3.2 + hcc-dev §3.3（loop_back N7→N6 max_iter=3） |
| N8 规模化 | 销售部 | placeholder | hcc-sales SKILL.md §3.5 |

### 5.2 映射不装配（BOSS §DAG 对接 选「映射但不装配」）

- dag.placeholder.json 保持 placeholder（**不动层2已定稿拓扑**，C7）
- hcc 协议层只定义「部门↔节点映射规则」（上表），不替换 placeholder → 真实 skill
- 装配（placeholder → 真实 skill）留层3 cc-venture 启动时（charter §组织架构 形态定论 + explore §5.5）

### 5.3 C7/C1 不破核验

- C7（placeholder 语义）：dag.placeholder.json 全部 skill=placeholder 不变（explore §3.4）。hcc 协议层是 SKILL.md + 文档，不碰 dag.json。
- C1（写入隔离）：部门协议触发换向 **必须经 shift-direction.js**（hcc-decision §3.1.3 step5 + hcc-protocol §3.3）。HG 停等 **经 pipeline-state.js set-hg**（不直写 pipeline-state.json）。direction.json 唯一写者仍是 shift-direction.js（state-schema §3 + explore §5.7）。

---

## 六、护栏双闸（budget_tokens_cap + max_iteration）

### 6.1 双闸定义（BOSS §协作预算 选「完整双能力 + 预算护栏」）

| 闸 | 字段 | 位置 | 默认值 | 触发动作 |
|----|------|------|--------|---------|
| **预算闸** | `checkpoint.guardrails.budget_tokens_cap` | state-schema §1.1 | 500000 | 达上限 → 强制收敛（取最近 plan + review 合并）或上报 HG |
| **回环闸** | `checkpoint.guardrails.max_iteration` | state-schema §1.1 | 10 | plan→review→驳回→重 plan 达上限 → 强制收敛或上报 HG |

### 6.2 映射 checkpoint.guardrails（state-schema §1.1 guardrails 对象）

state-schema §1.1 已定义 guardrails 对象含 4 字段：max_iteration / no_progress_streak / budget_tokens_used / budget_tokens_cap。hcc 协议层**复用此对象**，不新增字段（C5 不破层1 frozen-v1）。

- 部门协作消耗的 token → 累加到 `budget_tokens_used`（H2 PostToolUse 自动累加，state-schema §2.2 tokensUsed）
- plan→review 回环计数 → 映射 `iteration`（节点内迭代）+ `max_iteration` 上限
- 无进展检测 → `no_progress_streak` + `stagnation_count`（state-schema §1.3 health 状态机）

### 6.3 双闸触发后的处置（落地 hcc-protocol §1.5）

```
budget_tokens_used ≥ budget_tokens_cap
  OR iteration ≥ max_iteration
  OR stagnation_count ≥ N_block（health=blocked）
        │
        ▼
触发强制收敛 OR 上报 HG
        │
        ├── 强制收敛：取最近一版 plan + review 意见合并，推进到下一节点
        └── 上报 HG：决策部调 pipeline-state.js set-hg（gate=HG1/HG2）→ awaiting_human → boss 决策
```

这与 cc-loop 护栏三件套（max_iteration / no_progress_streak / budget_tokens_cap）完全对齐（cc-loop SKILL.md「护栏三件套」+ state-schema §1.1）。

---

## 七、设计张力裁决（3 张力各给 β 立场 + ROI 论证）

### 张力 1：共享协作协议的物理放置

**β 立场**：cc-runtime/references/hcc-protocol.md（下沉层1）。

**ROI 论证**：
- **收益**：层1 owns 协议符合"地基"定位（state-schema.md 先例）；协议紧邻 state-schema（同目录加载）；运维部天然守护协议（§3.4.8）；5 独立目录字面满足 BOSS 选项（无第 6 目录命名悖论）。
- **代价**：协议与部门 SKILL.md 物理分离（跨技能目录引用），部门加载需回头读层1 references。
- **ROI 判定**：代价可控（references 加载是 Claude 常态，cc-* 子技能都这么做，explore §5.3）；收益结构性（地基 owns 协议的语义正当性 + 运维部守护闭环）。**β 选下沉**。

**vs α（hcc-org/ 新根）**：α 多一个目录（6 目录偏离 5 独立名义，explore §八 α 自承代价）；α 把协议放在"组织层"概念上对，但物理上 cc-runtime 才是真正的地基（state 文件在那）。β 让概念层（组织）与物理层（地基）分离——组织层是 5 个 hcc-* 目录（概念），地基层是 cc-runtime（物理 owns 协议）。**β 更贴合 BOSS「5 独立」字面 + charter 三层总图的地基层语义**。

**vs γ（5 目录内嵌）**：γ 每部门内嵌完整协议（DRY 代价高，5 份重复）。β 抽共享部分到层1（DRY），部门内嵌只放部门特有部分（references/decision-deep-dive.md 等）。**β 在 DRY 与自包含之间取平衡**（这也是"平衡派"之名）。

### 张力 2：5 独立目录 vs 单 agent 动态切换

**β 立场**：坚持 5 独立，论证"协议下沉层1"如何缓解多节点复杂度。

**ROI 论证**：
- LangChain 警告多节点 context engineering 复杂度（0b §6.2）。β 的缓解：**协议下沉层1 → 部门 SKILL.md 只聚焦部门职责，不背协议包袱**。部门加载时读 hcc-protocol.md（共享地基共识）+ 自己 SKILL.md（部门职责），**不读其他 4 个部门的 SKILL.md**——context engineering 复杂度从 O(5²) 降到 O(5+1)。
- 5 独立在角色边界清晰性上站得住（Ruh Specialist 分工，0b §6.2）：决策/产品/开发/运维/销售 5 个角色有本质不同职责+信息源+plan/review 流程（charter §组织架构 5 部门表），不是同 agent 换 prompt。
- **ROI 判定**：5 独立的边界清晰收益（Ruh 反模式#2 解法）> 协议下沉后的 context 复杂度（已缓解到 O(5+1)）。**β 选 5 独立 + 协议下沉**。

**关键反证预案**（对抗验证可能攻击）：若攻击者指出"5 独立仍比单 agent 多 4 次 SKILL.md 加载"——β 回应：部门是按需加载（只加载当前节点归属部门），不是同时加载 5 个。单 agent 动态切换看似省加载，但每次切换都要重新注入角色 prompt（context 抖动），5 独立的"一次加载全程稳定"反而更省 token（长期来看）。

### 张力 3：RACI 矩阵形态

**β 立场**：RACI 总表放 cc-runtime/references/hcc-protocol.md（层1 owns），部门 SKILL.md 补部门内 RACI 细节。

**ROI 论证**：
- RACI 总表是跨部门视图（5 部门 × 节点/字段），天然是共享协议的一部分 → 放 hcc-protocol.md（与张力 1 一致，层1 owns 共享部分）。
- 部门内 RACI（如决策部内 cc-2pp/cc-goal/cc-orchestration 谁R/C/I）是部门特有 → 放部门 SKILL.md。
- **二分原则**：跨部门共享 → 层1；部门特有 → 部门 SKILL.md。这是 β 的统一放置逻辑（也用于协议本身：协作总则层1，部门流程部门内）。
- **ROI 判定**：总表集中（DRY，修改一处）+ 部门细节分散（自包含）。**β 选总表层1 + 部门内 SKILL.md**。

**vs 「每部门内嵌 RACI 表」**：5 份重复总表（DRY 代价）。**β 抽总表到层1**。

**vs 「独立 RACI 矩阵文档横切」**：又多一个文件。β 已有 hcc-protocol.md，总表作为它的块2，不另起文件。**β 更紧凑**。

---

## 八、所需 skills 清单（消费 00-explore §一，每个标"在哪步用"）

| skill | 来源 | 在哪步用 | 用法 |
|-------|------|---------|------|
| **cc-2pp** | explore §一 决策部工具箱 | 决策部 N3 方案 plan（§3.1.3）+ review（§3.1.4） | 判官小组起草 + 对抗验证 + 落盘契约；本方案本身就是 cc-2pp 模式 C 产物 |
| **cc-goal** | explore §一 决策部工具箱 | 决策部 N3 方案 C（§3.1.2） | 把方案变成可验证 /goal 条件（L4 自验证） |
| **cc-orchestration** | explore §一 决策部工具箱 | 决策部 N3 方案 I（§3.1.2） | 判定 N3 方案阶段是否需 subagent/team 编排 |
| **cc-loop** | explore §一 产品部/开发部工具箱 | 产品部 N5/N6/N7 plan（§3.2.3）+ 开发部实施编排（§3.3.3） | 循环工程方法论（worktree SOP + 循环合同 + 护栏三件套）；产品部用它设计迭代循环（缺业务技能时近似） |
| **cc-runtime** | explore §一 运维部工具箱（层1） | 运维部全流程（§3.4）+ **所有部门的 state 读写基础**（hcc-protocol.md 物理宿主） | state 四文件 + init-state/shift-direction + compact-snapshot；本方案 hcc-protocol.md 放其 references/ |
| **cc-config** | explore §一 运维部工具箱 | 运维部 plan（§3.4.3）配置诊断 | 六层配置 + CLAUDE.md 诊断 |
| **cc-context** | explore §一 运维部工具箱 | 运维部 plan（§3.4.3）上下文健康 | 防溢出/防遗忘/防冲刷 + 持久化策略 |
| **venture-judge** | explore §一 销售部工具箱（系统级 installed） | 销售部 N1/N2 plan（§3.5.3）+ review（§3.5.4） | 创业评估师（有序创业24步法 + VC投研7维）；N6/N8 缺口时近似用案例库 |
| **venture-pipeline** | explore §一 层2 引擎 | 决策部 HG 拍板（§3.1.3 step5 调 pipeline-state.js set-hg）+ 所有部门的节点流转基础 | DAG 数据驱动编排；本方案不改其拓扑（C7），只经其脚本触发 HG |
| **claude-coach** | explore §一 路由器 | 不直接用（hcc-* 部门是协议层，无业务 trigger，explore §5.3） | — |
| **cc-scanner** | explore §一 技能知识库 | 开发部缺口补齐（§3.3.7）+ 产品部/销售部层3 补齐时推荐技能 | 6 源扫描 + 场景推荐；联动 charter P1 最懒「缺能力先找/造 skill」 |
| **cc-memory** | explore §一 记忆审查 | 运维部 review（§3.4.4）可选用 | 五层记忆系统健康审查（非本方案核心，按需） |

**缺口占位（待层3 补齐，本方案不新建）**：
- venture-product（产品部 N5 设计 / N7 需求）
- venture-uiux（产品部 N8 UIUX）
- venture-sales（销售部 N6 画像 / N8 收益转化 / 市场验证）
- executor 专项（开发部代码质量/测试/重构，依赖外部 superpowers:* 系列）

---

## 九、工作量估算（Claude 度量：token/轮次/skill配置/验证，禁人天）

> 禁人天铁律（explore §5.8 + cc-2pp Prompt 注入约束）。实施者 = Claude + skills。

### 9.1 交付物清单 + Claude 度量估算

| 交付物 | token 估算（产出） | 上下文轮次 | skill 配置成本 | 验证复杂度 | 依赖风险 |
|-------|------------------|----------|--------------|----------|---------|
| cc-runtime/references/hcc-protocol.md（4 块：总则+RACI总表+交接+读写矩阵） | ~8000-12000 token | 3-5 轮（起草+精修） | 0（纯新增 references，不动 cc-runtime 脚本） | 低（对照 state-schema § + charter §组织架构 核验） | 低（不碰 frozen-v1） |
| hcc-decision/SKILL.md + references/decision-deep-dive.md | ~6000-8000 token | 2-3 轮 | 0（新建目录） | 低（决策部 ✓ 厚实，cc-2pp/cc-goal/cc-orchestration 已闭环） | 低 |
| hcc-product/SKILL.md + references/product-gap-placeholder.md | ~4000-6000 token | 2-3 轮 | 0 | 中（业务技能真空，占位要预留层3 接口） | 中（层3 补齐时机不确定） |
| hcc-dev/SKILL.md + references/dev-execution-sop.md | ~5000-7000 token | 2-3 轮 | 0 | 中（executor 非本项目技能，依赖外部 agent/skill） | 中 |
| hcc-ops/SKILL.md + references/ops-runtime-stewardship.md | ~5000-7000 token | 2-3 轮 | 0 | 低（运维部 ✓ 厚实） | 低 |
| hcc-sales/SKILL.md + references/sales-gap-placeholder.md | ~4000-6000 token | 2-3 轮 | 0 | 中（venture-judge 系统级 + 业务真空） | 中 |
| DAG 映射表（§五，文档非代码） | ~2000 token | 1 轮 | 0 | 低（映射不装配，C7 不破） | 低 |

### 9.2 总估算

- **总 token**：~35000-55000 token（产出侧，不含探索/对抗验证消耗）
- **总轮次**：~15-25 轮（含精修 + 核验）
- **skill 配置成本**：**0**（纯新增 SKILL.md + references，不动现有 cc-runtime/venture-pipeline 任何脚本/schema；C5/C6/C7 天然满足）
- **验证复杂度**：低-中（主要核验 charter 一致性 + state-schema 不变量不破 + trigger 不竞争）
- **依赖风险**：低-中（产品部/销售部业务真空是已知风险，charter 明确不阻塞层1先行）

### 9.3 与 α/γ 的度量对比（预判）

- vs α（hcc-org/ 新根）：α 多 1 个目录（hcc-org/SKILL.md + references），β 把等价内容放 cc-runtime/references（已有目录）。**β 省 1 个目录的 SKILL.md 起草 token**（~3000-5000 token）。
- vs γ（5 目录内嵌完整协议）：γ 每部门内嵌完整协议（5 份重复），β 抽共享到层1。**β 省 ~10000-15000 token 重复产出**（4 份协议副本）。

**β 在度量上最优**（平衡 DRY 与自包含）。

---

## 十、优势 / 致命弱点 / 适用场景

### 10.1 优势

1. **5 独立目录字面满足 BOSS 选项**（无第 6 目录命名悖论，与 α 核心分歧点）
2. **层1 owns 协议语义正当**（state-schema.md 先例 + 运维部守护闭环 + 地基共识定位）
3. **DRY 最优**（共享协议抽层1，部门只内嵌部门特有；vs γ 省 4 份重复）
4. **C1/C5/C6/C7 天然满足**（纯新增 references + SKILL.md，不动层1/层2 任何脚本/schema）
5. **context 复杂度 O(5+1)**（协议下沉缓解多节点复杂度，vs 5 目录全内嵌 O(5²)）
6. **运维部天然守护协议**（hcc-protocol.md 在 cc-runtime/references/，运维部 R cc-runtime，协议变更经运维部审查，闭环 state-schema §7.3 变更门）
7. **trigger 不竞争**（部门 trigger 用 hcc-* 路由词，与 cc-* 工具箱业务词正交，闭合 explore §5.3）

### 10.2 致命弱点（β 自我承认，供对抗验证攻击）

1. **协议与部门 SKILL.md 物理分离**：部门加载时需跨目录读 cc-runtime/references/hcc-protocol.md。若攻击者论证"跨技能目录引用增加加载摩擦"——β 反证：references 加载是 Claude 常态（cc-* 子技能都读自己 references/），跨目录读 cc-runtime/references/ 不比读自己 references/ 摩擦大多少。**但这是 β 最可被攻击的点**。
2. **概念层与物理层分离的认知负担**：组织层（5 hcc-* 目录）与协议物理宿主（cc-runtime）不在同一层。新人理解时需跨层关联。β 反证：charter 三层总图本就是概念分层（组织/工具/地基），β 的物理放置只是让"地基 owns 协议"与概念图的"地基层 cc-runtime"对齐——**反而是概念-物理一致性**，非负担。
3. **运维部职责扩张**：运维部从"state 保活"扩张到"协议守护"，可能过载。β 反证：运维部本就是 cc-runtime 的 R（explore §四），hcc-protocol.md 放 cc-runtime/references 是其 references 目录的自然扩展，不算职责扩张——只是文档托管位置。

### 10.3 适用场景

- **适用**：5 部门职责边界清晰且稳定（charter D10 已定稿 5 部门表）；层1 cc-runtime 已闭合（state-schema frozen-v1，可承载协议文档）；追求 DRY + 概念-物理一致性。
- **不适用**：若未来协议需要部门级定制（每部门协议差异大）→ γ 更优；若追求最少目录数 → α 更优（hcc-org/ 单根）；若层1 cc-runtime 尚未闭合 → β 无地基可下沉（但本场景层1已闭合，β 适用）。

---

## 十一、与 charter D10 一致性核验（逐条对照 A 工具箱模型 + 5 部门表 + 协作协议）

### 11.1 A 工具箱模型核验（charter §组织架构 形态定论）

| charter 条款 | β 方案落地 | 一致性 |
|-------------|----------|--------|
| 部门 = 协作协议层（定义职责 + plan/review 流程 + 交接协议 + 信息源） | 5 个 hcc-* SKILL.md 各含 7 段（§三） | ✅ |
| 技能 = 跨部门工具箱（现有 cc-*/venture-* 原位保留，按需调用） | §八 skills 清单，全部原位保留，部门 SKILL.md 标注调用关系 | ✅ |
| 重构≈0，不破坏 50-decision 技能树 | 0 改动现有技能（只新增 5 目录 + 1 references 文档） | ✅ |

### 11.2 5 部门表核验（charter §组织架构 5 部门表）

| charter 部门 | charter 节点 | charter 信息源 | charter 工具 | β 部门目录 | β 工具映射 | 一致性 |
|------------|------------|--------------|------------|----------|----------|--------|
| 决策部 | N3/N4/HG | 知识库+web | cc-2pp/cc-goal/cc-orchestration | hcc-decision（§3.1） | cc-2pp/cc-goal/cc-orchestration | ✅ |
| 产品部 | N5/N7/N8 | 本地产物+用户反馈 | cc-loop+产品设计（新建） | hcc-product（§3.2） | cc-loop + 缺口占位 | ✅（缺口留层3） |
| 开发部 | 实施 | 本地代码 | executor/cc-loop | hcc-dev（§3.3） | executor/cc-loop + 外部 superpowers | ✅ |
| 运维部 | 层1贯穿 | 本地 state/config | cc-runtime/cc-config/cc-context | hcc-ops（§3.4） | cc-runtime/cc-config/cc-context | ✅ |
| 销售部 | N1/N2/N6 | web+知识库 | venture-judge+销售（新建） | hcc-sales（§3.5） | venture-judge + 缺口占位 | ✅（缺口留层3） |

### 11.3 部门协作协议核验（charter §组织架构 协作协议）

| charter 协议条款 | β 方案落地 | 一致性 |
|----------------|----------|--------|
| 部门间不直接对话 | hcc-protocol §1.1（经 state/direction/trace 交换） | ✅ |
| 通过层1 产物契约（state）+ 方向指针（direction）+ 执行记忆（trace）交换上下文 | hcc-protocol §1.1 + §2.2 块4 读写矩阵 | ✅ |
| 每个部门的 plan/review 遵循 cc-2pp（判官 + 对抗） | 每部门 plan/review 流程（§三 各部门 .3/.4）引用 cc-2pp 方法论 | ✅ |

### 11.4 BOSS 三维决策核验（explore §七）

| BOSS 维度 | BOSS 选择 | β 落地 | 一致性 |
|----------|----------|--------|--------|
| 交付范围 | 协议层完整骨架（5 部门 SKILL.md 各含 7 段，不新建业务技能） | §三 5 部门各 7 段 + 产品部/销售部缺口占位留层3 | ✅ |
| DAG 对接 | 映射但不装配（placeholder 不动，C7/C1 不破） | §五 映射表 + §5.3 C7/C1 核验 | ✅ |
| 协作预算 | 完整双能力 + 预算护栏（plan+review + budget_tokens_cap + max_iteration） | §三 各部门 plan+review + §六 护栏双闸 | ✅ |

### 11.5 硬约束核验（charter/engineering）

| 约束 | β 落地 | 一致性 |
|------|--------|--------|
| C1 写入隔离（direction.json 仅 shift-direction.js 写） | §3.1.3 step5 + hcc-protocol §3.3（HG 经 shift-direction.js / pipeline-state.js） | ✅ |
| C2 纯 Node fs+path+crypto | β 是 SKILL.md + 文档，无脚本，天然满足 | ✅ |
| C5/C6/C7 不动层2 拓扑/graph_hash/placeholder | §5.2 映射不装配 + §九 skill 配置成本=0 | ✅ |
| 7×24 单机 = B（会话级断点续传） | 复用层1 checkpoint/direction/trace（state-schema §0），不新增 | ✅ |
| 度量用 Claude 实施者度量（禁人天） | §九 全用 token/轮次/skill配置/验证 | ✅ |

---

## 附录：β 派核心论点一句话总结

**"5 个部门目录严格独立（名实相符），但它们共同站立的协议地基下沉到 cc-runtime/references/hcc-protocol.md——因为协议不是某个部门的知识，而是 5 个部门共同的地基共识，地基 owns 它语义正当，state-schema.md 已是先例。"**

代价是协议与部门 SKILL.md 物理分离（跨目录引用），但这个代价被"层1 是所有部门的共同地基"语义正当化，且 context 复杂度从 O(5²) 降到 O(5+1)（协议下沉缓解多节点复杂度）。β 在 DRY、概念-物理一致性、C1/C5/C6/C7 天然满足、度量最优 4 个维度优于 α/γ；致命弱点是协议-部门物理分离的可攻击性（供对抗验证检验）。
