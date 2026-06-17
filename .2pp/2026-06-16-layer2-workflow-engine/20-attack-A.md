---
run: 2026-06-16-layer2-workflow-engine
phase: 2
artifact: attack
attacker: A
perspective: 架构（外部视角）
stance: 推翻 β 和 γ，找致命缺陷让方案活不下来
effort: max
targets:
  - 10-plan-beta.md（β 平衡派：四原语 + 每 stage 一 loop + dag.json 驱动）
  - 10-plan-gamma.md（γ 创新派：六原语 + tick 推进 + Kahn 拓扑序 + evalEdge 受限 JS）
created: 2026-06-17
---

# 攻击者 A 报告（架构视角）

> **使命**：我不是中立评审。我要找致命缺陷让 β 和 γ **活不下来**。每个攻击点引用方案原文或层1 契约事实，不编造 API 或版本。effort=max：诚实自曝，不省步骤，不讨好附和。

---

## 攻击点列表

### [β-1] F2 双写竞态没有被消除，只是被换了个位置——β 的"顺序写 + INV-8 兜底"在崩溃窗口下无法保证一致性

- **严重度**: CRITICAL
- **证据**:
  - β §12.1 F2 自承认："HG 进入时层2 同时写 pipeline-state（骨架）和 direction.status（经 skill），两文件写非原子"，残余风险："极端情况（写 pipeline-state 后崩溃）direction 未更新，INV-8 失败需手动修复"。
  - β §4.4 第 3 步明确顺序：先写 `pipeline-state.awaiting_human`，再"经 skill 调 direction 字段更新（status:awaiting_human, gate:HG1）"——两个独立文件，两次独立原子写（M4 rename 只保证**单文件**原子）。
  - β §7.1 INV-8 要求："`pipeline-state.status == "awaiting_human"` ⟺ `direction.status == "awaiting_human"` 且 `direction.gate == pipeline-state.awaiting_human.gate`"——这是一个**双文件等价不变量**，但层1 frozen-v1 没有任何"联合原子写"原语（state-schema.md §5 direction.set 只保证 direction/checkpoint/tasks.tree **同一次脚本调用内**写，且那是 shift-direction.js 内部三件套，pipeline-state 是 β 新增的第四文件，**不在 shift-direction.js 的写范围内**）。
- **影响**:
  1. **崩溃窗口**：写完 pipeline-state.json、尚未写 direction.json 时进程崩溃（compact / 断电 / Claude 会话被杀）→ 重启后读到 `pipeline-state.status=awaiting_human` 但 `direction.status` 仍是旧值（running）。INV-8 等价被打破。
  2. **β 自己的兜底不成立**：β 说"INV-8 校验兜底"——但 INV-8 是**事后校验**，不是**事中保护**。校验失败后状态已经不一致，β 没提供自动修复路径，只说"需手动修复"。对一个 7×24 无人值守的 charter（charter §部署约束）来说，"手动修复 awaiting_human 不一致"=引擎卡死。
  3. **更阴险的反向窗口**：恢复时（§4.4 boss continue）顺序是 skill 调 direction status:active → 骨架清 awaiting_human。如果 direction 先写成 active 但 pipeline-state 尚未清，loop 驱动器下一 tick 读到 direction.status=active（继续推进）但 pipeline-state.current_node 仍指向 HG1（还没切到 N4）→ **loop 在错误节点上推进**，产生脏 trace。
  4. **顺序约定是口头契约**：β 写"顺序写：先 pipeline-state 再 direction"，但这个顺序只活在文档里，没有代码强制。任何后续 Claude 维护者（charter 单 Claude）在改骨架时都可能调换顺序——口头不变量在单维护者长期演进中几乎必然被破坏。
- **修复建议**:
  - 要么真消除竞态：把 direction.status/gate 的 HG 更新**合并进 shift-direction.js 的事务**（即 direction.update-status 不是"微调字段"而是走 INV-1 同一原子批次），让 pipeline-state.awaiting_human 在同一批 rename 内写。但这要求 shift-direction.js 知道 pipeline-state——破坏 β 自己的"层2 独占写 pipeline-state"职责切分（§6.2）。
  - 要么承认竞态无法在文件层消除，改用**恢复时幂等重建**：启动时以 direction.status 为权威，pipeline-state.awaiting_human 由 direction 反推重建。但这又让 pipeline-state 退化为 direction 的缓存，削弱 β "解耦"卖点。
  - **结论：β 的双文件协同是结构性缺陷，不是 F2 一个风险条目能兜住的。**

---

### [β-2] dag.json 驱动是伪通用——转移函数"查表"是真的，但 stage 划分 + HG 字段语义 + loop_back 收敛判据全是 cc-venture 专属硬编码

- **严重度**: MAJOR
- **证据**:
  - β §5.3 transition 函数看起来纯查表：`edges.filter(e => e.from === currentNode)`——这部分**确实**数据驱动。
  - 但 β §2.2 schema 里 `current_stage` 枚举写死成 `"pre_hg1" | "judge" | "post_hg2"`——**这三个 stage 名是 cc-venture 专属**（HG1/HG2 是 cc-venture 的两个人工门）。换流水线（β 自己 §5.2 列了 thesis-pipeline.json / repo-analysis.json）若没有恰好两个 HG，stage 枚举要么失效要么得改 schema。
  - β §9.1 dag-definition 里 HG 的 `on_decision` 字段值是字符串动作（`"advance_to(N4)"` / `"call direction.set"`）——这是**动作 DSL**，不是数据。骨架要解析这些字符串动作并分派，换流水线时 N4 这种节点 id 是 cc-venture 专属，新流水线的动作字符串里会出现自己的节点 id，骨架的 action parser 必须理解每种动作语义。这是把硬编码从"转移表"挪到了"动作 DSL 解析器"。
  - β §9.1 loop_back 的 `convergence_check: "persona_segment_unchanged_between_iter"` 是**业务语义字符串**——骨架要把它映射成实际的 segment 比较。换流水线的回环（如论文"文献综述⇄研究方法"互锁）收敛判据不同，骨架要么写死 persona 专属逻辑，要么再引入一个判据 DSL。β §12.2 M1 自己承认"收敛判据定义模糊"。
  - β §3.2 human_gate 原语有 `panel_builder_skill` 字段 + `verbs` 写死 `["continue","shift","abandon"]`——charter P1 三动词是 cc-venture 语义，换流水线的 gate（如论文"开题答辩 gate"）动词可能不同（通过/修改/驳回）。
- **影响**:
  1. β 反复宣称的"换流水线只换 dag-definition json，骨架零修改"（§5.3、§8.B、附录 A）**只在转移拓扑层成立**。一旦涉及 stage 划分、HG 动作、回环收敛判据、gate 动词——全是 cc-venture 专属假设渗进骨架。
  2. 这正是 α 派批评 β 的点（β §1 主动批评锚点），但 β 没真正回应，只是把硬编码从转移表挪到 DSL/枚举/判据里。**"伪通用"指控成立**。
- **修复建议**:
  - 要么诚实降级：β 承认"通用骨架"= 通用**转移拓扑**，stage/HG 动作/收敛判据是流水线专属插件，每条流水线自带 plugin.js。这放弃"零改代码"卖点。
  - 要么把所有专属语义抬到 dag.json 的纯数据声明（stage 名可配置、动作用回调 id 注册、判据用可插拔函数表），但这会让 dag.json 变成图灵完备配置——重蹈 γ evalEdge 的复杂度（见 γ 攻击点）。

---

### [β-3] "每 stage 一 loop"把同一个 DAG 人为切成三段，引入 stage 交接的额外不变量负担，且与 N6⇄N7 回环的 loop_back 原语职责重叠

- **严重度**: MAJOR
- **证据**:
  - β §4.1 三 stage 划分：Stage A (N1-N3) / Stage B (N4) / Stage C (N5-N8)，HG1/HG2 之间"无 loop"。但 N6⇄N7 是**跨节点回环**，发生在 Stage C 内部——由 `loop_back` 原语 + `loop_back_state` 字段处理（§2.2、§9.3）。
  - 同时 β §4.1 每个 stage 自带一个 loop（venture-loop-pre-hg1 / venture-loop-judge / venture-loop-post-hg2），每个 loop 套独立循环合同（BUDGET/max_iteration）。即 Stage C 的 venture-loop-post-hg2 **外层有一个 loop**，N6⇄N7 **内层有一个 loop_back**——两层循环嵌套。
  - β §4.2 Stage A loop 的 ACTION 第 5 步："skill 调 exit_check → 通过 → 调骨架 transition"——loop 的推进依赖骨架 transition。但 stage 切换（current_stage: pre_hg1 → judge）发生在 HG 恢复时（§4.4 恢复第 3 步："current_stage="judge" + 触发 Stage B loop 启动"）。**stage 切换是隐式状态机**，不在 transition 函数里，而在 venture-resume skill 里。
- **影响**:
  1. **两层循环护栏冲突**：Stage C loop 有自己的 max_iteration 护栏（cc-loop 三件套），N6⇄N7 loop_back 有自己的 max_iter=3（M2）。当 N6⇄N7 跑到第 3 轮强制收敛时，是触发内层 loop_back 的 on_max_iter 还是外层 Stage C loop 的 max_iteration？β §9.3 没说清两层护栏的优先级。若外层先撞顶，内层收敛逻辑被截断；若内层先撞顶，外层 budget 还没用完但 loop_back 已退出——**两套循环合同相互踩踏**。
  2. **stage 边界是人为的**：为什么 Stage B 只有 N4 一个节点还要单独一个 loop？β §4.1 理由"HG 决策是 stage 边界天然断点"——但 N4 之后就是 HG2，Stage B 的 venture-loop-judge 实际只跑一个节点就进 HG2 停等，这个 loop 几乎是空壳。维护一个只跑一节点的 loop = 浪费 PROMPT.md 锚文件（β 自己 §4.1 批评 γ"8 loop 维护爆炸"，但 3 loop 里有一个是空壳，β 没自省）。
  3. **stage 切换的不变量没定义**：β §2.2 有 current_stage 字段，但 §7 INV-7/8/9 里**没有** "current_stage 转移合法性"不变量。stage 从 pre_hg1 跳到 post_hg2（跳过 judge）不会被 INV 拦截——骨架若 bug 写错 stage，无校验兜底。
- **修复建议**:
  - 砍掉 Stage B 空壳 loop，Stage A/C 两段足够；或者干脆放弃"每 stage 一 loop"，回到"整条流水线一 loop + HG 期间 loop 内停等"（即 β 批评的 α 方案）。β 的中道在这里是伪中道。
  - 明确两层循环护栏优先级：内层 loop_back 优先，外层 stage loop 的 budget 不计入内层回环迭代（否则 budget 双重计算）。

---

### [β-4] INV-7/8/9 + 四原语 + 三 stage + loop_back_state = 不变量数量膨胀，单 Claude 维护者认知负荷超 charter 单机约束

- **严重度**: MINOR（累积成 MAJOR）
- **证据**:
  - β §7.1 一次新增 INV-7（拓扑合法性）/ INV-8（HG 双文件等价）/ INV-9（回环收敛单调），加上扩展的 INV-1，层2 引入 **4 个新不变量**。
  - β §2.2 pipeline-state 字段 13 个（schema_version/pipeline_version/direction_version/pipeline_id/current_node/current_stage/iteration/status/completed_nodes/progress_percent/awaiting_human/loop_back_state/pending_transitions + 审计字段）。
  - β §3.2 四原语 schema 字段：node 6 字段、edge 4 字段、human_gate 7 字段、loop_back 7 字段。
- **影响**: charter 单 Claude 约束下，维护者是同一个 Claude。每次改骨架要同时心算 4 个 INV + 13 个 state 字段 + 4 原语 schema + 3 stage 枚举 + 两层循环护栏。β §1 批评 γ"维护成本爆炸"，但 β 自己的不变量面并不小——只是比 γ 小一档。**"中道"在认知负荷上没有质的区别，只有量的折扣**。debug 时一个 INV-8 违反可能牵出 direction/pipeline-state/venture-resume skill 三个写入点，定位成本不低。
- **修复建议**: 接受这是结构复杂度的必然，但 β 应明确给出 INV 违反时的**精确诊断输出**（哪个文件哪个字段违反哪个 INV），而非"需手动修复"。否则单 Claude 维护者在 7×24 运行中排障成本失控。

---

### [γ-1] R-γ1 自承认过度设计，但辩护逻辑链条全部建立在"未来一定有第二个 DAG instance"的未验证假设上——YAGNI 违反，且 effort=max ≠ 造未验证特性

- **严重度**: CRITICAL
- **证据**:
  - γ §12.1 诚实自评："γ 派的六原语引擎对首发只跑 cc-venture 一条线性 DAG 的场景，确实过度设计——subgraph/fan_out 首发 reserved 不用，却要写它们的单测和递归/屏障逻辑（~12k token + 4 轮）"。
  - γ §12.1 辩护理由 1："若未来加任何并行（charter『多头注意力，并行合作』+ hcc 5 部门天然有并行需求）或嵌套（N4 judge 红蓝队对抗，50-decision M1 已要求）"——**两个"未来需求"都是假设**：charter"多头注意力"是否一定落到 DAG 级 fan_out（而非节点内 Subagent）？未论证。50-decision M1 红蓝队对抗**当前就要求**，但 γ §9.1 N4 节点自己注释"M1 红队对抗：可用 subgraph 展开（红蓝队），首发简化为单节点"——**首发连 M1 都没用 subgraph**，subgraph 是 reserved。
  - γ §12.1 ROI 拷问的退路："但如果对抗验证证明『未来 6 个月不会有第二个 DAG instance / 不会有并行需求』，则 γ 的 subgraph/fan_out 确实过度 → 应降级为 β 四原语 + 预留扩展点"。
  - 任务约束明确："effort=max ≠ 造用不上的东西——区分『不省步骤』与『造未验证的特性』"。
- **影响**:
  1. **首发验证场景里 subgraph/fan_out 零调用**：γ §9.1 `subgraphs: []` / `fan_outs: []`，M1 红蓝队首发"简化为单节点"。即 γ 花费 ~12k token + 4 轮（§11.1 enterSubgraph ~6k + fanOut ~6k）实现的两个原语，**在首发 cc-venture 端到端验证中完全不被执行**。可证伪点（§8.2）1-4 全部只覆盖 node/edge/gate/loop_back——subgraph/fan_out 的正确性首发**无法验证**。
  2. **"同构扩展"辩护不成立**：γ §12.1 辩护 2 说 subgraph/fan_out 是"同构扩展（同样的 frontier/advance 逻辑）"——但 subgraph 要压栈弹栈（§5.5 enterSubgraph 独立逻辑），fan_out 要屏障 + concurrency_cap + merge_skill（§3.7 独立逻辑）。这与 node/edge 的 frontier 逻辑**不同构**，是两套独立调度。"同构"是话术，不是事实。
  3. **P3"世界最好"维度选择有争议**：γ 选"表达力"作为世界最好维度（§1）。但 charter P3 原文是"世界最好（一维即可）"——"一维"是**限定**（只选一维做到极致），不是"选表达力"。选"可证伪验证完备性"或"单 Claude 可维护性"同样可以是世界最好维度。γ 把 P3 偷换为"必须选表达力"，用 P3 为过度设计背书是循环论证。
  4. **未验证特性进入 frozen-v2 契约**：γ §7 把 subgraph/fan_out 写进 INV-P6（subgraph 无环引用）+ schema 校验。一旦 frozen-v2 落地，这两个原语的 schema 成为层1 契约的一部分，未来要改它们的语义就是改 frozen 契约（major 变更门）。**首发就把未验证的特性钉进冻结契约 = 把技术债固化**。
- **修复建议**:
  - 采纳 γ 自己的退路：首发降级为 β 四原语 + dag.json schema 里 subgraph/fan_out 字段**允许声明但引擎 lazy 报错**（声明即拒绝，提示"未实现"）。等真有第二个 instance 再实现。这保留扩展点，不花 12k token 造未验证代码，不进 frozen INV。
  - 这正是 γ §12.1 退路写的，但 γ 主体方案没采用——攻击点成立：γ 主体方案没有兑现自己的退路。

---

### [γ-2] evalEdge 受限 JS 子集求值器 = 自造迷你解释器，与 C2"纯 Node fs"约束存在张力，且边界 case 爆炸

- **严重度**: CRITICAL
- **证据**:
  - γ §3.3："条件求值：`dag-engine.evalEdge(edge, ctx)` 中 `ctx` = 前驱节点的 out_schema 解析结果（jsonld）。条件表达式用受限 JS 子集（`prev_out.field == 'value'` / `in` / 逻辑与或），禁任意代码执行（安全）"。
  - γ §5.1 evalEdge 实现：`return safeEval(edge.condition, ctx);  // 禁任意代码，只允 ==/in/&&/||`。
  - γ §3.3 条件示例：`"prev_out.signal == 'green'"`、`"prev_out.signal in ['yellow','red','unknown']"`。
  - γ §3.5 loop_back 的 converge_pred 也是同类表达式：`"prev_out.persona_unchanged == true || iter >= max_iter"`——**加入了 `>=` 比较和 `iter`/`max_iter` 变量**，比 edge condition 的 `==/in` 更复杂。
  - 任务约束背景："γ=六原语（+subgraph/fan_out）tick 推进运行时，Kahn 拓扑序，evalEdge 受限 JS 求值器"；charter C2 约束（γ §1.2 反复强调"纯 Node fs"）。
  - γ §12.2 R-γ2 自承认："evalEdge 条件求值的受限 JS 子集边界模糊（安全 + 表达力）"，缓解"白名单操作符（==/in/&&/||），禁 eval/Function；单测覆盖"。
- **影响**:
  1. **safeEval 是自造解释器**：白名单操作符听起来简单，但 `prev_out.field` 的字段访问语义、字符串字面量转义、`in` 操作符对数组 vs 对象的不同行为、`&&`/`||` 的短路——每一个都要手写解析。这不是"纯 Node fs"，这是在一个 fs 脚本里**嵌入一个表达式语言**。C2"纯 Node fs"约束的精神是"不引入运行时依赖、可审计"，自造解释器违背这一精神（解释器本身是 ~6k token 的代码，γ §11.1 evalEdge 估算）。
  2. **边界 case 爆炸**：
     - `prev_out.signal` 若 jsonld 里 signal 字段缺失 → `undefined == 'green'` 是 false（JS 语义），但 DAG 设计者可能期望"缺失即 unknown 走 HG2"（missing#7）——求值器语义和业务期望错配。
     - converge_pred 里 `iter >= max_iter` 需要求值器知道 iter/max_iter 是数字、能做 `>=`——但 R-γ2 缓解只列了 `==/in/&&/||`，**没列 `>=`**。要么 converge_pred 用了未白名单的操作符（自相矛盾），要么白名单要扩到比较运算符（边界进一步扩大）。
     - 字符串里有单引号（如 `prev_out.note == 'it's fine'`）→ 解析器要处理转义，白名单操作符列表没覆盖。
  3. **安全性是空话**：γ 说"禁 eval/Function"——但若 safeEval 用 `new Function` 包一层白名单 AST 求值，稍有疏漏（如允许 `constructor` 访问）就是 RCE。单机单 Claude 场景下"表达式注入"威胁不大（dag.json 是自己写的），但"禁任意代码执行"的承诺在自造解释器里**几乎无法保证**——任何图灵完备的求值器都有逃逸路径。这是把一个伪安全承诺写进方案。
  4. **与 β 的对比反而暴露 γ 的问题**：β 的 human_gate.on_decision 用**字符串动作**（advance_to(N4)），也是 mini DSL，但 β 的 DSL 是骨架**内部派发**（不暴露给声明文件作者自由写表达式），攻击面更小。γ 把表达式**下放到 dag.json 作者**（任意 prev_out.field 组合），攻击面和边界 case 都更大。
- **修复建议**:
  - 放弃 evalEdge 自由表达式，改为**结构化条件对象**：`{"op":"eq","field":"signal","value":"green"}` / `{"op":"in","field":"signal","values":[...]}`。JSON 数据声明，无求值器，无注入面，无边界 case。converge_pred 同理用结构化谓词。
  - 这会让 dag.json 稍微啰嗦，但消除 ~6k token 求值器代码 + 消除 R-γ2 风险。γ 的"表达力"维度在结构化条件里依然成立（eq/in/gte/and/or 组合足够覆盖 signal 路由 + 回环收敛）。

---

### [γ-3] 分层 INV（D 系/P 系/X 系）三系交叉耦合，debug 时违反定位需要跨三系溯源，且 INV-X1"换向重置图"与"completed 单调递增"存在语义冲突

- **严重度**: MAJOR
- **证据**:
  - γ §7.1 引入三系：INV-D（方向系，3 条）/ INV-P（图执行系，6 条）/ INV-X（跨层系，3 条）= **共 12 条不变量**（对比 β 的 4 条）。
  - γ §7.1 INV-P1："`pipeline-state.completed[]` 单调递增（除非 direction 换向重置）"。
  - γ §7.1 INV-X1："`direction.current_version` 变化（换向）⟹ `pipeline-state` 重置 frontier + completed 清空"。
  - γ §7.2 graph_version vs direction_version 区分，但 INV-X1 的触发条件是 direction_version 变化，**不是** graph_version 变化。
- **影响**:
  1. **INV-P1 与 INV-X1 的语义张力**：INV-P1 说 completed 单调递增，INV-X1 说换向时 completed 清空。"单调递增除非换向"——但换向是 charter P4 高频创新决策点（charter 根原则），若 boss 频繁 shift（市场验证本就反复），completed 反复清空 → "单调递增"在实际运行中几乎不成立。这条 INV 的"单调"前提被 INV-X1 频繁打破，形同虚设。
  2. **三系交叉 debug**：假设运行时发现 `pipeline-state.current_node` 与 `checkpoint.current_node` 不一致。这违反 INV-P2（P 系）。但根因可能是：direction.set 换向时 INV-X1 没正确重置 pipeline（X 系违反），导致 INV-D1 四文件版本不一致（D 系违反），进而 checkpoint 和 pipeline-state 的 current_node 漂移。**一个现象，三个系都要查**。γ §12.2 R-γ10 自承认"分层 INV 校验复杂度上升，debug 困难"，缓解"每个 INV 独立单测；违反时报具体 INV-ID + 文件 + 字段"——但报 INV-ID 只告诉**症状**（哪个不变量炸了），不告诉**根因**（哪个写入点先错的）。单 Claude 维护者在 12 条 INV 的网里溯源根因，认知负荷远超 β 的 4 条。
  3. **graph_version 的归属模糊**：INV-X2 说 graph_hash 要等于声明文件 hash，但 graph_version 变化时（改声明）是否触发 INV-X1 的"重置 completed"？γ §7.2 说"graph_version 变 → 引擎重载图，但 completed 节点尽量保留（若 hash 兼容）"——"尽量保留""若兼容"是模糊词。graph_version 变化时 completed 到底保不保留，没有硬 INV 约束，留给运行时临时判断。这是**三系之外的灰色地带**，debug 时成为争议源。
- **修复建议**:
  - 砍掉三系分层，回到 β 式扁平 INV（D 系归入原 INV-1/3/4，P 系保留必要的 2-3 条，X 系只保留 INV-X1 一条跨层约束）。12 条 → 5-6 条。
  - 明确 graph_version 变化的硬规则：要么"graph_version 变必然重置 completed"（简单，可能浪费进度），要么"graph_version 变必然保留 completed"（乐观，可能不一致）——禁止"尽量保留"这种模糊语义。

---

### [γ-4] loop tick 算法把"选节点 + dispatch + 执行 + 写回"放在同一个 tick，违反 cc-loop"循环合同 ACTION 单一职责"——tick 内任一步失败导致 frontier 与 in_flight 状态不一致

- **严重度**: MAJOR
- **证据**:
  - γ §4.2 loop_tick 算法 step 4-7：
    ```
    # 4. 选节点
    node = frontier[0]
    # 5. dispatch：经 skill 调 direction.set
    for n in to_dispatch:
        mark_in_flight(n)
        skill_call("direction.set", ...)
    # 6. agent 执行节点
    for n in to_dispatch:
        result = agent_dispatch(skill, ...)
        dag_engine.advance(n, result)
        unmark_in_flight(n)
    ```
  - 即一个 tick 内：选节点 → mark_in_flight → direction.set → agent 执行 → advance 写回 → unmark_in_flight。
  - γ §2.2 in_flight 字段语义："正在执行（agent 已拉起未写回）"。
  - cc-loop 循环合同六要素里 ACTION 是单一动作（loop-guide §二），γ §4.3 自己列出循环合同 SCOPE = "当前 pipeline-state 的 frontier"，ACTION = "上面 loop_tick 算法"——把 6 步塞进一个 ACTION。
- **影响**:
  1. **tick 内崩溃窗口**：step 5 mark_in_flight 完成、direction.set 完成，但 step 6 agent 执行中途崩溃（skill 报错 / compact 触发 / token 超限）→ 节点停留在 in_flight，pipeline-state.completed 没更新，direction.current_node 已指向该节点。下一 tick 读到 in_flight 非空 + frontier 不含该节点（因 status=in_flight 不是 pending）→ γ §4.2 step 3 "frontier 空 → if in_flight: WAKEUP(120) 等在跑节点写回"——但那个节点**永远不会写回**（agent 已死）。loop 在 120s 间隔空转，直到 no_progress 护栏触发 blocked。**整个 DAG 卡死一个幽灵 in_flight 节点**。
  2. **in_flight 清理路径缺失**：γ §4.2 unmark_in_flight 只在 advance 成功后调用，没有"agent 死亡后清理 in_flight"的恢复路径。γ §12 风险登记 R-γ7 提到"compact 后 pipeline-state 与 checkpoint 不同步"，但没提"agent 中途死亡导致 in_flight 悬挂"。这是被遗漏的失败模式。
  3. **direction.set 与 advance 之间窗口**：step 5 direction.set 切到节点 N，step 6 才 advance 写回。若 step 5 和 step 6 之间另一个 tick（ScheduleWakeup 并发？或 boss 手动 /loop）抢跑——两个 tick 都读到 N 在 frontier，都 mark_in_flight，都 direction.set → **同一节点被 dispatch 两次**。γ §4.2 用 in_flight 防重复 dispatch，但 in_flight 是 step 5 才写，step 4 选节点时还没写——两个并发 tick 在 step 4 都选到 N，step 5 都 mark（覆盖），step 6 都 advance（completed 重复 append）。γ §2.3 completed 字段写者"dag-engine.advance"，但没说 advance 是否幂等（重复 append 同一节点）。
- **修复建议**:
  - 拆 tick：一个 tick 只做"选节点 + mark_in_flight + dispatch"，agent 执行结果在**下一个 tick** 写回（advance）。即两阶段 tick（dispatch tick / collect tick）。这消除 tick 内崩溃窗口，但增加 tick 数（延迟）。
  - 或：advance 必须幂等（检查 completed 已含则跳过），in_flight 必须有超时清理（in_flight 节点超过 N tick 未写回 → 强制回滚到 pending）。
  - γ §4.2 当前算法两者都没做，**并发安全 + 崩溃恢复都不成立**。

---

### [γ-5] subgraph 压栈弹栈 + fan_out 屏障 + concurrency_cap 与 worktree SOP 耦合——reserved 特性已经在偷绑单机物理约束，未来实现时必然撞 worktree 资源墙

- **严重度**: MINOR（因为 reserved，但暴露设计耦合）
- **证据**:
  - γ §3.7 fan_out 有 `concurrency_cap: 2`，γ §4.4 解释："并发槽位 ≤ 2（证据：cc-loop worktree SOP『并发槽位 ≤ 2：同时活跃 worktree ≤ 2』）——单机资源约束，超 2 个并行上下文不可控"。
  - γ §3.6 subgraph 有 `frontier_at_entry`（压栈父图 frontier）+ §5.5 enterSubgraph/exitSubgraph 递归。
  - γ §12.2 R-γ9 自承认："fan_out concurrency_cap=2 与 worktree SOP 的物理约束耦合（单机资源）"。
- **影响**:
  1. **fan_out 把 DAG 抽象与 worktree 物理资源绑死**：concurrency_cap=2 是 cc-loop worktree SOP 的约束，但 fan_out 是**图原语**，理论上应独立于运行时。若未来 worktree SOP 改（如支持 4 槽位），fan_out 的 cap 是跟 worktree 还是固定 2？γ §3.7 写死 `"concurrency_cap": 2` 在 dag.json——**图声明里写死了运行时物理约束**，违反层次分离。
  2. **subgraph 递归 + fan_out 屏障 + loop_back 回环三者组合的状态空间**：γ §3.6 subgraph 可嵌套（SG_A 内含 SG_B），§3.5 loop_back 可在子图内，§3.7 fan_out 可在子图内——三者组合时 pipeline-state 要同时维护 subgraph_stack + iter_counters + fan_out_groups + frontier。γ §2.2 这些字段都独立存在，但**组合语义没定义**：子图内的 loop_back 收敛时弹栈到父图，还是留在子图？子图内的 fan_out 屏障未满足时父图能否推进？这些组合 case 首发 reserved 不验证，但 schema 已经允许声明——未来某个 dag.json 作者写出子图内 fan_out 内 loop_back 的组合时，引擎行为未定义。
  3. **虽然首发 reserved，但 schema 已冻结**：γ §9.1 `subgraphs: []` / `fan_outs: []`，但 §3.6/§3.7 的 schema 字段（entry/exit/frontier_at_entry/barrier/merge_strategy/concurrency_cap）已经定稿进 frozen-v2。未来发现组合 case 行为有 bug，改 schema 就是改 frozen 契约。
- **修复建议**:
  - 若 reserved，**连 schema 字段也 lazy**（dag.json 不允许声明 subgraph/fan_out 字段，引擎遇到就报"不支持"）。等真要实现时再定 schema。这避免把未验证的字段钉进 frozen 契约。
  - concurrency_cap 不应写在 dag.json，应是引擎运行时配置（从 worktree SOP 读）。

---

## 总结

### β 能否存活？**勉强存活，但带结构性伤**

**理由**：
- β 的核心伤是 **[β-1] F2 双写竞态**（CRITICAL）。这不是一个可被风险登记表兜住的边缘 case，而是 β 架构的**结构性后果**：pipeline-state 与 direction 分文件 + HG 双文件协同 = 必然存在崩溃窗口。β 的"顺序写 + INV-8 校验兜底"在 7×24 无人值守 charter 下不成立（INV-8 是事后校验，失败后"手动修复"= 卡死）。但这个伤**可修**：要么把 HG 状态更新合并进 shift-direction.js 原子事务（破坏 β 职责切分），要么用启动时幂等重建（削弱解耦卖点）。修完后 β 能活。
- [β-2] 伪通用（MAJOR）是第二重伤：β 的"换流水线零改代码"只在转移拓扑层成立，stage/HG 动作/收敛判据全是 cc-venture 专属渗漏。但 β 可诚实降级为"通用转移拓扑 + 专属语义插件"，仍是有价值的方案。
- [β-3]/[β-4] 是累积复杂度问题，砍 Stage B 空壳 + 明确两层循环护栏优先级可缓解。
- **综合**：β 有 1 个 CRITICAL + 2 个 MAJOR，但都不致命到"必须推倒"，每个都有可行修复路径。β **能存活，但必须在实施前消化 [β-1] 的修复方案**，否则 HG 流转在第一个崩溃窗口就会卡死。

### γ 能否存活？**首发场景下不能存活，应降级为 β + 预留扩展点**

**理由**：
- γ 的核心伤是 **[γ-1] R-γ1 过度设计**（CRITICAL）+ **[γ-2] evalEdge 自造解释器**（CRITICAL）**叠加**。
  - [γ-1]：首发 cc-venture `subgraphs: []` / `fan_outs: []`，γ 花费 ~12k token + 4 轮实现的两个原语**首发零调用、零验证**。可证伪点 1-4 不覆盖 subgraph/fan_out。γ 自己的退路（§12.1）就是降级 β。effort=max 任务约束明确"≠ 造未验证特性"。**γ 主体方案没有兑现自己的退路，这是内部矛盾**。
  - [γ-2]：evalEdge 受限 JS 求值器在 C2"纯 Node fs"约束下是自造解释器，边界 case 爆炸（undefined 字段语义、`>=` 未进白名单、字符串转义），安全承诺（禁 eval）在自造解释器里无法保证。这是 ~6k token 的代码换取一个伪安全、高复杂度的特性。
- [γ-3] 三系 INV 12 条（MAJOR）：debug 复杂度 + INV-P1/INV-X1 语义冲突（completed 单调 vs 换向清空），单 Claude 维护者溯源负担过重。
- [γ-4] loop tick 内 6 步合一（MAJOR）：tick 内崩溃导致 in_flight 幽灵节点卡死整个 DAG，且无清理路径 + 无 advance 幂等 + 无并发抢跑保护。这是**运行时正确性缺陷**，不只是过度设计。
- **综合**：γ 有 2 个 CRITICAL + 2 个 MAJOR + 1 个 MINOR。其中 [γ-1] 和 [γ-2] 都是"首发不该造的东西"——一个是未验证特性（subgraph/fan_out），一个是高风险自造解释器（evalEdge）。γ 的"通用引擎"愿景在第二个 DAG instance 真的到来时可能成立，但**首发场景下，γ 比 β 多花的 ~40k token（114k vs 74k）换来的是两个首发零验证的 CRITICAL 包袱**。
- **判决**：γ **在首发场景下不能存活**。应采纳 γ 自己 §12.1 的退路——降级为 β 四原语 + dag.json schema 预留 subgraph/fan_out 字段位（声明即拒绝），evalEdge 换结构化条件对象。等第二个真实 DAG instance 的需求**被验证**（不是假设）后，再把 subgraph/fan_out 从 lazy 升级为 implemented。这才是 effort=max 的正确兑现：不省步骤（保留扩展点），但不造未验证特性（不花 12k+6k token 写首发不跑的代码）。

### 一句话判决

- **β**：带伤存活，[β-1] 双写竞态必须在实施前修（合并事务或幂等重建），否则 HG 流转第一个崩溃窗口就卡死。
- **γ**：首发不能存活，2 个 CRITICAL 都是"首发不该造的东西"（未验证特性 + 自造解释器），应降级为 β + 预留扩展点——这也是 γ 自己写的退路，主体方案没兑现。
