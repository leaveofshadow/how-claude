---
run: 2026-06-17-hcc-org-departmentalization
artifact: attack-B
attacker: 实现+测试视角（外部，只看方案不看探索）
created: 2026-06-17
---

# 20-attack-B.md —— 攻击者 B（实现+测试视角）对 Top 2（β+α）的对抗

> 攻击者立场：**推翻，不优化**。effort=max。专攻"看起来好但测不了/落不了地"的承诺。
> 实施者认知锚：实施者 = Claude + skills，非人类团队。度量用 token/轮次/skill配置/验证复杂度/依赖风险。
> 证据规范：所有论断引用方案原文行/节号或层1/层2 实证文件。

---

## 攻击点列表

### [B-1] β 的"skill 配置成本=0"是伪命题：hcc-protocol.md 与 state 的绑定无任何强制机制，纯文档约束可被任意绕过

- 方案: β
- 严重度: CRITICAL
- 证据:
  - β §9.2 L610「**skill 配置成本**：**0**（纯新增 SKILL.md + references，不动现有 cc-runtime/venture-pipeline 任何脚本/schema；C5/C6/C7 天然满足）」
  - β §2.1 L106「协议与 state-schema.md 同处一目录，部门读 state 字段时一并读读写规则，最低摩擦」
  - β §4.1 读写矩阵 L422-429 声称「关键：所有"state 字段写入"经层1 Hook 或层2 脚本，部门 SKILL.md 只描述"何时触发哪个 Hook/脚本"，不自己 fs.writeFile 状态文件（C1 写入隔离）」
  - **层1 实证反证**：`cc-runtime/references/state-schema.md` §7.3 变更门 L300-301 明确「**minor**（加字段）：本文档更新 + **init-state.js 补默认值** + 重跑 70-requirements §1.1/1.2」「**major**：本文档升 frozen-vN + **全量重跑 70-requirements §1** + 通知层3 重新对齐接口」——state-schema 是**有脚本感知的契约**（init-state.js 读它、70-requirements 验它）。
- 影响:
  - β 把 hcc-protocol.md 类比为"state-schema.md 先例"（§2.1 L104、§3.4.8 L379）是**错位类比**。state-schema 的约束力来自 init-state.js/shift-direction.js 在代码层读写它（init-state.js L307「init-state.js 严格照此」），hcc-protocol.md **没有任何脚本读它**——它只是 markdown，Claude 部门 agent 读不读、读哪一段、是否照办，**完全没有运行时强制**。
  - β §4.1 读写矩阵的"C1 写入隔离"承诺（部门不直写 state）：层1 现有 C1 强制力来自 shift-direction.js 是 direction.json **唯一物理写者**（state-schema §3 + explore §5.7）——这是 fs 权限级强制，部门 agent 没有 shift-direction.js 的代码路径就写不了。但 hcc-protocol.md §4 的"部门只读不写 checkpoint.*"这种约束**没有对应强制者**：checkpoint.json 的写者是 H4/H5 Hook（state-schema §2），Hook 触发条件是会话事件不是部门身份——**一个被路由到 hcc-decision 的 Claude agent 完全可以用 Write 工具直接覆写 checkpoint.json，没有任何机制阻止**，hcc-protocol.md §4 只是一行 markdown 说"不该写"。
  - 测试覆盖：**零**。β §9.1 验证复杂度标"低（对照 state-schema § + charter §组织架构 核验）"——这是**人眼审 markdown 一致性**，不是可执行测试。无法写断言验证"部门 agent 运行时确实遵守读写矩阵"。
- 修复建议:
  - 不可修至"零成本"。要让读写矩阵可证伪，必须在层1 加一个**部门身份→字段权限**的强制层：要么 (a) Hook 在 PreToolUse 拦截 Write 工具、按当前激活部门（如何判定？SKILL.md 加载无运行时标记）校验目标路径；要么 (b) 把读写矩阵下沉成 init-state.js 校验的 schema 约束。两者都**破坏 β 的"skill 配置成本=0"前提**。β 的"成本=0"是把强制力的负担转嫁给了"Claude 自觉读协议"——这是文档假设，不是工程契约。**判定：β 的核心成本论点崩塌。**

### [B-2] β/α 共通：验证闸全是文档级 grep 断言，"部门激活时确实读了协议/总则"这种行为级承诺无法可证伪测试

- 方案: β / α（共通）
- 严重度: CRITICAL
- 证据:
  - β §3.1.3 plan 流程 L250「1. 读 hcc-protocol.md §1（协作总则）+ state-schema.md（state 字段语义）」——这是**流程步骤描述**，不是可执行断言。
  - α §1.3 加载关系 L96-106「部门激活 → Read hcc-decision/SKILL.md → 内含引用块 → Read hcc-org/SKILL.md」——同样是**流程描述**。
  - α §10.2 致命弱点#2 L651 自承「部门 SKILL.md 依赖总则（加载耦合）：部门激活时必须先读总则再读本部门——若总则缺失/损坏，5 部门全瘫」——**承认了耦合是单点风险，但没给可证伪的验证**。
  - **层1/层2 实证对照**：cc-runtime 有 4 个 `.test.js`（init-state/shift-direction/compact-snapshot-e2e）+ venture-pipeline 有 7 个 `.test.js`（load-graph/pipeline-state/advance-node/resolve-hg/venture-resume/dag-placeholder/persona-signal）= **18 个可执行测试**。两个已闭合层的验证闸是 `node xxx.test.js` 跑绿，不是 grep markdown。
- 影响:
  - 任务给的示例断言 `grep -q 'hcc-protocol' hcc-{dept}/SKILL.md` 只能验证**文件里有这个字符串**，不能验证**Claude 运行时真的加载并遵守了它**。这等于"测试代码里有 `import foo`"但从不验证"foo 被调用时行为正确"。
  - 更严重：**Claude Code 的 Skill 加载机制本身不暴露"哪个 SKILL.md 被加载了"的可观测信号**。Skill 是按 frontmatter trigger 匹配 + 编排者决策加载的，没有 hook 输出"已加载 hcc-decision/SKILL.md"。所以"部门激活时读了协议"这个承诺**在当前 Claude Code 运行时架构下根本无法测**——不是测试写得不够，是**没有可观测点**。
  - α §10.2 #2 的"总则损坏 5 部门全瘫"风险：如何验证总则没损坏？markdown 文件没有 schema 校验、没有签名、没有版本哈希。一次手抖编辑就能让 5 部门静默引用到错误总则，且**无任何测试在 commit 前拦截**。
- 修复建议:
  - 部分可修：在层3 cc-venture 装配时（α §5.3、β §5.2 都说装配留层3）加一个"部门 SKILL.md 引用完整性"的预检脚本——遍历 hcc-{dept}/SKILL.md 的引用块，断言被引用文件存在 + 被引用章节锚点存在。这是**可证伪的文档级测试**（grep + 文件存在性），能覆盖"引用断裂"但不覆盖"运行时遵守"。
  - 不可修部分："运行时 Claude 真的按协议办事"——这是 LLM 行为，不是确定性代码，**本质上不可单元测试**。只能靠层3 端到端跑一个完整 venture 节点观察产物。两个方案都把这个验证**推迟到层3**（α §5.1、β §5.2 映射不装配），等于**本层交付的是一个无法自证的协议骨架**。**判定：两个方案的"验证闸"在实现+测试视角下都不达标——它们验证的是"文档写对了"，不是"系统跑对了"。**

### [B-3] α 总则架构单点（RACI 总表 bug 5 部门全错）无任何自动化修复/一致性检测机制

- 方案: α
- 严重度: MAJOR
- 证据:
  - α §10.2 致命弱点#3 L651-652 自承「**总则成为单点**：所有部门引用同一总则——总则有 bug（如 RACI 总表某格错），5 部门全错。**对冲**：总则修订经决策部 review（cc-2pp 对抗验证），且 references/ 深度参考分离（总则精简易审）」
  - α §2.2 RACI 总表 L166-180：10 节点 × 5 部门 = 50 格 RACI，分散在 hcc-org/SKILL.md §2（精简）+ references/racii-matrix.md（完整）**两处**。
  - α §4.1 字段级权限矩阵 L364-376：11 个 state 字段 × 5 部门 = 55 格权限，在 hcc-org/SKILL.md §4（精简）+ references/state-access-rules.md（完整）**两处**。
- 影响:
  - α 的"对冲"是**人审**（决策部 cc-2pp 对抗验证）——这是流程承诺，不是测试。cc-2pp 对抗验证攻击的是"方案设计 ROI"，不是"RACI 总表第3行第4列的 R 是否应该是 A"这种格级一致性。
  - **真正的测试缺失**：α 没有提供任何机制验证"总则 §2 精简表 与 references/raci-matrix.md 完整表 一致"。这两处是手写 markdown，一处改了另一处忘了是**必然漂移**（α 自己在 §7.1 L528 驳 γ 时引用 Ruh 反模式#2「边界不清致 duplicate work + gaps」——**α 自己的两处 RACI 就是 duplicate work 的温床**）。
  - 可证伪测试缺口：可以写一个脚本解析两处 RACI 表，断言精简表每格 == 完整表对应格——但 α 方案**没有规划这个测试**（§9.3 验证复杂度明细 L613-622 列了 8 项验证，全是人审 walkthrough，无一项是可执行断言）。
  - 5 部门引用一致性：α §3.x 每个部门 §0 引用总则，但"部门 SKILL.md 漏引用总则某条"——**静默不一致，无报错**。grep 能查"hcc-org" 字符串存在，查不了"引用了 §1-§5 全部 5 节"。
- 修复建议:
  - 可修：加一个 `raci-consistency.test.js`——解析 hcc-org/SKILL.md §2 表 + references/raci-matrix.md 表，逐格断言一致；解析 5 个 hcc-{dept}/SKILL.md §0 引用块，断言引用了总则所有必读章节。这是**可证伪测试**，能覆盖"RACI 漂移"+"引用遗漏"。
  - 但 α 方案**没规划这个测试**，且 §9.2 把验证复杂度标"低-中"、依赖风险标"0"——**低估了单点风险的可证伪验证成本**。若按实现+测试视角补齐，α 的验证复杂度应升为"高"（需写 2-3 个一致性测试脚本），§9.4 度量对比的"α 长期维护成本最低"结论需重新评估。**判定：α 的单点风险有解但方案未纳入，落地后会以"RACI 静默漂移"形式爆发。**

### [B-4] α 总则 state 读写规则 与 cc-runtime state-schema.md 边界模糊，两处都讲 state 读写，冲突时无强制优先级

- 方案: α
- 严重度: MAJOR
- 证据:
  - α §10.2 致命弱点#5 L653 自承「**与 cc-runtime 边界模糊风险**：运维部（hcc-ops/）引用 cc-runtime 脚本，hcc-org/ 总则 §4 state 读写规则与 cc-runtime/references/state-schema.md 内容部分重叠——可能重复或漂移。**对冲**：hcc-org §4 只定义"部门权限矩阵"（谁读谁写），cc-runtime state-schema 定义"字段 schema"（字段是什么）——维度不同，引用不复制」
  - α §4.1 L364-376 字段级权限矩阵：明确写了「direction.current_version | 读+触发换向(经shift) | ...」这种**读写语义**
  - **层1 实证反证**：`cc-runtime/references/state-schema.md` §2（未读全文但从 §7.3 L300「init-state.js 补默认值」+ §8 L307「init-state.js 严格照此」推断）本身就含字段读写规则——init-state.js 写默认值、H2/H4/H5 Hook 写运行时值，**这些写者规则在 state-schema 里已经定义**（否则 init-state.js 不知道写什么）。
- 影响:
  - α 的"对冲"（维度不同：权限矩阵 vs 字段 schema）在纸面上成立，但**落地时会冲突**。例：state-schema 定义 checkpoint.continue_from 的写者是 H4 Stop/H5 PreCompact（层1 Hook）；α §4.1 L369 写「checkpoint.continue_from | 读（续跑）| 读 | 读 | 读+监管 | 读 | H4/H5」——**运维部"监管"是什么权限？**是读还是写？state-schema 里 checkpoint.continue_from 的写者只有 H4/H5，没有"运维部"。α §4.1 给运维部标"读+监管"——这个"监管"若是读，与 state-schema 不冲突；若是"发现异常时调 cc-runtime 脚本修复"（α §3.4 §4 L318「异常→告警决策部 + 修复（调 cc-runtime 脚本）」），那运维部通过脚本间接写——**这条间接写路径在 state-schema 里没有定义**。
  - 冲突仲裁：当 α §4.1 说"运维部可经脚本修复 checkpoint"而 state-schema 说"checkpoint 唯一写者 H4/H5"——**谁优先？** α 没有声明优先级。两份都是 markdown，运行时 Claude 读到冲突规则时**行为未定义**。
  - 可证伪测试：**无法测**。"两份文档不冲突"是语义判断，没有确定的比对算法（"监管"是否等于"写"需要语义理解）。最多 grep 双份文档的关键词重叠度，但重叠≠冲突。
- 修复建议:
  - 唯一彻底修复：**α §4 不要重复定义 state 读写**，改为「state 字段 schema + 写者规则**全部引用** cc-runtime/references/state-schema.md §2-§8，hcc-org §4 只定义"部门→字段"的 RACI 归属（这个部门对这个字段是 R 还是 I）」。即 α §4 退化为 RACI 矩阵的子表，不碰读写语义。
  - 但 α §4.1 L364-376 现在的写法是**读写语义 + 部门归属混在一张表**——这是设计缺陷。修了之后 α §4 内容缩减约 60%，α §2.2 总则的"state 读写规则"卖点弱化。**判定：α 的 §4 设计与 cc-runtime 有真实重叠风险，"对冲"不成立，需重构 §4 为纯 RACI 引用。**

### [B-5] β 运维部职责从"state 保活"扩张到"协议守护"，运维部 SKILL.md 同时 owns 读写矩阵 + 协议变更门，职责过载且与 cc-runtime 工具箱边界混乱

- 方案: β
- 严重度: MAJOR
- 证据:
  - β §3.4.8 L378-379「**β 特殊论点：运维部是 hcc-protocol.md 的天然守护者**：hcc-protocol.md 物理在 cc-runtime/references/，运维部用 cc-runtime 做 R——**运维部天然是协议的维护者**（读写规则变更经运维部审查，类似 state-schema frozen-v1 的变更门，state-schema §7.3）」
  - β §3.4.2 RACI L355-357「cc-runtime：state 四文件 + init-state/shift-direction + compact-snapshot R；cc-config：六层配置 C；cc-context：上下文健康 C」
  - β §10.2 致命弱点#3 L639「**运维部职责扩张**：运维部从"state 保活"扩张到"协议守护"，可能过载。β 反证：运维部本就是 cc-runtime 的 R，hcc-protocol.md 放 cc-runtime/references 是其 references 目录的自然扩展，不算职责扩张——只是文档托管位置」
  - **层1 实证反证**：state-schema §7.3 变更门 L300-301 的执行者是「init-state.js 补默认值 + 重跑 70-requirements」——**是脚本 + 测试套件执行变更门，不是"运维部 agent 审查"**。β 把"脚本驱动的变更门"类比为"运维部 agent 审查协议变更"是**机制错位**。
- 影响:
  - 运维部 SKILL.md 职责叠加：(1) charter §组织架构 原始职责"7×24 保活、state/trace/Hook 维护"（运维部 §3.4.1 L350）+ (2) β §3.4.8 新增"协议守护（读写矩阵变更门）" + (3) β §4.1 运维部对 6 个 state 字段都是"写（Hook）"或"读（监测漂移）"。一个部门 SKILL.md 同时是 state 保活 SOP + 协议变更门 + 字段读写执行者——**加载这份 SKILL.md 的 token 成本和认知负担**远超 β §9.1 标的"~5000-7000 token"。
  - 与 cc-runtime 工具箱边界混乱：运维部"用 cc-runtime 做 R"（§3.4.2），cc-runtime 自己也有 SKILL.md（层1 地基，已存在）。**当运维部 agent 激活时，它读 hcc-ops/SKILL.md 还是 cc-runtime/SKILL.md？** 两者职责重叠（都讲 state 保活）。β §1.4 trigger 设计 L88-92 给 hcc-ops 的 trigger 是"hcc 运维部/state 健康巡检/venture 保活"，cc-runtime 的 trigger（未读但层1 已存在）大概率含"state/runtime"——**trigger 竞争风险β 自己在 §1.4 声称"已闭合 explore §5.3"但没给 cc-runtime 现有 trigger 的对照**。
  - 可证伪测试：运维部 SKILL.md 过载程度——可用 token 计数测（写完 hcc-ops/SKILL.md 后 wc token，超阈值告警），但"职责过载导致 Claude 执行时顾此失彼"是行为问题，**不可单元测**。
- 修复建议:
  - 剥离：β §3.4.8 的"协议守护"应**还给机制本身**，不赋给运维部 agent。协议变更门应该是"改 hcc-protocol.md → 跑一个 markdown lint/一致性测试 → 通过才 commit"（类似 state-schema 的 init-state.js + 70-requirements），**不是"运维部 agent 审查"**。运维部 agent 的职责退回 charter 原始定义"state 保活"。
  - β §3.4.8 删除或改写为「hcc-protocol.md 的变更门 = 文档一致性测试（层3 补），不由运维部 agent 守护」。这削弱了 β §10.1 优势#6「运维部天然守护协议」的卖点——但那个卖点本身是**把文档治理责任塞给 LLM agent**，工程上不靠谱。**判定：β 的"运维部守护协议"是责任错配，应剥离为机制驱动。**

### [B-6] β/α 共通：7×24 自主运行的断点续传鲁棒性未验证——方案假设"Skill 无状态每次从磁盘读"但未测 compact 后部门激活上下文恢复

- 方案: β / α（共通）
- 严重度: MAJOR
- 证据:
  - β §11.5 L691「7×24 单机 = B（会话级断点续传）：复用层1 checkpoint/direction/trace（state-schema §0），不新增」
  - α §11.7 L731「7×24 单机 = B：会话级断点续传：α 依赖层1 checkpoint/direction/trace（已就绪），部门协议层无新增状态文件」
  - **层1 实证**：cc-runtime 有 `compact-snapshot-e2e.test.js`（compact 抢救 e2e 测试）+ state-schema §0 四文件含 checkpoint.continue_from（续跑锚点）。层1 的断点续传**测的是 state 四文件恢复**，不是"部门 SKILL.md 加载状态恢复"。
- 影响:
  - 核心未测假设：两个方案都说"部门协议层无新增状态文件，复用层1 断点续传"。但层1 的 checkpoint.continue_from 恢复的是**节点级**位置（current_node + current_task），不是**部门激活级**位置。例：compact 发生在 N6 产品化阶段，产品部 agent 正在 plan 第 2 轮——compact 后恢复时，checkpoint 指向 N6，但**"产品部 plan 第 2 轮的中间思考、已读的 N4 原型 handoff、已起草的 plan 片段"全在 Claude 上下文里，compact 后丢失**。恢复后的 Claude 重新加载 hcc-product/SKILL.md，从头读协议 + 从 artifacts 读已落盘的 plan 草稿——**但 artifacts 里若没落盘中间态（plan 还在上下文没写文件），则丢失**。
  - β §3.2.3 产品部 plan 流程 L285-289 + α §3.2 产品部 §3 L275 都说"产出落盘 .venture/artifacts/..."——**只在 plan 完成时落盘**，plan 进行中的中间态无持久化。compact 撞上 plan 进行中 = 中间态丢失 = 重来。
  - 可证伪测试缺口：可以写一个 e2e——启动部门 plan → 模拟 compact（清上下文）→ 恢复 → 断言 plan 能从中断点继续而非从头。但两个方案**都没规划这个测试**（都声称"复用层1 断点续传"就把锅甩给层1，而层1 测的是 state 不是部门中间态）。
  - "Skill 无状态每次从磁盘读"假设：这个假设**只在 SKILL.md 层面成立**（markdown 文件无状态），但**部门 agent 的 plan/review 工作产物有状态**（在 Claude 上下文或 artifacts）。两个方案混淆了"SKILL.md 无状态"和"部门工作无状态"。
- 修复建议:
  - 可修：规定部门 plan 进行中**每轮迭代都落盘中间态**到 artifacts（如 N3-decision-plan-draft-iter{N}.md），compact 后恢复时读最新 draft 继续。但这**增加 token 成本**（每轮多一次 Write）和 artifacts 膨胀——与 β §4.4「不灌完整 trace」的 token 节省目标拉扯。
  - 或：限制 plan 必须在单次 Claude 会话内完成（不分轮），compact 只在节点边界发生——但这与 7×24 长循环矛盾（长循环必然跨 compact）。
  - 两个方案都**未正视这个矛盾**，都假设层1 断点续传够用。**判定：7×24 断点续传在部门工作产物中间态层面有未测漏洞，两个方案都需补"部门中间态持久化"协议，否则 compact 撞 plan 进行中 = 静默丢工作。**

### [B-7] β/α 共通：部门 plan→review 双能力的回环防护，max_iteration 上限存在但"驳回→重 plan"的迭代计数器无明确写者，可能不累加导致死循环

- 方案: β / α（共通）
- 严重度: MAJOR
- 证据:
  - β §6.1 L495「回环闸 | checkpoint.guardrails.max_iteration | 默认 10 | plan→review→驳回→重 plan 达上限 → 强制收敛」
  - β §6.2 L502「plan→review 回环计数 → 映射 iteration（节点内迭代）+ max_iteration 上限」
  - α §6.2 L493「闸 2 max_iteration：plan→review 驳回回环上限（决策部监管）。某节点 plan 被 review 驳回次数达 max_iteration → 决策部 force converge」
  - **层1 实证**：state-schema §8 L323 init 默认值「"guardrails": { "max_iteration": 10, ... }」+ §1.3（未读但 β §6.2 L503 引用）health 状态机含 stagnation_count。但 **iteration 字段的写者**——state-schema §2.2（β §6.2 L501 引用「H2 PostToolUse 自动累加，state-schema §2.2 tokensUsed」）说明 tokensUsed 是 H2 累加，但 **iteration 计数器谁累加？**
- 影响:
  - iteration 写者模糊：tokensUsed 是 H2 PostToolUse 每次工具调用自动累加（机械的、确定的）；但 **plan→review 回环的 iteration** 是"一次驳回 = +1"——**谁来判定"一次驳回发生了"并 +1？** H2 PostToolUse 不知道语义层面的"驳回"，它只知道工具调用。iteration 的累加需要一个**语义判定者**（决策部 review 后判定驳回 → 写 iteration+1），但**这个写动作经不经过层1 Hook？** 两个方案都没说。
  - 若 iteration 由决策部 agent 直接 fs.write checkpoint.json → **违反 C1 写入隔离**（checkpoint 写者应是 H4/H5 Hook）。若 iteration 由某个 Hook 累加 → **该 Hook 如何识别"驳回事件"？** 没有定义。
  - 死循环风险：若 iteration 不累加（因为没明确写者），则 max_iteration 永远不达上限 → plan→review→驳回→重 plan **无限循环**，直到 budget_tokens_cap 触发（β 默认 500k token）。500k token 的死循环 = **真金白银的 token 浪费 + 7×24 卡死**。budget_tokens_cap 是兜底但代价高昂（β §6.3 L516「强制收敛或上报 HG」——上报 HG 要 boss 介入，7×24 自主运行中断）。
  - 可证伪测试缺口：可写测试模拟"plan 被 review 驳回 10 次"，断言第 11 次触发 force converge——但**需要先明确 iteration 写者**。两个方案都没明确，测试无从写起。
- 修复建议:
  - 必须明确 iteration 写者：建议「决策部 review 产出驳回意见 → 落盘 review 文件（带 `verdict: reject` + `iter: N`）→ 一个层1 Hook（如 H2 PostToolUse 识别 review 文件写入）读 verdict=reject → 累加 checkpoint.iteration」。这需要**新增 Hook 逻辑识别驳回事件**——破坏 β "skill 配置成本=0"（与 B-1 同源问题）。
  - 或退而求其次：max_iteration 改为**节点内 plan 文件的 iter 编号**（α §4.2 L387「iter = 节点内迭代轮次」）——决策部 review 时读 plan 文件名 iter 编号判定是否达上限。这是**文档级可测**（grep artifacts 目录下同节点 plan 文件数），但要求每轮 plan 严格按命名落盘（强制）。
  - 两个方案都没给 iteration 写者的明确答案，**回环防护在实现层面有空洞**。**判定：max_iteration 作为护栏存在但累加机制未定义，死循环风险真实，需补 iteration 写者契约。**

---

## 总结

### β 能否存活

**判定：有条件存活，但核心成本论点（B-1）崩塌，需重构"skill 配置成本=0"的声明。**

- β 的最大卖点"5 独立 + 协议下沉层1 + 成本=0"在实现+测试视角下**站不住**：
  - B-1 证明 hcc-protocol.md 无脚本感知，读写矩阵无运行时强制，"成本=0"是把强制力转嫁给"Claude 自觉读协议"——这是文档假设非工程契约。要让读写矩阵可证伪，必须加 Hook 拦截或 schema 下沉，**成本>0**。
  - B-2 证明"部门激活时读了协议"在当前 Claude Code 运行时**无可观测点**，行为级承诺不可测。
  - B-5 证明"运维部守护协议"是责任错配（LLM agent 守文档治理不靠谱），应剥离为机制驱动。
- β 可存活的部分：目录结构（5 独立）、DRY 论证（共享抽层1）、trigger 设计——这些是文档级可 grep 验证的，能落地。
- **β 若要真正可证伪验证，需在层1 加协议感知机制（Hook 或 schema），这破坏"成本=0"——β 需诚实承认成本>0 并规划验证测试，否则交付的是不可自证的文档骨架。**

### α 能否存活

**判定：有条件存活，但单点风险（B-3）和边界模糊（B-4）需重构，验证复杂度被低估。**

- α 的"集中放置 DRY + charter 原意"在文档层面成立，但实现+测试视角下：
  - B-3 证明总则单点（RACI/读写矩阵 bug 5 部门全错）**无自动化一致性检测**，α 的"对冲"是人审（cc-2pp 攻击的是设计 ROI 不是格级一致性），RACI 漂移必然发生。需补一致性测试脚本。
  - B-4 证明 α §4 state 读写规则与 cc-runtime state-schema **有真实重叠**（运维部"监管"权限在 state-schema 里无定义），"维度不同"对冲不成立，需重构 §4 为纯 RACI 引用。
  - B-3/B-4 修复后 α §9.2 验证复杂度应从"低-中"升为"高"（需写 2-3 个一致性测试），§9.4 "α 长期维护成本最低"结论需重评。
- α 可存活的部分：hcc-org/ 宪法 + 部门引用的 DRY 结构、charter 对齐、缺口占位——文档级可验证。
- **α 若要真正可证伪，需补 RACI 一致性测试 + 重构 §4 消除与 state-schema 重叠，验证复杂度被低估的问题需在裁决时纳入。**

### 实现视角下哪个验证闸更不靠谱

**结论：β 的"skill 配置成本=0"（B-1）是最不靠谱的验证闸——它不是"验证闸不够"，是"根本无闸"。**

- α 的验证闸虽然多是文档级（B-2/B-3），但**至少有可补的路径**（加一致性测试脚本、重构 §4 引用）——补了之后可证伪。
- β 的 B-1 是**结构性缺陷**：协议与 state 的绑定（direction_version/trace 引用/读写矩阵）若无层1 脚本感知，则**任何"部门遵守协议"的承诺都无运行时验证手段**——补 Hook 拦截会破坏"成本=0"，不补则承诺悬空。β 把自己锁死在"成本=0"的营销话术里，**反而堵死了补验证机制的退路**。
- 共通的 B-6（断点续传中间态）和 B-7（iteration 写者）两个方案都有，但**α 因为有明确的"总则单一写者"结构，补 iteration 写者契约时改动局部（总则 §5 + 一个 Hook）；β 因为协议分散在 cc-runtime references + 5 部门 SKILL.md 各引用，补 iteration 写者需协调更多文件**——集中结构在补漏时反而占优。

**实现+测试视角的最终倾向：α 略优于 β**——不是因为 α 设计更好，而是因为 α 的缺陷（B-3/B-4）有明确的可补测试路径（一致性脚本 + §4 重构），而 β 的核心缺陷（B-1）与它的卖点（成本=0）互斥，补了就背叛卖点，不补则不可证伪。但**两者都需在裁决前补齐验证机制规划**，否则交付的是"看起来好但测不了"的文档骨架，违背 charter P3「世界最好」和 cc-goal 可证伪性原则。
