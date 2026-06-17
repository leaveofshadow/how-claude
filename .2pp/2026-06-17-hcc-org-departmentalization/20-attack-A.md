---
run: 2026-06-17-hcc-org-departmentalization
artifact: attack-A
attacker: 架构视角（外部，只看方案不看探索）
created: 2026-06-17
effort: max
---

# 20-attack-A.md —— 攻击者 A（架构视角）对 Top 2（β+α）的对抗

> 视角：架构（模块边界/耦合/分层/协议放置合理性）。外部视角——只看两份方案 + charter L69/L75 外部证据 + cc-config L15 Skill 加载机制，不读 explore 探索结果。
>
> 校准：实施者 = Claude Code + 已装载 skills。我评估"Claude + skills 能否落地"，不是"团队能否排期"。度量用 token/轮次/skill 配置成本/验证复杂度/依赖风险，禁人天。
>
> 默认怀疑，找致命伤不是擦边球。

---

## 攻击点列表

### [A-1] β 跨技能目录引用 hcc-protocol.md 在 Claude Code Skill 加载机制下不自动成立——是文档假设，非已验证机制

- 方案: **β**（核心攻击，直击其核心主张）
- 严重度: **CRITICAL**
- 证据:
  - β 10-plan-beta.md L73 `cc-runtime/references/ hcc-protocol.md 【β 新增】`
  - β L79「5 个部门 SKILL.md 在「交接协议」「RACI 引用」段统一指回 `cc-runtime/references/hcc-protocol.md`」
  - β L637 反证自承「**这是 β 最可被攻击的点**」，但给出的反证是**乐观类比**："references 加载是 Claude 常态（cc-* 子技能都读自己 references/），跨目录读 cc-runtime/references/ 不比读自己 references/ 摩擦大多少"
  - 反证的不成立性：cc-config/references/config-systems-guide.md L15 明确「Layer 3: Skills (.claude/skills/) ← 按需加载」，**没有声明 Skill 框架会自动解析 SKILL.md 里的跨技能目录路径**
  - 自动加载机制（`@import` 语法）只存在于 **CLAUDE.md**（config-systems-guide L71-82「import 语法」），**不适用于 SKILL.md**。SKILL.md 里的 `> 详见 cc-runtime/references/hcc-protocol.md §X` 在加载时只是一段**纯文本提示**，不是被框架递归解析的导入指令。
- 影响:
  - β 的整个"协议下沉层1"论点建立在"部门激活 → 连带读 hcc-protocol.md"这个**未经验证的加载假设**上。真实加载行为是：Skill 框架只把 SKILL.md 本身注入 agent 上下文；hcc-protocol.md 必须靠 agent **主动发起一次 Read 工具调用**才能进入上下文。
  - β 自身证据链断裂：L637 反证拿"cc-* 子技能读自己 references/"类比——但 cc-* 读的是**同目录下** references（`<skill>/references/x.md`，agent 读 SKILL.md 后看到提及，发起 Read 是低摩擦的本地路径）。β 要 agent 读的是**另一个技能目录** `cc-runtime/references/hcc-protocol.md`——这是跨技能边界引用，agent 是否会自发去读一个"不是本技能 own 的、挂在运维部地基下"的文件，**取决于 agent 是否把 markdown 文本里的路径当指令**。这是 prompt 脆弱性，不是架构保证。
  - α 每部门 SKILL.md §0 也有同样的"引用块"（10-plan-alpha L227 `> 本部门遵循 hcc-org/SKILL.md`），α 也吃这个攻击——但 α 的引用目标是**同族 hcc-* 目录**（hcc-org/ 与 hcc-decision/ 同前缀，认知上是"本族宪法"），跨目录距离比 β 的"部门→运维部地基"短一截。**β 在这个维度比 α 更脆弱**，不是 β 自称的"等价"。
  - 致命后果：若 agent 不读 hcc-protocol.md 就干活（高概率——agent 默认按 SKILL.md 描述的流程执行，SKILL.md 里的"引用块"很容易被当成"装饰性引用"跳过），则协作总则/RACI/交接协议/state 读写矩阵**全部失效**。5 部门各干各的，无协作协议约束。β 的方案核心价值归零。
- 修复建议: **不可修=致命**，除非改变加载机制。要真正保证 hcc-protocol.md 被读，只能：
  1. 把协议**内嵌进每个部门 SKILL.md**（=γ 方案，β 自己 L536 论证 γ DRY 代价高）——β 的"下沉层1"卖点被自己放弃。
  2. 用 CLAUDE.md `@import` 把协议拉进常驻层（config-systems-guide L71）——但协议 ~200 行 ×5 部门共享进常驻 CLAUDE.md，违反 cc-loop/context-health 的"常驻成本控制"原则（CLAUDE.md 超 100 行就该拆，config-systems-guide L63）。
  3. 靠 Hook 强制注入（SessionStart/PreToolUse 把 hcc-protocol.md 注入）——但 β L73/L81 明确"纯新增 references 文档，不动脚本"，加 Hook = 改 settings.json = 动配置层，β 的"skill 配置成本=0"（L610）破产。
  
  **三条修复路径都摧毁 β 的核心卖点**。β 的"协议下沉层1 = 最低摩擦放置"是建立在未经验证的加载假设上的纸面优势。

---

### [A-2] β 把 charter L69/L75 物理指定的 `hcc-org/` 重新诠释为概念层，是对既定决策的越权重写

- 方案: **β**
- 严重度: **MAJOR**（接近 CRITICAL）
- 证据:
  - charter 00-charter.md L69 原话（带反引号，物理目录标记）：「形态定论（D10 → A 工具箱模型）：部门 = 协作协议层（**新增 `hcc-org/`**，定义职责 + plan/review 流程 + 交接协议 + 信息源）」
  - charter L75 三层总图代码块第一行：`├── 组织层  hcc-org/         ← 5 部门协作协议（D10 新增，轻量）`——**物理目录在三层总图的"组织层"行明确画出来**
  - β L32-36 自辩：「charter 三层总图是**概念图**……不是**物理目录强制约束**。BOSS 在 explore §7 的三维决策里选的是"5 独立部门目录"，**没选"hcc-org/ 单根 + 5 部门引用"**」
- 影响:
  - β 在做**架构师最忌讳的事——重新诠释已定稿的物理契约**。charter L69 用反引号 `` `hcc-org/` `` 是 markdown 的代码标记，语义上等于"这是一个具体的目录名"。L75 在 ASCII 树里把它画在"组织层"分支下，是**物理拓扑图**，不是概念图。β L32 一句"是概念图不是物理强制"就把 charter 既定决策推翻，这是**判官小组越权**——charter 是 BOSS 定稿的宪法，判官小组的职责是落地宪法，不是改写宪法。
  - 真实后果：若采纳 β，charter L69/L75 与实际目录结构**长期不一致**。未来任何人读 charter 找 `hcc-org/` 会落空，去 cc-runtime/references/ 才找到。charter 作为"循环锚文件"（config-systems-guide L276「CLAUDE.md 规则锚」）的稳定性被破坏——这正是 Loop Engineering 要避免的"锚文件漂移"。
  - β L36 的"避免 5 独立 vs 6 目录命名悖论"论证是**用战术便利推翻战略契约**。BOSS 如果真要 5 目录，应该在 charter 修订时删掉 `hcc-org/`，而不是让判官小组在方案里偷偷下沉。β 的路径是"绕过 charter 修订流程"。
- 修复建议: 要让 β 合法，必须先**修订 charter**（把 L69/L75 的 `hcc-org/` 改为"协议物理宿主=cc-runtime/references/hcc-protocol.md，hcc-org/ 为概念层"），走 charter 变更门。不修订就采纳 β = charter 与实现长期背离，是架构债。修订 charter 本身有成本（重新过 BOSS 确认），β 的"重构≈0"（L656）在 charter 层面不成立。

---

### [A-3] β 把组织层协议（协作总则/RACI/交接）下沉到地基层 cc-runtime，错置抽象层——污染地基语义

- 方案: **β**
- 严重度: **MAJOR**
- 证据:
  - charter L74-78 三层总图：组织层=`hcc-org/`，工具层=`cc-*/venture-*`，**地基层=`cc-runtime` ← state/direction/trace/Hook**
  - β L73 把「协作总则 + RACI 总表 + 交接协议 + state 读写规则」放进 cc-runtime/references/hcc-protocol.md
  - β L107-108 自辩：「协议不是某部门的知识，是 5 个部门共同站立的地基共识——地基 owns 它语义正当」
  - 但 charter L75 地基层定义是「**state/direction/trace/Hook**」——这是**运行时数据契约**（frozen schema、写入隔离 C1、不变量 INV-1..6）。协作总则/RACI/交接协议是**组织治理契约**（谁负责什么、怎么交接）。两者是**不同抽象层的不同关切**。
- 影响:
  - β 把"组织治理"塞进"运行时地基"，造成**层职责混淆**。后果：cc-runtime 从"纯地基（state 四文件 + 脚本）"扩张为"地基 + 组织宪法"——一个目录 own 两个抽象层。
  - 具体灾难场景：运维部（hcc-ops）用 cc-runtime 做 R（β L379「运维部天然是协议的维护者」）——但运维部的 R 是**state 保活**（charter L64「7×24 保活/state/trace/Hook」），不是**组织宪法维护**。β L378-379 把"协议守护"塞给运维部，是**职责越界扩张**。运维部一个 agent 同时 own「运行时数据完整性」和「组织治理规则」，两个语义域混在一个 agent 的 RACI 里，违反 Ruh 反模式#2（角色边界不清）。
  - state-schema.md 的 frozen-v1 变更门（β L379 援引 state-schema §7.3）是针对**schema 演进**设计的（字段加/改要走版本门）。组织宪法（RACI 总表、交接协议）的变更频率和审批逻辑与 schema 演进**根本不同**——RACI 改一格不需要 schema 版本升级，但需要决策部 review。β 把两套变更逻辑塞进同一个 references 目录，变更门语义会被滥用或被绕过。
- 修复建议: 协议属于**组织层**（charter L75 已定位），不该下沉。修复=放弃 β 的核心主张，回到 α（hcc-org/ own 组织宪法）或 γ（内嵌）。β 在分层上无解。

---

### [A-4] α 的 hcc-org/SKILL.md 成为架构单点——总则一处错/损坏，5 部门全瘫

- 方案: **α**
- 严重度: **MAJOR**
- 证据:
  - α 10-plan-alpha L650 自承弱点 2：「部门 SKILL.md 依赖总则（加载耦合）——若总则缺失/损坏，5 部门全瘫」
  - α L651 自承弱点 3：「总则成为单点——总则有 bug（如 RACI 总表某格错），5 部门全错」
  - α 给的"对冲"（L651）：「总则是静态文档（非脚本），损坏概率低」+「总则修订经决策部 review」
- 影响:
  - α 的对冲**严重低估了静态文档单点的风险**。在 7×24 自主运行场景（charter 部署约束「单机 = B 会话级断点续传」），文档损坏不是因为"脚本崩溃"，而是因为：
    1. **compact-snapshot 抢救覆盖盲区**：β/α 都依赖 cc-runtime compact-snapshot Block⑤ 抢救 state。但 hcc-org/SKILL.md 是 **.claude/skills/ 下的静态文件，不在 .venture/state/ 抢救范围内**。α L651 提到"总则文件不在 state 内但可纳入层3 备份"——这是**未实现的承诺**，层3 还没启动。在层3 启动前，hcc-org/SKILL.md **零备份**。一次误删/误改（agent 在 review 流程里"优化"总则）= 5 部门宪法丢失。
    2. **RACI 单格错误的传播**：α L651 说"总则修订经决策部 review"——但 review 是**事后**的。如果决策部 plan 阶段读总则时 RACI 已经是错的（比如上一次 review 漏掉的错格），决策部基于错误 RACI 出 plan，错误 plan 落盘，5 部门按错误 plan 执行。错误已经传播了 N 节点才可能在下次 review 被发现。**7×24 自主运行下，错误传播窗口可达数小时**。
    3. **运维部无法监管总则**：运维部的 review（α L318）是"回放 trace.ndjson 检测 INV 违反"——但 INV 是 state 不变量，不是文档正确性。运维部**没有能力检测 RACI 总表是否正确**。总则的正确性**无人持续监管**，全靠决策部偶尔 review（max_iteration 触发时）。
- 修复建议: 单点无法靠"静态文档损坏概率低"对冲。需要：(a) 把 hcc-org/SKILL.md 纳入 compact-snapshot 抢救范围（但要改 cc-runtime 脚本，α 自称"不动脚本"L610 破产）；(b) 加 Hook 在 SessionStart 校验 hcc-org/SKILL.md 的 hash（又是动配置层）。两条修复都增加 α 的"skill 配置成本"。**α 的"重构≈0"是脆弱前提下的乐观估计**。

---

### [A-5] α 的 hcc-org/SKILL.md §4 state 读写规则与 cc-runtime/references/state-schema.md 职责重叠——双源真理风险

- 方案: **α**
- 严重度: **MAJOR**
- 证据:
  - α L191-197 hcc-org §4「state 读写规则（部门权限矩阵）」——详细列出每字段每部门的 read/write/append/trigger 权限
  - α L215 references/state-access-rules.md「每字段每部门的 read/write/append/trigger 权限 + 写者隔离 C1 复述」
  - 同时 cc-runtime/references/state-schema.md（α L72 标注「已存在 frozen-v1，不变」）已经定义了**字段的 schema + 唯一写者约束**（C1：direction.json 仅 shift-direction.js）
  - α L653 自承弱点 5：「hcc-org §4 state 读写规则与 cc-runtime/references/state-schema.md 内容部分重叠——可能重复或漂移」
  - α 的"对冲"（L653）：「hcc-org §4 只定义'部门权限矩阵'（谁读谁写），cc-runtime state-schema 定义'字段 schema'（字段是什么）——维度不同，引用不复制」
- 影响:
  - α 的对冲**站不住**。"字段 schema"和"谁读谁写"在**唯一写者约束（C1）**这个点上**必然重叠**：state-schema 说"direction.json 唯一写者=shift-direction.js"，hcc-org §4 说"direction.current_version 实际写者=shift-direction.js"（α L366）。这两句话是**同一个事实的两份表述**。只要 C1 不变，两份表述必须永远一致；C1 一旦演进（比如未来加新的写者脚本），**两处必须同步改**——这就是 α 自己 L528 批评 γ 的"DRY 代价"（"任一修订需 N 处同步，漂移必然"）。
  - α 把"state 读写规则"既放在 hcc-org §4 又放在 cc-runtime state-schema，是**在自己的方案里复刻了它批评 γ 的反模式**。α L653 的"维度不同"是文字游戏——C1 约束在两个"维度"里都出现，就是重复。
  - 真实漂移场景：运维部 review（α L318）回放 trace 发现某部门越权写 direction.json——运维部该查 hcc-org §4 还是 state-schema 来判定"什么是越权"？两份文档可能描述不一致（§4 说"决策部读+触发换向"，state-schema 说"唯一写者=shift-direction.js"）——agent 判定越权时读哪份？**判定逻辑分叉**。
- 修复建议: state 读写规则的**唯一真理源**应该是 state-schema.md（它是 frozen-v1，C1 的权威定义处）。hcc-org §4 应该**只引用不重述**：「state 读写权限详见 cc-runtime/references/state-schema.md §X，本表只补'部门'维度」。但这样 hcc-org §4 就退化成一个"部门↔state-schema 条款"的索引表，不再是独立内容——α 的"hcc-org 总则 own 协作规则"卖点被削弱。**α 在 state 读写这个点上无法既 DRY 又自包含**。

---

### [A-6] α 的 6 目录偏离 BOSS #19"5 独立部门技能目录"——字面违规，"协议宪法非第6部门"的论证说服力不足

- 方案: **α**
- 严重度: **MAJOR**
- 证据:
  - α L649 自承弱点 1：「6 目录偏离'5 独立'字面。BOSS #19 启动指令字面是'5 独立部门技能目录'」
  - α L31/L531 对冲论证：「hcc-org/ 是协作协议的物理容器，不是第 6 个部门——它没有 plan/review 能力，不是 agent 角色，只是 5 部门共读的'宪法碑'」
  - α L144 frontmatter 自证：「hcc-org **无业务 trigger 关键词**……它只在部门 SKILL.md 被加载时通过引用块连带加载——这是'协议宪法'的语义（不被独立调用，被业务引用）」
- 影响:
  - α 的论证在**架构语义**上能成立（hcc-org 无 trigger、无 plan/review、不是 agent），但在**Claude Code Skill 系统的物理事实**上站不住：hcc-org/ 是 `.claude/skills/` 下的一个目录，带 SKILL.md——**在 Skill 注册表里它就是一个 skill**，无论 frontmatter 怎么写。Claude Code 的 Skill 列表（如本会话 system-reminder 里列出的 cc-runtime/venture-pipeline 等）是按目录枚举的，hcc-org/ 会出现在列表里，就是"第 6 个 skill"。
  - BOSS #19 说"5 独立部门技能目录"——如果 BOSS 的心智模型是"Skill 列表里看到 5 个 hcc-* 部门"，α 产出后 Skill 列表会看到 **6 个 hcc-* 条目**（hcc-org + 5 部门）。BOSS 一眼看到 6 个，第一反应是"怎么多了一个"。α 的"宪法非部门"论证需要 BOSS 读 frontmatter 才能理解——**依赖 BOSS 的二次认知**，不是自解释的物理事实。
  - 更致命：hcc-org 无 trigger（α L144）意味着它**永远不会被 Claude 主动加载**——它只能靠部门 SKILL.md 的"引用块"被动触发。但如 [A-1] 所述，"引用块"触发加载是未经验证的假设。如果该假设不成立，hcc-org/SKILL.md 就是**一个永远不被加载的死 skill**——它存在但不起作用，5 部门照样不读它。α 的整个"协议宪法层"可能是个**空壳**。
- 修复建议: α 的"宪法碑"语义要真正落地，hcc-org/ 不能是普通 skill 目录。要么 (a) 把协议放 CLAUDE.md（常驻，必读，但超 100 行该拆）；(b) 用 `@import` 从 CLAUDE.md 拉协议进常驻层（但协议 ~200 行进常驻违反 context-health）；(c) 接受 hcc-org/ 是第 6 个目录的事实，回头让 BOSS 确认"6 目录可接受"。**α 的"在 BOSS 真实意图内"（L31）是 α 替 BOSS 做的解读，不是 BOSS 确认过的**。

---

### [A-7] 两方案都假设"部门激活=单部门独占"，但 charter"单 Claude 分饰"与 venture-pipeline 节点路由的实际加载机制未验证

- 方案: **β 和 α 共同弱点**（架构前提未验证）
- 严重度: **MAJOR**
- 证据:
  - β L108「单部门激活 token 成本：2 个 SKILL.md ≈ 6-8k tokens（charter §部署约束'单 Claude'下，**同一时刻只有 1 个部门激活**，不存在 5 部门并行加载爆窗口）」
  - α L108 同样假设「同一时刻只有 1 个部门激活」
  - β L547 反证预案：「部门是按需加载（只加载当前节点归属部门），不是同时加载 5 个」
  - 但两方案都**没有验证 venture-pipeline 的节点路由如何触发 skill 加载**。charter L77「venture-pipeline 层2 引擎」是 DAG 数据驱动编排——dag.placeholder.json 的 skill 字段当前是 placeholder（β L463 / α L454），**层3 装配后才映射到真实 skill**。在层3 启动前（即本方案交付时），**没有任何机制把"当前节点 N3"翻译成"加载 hcc-decision/SKILL.md"**。
- 影响:
  - 两方案的 token 估算（β L108 6-8k / α L108 6-8k）都假设"节点路由→部门加载"链路已通。但这条链路的**最后一公里（节点 skill 字段 placeholder→真实 skill 装配）是层3 职责**（β L479 / α L453），本方案不交付。
  - 真实交付态：5 个 hcc-* SKILL.md 写好了，但**没有任何东西会去加载它们**。claude-coach 路由器（β L578 / α L575）明确"不进 claude-coach 路由表"（无业务 trigger）。venture-pipeline 的 dag.placeholder.json skill=placeholder 不变（C7）。**5 个部门 SKILL.md 是孤儿**——写好了没人调。
  - 这不是"待层3 补齐"的小缺口，是**架构断链**：本方案交付的"协议层完整骨架"在没有层3 装配的情况下**完全无法运行**。两方案都把"映射不装配"（C7）当优点，但从架构完整性看，这是"交付了无法通电的电路板"。验证无法自闭环——本方案无法独立验证"部门激活→读协议→干活"的闭环，必须等层3。
- 修复建议: 两方案都应在本方案内**至少验证一条端到端链路**（哪怕用硬编码临时装配一个节点→部门→读协议→产出 handoff），证明骨架不是死的。否则 7×24 自主运行的承诺（charter 部署约束）在本方案交付时**完全无法兑现**，要等层3。两方案的工作量估算（β L608 / α L609）都没算这条验证链路的成本——**低估了交付完整度**。

---

### [A-8] 两方案的 RACI 总表"N5 产品+销售双 R/A"违反 RACI 唯一 A 原则，交接仲裁无定义

- 方案: **β 和 α 共同弱点**（协议设计缺陷）
- 严重度: **MINOR**（设计缺陷，可修，但暴露协议设计成熟度不足）
- 证据:
  - β L159「N5 验证（产品设计 + 市场验证）| I | **R**（设计）| C | I | **A**（市场）」——产品部 R，销售部 A
  - β L160「N6 产品化 | C | **R/A**（设计）| R（实施）| I | I」——产品部 R/A，开发部 R
  - α L174「N5 验证 | C | R/A | C | I | C」——产品部 R/A（与 β 不一致！）
  - β L169 自辩：「R/A 同列出现时，R 是执行者，A 是拍板者」——但 β L159 N5 行产品部 R 和销售部 A **不在同一列**（产品部列=R，销售部列=A），β L169 的解释针对的是"同一列 R/A"，不适用于"跨列双 R/A"
- 影响:
  - **β 和 α 的 RACI 总表对同一节点 N5 给出不同答案**（β: 产品 R / 销售 A；α: 产品 R/A）。两份方案基于同一 charter/explore，RACI 总表却分歧——证明 RACI 总表的推导**不是确定的**，是各派自由诠释。这说明"RACI 总表"作为协议核心内容，**其正确性没有客观基准**，是主观设计。谁的对？没有仲裁机制。
  - N5/N6/N7 多部门协作节点（产品+开发+销售），RACI 的 A（拍板者）到底是谁？charter P4「boss 在 gate 做创新决策」——但 N5/N6/N7 不是 gate（HG1/HG2 才是 gate）。非 gate 节点的拍板权**charter 没定义**。β/α 各自补位，补位不一致。
  - 真实冲突场景：N5 验证阶段，产品部说"设计验证通过"，销售部说"市场验证不通过"——谁是 A 拍板继续还是回环？β L159 说销售部 A（市场），但产品部的 R（设计）如果否决呢？RACI 没有"R 否决 A"的机制。**协议在多部门协作节点的冲突仲裁是空白**。
- 修复建议: RACI 总表需要补"冲突仲裁规则"（多部门 R 时谁主、R 与 A 分歧时谁赢）。α L215 的 raci-matrix.md 提到「冲突仲裁规则（多部门 R 时谁主）」——但只在 references 深度参考里，SKILL.md §2 精简总表（部门激活时连带读）没有。即部门激活时看不到仲裁规则，冲突发生时才发现要去翻 references。**协议的冲突处理不在必读层**。

---

## 总结

### β 能否存活: **不能存活（CRITICAL 致命伤未解）**

- **致命伤 [A-1]**：β 的核心卖点"协议下沉层1 = 最低摩擦放置"建立在"部门激活连带读 cc-runtime/references/hcc-protocol.md"这个**未经验证的 Skill 加载假设**上。Claude Code Skill 框架不自动解析 SKILL.md 里的跨技能目录路径引用——hcc-protocol.md 必须靠 agent 主动 Read，而 agent 是否会自发去读一个挂在运维部地基下的协议文档，是 prompt 脆弱性不是架构保证。β 的三条修复路径（内嵌=@γ、CLAUDE.md @import=违反常驻成本、Hook 注入=违反 skill 配置成本=0）**全部摧毁 β 的核心卖点**。
- **重伤 [A-2]**：β 把 charter L69/L75 物理指定的 `hcc-org/`（反引号+ASCII 树）重新诠释为概念层，是判官小组越权重写已定稿宪法。要让 β 合法必须先修订 charter，β 的"重构≈0"在 charter 层不成立。
- **重伤 [A-3]**：β 把组织治理协议塞进运行时地基 cc-runtime，错置抽象层，污染地基语义（state-schema frozen-v1 的变更门逻辑被组织宪法变更滥用）。
- β 唯一的亮点是 5 目录字面满足 BOSS #19（[A-6] 攻击 α 的点），但这个亮点被 [A-1] 的加载机制致命伤抵消——5 个目录独立了，但它们都读不到协议，独立得毫无意义。

### α 能否存活: **勉强存活，但带 4 个未解 MAJOR 伤**

- α 的核心主张（hcc-org/ own 组织宪法 + 5 部门引用）**符合 charter L69/L75 物理指定**（[A-2] 反过来是 α 的合法性来源），分层正确（[A-3] 反过来是 α 的优势——组织协议留组织层不污染地基）。
- 但 α 带 4 个未解 MAJOR：
  - [A-4] hcc-org/SKILL.md 单点（损坏/错误传播，对冲不足）
  - [A-5] §4 state 读写规则与 state-schema.md 双源真理（C1 重述漂移）
  - [A-6] 6 目录字面偏离 BOSS #19（"宪法非部门"论证依赖 BOSS 二次认知，且 hcc-org 无 trigger 可能成死 skill）
  - [A-7] 与 β 共享的架构断链（层3 未装配前 5 部门是孤儿，无法独立验证）
- α 的对冲（L649-653）多数是"静态文档损坏概率低""维度不同不重复"这类**乐观断言**，没有给出机制级保证。α 是"带病存活"，不是"健康存活"。

### 架构视角下哪个更不可救药: **β 更不可救药**

- β 的致命伤 [A-1] 是**机制级无解**（Skill 加载机制不支持跨技能目录自动引用），且 β 的核心卖点（协议下沉层1）直接建立在这个无解假设上——卖点即伤，无法剥离。
- α 的伤是**设计级可缓解**（单点可加备份/Hook、双源真理可改引用、6 目录可回头确认 BOSS、架构断链可加临时装配验证），虽然对冲不足但每条都有明确的修复方向，不需要推翻 α 的核心主张。
- **结论**：架构视角下，**β 因 [A-1] 机制级致命伤 + [A-2] charter 越权 + [A-3] 分层错置三连击，比 α 更不可救药**。α 带病但核心主张（hcc-org/ own 组织宪法）与 charter 物理指定一致、分层正确，是两个方案中架构上更站得住的那个——尽管它需要补强 4 个 MAJOR 伤的对冲机制。

---

> **攻击者 A 架构视角结论**：β 不可救药（机制级致命伤），α 勉强存活但需补强。若 30-score 强行选 β，建议先**实测验证** [A-1]——在真实 Claude Code 会话里激活一个 hcc-* 部门 skill，看 agent 是否会自发 Read cc-runtime/references/hcc-protocol.md。如果不会（高概率），β 方案当场证伪。
