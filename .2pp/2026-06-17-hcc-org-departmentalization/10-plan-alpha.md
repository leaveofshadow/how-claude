---
run: 2026-06-17-hcc-org-departmentalization
artifact: plan-alpha
faction: α 保守派（集中放置）
created: 2026-06-17
status: draft
---

# 10-plan-alpha.md —— hcc 部门化重组方案（α 保守派）

> 立场：**共享协作协议集中放置于 `hcc-org/` 新根**。1 个协议总则 SKILL.md（协作总则 + RACI 总表 + 交接协议 + state 读写规则），5 个部门子技能目录各自有 SKILL.md 但**引用总则**（DRY）。
>
> 证据根：charter §组织架构 D10=A 工具箱模型（00-charter.md L55-82）+ explore §五 8 条发现（00-explore.md L194-261）+ §七 BOSS 已定 3 约束（L326-332）+ §六 0b 外部校正（L266-321）。
>
> 实施者认知锚：本方案所有"谁做" = Claude/agent，工作量度量禁人天，用 token/轮次/skill 配置成本/验证复杂度/依赖风险。

---

## 方案核心主张

**一句话**：在 `.claude/skills/hcc-org/` 建一个**协议总则根目录**，作为 5 部门协作的「宪法」，5 个部门子技能目录（`hcc-decision/` `hcc-product/` `hcc-dev/` `hcc-ops/` `hcc-sales/`）各持 SKILL.md，**只引用总则**定义本部门专属内容（职责细节 + 部门内 RACI + plan/review 流程 + 工具箱映射），不复制总则。

**200 字展开（α 集中放置论据）**：

charter §组织架构 D10 形态定论原话是"部门 = 协作协议层（**新增 `hcc-org/`**，定义职责 + plan/review 流程 + 交接协议 + 信息源）"（00-charter.md L69）——charter 在定稿时**已经写明新根 hcc-org/**，α 方案是 charter 原意的直接落地，不是发明。集中放置三个不可替代的收益：

1. **DRY**：协作总则、RACI 总表、交接协议、state 读写规则是 5 部门**横切共享**内容（charter §组织架构协议一句话、explore §5.2 物理基础、§6.3 handoff pair、§6.4 RACI 维度都跨部门），放总则一处改全生效。若分散到 5 目录（γ 方案）或塞进 cc-runtime（β 方案），任意一条总则修订需 5 处同步——5 处漂移是必然结果（Ruh 反模式#2：边界不清致 duplicate work + gaps，00-explore.md L292）。
2. **职责分层清晰**：总则只管"跨部门怎么协作"（协议宪法），部门 SKILL.md 只管"本部门怎么干活"（部门业务）——两层不混。运维部是层1 运行时地基（explore §5.7），把它和决策部/销售部协议混在 cc-runtime 会让层1 文件污染业务语义。
3. **加载成本可控**：总则 SKILL.md 精简（约 200 行，纯协议无业务），部门 SKILL.md 精简（约 150 行，引用总则 + 本部门业务）。任一部门激活时读 2 个文件（总则 + 本部门），token 成本 ≈ 6-8k，远低于 γ 方案每部门内嵌全协议（每部门 350+ 行，单文件 10-12k）。**集中 = 加载时多读一个小文件，换来修订时的 DRY 收益**，ROI 正向。

代价坦诚：6 目录（hcc-org/ + 5 部门）偏离 BOSS #19"5 独立"字面表述。但 BOSS 真实意图是"5 部门独立运行"（每部门有自己的职责+工具+plan/review），不是"5 个目录物理隔离到不能有共享文件"。hcc-org/ 是**协作协议的物理容器**，不是第 6 个部门——它没有 plan/review 能力，不是 agent 角色，只是 5 部门共读的"宪法碑"。这与 charter §组织架构"新增 hcc-org/"原话一致，α 方案在 BOSS 真实意图内。

---

## 一、整体架构（α 目录结构）

### 1.1 设计原则

α 方案的目录结构遵循三条原则：

1. **协议宪法层 + 部门业务层物理分离**：`hcc-org/` 是协议宪法（横切共享），5 个 `hcc-{dept}/` 是部门业务（纵切自治）。两层文件类型不同（宪法 = 协议规则；部门 = 职责+流程+工具），不混淆。
2. **总则唯一，部门引用**：协作总则、RACI 总表、交接协议模板、state 读写规则**只在 `hcc-org/SKILL.md` 定义一次**。5 个部门 SKILL.md 用「引用块」（`> 详见 hcc-org/SKILL.md §X`）挂接，不复制。
3. **缺口占位显式留层3**：产品部/销售部业务技能真空（explore §5.6，charter L80）——部门 SKILL.md 的「工具箱映射」段用 `[GAP: 待层3 cc-venture 填充]` 显式占位，协议层不假装已具备业务能力。

### 1.2 ASCII 目录树

```
.claude/skills/
├── claude-coach/                     # 路由器（已存在，不改）
├── cc-2pp/                            # 工具箱（已存在）
├── cc-goal/                           # 工具箱（已存在）
├── cc-orchestration/                  # 工具箱（已存在）
├── cc-loop/                           # 工具箱（已存在）
├── cc-config/                         # 工具箱（已存在）
├── cc-context/                        # 工具箱（已存在）
├── cc-scanner/                        # 工具箱（已存在）
├── cc-memory/                         # 工具箱（已存在）
├── cc-runtime/                        # 层1 地基（已存在，不改）
├── venture-pipeline/                  # 层2 引擎（已存在，不改）
│
├── hcc-org/                           # ★ α 新增：协议宪法根（横切共享）
│   ├── SKILL.md                       #   协作总则 + RACI 总表 + 交接协议 + state 读写规则 + 部门索引
│   └── references/
│       ├── handoff-protocol.md        #   交接协议深度参考（handoff pair + 文件命名 + direction_version 绑定）
│       ├── raci-matrix.md             #   RACI 总表深度参考（venture 节点 × 5 部门 R/A/C/I 全矩阵）
│       └── state-access-rules.md      #   state 字段读写矩阵深度参考（哪个部门读/写哪个字段）
│
├── hcc-decision/                      # ★ α 新增：决策部
│   ├── SKILL.md                       #   职责 + 部门内 RACI + plan/review + 交接(引用总则) + 工具映射 + 缺口
│   └── references/
│       └── judge-gate-flow.md         #   HG 拍板 + 换向触发 shift-direction.js 流程深度参考
│
├── hcc-product/                       # ★ α 新增：产品部（业务真空，留层3）
│   ├── SKILL.md                       #   职责 + 部门内 RACI + plan/review + 交接(引用总则) + 工具映射 + [GAP 占位]
│   └── references/
│       └── product-design-flow.md     #   N5 设计/N7 需求/N8 UIUX 协议占位（业务技能留层3）
│
├── hcc-dev/                           # ★ α 新增：开发部
│   ├── SKILL.md                       #   职责 + 部门内 RACI + plan/review + 交接(引用总则) + 工具映射
│   └── references/
│       └── implementation-sop.md      #   按 plan 实施 SOP + worktree + 循环合同引用 cc-loop
│
├── hcc-ops/                           # ★ α 新增：运维部
│   ├── SKILL.md                       #   职责 + 部门内 RACI + plan/review + 交接(引用总则) + 工具映射
│   └── references/
│       └── ops-runtime-stewardship.md #   7×24 保活 + state/trace/Hook 监管流程（引用 cc-runtime 脚本）
│
└── hcc-sales/                         # ★ α 新增：销售部（业务真空，留层3）
    ├── SKILL.md                       #   职责 + 部门内 RACI + plan/review + 交接(引用总则) + 工具映射 + [GAP 占位]
    └── references/
        └── market-validation-flow.md  #   N1 调查/N2 竞品/N6 画像/N8 规模化协议占位（业务技能留层3）
```

### 1.3 加载关系（运行时 Claude 读哪些文件）

```
部门激活（如决策部被节点 N3 路由命中）
   │
   ├─► Read hcc-decision/SKILL.md        （本部门业务，~150 行）
   │     │
   │     └─► 内含引用块：> 详见 hcc-org/SKILL.md §协作总则 / §交接协议 / §state 读写
   │
   └─► Read hcc-org/SKILL.md             （协议宪法，~200 行，按需读 references/）
         │
         └─► 按需 Read hcc-org/references/{handoff-protocol, raci-matrix, state-access-rules}.md
```

**单部门激活 token 成本**：2 个 SKILL.md ≈ 6-8k tokens（charter §部署约束"单 Claude"下，同一时刻只有 1 个部门激活，不存在 5 部门并行加载爆窗口）。references/ 按需加载（深度参考，非每次必读）。

### 1.4 与 charter 三层总图的对齐

charter §组织架构三层总图（00-charter.md L74-78）：
```
hcc = AI 公司员工指南
├── 组织层  hcc-org/         ← 5 部门协作协议（D10 新增，轻量）
├── 工具层  cc-* + venture-* ← 跨部门方法论与业务技能
└── 地基层  cc-runtime        ← state/direction/trace/Hook
```

α 目录树**精确对齐**：
- 组织层 = `hcc-org/` + 5 个 `hcc-{dept}/`（charter 写"hcc-org/"代表整个组织层，α 把它拆为宪法 + 5 部门，物理上仍是 1 个新根 + 5 子目录的"hcc-*"族）
- 工具层 = 11 个已存在 cc-*/venture-* 技能，**原位不动**（charter L69"现有 cc-*/venture-* 原位保留"）
- 地基层 = cc-runtime，**原位不动**

---

## 二、共享协作协议设计（hcc-org/SKILL.md 总则）

`hcc-org/SKILL.md` 是 5 部门共读的协议宪法。**只管跨部门协作规则**，不管任何部门业务。结构如下（章节清单 + 内容要点）：

### 2.1 frontmatter

```yaml
---
name: hcc-org
description: |
  hcc 组织协作协议宪法（层3 协议层根）。定义 5 部门（决策/产品/开发/运维/销售）的协作总则、
  RACI 总表、交接协议、state 读写规则。被 5 个 hcc-{dept}/ 部门 SKILL.md 引用。
  本身不直接触发（无业务 trigger），仅在 hcc-{dept}/ 激活时被引用加载。
  触发条件：被 hcc-decision/hcc-product/hcc-dev/hcc-ops/hcc-sales 的 SKILL.md 引用块触发加载。
---
```

**关键设计**：hcc-org **无业务 trigger 关键词**（explore §5.3 张力解法：避免与 cc-* 工具箱 trigger 竞争）。它只在部门 SKILL.md 被加载时通过引用块连带加载——这是"协议宪法"的语义（不被独立调用，被业务引用）。

### 2.2 章节结构（hcc-org/SKILL.md 正文）

```
# hcc-org —— 5 部门协作协议宪法

## §0 定位与边界
- 本文件 = 5 部门协作的横切共享协议，非业务技能，无 plan/review 能力
- 5 部门索引：hcc-decision / hcc-product / hcc-dev / hcc-ops / hcc-sales（链接到各自 SKILL.md）
- 工具箱索引：cc-2pp / cc-goal / cc-orchestration / cc-loop / cc-config / cc-context / cc-runtime / venture-judge（链接到 .claude/skills/ 对应目录）
- 物理基础：层1 state 四文件 + 层2 pipeline-state（引用 explore §二/§三 schema）

## §1 协作总则（5 条不可违背）
1. 部门间不直接对话，通过 state/direction/trace 交换上下文（charter §组织架构协议原话）
2. direction.json 唯一写者 = shift-direction.js（C1 硬约束，explore §5.7）；部门协议触发换向必须调 shift-direction.js --reason
3. pipeline-state.json HG 停等语义独占（嫁接1，explore §3.5）；部门"是否 HG 停等"判断读 pipeline-state.status
4. 交接 = 上游产物文件 + handoff pair（结构化交接说明），不灌完整 trace（explore §6.3 LangChain 铁律）
5. 每节点 plan+review 双能力全保留，护栏双闸 budget_tokens_cap + max_iteration（BOSS #3 约束）

## §2 RACI 总表（横切矩阵）
[此处放精简总表，完整版见 references/raci-matrix.md]
| venture 节点/产物 | 决策部 | 产品部 | 开发部 | 运维部 | 销售部 |
|------------------|--------|--------|--------|--------|--------|
| N1 启动调查       | I      | -      | -      | I      | R/A    |
| N2 机会识别       | C      | -      | -      | I      | R/A    |
| N3 方案           | R/A    | C      | C      | I      | C      |
| HG1 拍板          | R/A    | I      | I      | I      | I      |
| N4 原型           | C      | C      | R/A    | I      | I      |
| HG2 拍板          | R/A    | I      | I      | I      | I      |
| N5 验证           | C      | R/A    | C      | I      | C      |
| N6 产品化         | I      | R/A    | R      | I      | C      |
| N7 迭代优化       | I      | R/A    | R      | I      | C      |
| N8 规模化         | C      | C      | -      | I      | R/A    |
| direction 换向    | R/A    | I      | I      | C      | I      |
| state 读写        | I      | I      | I      | R/A    | I      |
（R=做 A=拍板 C=咨询 I=知情；完整矩阵 + 字段级 RACI 见 references/raci-matrix.md）

## §3 交接协议（handoff pair 规范）
- 交接单元 = handoff pair = {上游产物文件路径, 结构化交接说明}
- 交接说明字段（最小集）：direction_version / from_node / to_node / iter / 产物路径 / 一句话交接意图
- 文件命名约定：`.venture/artifacts/v{direction_version}/{node}-{dept}-{iter}.md`
- direction_version 绑定：交接说明的 direction_version 必须 == direction.current_version（INV-1），否则下游拒绝接手
- 完整规范见 references/handoff-protocol.md

## §4 state 读写规则（部门权限矩阵）
[精简表，完整版见 references/state-access-rules.md]
| state 字段 | 决策部 | 产品部 | 开发部 | 运维部 | 销售部 |
|-----------|--------|--------|--------|--------|--------|
| direction.current_version | 读+触发换向(经shift) | 读 | 读 | 读+监管 | 读 |
| checkpoint.* | 读 | 读+写业务字段 | 读+写业务字段 | 读+写(监管) | 读+写业务字段 |
| trace.ndjson | 读 | 追加写 | 追加写 | 追加写+监管 | 追加写 |
| pipeline-state.* | 读+HG触发 | 读 | 读 | 读+监管 | 读 |
| tasks.tree.* | 读 | 读+写 | 读+写 | 读+写(监管) | 读+写 |

## §5 护栏双闸（引用 BOSS #3 + checkpoint.guardrails）
- budget_tokens_cap：每节点 token 预算上限（运维部监管，超阈值→运维部告警）
- max_iteration：plan→review 驳回回环上限（决策部监管，超阈值→force converge）
- 详细触发流程见 hcc-ops/references/ops-runtime-stewardship.md + hcc-decision/references/judge-gate-flow.md

## §6 与工具层的契约
- hcc 部门协议层只定义"用哪个工具箱 + 在哪步用"，工具箱本身（cc-*/venture-*）原位不动
- 装配（节点 skill 字段 placeholder→真实 skill）是层3 cc-venture 职责，hcc 协议层只定义"映射规则"（§五）
```

### 2.3 references/ 三深度参考文件

| 文件 | 内容要点 |
|------|---------|
| `handoff-protocol.md` | handoff pair 完整规范 + 文件命名 regex + direction_version 绑定校验算法 + 不灌 trace 的 token 节省估算 + 反模式（灌完整 trace 致接收 agent 上下文爆） |
| `raci-matrix.md` | §2 总表的完整版：venture 8 节点 + HG1/HG2 + 5 类产物（direction/checkpoint/trace/pipeline-state/tasks.tree） × 5 部门的 R/A/C/I 全矩阵 + 每格判定理由 + 冲突仲裁规则（多部门 R 时谁主） |
| `state-access-rules.md` | §4 读写矩阵的完整版：每字段每部门的 read/write/append/trigger 权限 + 写者隔离 C1 复述（direction.json 仅 shift-direction.js）+ INV-1..6 不变量在部门协作中的约束力 + 违规检测（trace 回放发现越权写） |

---

## 三、5 部门 SKILL.md 设计

每个部门 SKILL.md **引用 hcc-org/SKILL.md 总则**，只补充本部门专属内容。统一结构（8 段）：

```
# hcc-{dept} —— {部门名}

## §0 引用协议宪法
> 本部门遵循 hcc-org/SKILL.md 协作总则（§1）/ RACI 总表（§2）/ 交接协议（§3）/ state 读写（§4）/ 护栏（§5）。
> 本 SKILL.md 只补充本部门专属内容。

## §1 部门职责（charter §组织架构部门表 + 节点映射）
## §2 部门内 RACI（补充总表未覆盖的本部门内部角色分工）
## §3 plan 流程（规划能力）
## §4 review 流程（审查能力）
## §5 交接协议（引用 hcc-org §3，补本部门产物命名/路径）
## §6 信息源（charter 部门表"主信息源"列）
## §7 工具箱映射（charter 部门表"hcc 工具"列 + 在哪步用 + [GAP 占位]）
## §8 缺口技能占位（产品部/销售部真空，留层3）
```

### 3.1 决策部（hcc-decision/）

**venture 节点**：N3 计划 / N4 judge / HG1 / HG2（charter L61，explore §四 L180）
**信息源**：知识库 + web（行业/竞品）
**工具箱**：cc-2pp / cc-goal / cc-orchestration（explore §一 L13/L16/L19，已厚实无缺口）

**§1 职责**：方向设定、可行性判断、judge gate 拍板、换向触发（经 shift-direction.js）。
**§2 部门内 RACI**：plan 阶段（cc-2pp 判官小组起草）= R/A 决策部自身；review 阶段（对抗验证）= R 决策部 + A boss（HG 时）；HG 拍板 = A 决策部代 boss 行使（boss 唯一人类，决策部是 boss 的 AI 代理）。
**§3 plan 流程**：
- 触发：节点进入 N3/N4，或 HG1/HG2 awaiting_human
- 步骤：① 读 direction.current_version + checkpoint.continue_from（恢复上下文）② 调 cc-2pp 判官小组（α/β/γ 起草→评分→对抗→综合）③ 产出落盘 `.venture/artifacts/v{ver}/{node}-decision-{iter}.md` ④ 写 handoff pair 交接给下游
**§4 review 流程**：
- 触发：上游部门（产品/开发/销售）产出 handoff pair 后
- 步骤：① 读上游 handoff pair ② 调 cc-2pp 对抗验证（攻击者攻击 ROI/Claude 度量/可编排性）③ 评分 < 阈值→驳回（max_iteration 计数）④ 评分 ≥ 阈值→放行 + 写 trace
**§5 交接协议**：引用 hcc-org §3；产物命名 `{node}-decision-{iter}.md`；HG 拍板后写 `gate-resolution-HG{1|2}.md` 含 boss 决策动词（continue/redirect/abort）。
**§6 信息源**：cc-scanner 扫描的知识库 + WebSearch（行业/竞品）。
**§7 工具箱映射**：
| 步骤 | 工具 | 用法 |
|------|------|------|
| plan 起草 | cc-2pp | 判官小组 α/β/γ 并行起草 → 10-plan-*.md |
| plan 综合 | cc-2pp | 40-synthesis.md 综合裁决 |
| review 对抗 | cc-2pp | 20-attack-{A,B,C}.md 对抗验证 |
| 终态设计 | cc-goal | N3 方案输出 /goal 终态条件 |
| 编排决策 | cc-orchestration | plan→review 驳回时决策 subagent/team 模式 |
| HG 拍板 | shift-direction.js | 换向触发（C1：唯一 direction.json 写者） |
**§8 缺口**：无（决策部厚实，charter L80 ✓）。

### 3.2 产品部（hcc-product/）

**venture 节点**：N5 设计 / N7 需求 / N8 UIUX（charter L62）
**信息源**：本地产物 + 用户反馈
**工具箱**：cc-loop（循环工程方法论）+ **[GAP: 产品设计/UIUX/需求挖掘业务技能待层3]**

**§1 职责**：产品设计、UIUX 设计、需求挖掘、用户反馈整合。
**§2 部门内 RACI**：产品设计 = R/A 产品部；需求挖掘 = R 产品部 + A 决策部（需求需 boss 认可）；UIUX = R/A 产品部。
**§3 plan 流程**：① 读 N4 原型 handoff pair ② 调 cc-loop 设计产品迭代循环（worktree SOP + 循环合同）③ 产出 `.venture/artifacts/v{ver}/{node}-product-{iter}.md` ④ [GAP: 产品设计具体方法待层3 venture-product skill 填充]
**§4 review 流程**：① 读本部门产物 ② 调 cc-loop review 模式（自评终态条件 + 护栏）③ 驳回/放行
**§5 交接协议**：产物命名 `{node}-product-{iter}.md`；交接给开发部（设计稿）+ 决策部（review）。
**§6 信息源**：本地产物（N4 原型代码）+ 用户反馈（[GAP: 反馈采集技能待层3]）。
**§7 工具箱映射**：
| 步骤 | 工具 | 用法 |
|------|------|------|
| 迭代循环 | cc-loop | N6⇄N7 产品迭代循环（worktree + 循环合同） |
| 终态自评 | cc-goal/cc-loop | 产品设计终态条件自评 |
| [GAP] | venture-product (待层3) | 产品设计具体方法 |
| [GAP] | venture-uiux (待层3) | UIUX 设计 |
**§8 缺口占位**：`[GAP: N5 产品设计 / N7 需求挖掘 / N8 UIUX 无本项目技能，待层3 cc-venture 启动补齐 venture-product/venture-uiux skill。charter §组织架构 L80 明确"产品部 ❌ 真空，待层3"，P1 最懒——协议层先预留接口，业务技能按需补]`

### 3.3 开发部（hcc-dev/）

**venture 节点**：实施（执行计划，charter L63）
**信息源**：本地代码
**工具箱**：executor（Claude 原生 general-purpose agent / OMC executor）+ cc-loop

**§1 职责**：按 plan 实施、代码交付、测试、重构。
**§2 部门内 RACI**：实施 = R 开发部 + A 决策部（plan 由决策部出）；测试 = R/A 开发部。
**§3 plan 流程**：① 读决策部 plan handoff pair（60-impl-plan.md）② 调 cc-loop worktree SOP（隔离工作区）+ 循环合同（max_iteration + budget）③ 产出代码 commit + `.venture/artifacts/v{ver}/{node}-impl-{iter}.md`（实施日志）
**§4 review 流程**：① 读代码 diff ② 调 cc-loop review + verifier（自评终态条件）③ 驳回（返工）/ 放行（交接产品部/销售部）
**§5 交接协议**：产物 = 代码 commit + 实施日志；交接给产品部（N5 验证）/ 销售部（N8 规模化）。
**§6 信息源**：本地代码（git diff）+ cc-loop 循环上下文。
**§7 工具箱映射**：
| 步骤 | 工具 | 用法 |
|------|------|------|
| 实施 | executor (general-purpose/OMC) | 按 plan 写代码（route to executor agent） |
| 循环编排 | cc-loop | worktree SOP + 循环合同 + 护栏三件套 |
| 终态验证 | cc-goal/verifier | 实施终态条件自评 |
| 代码审查 | code-reviewer/verifier | review 阶段（OMC agent） |
**§8 缺口**：⚠️ 中等（charter L80）。executor 依赖外部 agent/skill（superpowers:* 系列），非本项目技能。协议层只定义"调 executor"，不假装本项目有 executor 技能。

### 3.4 运维部（hcc-ops/）

**venture 节点**：层1 运行时（贯穿所有节点，charter L64）
**信息源**：本地 state/config
**工具箱**：cc-runtime / cc-config / cc-context（explore §一 L22/L14/L15，已厚实无缺口）

**§1 职责**：7×24 保活、state/trace/Hook 监管、上下文健康、配置系统维护、护栏双闸监管。
**§2 部门内 RACI**：state 读写 = R/A 运维部（唯一有权监管四文件完整性）；护栏监管 = R 运维部 + A 决策部（超阈值告警决策部）；保活 = R/A 运维部。
**§3 plan 流程**：① 持续读 checkpoint.health + guardrails 字段 ② 检测 health=stagnant_warn/blocked → 调 cc-context 上下文健康诊断 ③ 检测 budget_tokens_used 接近 cap → 告警决策部 ④ 产出运维日志 `.venture/artifacts/v{ver}/ops-health-{ts}.md`
**§4 review 流程**：① 定期（每 N 节点）回放 trace.ndjson ② 检测 INV-1..6 违反（越权写/版本漂移）③ 检测 direction.status 异常（应永远 active，explore §2.3）④ 异常→告警决策部 + 修复（调 cc-runtime 脚本）
**§5 交接协议**：运维部是横切部门（不参与节点流转），交接 = 告警 handoff pair（异常时产 `{alert-type}-alert-{ts}.md` 推给决策部）。
**§6 信息源**：层1 四文件（checkpoint/direction/trace/tasks.tree）+ 层2 pipeline-state.json + settings.json + CLAUDE.md。
**§7 工具箱映射**：
| 步骤 | 工具 | 用法 |
|------|------|------|
| state 监管 | cc-runtime | 读 checkpoint/direction/trace，监管 INV 不变量 |
| 换向执行 | shift-direction.js | 决策部判定换向→运维部代调脚本（C1） |
| 上下文健康 | cc-context | health=stagnant 时诊断 + 持久化策略 |
| 配置维护 | cc-config | 六层配置 + CLAUDE.md 诊断 |
| 保活 hook | compact-snapshot Block⑤ | compact 抢救（explore §2.6） |
**§8 缺口**：无（运维部厚实，charter L80 ✓）。

### 3.5 销售部（hcc-sales/）

**venture 节点**：N1 调查 / N2 竞品 / N6 画像 / N8 规模化（charter L65）
**信息源**：web + 知识库（案例）
**工具箱**：venture-judge（系统级 installed skill）+ **[GAP: N1 调查/N2 竞品/N6 画像/N8 收益转化业务技能待层3]**

**§1 职责**：用户画像、收益转化、市场验证、机会识别、竞品分析。
**§2 部门内 RACI**：调查/竞品 = R/A 销售部；画像 = R 销售部 + A 决策部（画像需 boss 认可）；收益转化 = R 销售部 + A boss（最终收益归 boss）。
**§3 plan 流程**：① 读 direction.current_version（恢复上下文）② 调 venture-judge 创业评估（24 步法 + VC 7 维）③ web 调查（WebSearch + 知识库）④ 产出 `.venture/artifacts/v{ver}/{node}-sales-{iter}.md`
**§4 review 流程**：① 读产物 ② 调 venture-judge 评判卡 review ③ 驳回/放行
**§5 交接协议**：产物命名 `{node}-sales-{iter}.md`；N1→N2→N3（交接决策部做方案）；N6→N7（交接产品部做画像驱动迭代）；N8→出口（交接 boss 做规模化决策）。
**§6 信息源**：WebSearch + 知识库（venture-judge 150+ 案例库）+ 本地产物（N4/N5 验证产物）。
**§7 工具箱映射**：
| 步骤 | 工具 | 用法 |
|------|------|------|
| 创业评估 | venture-judge | 24 步法 + VC 7 维 + 评判卡 |
| web 调查 | WebSearch + cc-scanner 知识库 | N1 调查/N2 竞品 |
| 画像构建 | venture-judge + [GAP] | N6 用户画像 |
| [GAP] | venture-research (待层3) | 系统化市场验证技能 |
**§8 缺口占位**：`[GAP: N1 调查/N2 竞品/N6 画像/N8 收益转化无本项目技能，venture-judge 是系统级 installed skill 但本项目 .claude/skills/ 无承接目录（explore §四 L184）。待层3 cc-venture 启动补齐 venture-research/venture-sales skill。charter §组织架构 L80 明确"销售部 ❌ 真空"，P1 最懒——协议层先预留接口]`

---

## 四、部门协作协议落地

### 4.1 state 字段读写矩阵（落地 hcc-org §4 精简表）

**核心原则（C1 + 嫁接1，explore §5.7/§3.5）**：
- `direction.json` 唯一写者 = `shift-direction.js`（任何部门触发换向 → 调脚本，不直写）
- `pipeline-state.json` 写者 = pipeline-state.js + advance-node.js + resolve-hg.js（部门只读 + 触发 HG via resolve-hg.js）

**字段级权限矩阵**（完整版在 hcc-org/references/state-access-rules.md）：

| state 字段 | 决策部 | 产品部 | 开发部 | 运维部 | 销售部 | 唯一写者约束 |
|-----------|--------|--------|--------|--------|--------|-------------|
| direction.current_version | 读 + 触发换向(调 shift) | 读 | 读 | 读 + 监管 | 读 | **shift-direction.js 唯一写** |
| direction.status/gate | 读（永远 active/null，不判断 HG） | 读 | 读 | 读 + 监管 | 读 | shift-direction.js |
| checkpoint.current_node/task | 读 | 读 + 写 | 读 + 写 | 读 + 写 + 监管 | 读 + 写 | H4/H5（层1 hook） |
| checkpoint.continue_from | 读（续跑） | 读 | 读 | 读 + 监管 | 读 | H4/H5 |
| checkpoint.guardrails | 读 + 设阈值(经运维) | 读 | 读 | 读 + 写 + 监管 | 读 | H4/H5 |
| checkpoint.direction_version | 读（INV-1 校验） | 读 | 读 | 读 + 监管 | 读 | H4/H5 |
| trace.ndjson 每行 | 读 | 追加写 | 追加写 | 追加写 + 监管 | 追加写 | H2 PostToolUse |
| pipeline-state.status/gate | 读 + 触发 HG(调 resolve-hg) | 读 | 读 | 读 + 监管 | 读 | pipeline-state.js 等 |
| pipeline-state.current_node | 读 | 读 | 读 | 读 + 监管 | 读 | advance-node.js |
| pipeline-state.graph_hash | 读（C6 漂移校验） | 读 | 读 | 读 + 监管 | 读 | load-graph.js |
| tasks.tree.tasks[] | 读 | 读 + 写 | 读 + 写 | 读 + 写 + 监管 | 读 + 写 | H2 PostToolUse |

**部门越权检测**：运维部 review 阶段回放 trace.ndjson，若发现某部门直接写 direction.json 或 pipeline-state.json（绕过脚本），告警决策部 + 修复（INV-1..6 违反，explore §2.5）。

### 4.2 交接文件命名约定

**根目录**：`.venture/artifacts/v{direction_version}/`（方向版本绑定，换向时归档，explore §2.3 shift-direction 归档机制）

**命名 regex**：`{node_id}-{dept}-{iter}.md`
- node_id ∈ {N1,N2,N3,N4,N5,N6,N7,N8,HG1,HG2,ops}
- dept ∈ {decision,product,dev,ops,sales}
- iter = 节点内迭代轮次（int，从 0 起）

**示例**：
- `v3/N3-decision-0.md`（决策部在 N3 方案的第 0 轮产出）
- `v3/HG1-decision-0.md`（决策部在 HG1 拍板记录）
- `v3/N4-dev-1.md`（开发部在 N4 原型的第 1 轮实施日志）
- `v3/ops-health-20260617T143000.md`（运维部健康检查日志，ops 用时间戳代替 iter）

**特殊产物**：
- `gate-resolution-HG{1|2}.md`（HG 拍板结果，含 boss 决策动词 continue/redirect/abort）
- `{alert-type}-alert-{ts}.md`（运维部告警，推决策部）

### 4.3 direction_version 绑定（INV-1 落地）

**铁律**：所有交接 handoff pair 的 `direction_version` 字段必须 == `direction.current_version`（explore §2.5 INV-1）。

**下游校验流程**：
1. 下游部门读 handoff pair → 提取 `direction_version`
2. 读 `direction.json` 当前 `current_version`
3. 若不等 → 拒绝接手 + 告警运维部（方向已换向，上游产物过期）
4. 若等 → 接手 + 在本部门 trace 追加行（带 direction_version，INV-4）

**换向时归档**：shift-direction.js 把 `.venture/artifacts/v_old/` → `.venture/archived/v_old/`（explore §2.3），旧版本产物物理隔离，下游读不到（ENOENT 自然拦截，痛点4 机制腿）。

### 4.4 不灌完整 trace（LangChain handoff pair 铁律，explore §6.3）

**交接内容** = handoff pair = {
  `upstream_artifact`: 上游产物文件路径,
  `direction_version`: int,
  `from_node`: 上游节点,
  `to_node`: 下游节点,
  `iter`: 迭代轮次,
  `intent`: 一句话交接意图,
  `summary`: 上游关键结论摘要（≤ 500 tokens，非完整 trace）
}

**禁止**：交接时附完整 trace.ndjson（bloat + 干扰接收 agent，LangChain 教训）。需更多 context 在 `summary` 里精炼，不在 handoff 灌原始 trace。

**token 节省**：完整 trace 单节点可达 10-50k tokens，handoff pair summary ≤ 500 tokens，**节省 95%+**（explore §6.3 验证）。

---

## 五、DAG 对接（映射不装配，C7/C1 不破）

### 5.1 BOSS 约束复述（explore §七 L331）

> DAG 对接 = 映射但不装配：dag.placeholder.json 保持 placeholder，**不动层2已定稿拓扑**（C7/C1 不破）。hcc 协议层只定义「部门↔节点映射规则」，不替换 placeholder→真实 skill（装配留层3 cc-venture）。

### 5.2 部门 ↔ 节点映射表（hcc-org §6 + 各部门 §1 的汇总）

| venture 节点 | 节点语义 | 归属部门 | 该节点部门做什么 |
|-------------|---------|---------|-----------------|
| N1 | 启动 | 销售部 | 市场调查启动，调 venture-judge + WebSearch |
| N2 | 机会识别 | 销售部 | 竞品分析 + 机会评估，调 venture-judge 评判卡 |
| N3 | 方案 | 决策部 | 判官小组 plan，调 cc-2pp/cc-goal/cc-orchestration |
| HG1 | 方案→原型 boss 决策 | 决策部 | HG 拍板（boss 代行），写 gate-resolution-HG1.md |
| N4 | 原型 | 开发部 | 按 plan 实施，调 executor + cc-loop worktree |
| HG2 | 原型→验证 boss 决策 | 决策部 | HG 拍板，写 gate-resolution-HG2.md |
| N5 | 验证 | 产品部 + 销售部 | 产品部设计验证 + 销售部市场验证（双线） |
| N6 | 产品化 | 产品部 + 开发部 | 产品部设计 + 开发部实施（N6⇄N7 loop_back） |
| N7 | 迭代优化 | 产品部 + 开发部 | 产品部需求驱动 + 开发部迭代（max_iter=3 收敛） |
| N8 | 规模化 | 销售部 | 收益转化 + 市场规模化，调 venture-judge |
| (贯穿) | 运行时保活 | 运维部 | 全节点 state/trace/Hook 监管（横切） |

### 5.3 映射规则（hcc 协议层定义，层3 装配时用）

**规则 1：节点 skill 字段映射规则**（层3 cc-venture 装配 placeholder→真实 skill 时遵循）
- N1/N2/N8 的 `skill` 字段 → 装配为 `hcc-sales`（销售部 SKILL.md 触发）
- N3/HG1/HG2 的 `skill` 字段 → 装配为 `hcc-decision`
- N4 的 `skill` 字段 → 装配为 `hcc-dev`
- N5 的 `skill` 字段 → 装配为 `hcc-product`（设计验证）+ `hcc-sales`（市场验证，双线）
- N6/N7 的 `skill` 字段 → 装配为 `hcc-product` + `hcc-dev`
- 全节点的运维监管 → 不在 skill 字段，由层1 hook（H4/H5/H6）+ 运维部 review 阶段横切

**规则 2：loop_back N7→N6 的部门归属**
- loop_back（max_iter=3, converge_field=signal，explore §3.4）触发时，产品部（需求驱动）+ 开发部（迭代实施）协作
- 收敛判据（persona-signal.md，signal 四态 jsonld + delta < 0.1）由产品部判定，决策部 review

**规则 3：HG 触发的部门动作**
- pipeline-state.status=awaiting_human + gate=HG1/HG2 → 决策部 plan（HG 拍板准备）→ boss 决策 → 决策部调 resolve-hg.js 推进
- 决策部不直写 pipeline-state.json（C1 嫁接1），只调 resolve-hg.js

### 5.4 C7/C1 不破验证

- **C7（placeholder 占位跑通 ≠ 业务跑通）**：α 方案不动 dag.placeholder.json 的 skill=placeholder 字段。映射规则（§5.3）是 hcc 协议层文档，层3 cc-venture 启动时才装配。✓ 不破
- **C1（direction.json 唯一写者）**：α 方案所有部门触发换向 → 调 shift-direction.js（§4.1 矩阵 + 决策部 §7 工具映射）。无部门直写 direction.json。✓ 不破
- **C5/C6（不动层2拓扑 + graph_hash）**：α 方案不动 dag.json/dag.placeholder.json/pipeline-state.json schema。✓ 不破

---

## 六、护栏双闸（budget_tokens_cap + max_iteration）

### 6.1 BOSS 约束复述（explore §七 L332）

> 协作预算 = 完整双能力 + 预算护栏：每部门 plan+review 双能力全保留；护栏双闸 budget_tokens_cap + max_iteration。

### 6.2 双闸映射 checkpoint.guardrails（explore §2.1）

checkpoint.json 的 `guardrails` 字段（frozen-v1 schema）含：
- `max_iteration`：plan→review 驳回回环上限
- `no_progress_streak`：无进展连续轮次
- `budget_tokens_used`：已耗 token
- `budget_tokens_cap`：token 预算上限

**α 方案双闸**：
- **闸 1 budget_tokens_cap**：每节点 token 预算上限（运维部监管）。`budget_tokens_used` 接近 `budget_tokens_cap`（90%）→ 运维部告警决策部 → 决策部判定 continue（追加预算）/ redirect（换向）/ abort（终止）。
- **闸 2 max_iteration**：plan→review 驳回回环上限（决策部监管）。某节点 plan 被 review 驳回次数达 `max_iteration` → 决策部 force converge（强制取当前最优 plan 推进，explore §6.5 Ruh 反模式#3 解法）。

### 6.3 触发流程

```
节点执行中（任意部门 plan/review）
   │
   ├─► 运维部持续读 checkpoint.guardrails
   │     ├─ budget_tokens_used >= 0.9 × budget_tokens_cap → 告警决策部
   │     └─ no_progress_streak >= 阈值 → health=stagnant_warn → 告警决策部
   │
   └─► 决策部读告警
         ├─ budget 告警 → 判定 continue/redirect/abort（HG 拍板）
         └─ max_iteration 达上限 → force converge（取当前最优 plan，写 trace "force_converge"）
```

### 6.4 阈值设定（Claude 度量，禁人天）

| 护栏字段 | 建议阈值 | 依据 |
|---------|---------|------|
| budget_tokens_cap | 50k tokens/节点 | Claude 单节点上下文窗口预算（5 部门 plan+review 双能力 × 3-5 次调用，Ruh 成本乘法 explore §6.6） |
| max_iteration | 3 | persona-signal MAX_ITER=3 先例（explore §3.3）；plan→review 驳回 3 次仍不收敛 → force converge |
| no_progress_streak | 2 轮 | cc-loop 护栏三件套先例；2 轮无 progress_delta → stagnant_warn |

**注**：阈值为协议层建议值，层3 cc-venture 启动时可按节点类型（task/human_gate/loop）差异化配置。

---

## 七、设计张力裁决（3 张力各给 α 立场 + ROI 论证）

### 7.1 张力 1：共享协作协议放置

**α 立场**：hcc-org/ 新根（集中）

**ROI 论证**：
- **收益（DRY）**：协作总则/RACI 总表/交接协议/state 读写规则是 5 部门横切共享。放总则一处改全生效。若分散（γ）或塞 cc-runtime（β），任一修订需 N 处同步，漂移必然（Ruh 反模式#2）。
- **收益（charter 原意）**：charter §组织架构 D10 形态定论原话"新增 hcc-org/"（00-charter.md L69）——α 是 charter 直接落地，非发明。β（塞 cc-runtime）偏离 charter 原意（cc-runtime 是地基层不是组织层）；γ（5 目录内嵌）偏离 charter"hcc-org/ 单一根"。
- **收益（职责分层）**：总则只管跨部门协作（协议宪法），部门 SKILL.md 只管本部门业务。两层不混。运维部是层1 地基，把组织协议塞进 cc-runtime 会让地基层文件污染业务语义。
- **代价（6 目录）**：坦诚承认 6 目录偏离"5 独立"字面。但 BOSS 真实意图是"5 部门独立运行"（每部门有职责+工具+plan/review），hcc-org/ 是协议宪法的物理容器不是第 6 部门（无 plan/review 能力，不是 agent 角色）。
- **代价（加载多读一文件）**：部门激活读 2 文件（总则 + 本部门）≈ 6-8k tokens。vs γ 每部门内嵌全协议 10-12k tokens——**集中反而更省**（总则 200 行被 5 部门共享，γ 是 5×350 行重复）。
- **ROI 结论**：DRY 收益 + charter 原意 + 职责分层 > 6 目录字面代价。**集中放置 ROI 正向**。

### 7.2 张力 2：5 独立目录 vs 单 agent 动态切换（explore §6.2 LangChain 质问）

**α 立场**：坚持 5 独立部门目录（驳 LangChain 单 agent 警告）

**ROI 论证**：
- **LangChain 警告**：单 agent + middleware（动态配置）比多 agent subgraph 简单，推荐多数场景（explore §6.2）。
- **α 驳斥 1（角色本质不同）**：hcc 5 部门不是"同 agent 换 prompt"，而是 Claude 分饰 5 个**有本质不同职责+信息源+plan/review 流程**的角色（charter §部署约束"单 Claude"分饰）。决策部（HG 拍板 + 换向触发 + 知识库/web）vs 运维部（state 监管 + 横切 + 不参与节点流转）vs 销售部（web 调查 + 画像 + 收益）——三者信息源、plan/review 流程、state 读写权限**根本不同**（§4.1 矩阵）。LangChain 单 agent + middleware 适用于"同 agent 不同配置"，hcc 是"不同 agent 不同职责"——更接近 Ruh **Specialist 分工**（领域专家/委托禁用/领域工具，explore §6.2/§6.7）。
- **α 驳斥 2（边界清晰性）**：Ruh 反模式#2 头号失败模式 = 角色边界不清致 duplicate work + gaps（explore §6.4）。5 独立目录 + 每部门 SKILL.md 显式 RACI（§三各部门 §2）= 边界清晰。单 agent 动态切换 = 角色边界靠 middleware 配置隐式表达，易漂移。
- **α 驳斥 3（charter 已定调）**：charter §组织架构 D10 已选 A 工具箱模型（部门 = 协议协议层，5 部门表），BOSS #19 已选"判官 panel + 对抗验证"模式 C 围绕"共享协议放置"分化——**5 独立 vs 单 agent 不是 BOSS 待决策项**，是张力 1 的衍生。α 在 charter D10 框架内，5 独立是 charter 既定。
- **代价坦诚（多节点复杂度）**：LangChain 警告多 agent subgraph 的 context engineering 复杂度。α 承认：5 部门 × plan+review 双能力 = 每节点可能 3-5 次 agent 调用（Ruh 成本乘法 explore §6.6）。**对冲**：handoff pair 不灌 trace（§4.4，省 95% token）+ 护栏双闸（§六，budget_tokens_cap 强制收敛）+ 同一时刻单 Claude 只激活 1 部门（charter"单 Claude"，非 5 并行）。
- **ROI 结论**：角色本质不同（非同 agent 换 prompt）+ 边界清晰性（Ruh 头号反模式解法）+ charter 既定 > 多节点复杂度（已有 handoff/护栏对冲）。**5 独立目录 ROI 正向**。

### 7.3 张力 3：RACI 矩阵形态（explore §6.4）

**α 立场**：RACI 总表放 hcc-org/SKILL.md（横切），部门 SKILL.md 引用 + 补部门内 RACI 细节

**ROI 论证**：
- **α 主张（横切总表 + 纵切补充）**：venture 节点 × 5 部门的 R/A/C/I 是**横切矩阵**（同一节点多部门协作，谁是 R/A/C/I）——放 hcc-org/SKILL.md §2 总表一处。部门 SKILL.md §2 只补"本部门内部角色分工"（如决策部 plan 阶段 cc-2pp 判官小组内部分工）——纵切补充。
- **vs γ（每部门内嵌全 RACI）**：γ 每部门 SKILL.md 内嵌完整 RACI = 5 份重复矩阵，任一节点归属修订需 5 处同步（违反 DRY）。且部门视角写 RACI 易遗漏"其他部门对本节点的 R/A/C/I"（只写自己）——Ruh 反模式#2 gaps。
- **vs 独立 RACI 文档（无总表）**：若 RACI 只放 references/raci-matrix.md 不进 SKILL.md §2 → 部门激活时不连带加载（references 按需读）→ 部门可能不看 RACI 就干活 → 边界模糊。α 把精简总表放 SKILL.md §2（必读）+ 完整版 references/（深度按需），**强制部门激活时至少看精简总表**。
- **收益（边界清晰）**：RACI 总表让每节点每部门权责一目了然（§2.2 表）。决策部 review 时读总表判定"这个节点我该不该 R/A"——避免越权或漏责。
- **代价（总表维护）**：venture 节点 × 5 部门矩阵规模 = 10 行 × 5 列（§2.2），可维护。新增节点/部门时总表加一行/列，5 部门 SKILL.md 不用改（引用总则）。
- **ROI 结论**：横切总表（一处改全生效）+ 纵切补充（部门内部细节）= DRY + 边界清晰。**总表放 hcc-org/SKILL.md ROI 正向**。

---

## 八、所需 skills 清单（消费 explore §一，每个标"在哪步用"）

| skill | 类型 | 在 α 方案哪步用 | 证据 |
|-------|------|----------------|------|
| **cc-2pp** | 工具箱（已存在） | 决策部 §3 plan（判官小组起草 α/β/γ）+ §4 review（对抗验证 20-attack） | explore §一 L13；charter L61 |
| **cc-goal** | 工具箱（已存在） | 决策部 §3 plan（N3 方案输出 /goal 终态条件）+ 开发部 §4 review（实施终态自评）+ 产品部 §4 review（产品设计终态自评） | explore §一 L16；charter L61 |
| **cc-orchestration** | 工具箱（已存在） | 决策部 §3 plan（plan→review 驳回时决策 subagent/team 模式）+ §4 review（多 agent 编排对抗验证） | explore §一 L19；charter L61 |
| **cc-loop** | 工具箱（已存在） | 开发部 §3 plan（worktree SOP + 循环合同）+ 产品部 §3 plan（N6⇄N7 产品迭代循环）+ 全部门护栏三件套（max_iteration/no_progress/budget） | explore §一 L17；charter L62/L63 |
| **cc-config** | 工具箱（已存在） | 运维部 §3 plan（六层配置 + CLAUDE.md 诊断）+ §4 review（配置健康审查） | explore §一 L14；charter L64 |
| **cc-context** | 工具箱（已存在） | 运维部 §3 plan（health=stagnant 时上下文诊断 + 持久化策略）+ 全部门（上下文窗口管理） | explore §一 L15；charter L64 |
| **cc-runtime** | 层1 地基（已存在） | 运维部 §7 工具映射（state 监管 + shift-direction.js 换向 + compact-snapshot Block⑤）+ 全部门 state 读写基础（§4.1 矩阵物理基础） | explore §一 L22/§二；charter L64/L78 |
| **cc-scanner** | 工具箱（已存在） | 决策部 §6（知识库扫描）+ 销售部 §6（案例库扫描）+ 缺口技能发现（产品部/销售部 [GAP] 时调 cc-scanner 找/造 skill） | explore §一 L20 |
| **venture-judge** | 系统级 installed skill | 销售部 §3 plan（24 步法 + VC 7 维 + 评判卡）+ §4 review（评判卡 review） | explore §一 L23 备注/§四 L184；charter L65 |
| **venture-pipeline** | 层2 引擎（已存在） | 全部门 DAG 推进基础（advance-node/resolve-hg/venture-resume）+ HG 停等（pipeline-state.status）+ 部门 ↔ 节点映射（§五） | explore §三；charter L77 |
| **claude-coach** | 路由器（已存在） | hcc-org 协议层**不进 claude-coach 路由表**（无业务 trigger，避免竞争，explore §5.3）。hcc-{dept}/ 部门 SKILL.md 由层3 cc-venture 节点路由命中加载，非 claude-coach 分诊 | explore §一 L21/§5.3 |
| **[GAP] venture-product** | 待层3 新建 | 产品部 §7（N5 产品设计/N7 需求/N8 UIUX 业务技能） | charter L80 真空；explore §四 L181/§5.6 |
| **[GAP] venture-uiux** | 待层3 新建 | 产品部 §7（UIUX 设计专项） | charter L80；explore §四 L181 |
| **[GAP] venture-research** | 待层3 新建 | 销售部 §7（N1 调查/N2 竞品/N6 画像系统化技能） | charter L80；explore §四 L184 |
| **[GAP] venture-sales** | 待层3 新建 | 销售部 §7（N8 规模化/收益转化） | charter L80；explore §四 L184 |
| **executor / general-purpose** | Claude 原生 / OMC agent | 开发部 §3 plan（按 plan 写代码，route to executor agent） | charter L63；explore §四 L182 |

**缺口处理协议**（P1 最懒，charter L80）：产品部/销售部 [GAP] 业务技能，hcc 协议层先预留接口（部门 SKILL.md §7 工具映射 + §8 缺口占位），层3 cc-venture 启动时调 cc-scanner 找外部 skill 或调 skill-creator 造新 skill 补齐。**不阻塞协议层先行**。

---

## 九、工作量估算（Claude 度量，禁人天）

### 9.1 度量维度（charter §度量约束 + cc-2pp Prompt 注入约束，explore §5.8）

| 维度 | 单位 | 说明 |
|------|------|------|
| token 成本 | tokens | 单次产出消耗（起草/读/写文件） |
| 上下文轮次 | 轮 | 完成单部门 SKILL.md 需要的 Claude 对话轮次 |
| skill 配置成本 | 文件数 × 行数 | 新建/修改的 SKILL.md + references 文件规模 |
| 验证复杂度 | 校验项数 | 需验证的不变量/契约/对齐项 |
| 依赖风险 | 阻塞项数 | 依赖未就绪项（如层3 cc-venture 未启动） |

### 9.2 α 方案工作量估算

| 工作项 | token 成本 | 上下文轮次 | skill 配置成本 | 验证复杂度 | 依赖风险 |
|--------|-----------|-----------|---------------|-----------|---------|
| hcc-org/SKILL.md（协议宪法） | ~12k（起草 200 行总则+RACI 总表+交接+state 矩阵） | 3-4 轮（起草→自评→修订） | 1 文件 ~200 行 | 高（INV-1..6 对齐 + C1/C7 对齐 + charter D10 对齐，§十一核验 8 项） | 0（物理基础层1/层2 已就绪） |
| hcc-org/references/ ×3 | ~18k（handoff-protocol + raci-matrix + state-access-rules 各 ~250 行深度参考） | 6-8 轮（每文件 2-3 轮） | 3 文件 ~750 行 | 中（RACI 矩阵完整性 + state 权限矩阵准确性） | 0 |
| hcc-decision/SKILL.md + references | ~10k（决策部厚实，引用 cc-2pp/cc-goal/cc-orchestration） | 2-3 轮 | 2 文件 ~200 行 | 中（HG 流程 + shift-direction.js 调用契约） | 0 |
| hcc-product/SKILL.md + references | ~6k（产品部真空，多数 [GAP] 占位） | 1-2 轮 | 2 文件 ~120 行 | 低（协议占位，业务留层3） | 1（层3 venture-product/uiux 未启动，[GAP] 阻塞业务跑通） |
| hcc-dev/SKILL.md + references | ~8k（开发部中等，引用 executor/cc-loop） | 2 轮 | 2 文件 ~180 行 | 中（worktree SOP + 循环合同引用 cc-loop） | 1（executor 依赖外部 agent/skill） |
| hcc-ops/SKILL.md + references | ~10k（运维部厚实，引用 cc-runtime/cc-config/cc-context） | 2-3 轮 | 2 文件 ~220 行 | 高（state 监管 + INV 检测 + 护栏双闸监管流程） | 0 |
| hcc-sales/SKILL.md + references | ~6k（销售部真空，多数 [GAP] 占位 + venture-judge 系统级） | 1-2 轮 | 2 文件 ~130 行 | 低（协议占位，业务留层3） | 1（层3 venture-research/sales 未启动） |
| **合计** | **~70k tokens** | **~17-24 轮** | **14 文件 ~2120 行** | — | **3 阻塞项（均层3，不阻塞协议层）** |

### 9.3 验证复杂度明细（§十一核验 + 工程验证）

| 验证项 | 验证方法 | 复杂度 |
|--------|---------|--------|
| charter D10 A 工具箱模型对齐 | §十一逐条核验 8 项 | 中 |
| C1 写入隔离（direction.json 唯一 shift-direction.js） | grep hcc-{dept}/ 确认无直写 direction.json 代码 | 低（hcc 协议层是 SKILL.md 无脚本，天然满足 C2） |
| C7 placeholder 不动 | 确认 dag.placeholder.json 未修改 | 低（α 方案不动层2拓扑） |
| INV-1..6 在部门协作中约束力 | state-access-rules.md 逐条映射部门权限 | 中 |
| RACI 总表完整性 | 10 节点 × 5 部门矩阵无空格 | 低 |
| 护栏双闸触发流程 | ops-runtime-stewardship.md + judge-gate-flow.md 流程 walkthrough | 中 |
| handoff pair 不灌 trace | handoff-protocol.md token 节省估算验证 | 低 |
| 缺口占位显式 | grep [GAP] 确认产品部/销售部占位 | 低 |

### 9.4 与 β/γ 方案的度量对比（预估，供 30-score 评分）

| 方案 | 文件数 | 总行数 | token 成本 | 维护成本（修订总则时） |
|------|--------|--------|-----------|---------------------|
| α 集中 | 14 | ~2120 | ~70k | 低（总则 1 处改） |
| β（预估）塞 cc-runtime | ~10 | ~1800 | ~60k | 中（cc-runtime references 加协议，地基层污染） |
| γ（预估）5 目录内嵌 | ~20 | ~3500 | ~100k | 高（5 处同步改） |

**α 估算依据**：集中放置总则被 5 部门共享（DRY），文件数少于 γ（不重复），略多于 β（β 塞 cc-runtime 不新建 hcc-org/）。token 成本 α 居中（β 最省但污染地基，γ 最贵因重复）。**长期维护成本 α 最低**（修订总则 1 处）。

---

## 十、优势 / 致命弱点 / 适用场景

### 10.1 优势

1. **DRY（核心优势）**：协作总则/RACI 总表/交接协议/state 读写规则一处定义，5 部门引用。修订时 1 处改全生效，零漂移（vs γ 5 处同步）。
2. **charter 原意直接落地**：charter §组织架构 D10 形态定论原话"新增 hcc-org/"（00-charter.md L69）——α 是 charter 直接落地，非发明。β/γ 都偏离 charter"hcc-org/ 单一新根"原意。
3. **职责分层清晰**：协议宪法层（hcc-org/）+ 部门业务层（hcc-{dept}/）物理分离。地基层（cc-runtime）不被组织协议污染（vs β）。
4. **加载成本可控**：单部门激活读 2 文件（总则 + 本部门）≈ 6-8k tokens，低于 γ 内嵌全协议（10-12k/部门）。总则 200 行被 5 部门共享，边际成本低。
5. **RACI 横切总表强制可读**：精简总表放 SKILL.md §2（部门激活连带加载），避免部门不看 RACI 就干活（vs 独立 references 文档按需读易漏）。
6. **缺口显式占位**：产品部/销售部 [GAP] 标记清晰，层3 启动时一目了然补什么（P1 最懒，不阻塞协议层）。

### 10.2 致命弱点（坦诚自曝，供 20-attack 攻击）

1. **6 目录偏离"5 独立"字面**：BOSS #19 启动指令字面是"5 独立部门技能目录"。α 产出 6 目录（hcc-org/ + 5 部门）——虽论证 hcc-org/ 是协议宪法非第 6 部门，但字面偏离可能被攻击为"未遵循 BOSS 指令"。**对冲**：charter §组织架构 D10 原话"新增 hcc-org/"证明 BOSS 真实意图含 hcc-org/，α 在 charter 框架内。
2. **部门 SKILL.md 依赖总则（加载耦合）**：部门激活时必须先读总则再读本部门——若总则缺失/损坏，5 部门全瘫。**对冲**：总则是静态文档（非脚本），损坏概率低；cc-runtime compact-snapshot Block⑤ 会抢救 state，总则文件不在 state 内但可纳入层3 备份。
3. **总则成为单点**：所有部门引用同一总则——总则有 bug（如 RACI 总表某格错），5 部门全错。**对冲**：总则修订经决策部 review（cc-2pp 对抗验证），且 references/ 深度参考分离（总则精简易审）。
4. **RACI 总表维护负担**：10 节点 × 5 部门矩阵，新增节点/部门需总表加行列。**对冲**：矩阵规模可控（50 格），新增频率低（venture 节点稳定）。
5. **与 cc-runtime 边界模糊风险**：运维部（hcc-ops/）引用 cc-runtime 脚本，hcc-org/ 总则 §4 state 读写规则与 cc-runtime/references/state-schema.md 内容部分重叠——可能重复或漂移。**对冲**：hcc-org §4 只定义"部门权限矩阵"（谁读谁写），cc-runtime state-schema 定义"字段 schema"（字段是什么）——维度不同，引用不复制。

### 10.3 适用场景

- **高 ROI 场景**：venture 流水线长期运行（7×24，charter §部署约束），协作协议修订频率高（部门边界/交接规则迭代）→ α DRY 收益最大化。
- **多部门协作密集**：N5/N6/N7 多部门协作节点（产品+开发+销售）→ RACI 总表 + state 读写矩阵价值高。
- **不适用场景**：若 venture 流水线只用单部门（如纯开发部执行）→ hcc-org/ 总则开销显得冗余（但 charter 5 部门模型已定，单部门场景非主线）。

---

## 十一、与 charter D10 一致性核验（逐条对照）

charter §组织架构 D10=A 工具箱模型（00-charter.md L55-82）逐条核验：

### 11.1 A 工具箱模型形态定论（L69）

> 部门 = 协作协议层（新增 hcc-org/，定义职责 + plan/review 流程 + 交接协议 + 信息源），技能 = 跨部门工具箱（现有 cc-*/venture-* 原位保留，按需调用）。重构≈0，不破坏 50-decision 技能树。

| 核验项 | charter 要求 | α 方案落地 | 一致? |
|--------|-------------|-----------|-------|
| 部门 = 协作协议层 | 新增 hcc-org/ 定义职责+plan/review+交接+信息源 | α hcc-org/SKILL.md §1-5 协作总则 + 5 部门 SKILL.md §1-8 部门职责/plan/review/交接/信息源 | ✓ |
| 技能 = 跨部门工具箱 | cc-*/venture-* 原位保留 | α §一目录树 11 技能原位不动，部门 §7 工具映射引用 | ✓ |
| 重构 ≈ 0 | 不破坏 50-decision 技能树 | α 不动任何现有技能目录，只新增 hcc-* 6 目录 | ✓ |

### 11.2 5 部门表（L59-65）

| 部门 | charter 职责 | charter 节点 | charter 信息源 | charter 工具 | α 落地 | 一致? |
|------|------------|------------|--------------|------------|--------|-------|
| 决策部 | 方向设定/可行性/judge | N3/N4/HG | 知识库+web | cc-2pp/cc-goal/cc-orchestration | hcc-decision §1/§7 全覆盖 | ✓ |
| 产品部 | 产品设计/UIUX/需求 | N5/N7/N8 | 本地产物+用户反馈 | cc-loop+产品设计(新建) | hcc-product §1/§7 + [GAP] 占位 | ✓（缺口显式） |
| 开发部 | 按 plan 实施/交付 | 实施 | 本地代码 | executor/cc-loop | hcc-dev §1/§7 全覆盖 | ✓ |
| 运维部 | 7×24 保活/state/trace/Hook | 层1 贯穿 | 本地 state/config | cc-runtime/cc-config/cc-context | hcc-ops §1/§7 全覆盖 | ✓ |
| 销售部 | 画像/收益转化/市场验证 | N1/N2/N6 | web+知识库 | venture-judge+销售(新建) | hcc-sales §1/§7 + [GAP] 占位 | ✓（缺口显式） |

### 11.3 部门协作协议（L67）

> 部门间不直接对话，通过层1 产物契约（state）+ 方向指针（direction）+ 执行记忆（trace）交换上下文。每个部门的 plan/review 遵循 cc-2pp（判官 + 对抗）。

| 核验项 | charter 要求 | α 方案落地 | 一致? |
|--------|-------------|-----------|-------|
| 不直接对话，经 state/direction/trace 交换 | 协作协议物理基础 | α hcc-org §1 协作总则第1条 + §4 state 读写矩阵 + §4.4 handoff pair 不灌 trace | ✓ |
| plan/review 遵循 cc-2pp | 判官+对抗 | α 决策部 §3/§4 plan/review 调 cc-2pp；全部门 review 经决策部对抗验证 | ✓ |

### 11.4 hcc 三层总图（L74-78）

| 层 | charter | α 落地 | 一致? |
|----|---------|--------|-------|
| 组织层 | hcc-org/（5 部门协作协议） | α hcc-org/ + 5 hcc-{dept}/ | ✓ |
| 工具层 | cc-* + venture-* | α 11 技能原位 | ✓ |
| 地基层 | cc-runtime | α cc-runtime 原位，hcc-ops/ 引用 | ✓ |

### 11.5 覆盖度缺口（L80）

> 决策部/运维部 ✓ 厚实；开发部 ⚠️ 中等；产品部/销售部 ❌ 真空 → 待层3 启动补齐，不阻塞层1 先行。

| 核验项 | charter | α 落地 | 一致? |
|--------|---------|--------|-------|
| 决策部/运维部厚实 | ✓ | α hcc-decision/hcc-ops 工具映射完整 | ✓ |
| 开发部中等 | ⚠️ | α hcc-dev 引用 executor(外部)+cc-loop，缺口坦诚 | ✓ |
| 产品部/销售部真空 | ❌ 待层3 | α hcc-product/hcc-sales [GAP] 显式占位，不阻塞协议层 | ✓ |

### 11.6 BOSS #3 约束（explore §七 L332）

| 核验项 | BOSS 要求 | α 落地 | 一致? |
|--------|----------|--------|-------|
| 协议层完整骨架 | 5 部门 SKILL.md 各含职责+RACI+plan/review+交接+信息源+工具映射+缺口占位 | α §三 5 部门全 8 段结构 | ✓ |
| 不新建业务技能 | 产品部/销售部真空留层3 | α [GAP] 占位不新建 | ✓ |
| 映射不装配 | dag.placeholder.json 保持 placeholder | α §五 不动层2拓扑 | ✓ |
| 完整双能力 + 预算护栏 | plan+review 双能力 + budget_tokens_cap + max_iteration | α §三各部门 §3/§4 双能力 + §六双闸 | ✓ |

### 11.7 硬约束 C1/C2/C5/C6/C7（charter §工程约束 + explore §五）

| 约束 | 要求 | α 落地 | 一致? |
|------|------|--------|-------|
| C1 写入隔离 | direction.json 仅 shift-direction.js；pipeline-state.json 由 pipeline-state.js+advance-node.js+resolve-hg.js | α §4.1 矩阵全部门触发换向调 shift-direction.js；hcc 协议层是 SKILL.md 无脚本（天然满足） | ✓ |
| C2 纯 Node fs+path+crypto | hcc 协议层是 SKILL.md+文档 | α 无脚本（天然满足） | ✓ |
| C5/C6 不动层2拓扑/graph_hash | dag.json/dag.placeholder.json 不动 | α §五不动 | ✓ |
| C7 placeholder 语义 | 占位跑通 ≠ 业务跑通 | α §五映射规则留层3装配 | ✓ |
| 7×24 单机 = B | 会话级断点续传 | α 依赖层1 checkpoint/direction/trace（已就绪），部门协议层无新增状态文件 | ✓ |
| 度量禁人天 | token/轮次/skill配置/验证 | α §九全 Claude 度量 | ✓ |

### 11.8 核验结论

**α 方案与 charter D10 + BOSS #3 + 工程硬约束 100% 一致**。8 项核验全 ✓，无违背项。α 是 charter §组织架构 D10 形态定论（"新增 hcc-org/"）的直接落地实现。

---

> **α 保守派方案完。** 核心主张：共享协作协议集中放置于 hcc-org/ 新根（协议宪法），5 部门子技能目录引用总则（DRY）。与 charter D10 A 工具箱模型 + BOSS #3 约束 + 工程硬约束 C1/C2/C5/C6/C7 全一致。待 30-score 评分 + 20-attack 对抗验证。
