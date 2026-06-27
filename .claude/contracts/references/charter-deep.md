---
doc: org-protocol-deep
layer: D10 (hcc-org)
status: draft
created: 2026-06-17
basis: charter.md §1-§5（深度展开）+ 50-decision §八 α' + 00-explore §5/§6
parent: ../SKILL.md
---

# org-protocol-deep.md —— hcc-org 协议宪法深度参考

> **定位**：本文件是 charter.md 的按需加载深度参考（非必读）。展开 §1 协作总则的设计理由（§A）、§2 RACI 总表的推导过程（§B）、§3 交接协议细则（§C）、§2.1 冲突仲裁案例库（§D）。
>
> **实施者 = Claude Code + 已装载 skills**。5 部门皆由 Claude 分饰，协作成本按 token / 上下文轮次 / 文件交接开销度量（C-2：禁人天隐喻）。本文件禁出现任何 state 写者函数的**调用符号或实现逻辑**（含层1 原子写工具 / 同步写盘 API / 层1 init 脚本 / 换向脚本的具体函数符号），统一用职责名指代（[A-5/B-4] 纯引用约束）。

---

## §A 协作总则深度推导（每条总则的设计理由 + 证据锚点）

### §A.1 总则1「部门间不直接对话，经 state/direction/trace 交换上下文」

**设计理由**：异步协作的物理基础。若部门间用自然语言对话，会引入实时耦合（一部门停等另一部门响应）+ 上下文膨胀（完整历史灌入接收方）。改用 state 文件交换 → 部门各自激活时 Read 自己负责的字段，无停等，无历史 bloat。

**证据锚点**：
- charter §组织架构原话「部门间不直接对话，通过层1 产物契约 + 方向指针 + 执行记忆交换上下文」（00-explore §5.2 引用）。
- 00-explore §6.1：charter 这条路与 LangChain Handoffs「工具更新 state variable，系统读它调整行为」完全同构——业界标准 state-driven handoffs 验证了正确性。
- 00-explore §6.3：LangChain 教训「subgraph handoff 不传完整历史（bloat + 干扰），只传 handoff pair」→ hcc 部门交接 = state 字段 + 结构化交接说明，不灌完整 trace。

**Claude 度量**：部门激活时 Read 跨目录协议文件 + 自己负责节点的 state 字段，+N token/激活（非「跨部门沟通成本」隐喻）。

### §A.2 总则2「plan/review 遵循 cc-2pp（判官 + 对抗验证）」

**设计理由**：统一 plan/review 方法论，避免每个部门各搞一套（碎片化）。cc-2pp 已是成熟判官小组（6 视角并行起草 + 评分 + 对抗验证 + 落盘契约），复用它 = 零新方法论成本 + 结构化产物（下游可读）。

**证据锚点**：
- cc-2pp SKILL.md「充分探索 → 多方案生成 → 对抗验证 → 裁决输出 → 实施计划」工作流。
- cc-2pp 假设4「agent 写文件 / 编排者读文件」（00-explore §5.4 引用）——这正是部门间协作原型：部门（agent 角色）产出落盘到 `.2pp/{date}-{slug}/` 或 `.venture/artifacts/v{n}/`，下游部门读文件接力。
- 00-explore §6.4：charter 部门表缺 RACI 维度，cc-2pp 的判官小组 + 对抗验证正好补「边界清晰性」。

**Claude 度量**：plan/review 各 1 次 cc-2pp 流程 = 判官小组 N 视角 token + 攻击者 M 次 token（非「部门 review 工时」隐喻）。

### §A.3 总则3「换向必经 shift-direction.js（C1 约束）」

**设计理由**：direction.json 是单一真相源，多写者会破坏 INV-1（`checkpoint.direction_version == direction.current_version == tasks.tree.direction_version`）。强制唯一写者（shift-direction.js）= 机制上消灭竞态。

**证据锚点**：
- state-schema.md §3.2/§3.4：direction.json 字段语义 + 原子写协议（临时文件 + rename，Windows 竞态防护）。
- state-schema.md §6 INV-1：跨文件不变量，每次 write 后校验。
- pipeline-state-schema.md §四 §4.3 写者隔离表：`direction.json` 仅 shift-direction.js 可写（C1 核心约束）。
- 00-explore §5.7：层2 全部脚本禁碰 direction.json（init 只读 current_version 纯读例外）。
- 00-explore §6.7：Ruh「Manager 无工具」原则——决策部判定换向 → 调 shift-direction.js（层1 工具），不直写 state。

**Claude 度量**：换向 = 1 次 shift-direction.js 调用（`--reason`/`--to`），脚本自动维护 INV-1..6，部门零额外 token（非「换向流程成本」隐喻）。

### §A.4 总则4「state 字段读写规则由 cc-runtime/state-schema.md owns」（[A-5/B-4] 修复核心）

**设计理由**：消除双源真理。若 hcc-org 复制读写规则，state-schema.md 与 hcc-org 会漂移（一处改另一处忘改）。纯引用 → 单一真理源（state-schema.md frozen-v1），hcc-org 只标 RACI 归属。

**证据锚点**：
- 50-decision §二 B-1：β 方案「skill 配置成本=0」是伪命题（state-schema.md 有脚本感知：层1 init 脚本 + §7.3 变更门），hcc-org 类比错位。
- 50-decision §八 [A-5/B-4]：α §4 重构为纯 RACI 引用（state 读写规则完全由 cc-runtime/state-schema.md owns）。
- state-schema.md §7.3 变更门：minor（加字段）需层1 init 脚本补默认值 + 重跑 70-requirements §1.1/1.2；major 阻塞层3。

**Claude 度量**：hcc-org 引用 state-schema.md = 0 维护成本（schema 变更由 state-schema.md §7.3 门控，hcc-org 自动跟随）；若复制规则 = 双源维护成本 + 漂移风险（非「文档同步成本」隐喻）。

### §A.5 总则5「plan/review 回环上限 max_iteration」

**设计理由**：plan → review → 驳回 → 重 plan 可能死循环。护栏三件套（max_iteration + no_progress_streak + budget_tokens_cap）硬截断，达上限 → 仲裁或换向。

**证据锚点**：
- state-schema.md §1.1：`guardrails.max_iteration`（循环合同护栏一）+ `budget_tokens_cap`（护栏三）。
- 00-explore §6.5：Ruh 反模式#3 循环检测 → 部门 plan/review 回环需定义上限。
- 00-explore §6.6：Ruh 成本乘法（委托是 3-5x 单 agent 成本）→ 协作开销显式纳入 budget_tokens_cap。
- 50-decision §八 [B-7]：iteration 计数由层2 advance-node.js handleLoopBack owns（L161-181，newIter = currentIter + 1），部门只读不写。

**Claude 度量**：回环达 max_iteration → 1 次决策部仲裁（或换向），bounded by budget_tokens_cap（非「死循环风险」隐喻）。

---

## §B RACI 总表推导过程（每个 R/A/C/I 分配的依据）

> **来源**：charter L60-65 节点归属（00-explore §四核实）+ 00-explore §5.5 dag.placeholder 节点隐含归属 + Ruh 三层角色模型（00-explore §6.7）。

### §B.1 节点行推导（N1-N8 + HG1/HG2）

| 节点 | R 归属推导 | A 归属推导 | 证据 |
|------|----------|----------|------|
| **N1 启动** | 销售部 R（机会启动 / 方向锚定，charter L65 销售部 N1） | 决策部 C → 销售「方案自治」，跨节点升级决策部兜底 | charter L65 + 00-explore §四销售部 |
| **N2 机会识别** | 销售部 R（调研 / 竞品，charter L65 N2） | 同 N1 | charter L65 + 00-explore §四 |
| **N3 方案** | 决策部 R（计划起草，判官小组，charter L61 N3） | 决策部 A（方案产出需决策部 review 拍板，Ruh Manager） | charter L61 + cc-2pp |
| **HG1** | （闸门，无执行 R）决策部 C | 决策部 A（显式 boss 决策闸，方案→原型，pipeline-state-schema §二 gate=HG1） | pipeline-state-schema §二 + 00-explore §5.5 |
| **N4 原型** | 开发部 R（按方案实施，charter L63 实施节点） | 决策部 A（开发部 plan 需决策部 review） | charter L63 + 00-explore §四开发部 |
| **HG2** | （闸门）决策部 C | 决策部 A（原型→验证 boss 决策闸，gate=HG2） | pipeline-state-schema §二 + 00-explore §5.5 |
| **N5 验证** | 产品部 R（设计验证，charter L62 N5） | 决策部 A（产品部 plan review） | charter L62 + 00-explore §四产品部 |
| **N6 产品化** | 产品部 R（产品设计，charter L62 N6 节点归属） | 决策部 A | charter L62 + 00-explore §5.5 |
| **N7 迭代优化** | 产品部 R（需求挖掘 / UIUX，loop_back N7→N6 max_iter=3） | 决策部 A | dag.placeholder loop_back + 00-explore §5.5 |
| **N8 规模化** | 销售部 R（收益转化 / 市场规模化，charter L65） | 决策部 C → 销售自治 | charter L65 |

> **A 默认决策部**的理由：Ruh 三层模型中 Manager（决策部）负责编排/拍板（00-explore §6.7）。部门 plan 产出 → 决策部 review → 拍板推进。销售部 own 的 N1/N2/N8 业务节点，决策部批准转 C（销售方案自治），但跨节点升级（如 N3 方案需销售输入）仍决策部兜底 A。

### §B.2 state 字段行推导（运维部 owns）

| state 字段 | R/A 归属推导 | 其他部门 | 证据 |
|-----------|------------|---------|------|
| `direction_version` | 运维部 R/A（运维 owns 层1 state，cc-runtime 地基） | C（只读） | charter L64 运维部 + state-schema §3 |
| `current_node` | 运维部 R/A（pipeline-state 引擎态，运维横切） | C | pipeline-state-schema §二 + charter L64 |
| `iteration` | 运维部 R/A（advance-node.js handleLoopBack owns，[B-7]） | I | 50-decision §八 [B-7] |
| `status`/`gate` | 运维部 R/A（HG 停等语义，pipeline-state 独占） | C/I | pipeline-state-schema §四 §4.1 |
| `trace` | 运维部 R/A（H2 PostToolUse 自动写，运维 owns Hook 链） | I | state-schema §0 + §2 |
| `checkpoint.continue_from` | 运维部 R/A（H4/H5 写，续跑锚点） | C | state-schema §1 |

> **运维部 owns 全部 state 字段**的理由：运维部 = 层1 运行时横切贯穿（charter L64「7×24 保活/state/trace/Hook，层1 运行时贯穿」），工具箱 cc-runtime/cc-config/cc-context 覆盖全链路（00-explore §四运维部「厚实」）。其他部门对 state 只读（经脚本/Hook 间接读写，总则4）——这正是 §4 纯引用的精髓。

---

## §C 交接协议细则

### §C.1 文件命名约定规范格式

```
.venture/artifacts/v{direction_version}/
├── decision-plan.md          # 决策部判官小组 plan
├── decision-review.md        # 决策部对抗验证裁决
├── product-design.md         # 产品部 N5 设计
├── product-requirements.md   # 产品部 N7 需求
├── product-uiux.md           # 产品部 N8 UIUX
├── dev-impl.md               # 开发部实施记录
├── dev-test.md               # 开发部测试结果
├── ops-state-health.md       # 运维部 state/trace 健康报告
├── ops-config.md             # 运维部配置变更
├── sales-research.md         # 销售部 N1 调查
├── sales-competitor.md       # 销售部 N2 竞品
├── sales-persona.md          # 销售部 N6 画像
└── sales-validation.md       # 销售部 N8 市场验证
```

**命名规则**：`{部门缩写}-{产物类型}.md`。部门缩写：decision/product/dev/ops/sales。产物类型语义见 charter.md §3.1。

### §C.2 direction_version 绑定规则

- 所有交接文件落盘到 `.venture/artifacts/v{n}/`，n = 当前 `direction.current_version`（state-schema.md §3.2）。
- 换向时（shift-direction.js `--to v_new`）：旧 artifacts 物理归档到 `.venture/archived/v_old/`（00-explore §2.3 shift-direction.js 用途），新方向新建空 artifacts 目录。
- 下游部门激活时 Read 当前 v{n} 目录（痛点4 机制腿：H1 拦截 superseded_paths，旧目录 ENOENT）。
- trace 每行带 `direction_version`（INV-4，state-schema.md §6），换向后新行带新版本——交接文件与 trace 版本一致。

### §C.3 handoff pair 不灌完整 trace（00-explore §6.3）

**规则**：交接文件只含：
1. **触发消息**：上游部门为何产出此文件（节点 + 任务 + direction_version）。
2. **确认消息**：上游部门的关键结论 / learnings summarize。
3. **关键字段**：state 当前值（current_node / iteration / status）快照。

**禁止**：复制完整 trace.ndjson（bloat + 干扰接收部门）。需更多上下文 → 交接文件里 summarize，接收部门按需 Read trace 特定行（带 `node`/`iter`/`direction_version` 过滤）。

**Claude 度量**：handoff pair ≈ 200-500 token；完整 trace 可能 10k+ token。省 token + 减少接收方上下文污染（非「交接效率」隐喻）。

### §C.4 state 字段交接经脚本/Hook（非部门直写）

部门不直接读写 state 文件，间接路径：
- **写 trace/tasks**：H2 PostToolUse 自动写（部门产出文件时 Hook 触发）。
- **推进 current_node**：层2 advance-node.js（部门 plan 完成 → 引擎推进）。
- **换向 direction**：决策部调 shift-direction.js（总则3）。
- **读 state**：部门激活时 Read 自己负责节点的字段（只读）。

详细写者隔离见 pipeline-state-schema.md §四 §4.3 + state-schema.md §0。

---

## §D 冲突仲裁案例库（[A-8] 修复，≥3 个场景）

> **基准**：每行至少 1 R + 1 A（charter.md §2 RACI 总表）。冲突时按 §2.1 仲裁规则处理。

### 案例1：N6 产品化 R 冲突（产品部 vs 开发部）

**场景**：N6 产品化节点，产品部主张 R（产品设计是产品部职责），开发部也主张 R（产品化需实施落地）。

**冲突类型**：R 冲突（职责重叠）。

**仲裁路径**：
1. 决策部 review 两部门 plan（cc-2pp 判官小组）。
2. 裁定：产品部 R（产品设计决策），开发部 C（实施细节执行，N6 的「化」由产品部主导设计，开发部实施）。
3. 落盘：更新 charter.md §2.1 节点行 N6（产品部 R，开发部 C），通知两部门。

**依据**：charter L62 产品部「产品设计」+ L63 开发部「按 plan 实施」——产品化 = 设计驱动实施，R 归设计方。

### 案例2：N5 验证 A 冲突（产品部 vs 销售部）

**场景**：N5 验证节点，产品部主张 A（设计验证是产品部 own），销售部也主张 A（市场验证是销售部 own，N5 含市场验证）。

**冲突类型**：A 冲突（批准权争夺）。

**仲裁路径**：
1. 决策部 HG 拍板（非 HG 节点的 A 冲突 → 决策部 review 后指定唯一 A）。
2. 裁定：若 N5 当前阶段属「设计验证」→ A 归产品部（销售部 C）；若属「市场验证」→ A 归销售部（产品部 C）。跨域（既设计又市场）→ 决策部临时 A，拆分验证子节点后指派常驻 A。
3. 落盘：更新 §2.1 节点行 N5，标注当前阶段 A 归属。

**依据**：charter L62 产品部 N5 设计验证 + L65 销售部市场验证——N5 是双义节点，A 按当前验证类型裁定。

### 案例3：新增节点 N9 无 R 无 A（gap）

**场景**：层3 cc-venture 装配业务 skill 时新增 N9（如「渠道拓展」），但 §2.1 节点表无 N9 行 → 无 R 无 A。

**冲突类型**：无 R 行 + 无 A 行（gap，新节点未分配）。

**仲裁路径**：
1. 决策部 review N9 语义（渠道拓展 = 销售职能）。
2. 裁定：按 charter L60-65 节点归属表，N9 归销售部 R，决策部 A（默认 Manager 拍板）。
3. 落盘：§2.1 节点表新增 N9 行（销售部 R，决策部 A），更新 dag.json + 重 init pipeline-state（graph_hash 变更）。

**依据**：50-decision §八 [A-8]「无 R 行 → 决策部按 charter 节点归属指派 R；无 A 行 → 决策部临时 A」。

### 案例4：HG1 闸门 A 独占（决策部 vs 产品部）

**场景**：HG1（方案→原型 boss 决策闸），产品部主张 A（方案含产品设计，产品部应拍板），决策部主张 A（HG 闸门归 Manager）。

**冲突类型**：A 冲突（显式 HG 闸门）。

**仲裁路径**：
1. 决策部 HG 拍板（HG1/HG2 是显式 boss 决策闸，决策部独占 A，pipeline-state-schema §二 gate=HG1）。
2. 裁定：决策部 A（独占），产品部 C（方案输入咨询）。HG 闸门的 A 不容争议——它是 boss 决策点，非部门协作点。
3. 落盘：§2.1 节点行 HG1 维持决策部 A（无需更新， reaffirm）。

**依据**：pipeline-state-schema.md §二 gate 字段（HG1/HG2 = boss 决策闸）+ 00-explore §6.7 Ruh Manager 角色（HG 拍板归 Manager）。

---

> **org-protocol-deep.md 完。** 4 段：§A 协作总则推导（5 条 × 设计理由 + 证据锚点）+ §B RACI 推导（节点行 + state 字段行）+ §C 交接细则（命名/绑定/handoff pair/经脚本）+ §D 冲突仲裁案例库（4 案例）。0 写者函数调用（纯引用约束）。深度展开 charter.md §1-§3 + §2.1，按需加载非必读。
