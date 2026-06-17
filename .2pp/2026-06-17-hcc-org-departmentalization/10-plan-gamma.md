---
run: 2026-06-17-hcc-org-departmentalization
artifact: plan
faction: gamma（创新派）
title: γ 方案——5 部门目录各自内嵌完整协作协议（分散自包含放置）
status: draft
created: 2026-06-17
---

# γ 方案：5 独立部门目录各自内嵌完整协议（分散自包含放置）

> 派系：γ 创新派。立场：**每个部门目录（hcc-decision / hcc-product / hcc-dev / hcc-ops / hcc-sales）各自内嵌完整协作协议**（职责 + RACI + plan/review + 交接 + 信息源 + 工具映射全自包含），用 `references/` **交叉引用**共享片段避免硬复制，每部门**独立加载运行**——一个部门 agent 只读自己 SKILL.md 就能干活，零外部总则依赖。

---

## 方案核心主张

**一句话**：协作协议**分散自包含放置**——5 个独立部门 SKILL.md 各自内嵌完整协议要素，references 交叉引用消除硬重复，最大化部门加载独立性。

**200 字展开**：charter A 工具箱模型（explore §5.1）把"部门"定义为协作协议层而非业务技能层。γ 主张这份协议层的物理形态应该是**5 个自包含单元**，而非 1 个总则根 + 5 份引用。理由有四：(1) Skill 按需加载哲学的本质是"一个 agent 加载它要干的那一份就够"——部门 A agent 不该被迫先读组织总则、跨部门 RACI 总表才能开工；(2) Ruh 反模式#2（explore §6.4）头号失败模式是边界不清，自包含内嵌让本部门 R/A/C/I 在自己 SKILL.md 里零跳转可见，边界最强；(3) LangChain state-driven handoffs（explore §6.1）的物理基础是 state variable，不是中央协议文档——协议规则可以也应该跟着它服务的那个角色就近放置；(4) 7×24 单机（charter 部署约束）下，"5 份各自可加载"比"1 份总则 + 5 份索引"在断点续传时上下文恢复成本更低（只需恢复当前部门的 SKILL.md）。代价诚实承认：协议逻辑分散 5 处是 DRY 最差的，改协议要同步 5 个目录，漂移风险真实存在——但用 references 交叉引用 + 一条"协议版本号"校验规则可以把漂移约束在可控范围内，ROI 在"加载独立性 + 边界清晰性"维度上压过 DRY 损失。这是 γ 与 α（DRY 总则根）/ β（cc-runtime owns 协议）的根本分歧点。

---

## 一、整体架构

### 1.1 γ 目录结构设计原则

1. **5 部门目录平级**：`.claude/skills/hcc-{decision,product,dev,ops,sales}/` 五个独立目录，无 hcc-org/ 总则根。
2. **每部门内嵌完整协议**：SKILL.md 含职责 / RACI（本部门视角）/ plan 流程 / review 流程 / 交接协议 / 信息源 / 工具箱映射 / 缺口占位 8 要素全自包含。
3. **references/ 交叉引用共享片段**：跨部门共享的协议要素（DAG 节点映射规则、交接文件命名约定、护栏双闸语义、direction_version 绑定规则）抽到**每部门各自的 references/**，但通过**规范化的文件名 + 内容锚点**让 5 份引用指向**同一份语义内容**（不是 5 份硬复制的不同副本）。
4. **协议版本号防漂移**：每份 references 共享片段顶部带 `protocol_version: v1`，5 个目录的同名文件必须同版本号——init-state.js 扩展一条校验（轻量，符合 C2 纯 Node）。
5. **无业务 trigger**：hcc-* 部门 SKILL.md 不带业务关键词 trigger（explore §5.3 解法），避免与 cc-* 工具箱竞争激活——它们是协议层，被层3 venture-pipeline 按节点归属**直接调用**（脚本式调用，非自然语言路由）。

### 1.2 ASCII 目录树（γ 分散自包含放置）

```
.claude/skills/
│
├── hcc-decision/                          # 决策部（N3/N4/HG；cc-2pp/cc-goal/cc-orchestration）
│   ├── SKILL.md                           # 【内嵌完整协议】
│   │   ├── §职责                          #   方向设定/可行性/judge/HG 拍板
│   │   ├── §RACI（决策部视角）            #   本部门 R/A/C/I 全自包含
│   │   ├── §plan 流程                     #   cc-2pp 判官小组 + cc-goal 终态 + 对抗验证
│   │   ├── §review 流程                   #   对开发部 plan / 产品部设计 / 销售部画像做 judge
│   │   ├── §交接协议                      #   产出 plan.md → 落盘 → 触发 shift-direction.js 换向
│   │   ├── §信息源                        #   知识库 + web（行业/竞品）
│   │   ├── §工具箱映射                    #   cc-2pp / cc-goal / cc-orchestration + shift-direction.js
│   │   └── §缺口占位                      #   无缺口（3 技能厚实）
│   └── references/
│       ├── dag-node-mapping.md            #   ← 共享片段（protocol_version: v1）
│       ├── handoff-naming.md              #   ← 共享片段（protocol_version: v1）
│       ├── guardrails-dual-gate.md        #   ← 共享片段（protocol_version: v1）
│       └── direction-version-binding.md   #   ← 共享片段（protocol_version: v1）
│
├── hcc-product/                           # 产品部（N5/N7/N8；cc-loop + 缺口占位）
│   ├── SKILL.md                           # 【内嵌完整协议】
│   │   ├── §职责                          #   产品设计/UIUX/需求挖掘
│   │   ├── §RACI（产品部视角）            #   本部门 R/A/C/I 全自包含
│   │   ├── §plan 流程                     #   cc-loop 循环工程 + 缺口占位（venture-product）
│   │   ├── §review 流程                   #   对开发部实施 / 销售部画像做产品视角审查
│   │   ├── §交接协议                      #   产出 design-spec.md / uiux-spec.md → 落盘
│   │   ├── §信息源                        #   本地产物 + 用户反馈
│   │   ├── §工具箱映射                    #   cc-loop + 【缺口】venture-product / venture-uiux
│   │   └── §缺口占位                      #   N5/N7/N8 业务技能真空，层3 补齐
│   └── references/
│       ├── dag-node-mapping.md            #   ← 共享片段（与决策部同版本号）
│       ├── handoff-naming.md
│       ├── guardrails-dual-gate.md
│       └── direction-version-binding.md
│
├── hcc-dev/                               # 开发部（实施；executor/cc-loop）
│   ├── SKILL.md                           # 【内嵌完整协议】
│   │   ├── §职责                          #   按 plan 实施/交付
│   │   ├── §RACI（开发部视角）
│   │   ├── §plan 流程                     #   读决策部 plan.md → 拆 TaskCreate → cc-loop worktree SOP
│   │   ├── §review 流程                   #   自审（code-reviewer/verifier 分离 pass）+ 对接决策部 review
│   │   ├── §交接协议                      #   产出代码 + tasks.tree.json 更新
│   │   ├── §信息源                        #   本地代码 + 决策部 plan
│   │   ├── §工具箱映射                    #   executor / cc-loop / 外部 superpowers:* 系列
│   │   └── §缺口占位                      #   代码质量/测试/重构专项技能（外部 skill 生态）
│   └── references/
│       ├── dag-node-mapping.md
│       ├── handoff-naming.md
│       ├── guardrails-dual-gate.md
│       └── direction-version-binding.md
│
├── hcc-ops/                               # 运维部（层1贯穿；cc-runtime/cc-config/cc-context）
│   ├── SKILL.md                           # 【内嵌完整协议】
│   │   ├── §职责                          #   7×24 保活/state/trace/Hook
│   │   ├── §RACI（运维部视角）
│   │   ├── §plan 流程                     #   init-state.js / 健康检查 / compact-snapshot 兜底
│   │   ├── §review 流程                   #   state 不变量校验（INV-1..6）/ context 健康审查
│   │   ├── §交接协议                      #   state 字段读写矩阵（运维部是地基，被所有部门读写）
│   │   ├── §信息源                        #   本地 state/config
│   │   ├── §工具箱映射                    #   cc-runtime / cc-config / cc-context（3 技能厚实）
│   │   └── §缺口占位                      #   无缺口
│   └── references/
│       ├── dag-node-mapping.md
│       ├── handoff-naming.md
│       ├── guardrails-dual-gate.md
│       └── direction-version-binding.md
│
└── hcc-sales/                             # 销售部（N1/N2/N6；venture-judge + 缺口占位）
    ├── SKILL.md                           # 【内嵌完整协议】
    │   ├── §职责                          #   画像/收益转化/市场验证/调查/竞品
    │   ├── §RACI（销售部视角）
    │   ├── §plan 流程                     #   venture-judge 创业评估 + web 调研 + 缺口占位
    │   ├── §review 流程                   #   对产品部设计 / 决策部 plan 做市场可行性审查
    │   ├── §交接协议                      #   产出 persona.jsonld / market-validation.md → 落盘
    │   ├── §信息源                        #   web + 知识库（案例）
    │   ├── §工具箱映射                    #   venture-judge（系统级）+ 【缺口】venture-research
    │   └── §缺口占位                      #   N1/N2/N6 调查/竞品/画像业务技能，层3 补齐
    └── references/
        ├── dag-node-mapping.md
        ├── handoff-naming.md
        ├── guardrails-dual-gate.md
        └── direction-version-binding.md
```

**目录树关键特征**：
- **无 hcc-org/ 总则根**（与 α 根本分歧）——协议总则不存在于单一根目录，而是**分布在 5 份 references 共享片段**里。
- **每部门 4 份 references 共享片段**，文件名 + protocol_version 完全一致——这不是 5 份独立副本，而是"同一份语义内容的 5 个交叉引用锚点"。γ 用"规范化文件名 + 版本号校验"实现 DRY 的语义等价，而非物理单一。
- **部门 SKILL.md 是各自世界的入口**——agent 加载 hcc-dev/SKILL.md 就拿到开发部干活所需的全部协议要素，不需要先跳到 hcc-org/ 读总则。

### 1.3 与 charter D10 A 工具箱模型的对齐

charter §组织架构 D10 定稿（explore §5.1 引用）：
> 部门 = **协作协议层**（新增 `hcc-org/`，定义职责 + plan/review 流程 + 交接协议 + 信息源），技能 = **跨部门工具箱**（现有 cc-*/venture-* 原位保留）。

**γ 的解读**：D10 提议的"新增 hcc-org/"是**逻辑层**表述（"部门是协议层"），而非**物理目录的硬性指定**。γ 把"协议层"物理化为 5 个自包含部门目录，协议要素分散内嵌——这仍然满足 D10 的"部门 = 协议层、技能 = 工具箱原位保留"本质。charter 文本里"hcc-org/"是示意命名，D10 的裁决点是**形态**（A 工具箱 vs B 重构技能树），不是**目录是否单一根**。γ 在 A 形态内，物理放置选分散——这是 explore §七 张力①"共享协作协议物理放置"的合法分化点，不违背 D10。（此点将在 §十一 一致性核验逐条验证。）

---

## 二、共享协作协议设计

### 2.1 γ 的去重核心策略：references 交叉引用 + 协议版本号校验

跨部门共享的协议要素有 4 类（explore §五 8 条发现 + §6.3/6.5/6.6 提炼）：

| 共享片段 | 文件名 | 内容 | 为何共享 |
|---------|--------|------|---------|
| DAG 节点→部门映射规则 | `dag-node-mapping.md` | 8 节点（N1-N8 + HG1/HG2）→ 5 部门的归属表 + 映射不装配原则（C7） | 5 部门都要知道自己负责哪些节点 |
| 交接文件命名约定 | `handoff-naming.md` | `.venture/artifacts/v{n}/{dept}-{node}-{iter}-{artifact}.md` 规范 + handoff pair 不灌 trace（explore §6.3） | 所有部门交接产物用同一命名空间 |
| 护栏双闸语义 | `guardrails-dual-gate.md` | `budget_tokens_cap` + `max_iteration` 双闸定义 + 映射 checkpoint.guardrails（explore §6.5/6.6） | 所有部门 plan/review 回环共用同一护栏 |
| direction_version 绑定规则 | `direction-version-binding.md` | INV-1（checkpoint/direction/tasks.tree 三版本一致）+ 部门协议触发换向必经 shift-direction.js（explore §5.7） | 所有部门读写 state 都受版本绑定约束 |

**γ 的物理放置**：上述 4 份文件**在每个部门的 references/ 下都存在一份**，文件名完全一致，顶部都带：

```yaml
---
protocol_version: v1
shared_across: [hcc-decision, hcc-product, hcc-dev, hcc-ops, hcc-sales]
canonical_source: hcc-ops/references/<filename>.md  # 运维部是 state 地基，作为规范源
last_synced: 2026-06-17
---
```

**去重机制（不是硬复制）**：
1. **canonical_source 指定规范源**：运维部（owns state 地基）的 references 是规范源，其他 4 部门的同名文件是**交叉引用副本**。
2. **protocol_version 校验**：init-state.js 扩展一条校验（C2 纯 Node fs，约 15 行）：扫描 5 个 hcc-* 目录的 4 份共享片段，版本号必须一致，不一致则报错（防漂移）。
3. **修改协议的单点入口**：改协议时**先改 canonical_source**（运维部那份），然后跑一个同步脚本（`sync-protocol.js`，纯 Node fs copy）把规范源同步到其他 4 部门。这是 γ 唯一比 α/β 多出的一点点工具成本，换取的是加载独立性。

**为什么不是单一物理文件 + 软链接**：Windows 单机（部署约束）软链接体验差，且 Skill 加载机制对软链接的兼容性不确定。物理 copy + 版本号校验是**最稳健的跨平台方案**，符合 charter 单机约束。

### 2.2 每部门内嵌的协议要素（非共享部分）

除了 4 份共享片段，每部门 SKILL.md 内嵌**本部门独有的协议要素**（不共享，各自不同）：

| 协议要素 | 是否共享 | γ 放置 |
|---------|---------|--------|
| 部门职责 | ❌ 独有 | SKILL.md §职责（内嵌） |
| RACI（本部门视角的 R/A/C/I） | ❌ 独有 | SKILL.md §RACI（内嵌，本部门是 R/A 的项全列） |
| plan 流程 | ❌ 独有 | SKILL.md §plan 流程（内嵌，调用本部门工具箱） |
| review 流程 | ❌ 独有 | SKILL.md §review 流程（内嵌，本部门审查哪些下游产物） |
| 交接协议（本部门产出什么、读什么） | ❌ 独有 | SKILL.md §交接协议（内嵌，引用共享的 handoff-naming.md） |
| 信息源 | ❌ 独有 | SKILL.md §信息源（内嵌） |
| 工具箱映射 | ❌ 独有 | SKILL.md §工具箱映射（内嵌） |
| 缺口技能占位 | ❌ 独有 | SKILL.md §缺口占位（内嵌） |

**关键设计**：**跨部门 RACI 不做总表**（与 α 分歧）。γ 的 RACI 是"本部门视角"——每个部门 SKILL.md 只列**自己是 R 或 A 的那些节点/产物/状态字段**，以及相关的 C/I。要看"决策部对 N4 是 A"就去 hcc-decision/SKILL.md §RACI；要看"开发部对 N4 实施是 R"就去 hcc-dev/SKILL.md §RACI。**跨部门拼装完整 RACI 矩阵 = 读 5 份部门 RACI 拼起来**，而非维护一张横切总表。代价：想看全局 RACI 要读 5 份；收益：每个部门 agent 只读自己那份就清楚自己的责任边界（Ruh 反模式#2 解法的极致落地）。

### 2.3 去重策略 ROI 论证

- **DRY 损失**：4 份共享片段 × 5 部门 = 20 份物理文件，但语义只有 4 份。改协议要改 canonical_source + 跑 sync-protocol.js（一次性）。
- **DRY 收益（γ 独有）**：每个部门 agent 加载时，references/ 在本地目录内，**无需跨目录寻址**。断点续传时（7×24 单机），恢复 hcc-dev 上下文只需读 hcc-dev/SKILL.md + hcc-dev/references/*，不依赖 hcc-org/ 是否还在/是否被 compact 冲刷。
- **漂移风险控制**：protocol_version 校验 + canonical_source 单点修改 + sync 脚本 = 三重防护。漂移最多发生在一个 sync 周期内，且 init-state.js 启动即报错，不会静默积累。

---

## 三、5 部门 SKILL.md 设计

每个部门 SKILL.md 内嵌 8 要素。以下是**设计骨架**（实际交付时每部门一份完整 SKILL.md，此处给结构 + 关键内容）。

### 3.1 决策部（hcc-decision）

- **venture 节点**：N3 计划 / N4 judge / HG1 / HG2（explore §五 §5.5 映射）
- **工具箱**：cc-2pp / cc-goal / cc-orchestration + shift-direction.js（层1 脚本，非业务技能）

**§职责**：方向设定、可行性判断、judge、HG 拍板（是否换向/是否过 gate）。决策部是 Ruh 三层模型里的 Manager（explore §6.7），但"有工具"——工具是 shift-direction.js（触发换向），符合"Manager 无业务技能但有协调工具"原则。

**§RACI（决策部视角）**：
| 对象 | 决策部角色 | 说明 |
|------|-----------|------|
| N3 方案 plan | **R**（Responsible） | 决策部用 cc-2pp 起草方案 |
| N4 judge | **A**（Accountable） | 决策部拍板方案是否过 HG1 |
| HG1/HG2 拍板 | **A** | 决策部判定 gate 通过/驳回/换向 |
| direction 换向 | **R** | 决策部判定换向 → 调 shift-direction.js（**必经此脚本**，C1 约束，explore §5.7） |
| 开发部 plan review | **R** | 决策部 review 开发部的实施计划 |
| 产品部设计 review | **C**（Consulted） | 决策部对产品设计给可行性意见 |
| 销售部画像 review | **C** | 决策部对市场画像给方向意见 |

**§plan 流程**：
1. 读销售部 persona.jsonld + 市场验证（handoff）+ 产品部 design-spec（handoff）
2. 调 cc-2pp 判官小组（多视角起草 + 对抗验证）→ 产出 plan.md
3. 调 cc-goal 把方案终态条件化（L4 自验证 /goal）
4. 调 cc-orchestration 决定后续节点编排（subagent/workflow/team）
5. 落盘 `.venture/artifacts/v{n}/decision-plan-{node}-{iter}.md`

**§review 流程**：
1. 读下游部门（开发/产品/销售）的 plan 或产出
2. 对抗验证（cc-2pp attack 模式）：找 ROI 漏洞 / Claude 度量超预算 / 可编排性缺陷
3. 驳回 → 写 review-reject.md（含驳回理由 + 修改方向）→ 触发下游重 plan（受 max_iteration 护栏）
4. 通过 → 写 review-approve.md → 推进 advance-node.js

**§交接协议**：
- **产出**：plan.md / review-{approve,reject}.md / gate-decision.md
- **触发换向**：判定需换向时 → `node scripts/shift-direction.js --reason "<理由>" --to <新版本>`（**必经此脚本**，不直写 direction.json）
- **命名**：遵循共享 handoff-naming.md

**§信息源**：知识库（claude-coach 路由的 cc-* 方法论）+ web（行业/竞品，via 销售部 handoff）

**§工具箱映射**：cc-2pp（判官 + 对抗）/ cc-goal（终态条件）/ cc-orchestration（编排决策）/ shift-direction.js（换向，层1）

**§缺口占位**：无缺口（explore §四 核实，决策部 3 技能厚实）。

### 3.2 产品部（hcc-product）

- **venture 节点**：N5 设计 / N7 需求 / N8 UIUX
- **工具箱**：cc-loop + 【缺口】venture-product / venture-uiux

**§职责**：产品设计、UIUX 设计、需求挖掘。产品部是 Specialist（explore §6.7），领域工具箱待层3 补齐。

**§RACI（产品部视角）**：
| 对象 | 产品部角色 | 说明 |
|------|-----------|------|
| N5 产品设计 | **R** | 产品部产出 design-spec.md |
| N7 需求挖掘 | **R** | 产品部从用户反馈提炼需求 |
| N8 UIUX 设计 | **R** | 产品部产出 uiux-spec.md |
| N6 画像（与销售部） | **C** | 产品部给销售部画像提供产品视角输入 |
| 决策部 plan review | **I**（Informed） | 产品部被知会决策方向 |

**§plan 流程**：
1. 读决策部 plan.md（知会方向）+ 销售部 persona.jsonld（用户画像）
2. 调 cc-loop 设计"产品设计循环"（worktree SOP + 循环合同 + 护栏）
3. 【缺口】venture-product 技能：从画像 → 产品功能矩阵 → design-spec
4. 【缺口】venture-uiux 技能：从 design-spec → UIUX 原型规范
5. 落盘 `.venture/artifacts/v{n}/product-{design|uiux}-{node}-{iter}.md`

**§review 流程**：
1. 读开发部实施产出（代码/UI 实现）
2. 产品视角审查：是否符合 design-spec / uiux-spec
3. 驳回 → review-reject.md → 开发部重做

**§交接协议**：产出 design-spec.md / uiux-spec.md / requirement.md；读决策部 plan + 销售部 persona。

**§信息源**：本地产物（开发部代码）+ 用户反馈（销售部 handoff 的市场验证）。

**§工具箱映射**：cc-loop（循环工程方法论）/ 【缺口】venture-product / venture-uiux（层3 补，explore §5.6 不阻塞协议层）。

**§缺口占位**：N5/N7/N8 业务技能真空（explore §四），协议层预留接口（产出文件名 + 字段契约），业务技能层3 cc-venture 启动时补。

### 3.3 开发部（hcc-dev）

- **venture 节点**：实施（执行计划，贯穿 N4 原型之后的所有实施节点）
- **工具箱**：executor / cc-loop / 外部 superpowers:* 系列

**§职责**：按 plan 实施、交付代码。开发部是 Worker + Specialist 混合（explore §6.7），原子执行 + 领域工具。

**§RACI（开发部视角）**：
| 对象 | 开发部角色 | 说明 |
|------|-----------|------|
| N4 原型实施 | **R** | 开发部按决策部 plan 造原型 |
| 所有实施节点 | **R** | 开发部执行代码实现 |
| tasks.tree 更新 | **R** | 开发部更新任务树（INV-5） |
| 决策部 plan review | **I** | 开发部被知会 plan（不 review 决策） |
| 自审（code review） | **R** | 开发部对自己的产出做 reviewer/verifier 分离 pass |

**§plan 流程**：
1. 读决策部 plan.md + 产品部 design-spec.md / uiux-spec.md
2. 拆 TaskCreate（任务树，对齐 tasks.tree.json INV-5）
3. 调 cc-loop worktree SOP（隔离工作区）+ 循环合同（max_iteration + budget）
4. executor agent 逐任务实施（model=opus 用于复杂任务，charter model_routing）
5. 更新 tasks.tree.json + trace.ndjson（H2 PostToolUse 兜底）

**§review 流程**：
1. **自审分离 pass**（charter execution_protocols：authoring 与 review 分离）——开发部用 code-reviewer/verifier agent 审自己的产出，不在同一上下文自批准
2. 对接决策部 review：决策部 review 开发部 plan/产出，开发部响应驳回

**§交接协议**：产出代码 + tasks.tree.json 更新 + 实施报告 impl-report.md；读决策部 plan + 产品部 spec。

**§信息源**：本地代码 + 决策部 plan + 产品部 spec。

**§工具箱映射**：executor（OMC agent）/ cc-loop（worktree + 循环合同）/ 外部 superpowers:* 系列（TDD/systematic-debugging 等，非本项目技能）。

**§缺口占位**：代码质量/测试/重构专项技能依赖外部 skill 生态（explore §四），协议层不阻塞。

### 3.4 运维部（hcc-ops）

- **venture 节点**：层1 贯穿（所有节点的 state/trace/Hook 地基）
- **工具箱**：cc-runtime / cc-config / cc-context（3 技能厚实）

**§职责**：7×24 保活、state/trace/Hook 维护、context 健康。运维部是横切 Manager+Worker（explore §6.7），是其他部门的运行时地基。

**§RACI（运维部视角）**：
| 对象 | 运维部角色 | 说明 |
|------|-----------|------|
| .venture/state/ 四文件 | **R** | 运维部 owns state 地基（init/读写/校验） |
| INV-1..6 不变量校验 | **R** | 运维部确保跨文件不变量 |
| checkpoint.guardrails | **R** | 运维部维护护栏双闸字段 |
| compact-snapshot 兜底 | **R** | 运维部跑 compact-snapshot-write.js Block⑤ |
| shift-direction.js 调用 | **C** | 运维部提供脚本，决策部调用（运维部不主动换向） |
| 所有部门 state 读写 | **A** | 运维部 accountable state 字段读写矩阵的正确性 |

**§plan 流程**：
1. init-state.js 初始化四文件（幂等 + --force）
2. 健康检查：读 checkpoint.health（ok/stagnant_warn/blocked 状态机）
3. cc-config 诊断 CLAUDE.md / settings.json 六层配置
4. cc-context 审查上下文健康（防溢出/防遗忘/防冲刷）

**§review 流程**：
1. INV-1..6 不变量校验（direction_version 三处一致 / trace_ref 存在 / todo_summary 计数对齐）
2. context 健康审查（cc-memory 五层记忆系统）
3. 异常 → 报警（health=blocked）+ 提示，非 exit 阻塞（G1 闭合，explore §2.1）

**§交接协议**：运维部是地基，**被所有部门读写 state**。运维部定义"state 字段读写矩阵"（见 §四）作为共享协议（canonical_source 在运维部 references/）。

**§信息源**：本地 state（.venture/state/）+ config（settings.json / CLAUDE.md）。

**§工具箱映射**：cc-runtime（state 地基）/ cc-config（六层配置）/ cc-context（上下文健康）。

**§缺口占位**：无缺口（explore §四，运维部 3 技能厚实，18/18 测试闭合）。

**特殊地位**：运维部是 γ 方案里 4 份共享片段的 **canonical_source**（§2.1），因为它 owns state 地基，最"懂"协议。

### 3.5 销售部（hcc-sales）

- **venture 节点**：N1 调查 / N2 竞品 / N6 画像 / N8 规模化（收益转化）
- **工具箱**：venture-judge（系统级 installed skill）+ 【缺口】venture-research

**§职责**：用户画像、收益转化、市场验证、行业调查、竞品分析。销售部是 Specialist（explore §6.7），领域工具部分靠 venture-judge，部分待补。

**§RACI（销售部视角）**：
| 对象 | 销售部角色 | 说明 |
|------|-----------|------|
| N1 行业调查 | **R** | 销售部 web 调研行业 |
| N2 竞品分析 | **R** | 销售部产出 competitor-analysis.md |
| N6 用户画像 | **R** | 销售部产出 persona.jsonld（结构化，非自由文本） |
| N8 收益转化 | **R** | 销售部产出 monetization-plan.md |
| 决策部 plan review | **C** | 销售部对决策方向给市场可行性意见 |
| 产品部设计 review | **C** | 销售部对产品设计给市场匹配意见 |

**§plan 流程**：
1. web 调研（行业/竞品/案例）
2. 调 venture-judge（创业评估师，融合有序创业24步法 + VC投研7维）
3. 【缺口】venture-research 技能：从 web 数据 → 结构化 persona.jsonld（persona-signal.md 收敛判据，explore §3.3）
4. 落盘 `.venture/artifacts/v{n}/sales-{persona|competitor|monetization}-{node}-{iter}.md`

**§review 流程**：
1. 读决策部 plan + 产品部 design-spec
2. 市场可行性审查：画像是否匹配 / 竞品是否威胁 / 收益模型是否成立
3. 驳回 → review-reject.md

**§交接协议**：产出 persona.jsonld / competitor-analysis.md / market-validation.md / monetization-plan.md；读决策部 plan（被 review 时）。

**§信息源**：web + 知识库（案例，venture-judge 150+ 案例库）。

**§工具箱映射**：venture-judge（系统级 installed skill，explore §一 skills 清单）/ 【缺口】venture-research（层3 补）。

**§缺口占位**：N1/N2/N6 调查/竞品/画像业务技能真空（explore §四），协议层预留 persona.jsonld 字段契约（persona-signal.md 已定收敛判据）。

---

## 四、部门协作协议落地

### 4.1 state 字段读写矩阵（运维部 canonical_source，4 份共享片段之一）

| state 字段 | 写者部门 | 读者部门 | 触发条件 |
|-----------|---------|---------|---------|
| `checkpoint.current_node/task` | 开发部（层3 写） | 决策部/运维部 | 业务推进 |
| `checkpoint.direction_version` | shift-direction.js（决策部触发） | 所有部门 | INV-1 校验 |
| `checkpoint.guardrails` | 运维部（init）/ 层3（更新 budget_tokens_used） | 决策部（review 时读） | 护栏双闸 |
| `checkpoint.continue_from` | H4 Stop / H5 PreCompact | H6 SessionStart / 所有部门（续跑） | 断点续传 |
| `direction.current_version` | **仅 shift-direction.js**（决策部调用） | 所有部门（纯读） | 换向（C1） |
| `trace.ndjson` 每行 | H2 PostToolUse（所有部门动作） | H6 / 决策部（回放） | 任何动作 |
| `tasks.tree.tasks[]` | H2 PostToolUse（开发部启发式匹配） | H4/H6/决策部 | 任务变更 |
| `pipeline-state.status/gate` | pipeline-state.js + advance-node.js + resolve-hg.js | 决策部（HG 拍板读）| HG 停等（嫁接1） |

**关键约束**：
- **direction.json 唯一写者 = shift-direction.js**（C1，explore §5.7）。决策部判定换向 → 调脚本，**绝不直写**。
- **pipeline-state.json 写者隔离**：pipeline-state.js + advance-node.js + resolve-hg.js（C1，explore §3.5）。决策部读 status/gate 做 HG 拍板，不写。
- **所有部门读写 state 受 direction_version 绑定**（INV-1/4）：读 state 前先校验 version 一致，不一致则报漂移。

### 4.2 交接文件命名约定（共享片段 handoff-naming.md）

**规范**：`.venture/artifacts/v{n}/{dept}-{artifact}-{node}-{iter}.md`

- `{n}` = direction_version（绑定方向版本）
- `{dept}` = decision / product / dev / ops / sales
- `{artifact}` = plan / review-approve / review-reject / design-spec / uiux-spec / persona / competitor / impl-report / gate-decision / monetization
- `{node}` = N1-N8 / HG1 / HG2
- `{iter}` = 节点内迭代轮次

**handoff pair 不灌完整 trace**（explore §6.3 LangChain 铁律）：
- 上游部门交接 = 产出文件 + 一份结构化交接说明（含 `direction_version` / `node` / `iter` / 摘要）
- 下游部门读交接说明 + 产出文件，**不读上游完整 trace.ndjson**（避免 bloat + 干扰）

### 4.3 direction_version 绑定规则（共享片段 direction-version-binding.md）

- **INV-1**：`checkpoint.direction_version` == `direction.current_version` == `tasks.tree.direction_version`
- **INV-4**：trace 每行 `direction_version` == 该行写入时的 `direction.current_version`
- **部门协议触发换向流程**（决策部专属）：
  1. 决策部判定需换向（方案被否/方向调整）
  2. 决策部调 `node scripts/shift-direction.js --reason "<理由>" --to <新版本>`
  3. shift-direction.js 原子更新三文件（INV-1）+ 归档旧方向 + 追加 trace shift（INV-4）
  4. 所有部门下次读 state 时校验 version，不一致则触发 direction_shift_reset（advance-node action 枚举之一）

### 4.4 不灌完整 trace 的落地

每部门 SKILL.md §交接协议 明确：
- **本部门产出**：只写自己的 artifact 文件 + 交接说明（结构化 JSON，含摘要）
- **本部门读入**：只读上游 artifact 文件 + 交接说明，**禁止读 trace.ndjson 做上下文**（trace 是运维部/H6 回放用，不是部门协作上下文）
- 例外：决策部 review 时可读 trace 做 ROI/进度回放（决策部是 Manager 角色，需要全局视野）

---

## 五、DAG 对接（映射不装配，C7/C1 不破）

### 5.1 部门↔节点映射表（共享片段 dag-node-mapping.md）

| venture 节点 | 归属部门 | 节点 skill（dag.placeholder.json） | 装配状态 |
|------------|---------|----------------------------------|---------|
| N1 启动 | 销售部 | placeholder | **不装配**（层3 cc-venture 替换） |
| N2 机会识别 | 销售部 | placeholder | 不装配 |
| N3 方案 | 决策部 | placeholder | 不装配 |
| HG1（N3→N4） | 决策部（judge） | —（gate，非 skill 节点） | 不装配 |
| N4 原型 | 开发部 | placeholder | 不装配 |
| HG2（N4→N5） | 决策部（judge） | — | 不装配 |
| N5 验证 | 产品部（设计验证）/ 销售部（市场验证） | placeholder | 不装配 |
| N6 产品化 | 产品部 + 开发部 | placeholder | 不装配 |
| N7 迭代优化 | 产品部 + 开发部（loop_back N7→N6） | placeholder | 不装配 |
| N8 规模化 | 销售部（收益转化） | placeholder | 不装配 |

**映射不装配原则（C7）**：
- hcc 协议层**只定义"节点归哪个部门"的规则**（上表），**不替换 dag.placeholder.json 的 skill=placeholder**。
- 装配（placeholder → 真实 skill 名）是层3 cc-venture 的职责（explore §5.5）。
- hcc 协议层不影响层2 已定稿拓扑（C7/C1 不破）：dag.placeholder.json 的 8 节点 / HG1/HG2 / loop_back N7→N6 max_iter=3 全部原样保留。

### 5.2 映射规则如何被层3 使用

层3 cc-venture 启动时：
1. 读 dag.placeholder.json 拿到节点拓扑
2. 读 hcc-* 部门 SKILL.md §工具箱映射 + dag-node-mapping.md，知道每个节点归哪个部门、该部门有哪些工具箱技能
3. 把节点的 skill 字段从 placeholder 替换为真实 skill 名（装配）
4. 装配后节点运行时，层3 按 hcc-* 部门协议触发对应部门的 plan/review 流程

**γ 的映射规则物理放置**：dag-node-mapping.md 在每个部门 references/ 下（共享片段），层3 读任意一个部门的副本即可拿到完整映射（内容一致，protocol_version 校验保证）。

---

## 六、护栏双闸（budget_tokens_cap + max_iteration）

### 6.1 双闸定义（共享片段 guardrails-dual-gate.md）

映射 `checkpoint.guardrails`（explore §2.1）：

| 闸门 | 字段 | 语义 | 触发动作 |
|------|------|------|---------|
| **Token 预算上限** | `budget_tokens_cap` | 单方向/单节点的 token 总预算（Claude 度量，禁人天） | 超 cap → 决策部 review 判定：换向（shift-direction.js）/ 降级 / 终止 |
| **回环迭代上限** | `max_iteration` | plan→review→驳回→重 plan 的回环上限（explore §6.5 Ruh 反模式#3） | 达 max_iteration → 强制收敛（取当前最优 plan 推进，类似 persona-signal MAX_ITER=3） |
| 配套：无进展检测 | `no_progress_streak` | 连续 N 轮无 progress_delta | 触发 health=stagnant_warn → 运维部报警 |
| 配套：已用预算 | `budget_tokens_used` | 累计 token 消耗 | 实时更新，对比 cap |

### 6.2 双闸在部门协议里的落地

每部门 SKILL.md §plan 流程 + §review 流程 都嵌入双闸检查：

**plan 流程开头**：
1. 读 `checkpoint.guardrails.budget_tokens_used` vs `budget_tokens_cap`
2. 若 used/cap > 0.8 → plan 流程加 warning，提示决策部 review 时关注预算
3. 若 used >= cap → plan 流程拒绝启动，报决策部判定换向

**review 流程开头**：
1. 读 `checkpoint.guardrails`（iteration / budget / no_progress_streak）
2. 若 iteration >= max_iteration → review 强制 approve（取当前最优，不再驳回）
3. 若 no_progress_streak >= 阈值 → review 标记 stagnant，报运维部

**决策部专属**：决策部是双闸的**最终判定者**（A 角色）——超 cap / 达 max_iteration 时，决策部 review 判定换向/降级/终止，调 shift-direction.js 执行。

### 6.3 与 cc-loop 护栏三件套的关系

cc-loop SKILL.md「循环合同」定义护栏三件套：max_iteration / no_progress / budget（explore §一）。hcc 双闸是 cc-loop 护栏在**部门协作层**的投影：
- cc-loop 护栏管**单部门内的循环**（如开发部 worktree SOP 内的循环）
- hcc 双闸管**跨部门的 plan/review 回环**（如决策部 review 驳回开发部 plan，开发部重 plan）

两者共用 `checkpoint.guardrails` 字段（运维部 owns），通过 `iteration` 字段的语义区分（部门内循环 iteration vs 跨部门回环 iteration）。具体语义在 guardrails-dual-gate.md 里明确。

---

## 七、设计张力裁决（3 张力各给 γ 立场 + ROI 论证）

### 张力①：共享协作协议的物理放置

**γ 立场**：**5 部门各自内嵌（分散自包含），references/ 交叉引用共享片段**。

**vs α（hcc-org/ 协议总则根）**：
- α 优势：DRY 最佳（1 份总则 + 5 份引用），改协议单点。
- α 代价：6 目录偏离"5 独立"名义；部门 agent 加载需先读总则；断点续传时若 hcc-org/ 被 compact 冲刷，所有部门失协议上下文。
- **γ 反击**：Skill 按需加载哲学的核心是"加载你要的那一份"——α 的总则根强迫每个部门 agent 都加载一份组织级总则，违背按需加载。γ 的分散内嵌让每个部门 references 在本地，加载独立性最佳。

**vs β（cc-runtime/references/ owns 协议）**：
- β 优势：层1 地基 owns 协议（有 state-schema.md 先例），部门 SKILL.md 聚焦职责。
- β 代价：协议物理远离部门（在 cc-runtime 里），部门 agent 读协议要跨目录寻址；cc-runtime 变成"协议 + state 地基"双重职责，违反单一职责。
- **γ 反击**：协议是**部门间的协作规则**，本质属于"部门"而非"地基"。γ 把 canonical_source 放运维部（因为运维部 owns state，最懂协议物理基础），但**物理副本在每个部门**——兼顾"运维部最懂"和"部门就近加载"。

**γ ROI 论证**：
- 收益：加载独立性（每部门 references 在本地）+ 边界清晰性（RACI 内嵌）+ 断点续传鲁棒性（部门自包含，不依赖总则根存活）。
- 代价：DRY 损失（20 份物理文件，4 份语义）+ sync-protocol.js 工具成本（~30 行 Node fs）+ 漂移风险（protocol_version 校验控制）。
- **ROI 判定**：在 7×24 单机 + Skill 按需加载语境下，"加载独立性 + 断点续传鲁棒性"的收益 > DRY 损失。sync 成本是一次性的，运行时零开销。

### 张力②：5 独立目录 vs 单 agent 动态切换

**γ 立场**：**坚持 5 独立**，论证"自包含加载"如何最大化部门独立性。

**vs 单 agent + middleware 动态切换**（LangChain 推荐，explore §6.2）：
- 单 agent 优势：简单（1 个 agent 换 prompt/state），LangChain 推荐多数场景。
- 单 agent 代价：角色边界模糊（Ruh 反模式#2 头号失败模式），同一 agent 既是决策部又是开发部时责任不清。
- **γ 反击**：hcc 的 5 部门**不是同 agent 换 prompt**，而是 Claude 分饰 5 个有本质不同职责 + 信息源 + plan/review 流程的角色（charter 部署约束"单 Claude 分饰"）——这更接近 Ruh 的 **Specialist 分工**（领域专家/委托禁用/领域工具），而非 LangChain 的"单 agent 换配置"。

**γ 的"自包含加载"论证**：
- 5 独立目录 + 每部门内嵌完整协议 = **每个部门 agent 加载自己 SKILL.md 就能干活，零外部依赖**。
- 单 agent 动态切换需要 agent 先读"当前我是哪个部门"的配置 + 该部门的 prompt 模板 + 共享协议——加载链更长，上下文恢复成本更高。
- 在 7×24 断点续传语境下（charter 部署约束），5 独立目录的"加载即干活"特性优于单 agent 的"先配置再干活"。

**γ ROI 论证**：
- 收益：角色边界最强（Ruh 反模式#2 解法极致落地）+ 加载独立性（每部门自包含）+ 断点续传低恢复成本。
- 代价：多节点 context engineering 复杂度（LangChain 警告，explore §6.2）+ 5 份 SKILL.md 维护。
- **ROI 判定**：hcc 的角色本质差异（决策/产品/开发/运维/销售 职责 + 信息源 + 流程全不同）决定了 Specialist 分工的收益 > 多节点复杂度代价。5 独立在"角色边界清晰性"维度是世界最好的（P3）。

### 张力③：RACI 矩阵形态

**γ 立场**：**每部门 SKILL.md 内嵌完整 RACI（本部门视角），跨部门 RACI 用 references 交叉引用拼装，不做横切总表**。

**vs α（独立 RACI 总表横切 5 部门）**：
- α 优势：全局 RACI 一张表可见，便于审计。
- α 代价：维护横切总表（改一个 R/A 要同步表 + 相关部门 SKILL.md）；部门 agent 看自己 RACI 要跳转总表。
- **γ 反击**：RACI 的核心价值是**让每个角色清楚自己的责任边界**（Ruh 反模式#2 解法）。这个价值在"本部门视角内嵌"时最大化——开发部 agent 读 hcc-dev/SKILL.md §RACI 就看到自己所有 R/A/C/I，零跳转。横切总表是给**审计者**（决策部/运维部）看的，可以由决策部 review 时**临时拼装**（读 5 份部门 RACI 合并），无需常驻总表。

**γ 的跨部门 RACI 拼装机制**：
- 每部门 §RACI 只列**本部门是 R 或 A 的项**（+ 相关 C/I）。
- 想看全局 RACI（如决策部 audit）→ 读 5 份部门 §RACI，按节点/产物合并。
- 这符合"agent 写文件/编排者读文件做真综合"（cc-2pp 假设4，explore §5.4）——每个部门写自己的 RACI，决策部（编排者）读 5 份做综合判断。

**γ ROI 论证**：
- 收益：每个部门 agent 责任边界零跳转可见（Ruh 反模式#2 极致解法）+ 无横切总表维护成本。
- 代价：全局 RACI 审计需读 5 份（决策部 audit 时的上下文成本）。
- **ROI 判定**：RACI 的高频使用者是**部门 agent 自己**（每次 plan/review 都要确认责任边界），低频使用者是**审计者**（决策部偶尔 audit）。γ 把高频路径优化到零跳转，低频路径接受读 5 份——这是 P1 最懒（让最懒的部门 agent 最快有效）的正确落地。

---

## 八、所需 skills 清单

消费 explore §一 技能清单，每个标"在哪步用"：

| 技能 | γ 方案在哪步用 | 用法 |
|------|--------------|------|
| **cc-2pp** | 决策部 §plan 流程（核心）+ 所有部门 §review 流程（对抗验证） | 决策部用判官小组起草方案；所有部门 review 时调 attack 模式找漏洞 |
| **cc-goal** | 决策部 §plan 流程 | 把方案终态条件化（L4 自验证 /goal），确保 plan 可验证 |
| **cc-orchestration** | 决策部 §plan 流程 | 决定后续节点编排（subagent/workflow/team 三模式决策树） |
| **cc-loop** | 产品部 §plan 流程 + 开发部 §plan 流程 + 所有部门循环 | 产品部设计"产品设计循环"；开发部 worktree SOP + 循环合同 + 护栏三件套 |
| **cc-runtime** | 运维部 §plan/review 流程（核心）+ γ 共享片段 canonical_source | 运维部 owns state 地基；γ 的 4 份共享片段 canonical_source 在 hcc-ops/references/ |
| **cc-config** | 运维部 §plan 流程 | 六层配置诊断 + CLAUDE.md 诊断 |
| **cc-context** | 运维部 §review 流程 | 上下文健康审查（防溢出/防遗忘/防冲刷） |
| **cc-memory** | 运维部 §review 流程 | 五层记忆系统审查（INV 校验 + 清理） |
| **venture-pipeline** | 层2 引擎，被层3 + 决策部 HG 拍板调用（γ 不直接用，但依赖其拓扑） | γ 的 dag-node-mapping.md 映射 venture-pipeline 的 dag.placeholder.json 节点 |
| **claude-coach** | 路由器，γ 不直接用（hcc-* 是协议层，被层3 直接调用，不走自然语言路由） | explore §5.3：hcc-* 无业务 trigger，避免与 claude-coach 路由竞争 |
| **venture-judge**（系统级） | 销售部 §plan 流程 | 创业评估师，融合有序创业24步法 + VC投研7维，用于 N1/N2/N6 调研/竞品/画像 |
| 【缺口】venture-product | 产品部 §plan 流程（N5/N7） | 层3 补，协议层预留接口 |
| 【缺口】venture-uiux | 产品部 §plan 流程（N8） | 层3 补 |
| 【缺口】venture-research | 销售部 §plan 流程（N1/N2/N6 结构化产出） | 层3 补，persona-signal.md 已定收敛判据 |

---

## 九、工作量估算（Claude 度量，禁人天）

依据 charter 度量约束（explore §5.8）+ cc-2pp Prompt 注入约束，用 Claude 实施者度量：

### 9.1 协议层骨架交付工作量

| 交付物 | token 成本（估算） | 上下文轮次 | skill 配置成本 | 验证复杂度 | 依赖风险 |
|--------|------------------|-----------|--------------|-----------|---------|
| 5 份部门 SKILL.md（各 8 要素内嵌） | ~25k token/份 × 5 = 125k | 单次 Write 即可，每份 1-2 轮 | 低（纯文档，无 frontmatter trigger） | 中（需对照 charter 5 部门表 + explore 映射核验一致性） | 低（不依赖业务技能） |
| 4 份共享片段（canonical 在运维部） | ~3k token/份 × 4 = 12k | 单次 Write，每份 1 轮 | 低 | 中（需对照层1 state schema + 层2 pipeline-state schema） | 中（依赖 explore §二/§三 schema 准确性） |
| 4 份共享片段同步到其他 4 部门 | ~12k × 4 = 48k（物理 copy） | sync-protocol.js 1 轮跑完 | 低（纯 Node fs copy） | 低（protocol_version 校验） | 低 |
| sync-protocol.js + protocol_version 校验扩展 init-state.js | ~2k token 代码 | 1-2 轮（写 + 测试） | 低（C2 纯 Node fs+path+crypto） | 中（需测 5 目录版本号一致性校验） | 低 |
| dag-node-mapping.md 映射表 | 包含在共享片段内 | — | — | 低（对照 dag.placeholder.json 8 节点） | 低（C7 不破） |

**合计**：~187k token + ~15 上下文轮次 + 1 个轻量脚本（sync-protocol.js ~30 行 + init-state.js 扩展 ~15 行）。

### 9.2 验证工作量

| 验证项 | 成本 |
|--------|------|
| charter D10 一致性核验（§十一） | ~5k token，1 轮（对照 charter §组织架构逐条） |
| INV-1..6 不变量不被破坏核验 | ~3k token，1 轮（对照 explore §2.5） |
| C1/C7 不破核验 | ~2k token，1 轮（direction.json 唯一写者 + dag.placeholder.json 不动） |
| 5 部门 RACI 拼装完整性核验 | ~4k token，1 轮（读 5 份 §RACI 合并，查无遗漏节点） |

### 9.3 运行时开销（部门协作时）

| 场景 | token/轮次成本 |
|------|--------------|
| 单部门 agent 加载（如开发部开工） | 读 1 份 SKILL.md（~5k token）+ 4 份 references（~12k token）= ~17k token，1 轮 |
| 跨部门 handoff（决策部→开发部） | 读交接说明 + plan.md（~3k token），不读 trace，1 轮 |
| 决策部 review（读下游 + 对抗验证） | 读 1-2 份下游产出（~5k token）+ cc-2pp attack（~10k token）= ~15k token，2-3 轮 |
| 换向（决策部触发） | 调 shift-direction.js（脚本，0 token）+ 读新方向 plan（~3k token），1 轮 |

**对比 α/β**：γ 的单部门加载成本（~17k token）略高于 α（~15k token，1 总则 + 1 部门引用）和 β（~16k token，cc-runtime 协议 + 部门），但 γ 的优势是**断点续传时只需恢复当前部门**（不依赖总则根/cc-runtime 协议存活），长期 7×24 运行下恢复成本更低。

---

## 十、优势 / 致命弱点 / 适用场景

### 10.1 优势

1. **加载独立性最佳**（契合 Skill 按需加载哲学）：每个部门 agent 只读自己 SKILL.md + 本地 references 就能干活，零跨目录寻址。
2. **部门边界最强**（Ruh 反模式#2 极致解法）：本部门 R/A/C/I 内嵌 SKILL.md，零跳转可见责任边界。
3. **断点续传鲁棒性最高**（7×24 单机核心）：部门自包含，恢复某部门上下文不依赖总则根/cc-runtime 协议是否存活——compact 冲刷 hcc-org/（α）或 cc-runtime/references/（β）不会让部门失协议，γ 的协议在部门本地。
4. **跨部门 RACI 拼装符合"agent 写/编排者读"模式**（cc-2pp 假设4）：每部门写自己 RACI，决策部 audit 时读 5 份做综合——与现有协作原型同构。
5. **canonical_source 设计兼顾"运维部最懂协议"和"部门就近加载"**：规范源在运维部（owns state），物理副本在每部门——双层兼顾。

### 10.2 致命弱点

1. **DRY 最差**：4 份共享片段 × 5 部门 = 20 份物理文件，语义只有 4 份。改协议要改 canonical + 跑 sync-protocol.js（虽有工具，仍是多步）。
2. **漂移风险真实存在**：若开发者手动改了某部门的共享片段副本而忘跑 sync，5 份会漂移。protocol_version 校验能检测，但不能阻止手动误改（只能在 init 时报错）。
3. **维护成本乘以 5**：任何协议要素变更（如新增护栏字段、调整命名约定）都要同步 5 个目录。sync-protocol.js 自动化大部分，但 canonical_source 的内容变更需人工起草。
4. **SKILL.md 变长**：每部门内嵌 8 要素 + RACI 表，SKILL.md 比 α/β 的部门 SKILL.md 更长（α/β 部门 SKILL.md 可引用总则而精简）。
5. **全局 RACI 审计需读 5 份**：决策部 audit 时上下文成本高于 α 的横切总表（α 一张表可见）。
6. **目录数最多**：5 部门目录 ×（1 SKILL.md + 4 references）= 25 个文件，比 α（1 总则 + 5 引用 = ~11 文件）/ β（cc-runtime 扩展 + 5 部门 = ~16 文件）都多。

### 10.3 适用场景

**γ 最适合**：
- **7×24 长期运行 + 频繁断点续传**：部门自包含的鲁棒性优势在长期运行中累积（每次 compact/断电/换向恢复都省去寻址总则的成本）。
- **部门角色本质差异大**：5 部门职责 + 信息源 + plan/review 流程差异越大，自包含内嵌的"加载即干活"优势越明显（hcc 正是此场景）。
- **单机部署 + Skill 按需加载**：单机不依赖网络/服务器，Skill 按需加载哲学下，分散自包含最契合"加载你要的那一份"。
- **审计频率低 + 部门 agent 自查频率高**：RACI 高频使用者是部门 agent（自查责任边界），低频是审计者——γ 优化高频路径。

**γ 不适合**：
- **协议频繁变更**：若协作协议在迭代期频繁调整，sync 5 目录的成本累积（此时 α 单点修改更优）。
- **强中央审计需求**：若需要频繁看全局 RACI 总表做合规审计，α 的横切总表更方便。
- **目录数敏感**：若项目对文件数/目录数严格约束（如极简仓库），γ 的 25 文件偏多。

---

## 十一、与 charter D10 一致性核验

逐条对照 charter §组织架构（D10 = A 工具箱模型）+ 5 部门表 + 部门协作协议：

### 11.1 D10 形态：A 工具箱模型

| charter D10 要点 | γ 是否符合 | 证据/说明 |
|----------------|-----------|---------|
| 部门 = 协作协议层（定义职责 + plan/review + 交接 + 信息源） | ✅ 符合 | γ 5 部门 SKILL.md 各内嵌这 4 要素（§三） |
| 技能 = 跨部门工具箱（cc-*/venture-* 原位保留） | ✅ 符合 | γ 不动现有 11 技能，工具箱映射在每部门 §工具箱映射（§三） |
| 重构≈0，不破坏 50-decision 技能树 | ✅ 符合 | γ 只新增 5 hcc-* 目录 + 1 sync 脚本，不动 cc-*/venture-* |
| charter 提议"新增 hcc-org/" | ⚠️ 物理形态分化（张力①合法分化点） | γ 把"协议层"物理化为 5 自包含目录而非单一 hcc-org/ 根——D10 的裁决点是**形态**（A vs B），非"目录是否单一根"。γ 在 A 形态内，物理放置选分散，是 explore §七 张力①的合法分化 |

### 11.2 5 部门表对照

| charter 部门 | charter 节点 | charter 信息源 | charter 工具 | γ 部门 | γ 一致性 |
|-------------|------------|--------------|------------|--------|---------|
| 决策部 | N3/N4/HG | 知识库 + web | cc-2pp/cc-goal/cc-orchestration | hcc-decision | ✅ 节点/信息源/工具全对齐（§3.1） |
| 产品部 | N5/N7/N8 | 本地产物 + 用户反馈 | cc-loop + 新建 | hcc-product | ✅ 对齐，新建技能标缺口占位（§3.2） |
| 开发部 | 实施 | 本地代码 | executor/cc-loop | hcc-dev | ✅ 对齐（§3.3） |
| 运维部 | 层1贯穿 | 本地 state/config | cc-runtime/cc-config/cc-context | hcc-ops | ✅ 对齐，且 γ 选运维部为 canonical_source（§3.4） |
| 销售部 | N1/N2/N6 | web + 知识库 | venture-judge + 新建 | hcc-sales | ✅ 对齐，新建技能标缺口占位（§3.5） |

### 11.3 部门协作协议对照

| charter 协议要点 | γ 是否符合 | 证据/说明 |
|----------------|-----------|---------|
| 部门间不直接对话，通过层1 产物契约（state）+ direction + trace 交换上下文 | ✅ 符合 | γ §四 state 字段读写矩阵 + handoff pair 不灌 trace（§4.4） |
| 每个部门的 plan/review 遵循 cc-2pp（判官 + 对抗） | ✅ 符合 | γ 每部门 §plan/§review 流程调 cc-2pp（§三） |
| hcc 三层总图（组织层 hcc-org / 工具层 cc-*+venture-* / 地基层 cc-runtime） | ⚠️ 组织层物理形态分化 | γ 把"组织层"物理化为 5 hcc-* 目录（非单一 hcc-org/），工具层/地基层不变——三层逻辑结构保留，组织层物理分散 |

### 11.4 部署约束对照

| charter 约束 | γ 是否符合 |
|------------|-----------|
| 单机（一台笔记本） | ✅ 纯本地文件 + Node fs，无服务器依赖 |
| 单人（唯一人类） | ✅ 5 部门都是 Claude 分饰，human gate 是决策部 HG |
| 单 Claude（唯一 AI） | ✅ Claude 分饰 5 部门 agent |
| 7×24（会话断点续传） | ✅ γ 的自包含设计优化断点续传（§10.1 优势3） |

### 11.5 根原则对照

| charter 原则 | γ 落地 |
|------------|--------|
| P1 最懒 | ✅ 每部门 agent 读自己 SKILL.md 就干活，零跨目录寻址（加载最懒） |
| P2 三段论 | ✅ 部门 handoff = 解码（读上游）→ 转换（plan/review）→ 重编码（写 artifact + 交接说明） |
| P3 世界最好 | ✅ γ 在"部门加载独立性 + 边界清晰性"维度追求世界最好（§7 张力② ROI） |
| P4 超越 | ✅ 5 部门 7×24 自动协作，boss 在 HG 做创新决策（决策部 gate） |

### 11.6 核验结论

γ 方案在**形态（A 工具箱）、5 部门职责/节点/信息源/工具、协作协议、部署约束、根原则**全部与 charter D10 一致。唯一分化点是**组织层物理形态**（5 分散目录 vs 单一 hcc-org/ 根），这是 explore §七 张力①明确留给 judge panel 裁决的合法分化点，不违背 D10 的形态裁决（A vs B）。γ 在 A 形态内选分散放置，是 charter 文本"hcc-org/"示意命名的物理诠释分歧，非形态违背。

---

> **γ 方案完**。核心主张：协作协议分散自包含放置——5 部门目录各自内嵌完整协议，references 交叉引用消除硬重复，最大化加载独立性 + 边界清晰性 + 断点续传鲁棒性。代价诚实承认：DRY 最差 + 漂移风险 + 维护乘以 5。ROI 判定：在 7×24 单机 + Skill 按需加载 + 部门角色本质差异大语境下，加载独立性收益 > DRY 损失。等待 Step 2b 评分 + Step 2c 对抗攻击。
