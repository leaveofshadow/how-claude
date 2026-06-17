---
run: 2026-06-16-layer2-workflow-engine
phase: 2
artifact: attack
faction: B (实现+测试视角 · 攻击者)
targets: [10-plan-beta.md, 10-plan-gamma.md]
author: 攻击者 B agent（实现+测试外部视角）
created: 2026-06-17
stance: 推翻。使命=找致命缺陷让 β/γ 活不下来。重点：落地层、测试可行性、基线层 18/18 兼容性。
evidence_scope: 只读方案 + 层1 实现契约（shift-direction.js / shift-direction.test.js / init-state.js）。
---

# 攻击者 B：实现+测试视角对抗报告

> 视角锚定：实施者 = **Claude Code + 已装载 skills**，不是人类团队。度量用 token / 上下文轮次 / skill 配置成本 / 验证复杂度，禁人天。
>
> 证据基线已核验：
> - 基线层 18 测试 = `shift-direction.test.js` (7) + `init-state.test.js` (8) + `compact-snapshot-e2e.test.js` (~3)，纯 `node:test` 零依赖。
> - `atomicWriteJSON`（init-state.js:34-39）= `writeFileSync(tmp) + renameSync(tmp, filePath)`（Windows MOVEFILE_REPLACE_EXISTING）。**单文件原子，跨文件无事务**。
> - shift-direction.js 当前导出 `{ shiftDirection, archiveDir, copyDirRecursive, parseArgs, resolveRoot }`，`require.main === module` CLI 入口（line 190）。`parseArgs`（line 34-45）只认 5 个 flag。
> - autocompact thrashing 事实已确认：30-score.md:108 + MEMORY/compact-snapshot-hooks.md（BigModel 网关下 claude-mem 失效，自建 PreCompact+SessionStart 抢救，本项目已发生 3 turns 内多次 compact）。

---

## 攻击点列表

### [B-β-1] --update-status 子命令会污染 shift-direction.js 的 CLI 入口和 parseArgs，"只加子命令"不成立

- 严重度: **CRITICAL**
- 证据:
  - 方案 §7.3 第 3 条：「shift-direction.js 扩展：新增 `--update-status` 子命令（HG 进入/退出用，不换向）」。
  - 方案 §5.2 模块结构：「updateDirectionStatus(status, gate) ← 经 skill 调 direction（不换向）」。
  - 方案 §6.1 接口表：「direction.update-status（只改 status/gate，不换向） | shift-direction.js 新增子命令」。
  - 层1 实现事实：`shift-direction.js:34-45` 的 `parseArgs` 是**单一 flat parser**——把 `--reason/--to/--dry-run/--root/--help` 平铺进一个 opts 对象，没有任何「子命令分发」机制。`require.main === module` 块（line 190-208）直接调 `shiftDirection(stateRoot, opts)`，**整个 CLI 假设入口动作永远是"换向"**。
- 影响:
  - 要加 `--update-status` 子命令，必须引入**子命令分发层**（argv[2] 是 `update-status` 而非 `--reason`），这破坏了 parseArgs 的 flat 契约——要么改 parseArgs 签名（破坏现有 7 个 shift-direction.test.js 用例的隐式假设），要么在 main 块加 `if (argv[2]==='update-status')` 分支。
  - 更致命：`shiftDirection` 函数体内（line 87-187）整段假设"业务方向变更"——它构造 `newDirObj.history[].status='superseded'`（line 130-133）、归档旧目录（line 180-184）、升 version（line 105-108）。`--update-status` 是"不换向只改 status/gate"，**根本不能复用 `shiftDirection` 主函数**，必须新写一个 `updateDirectionStatus` 函数 + 新的原子写路径。所谓"扩展而非重写"是粉饰——实际是往一个单职责脚本里塞第二个职责。
  - 一旦塞进去，shift-direction.js 从"单一职责（换向）"退化为"换向 + status 微调"双职责。基线层 7 个测试里有 `--reason 必填`（line 111-116）、`--to 必须 > 当前版本`（line 119-127）——这些断言假设"任何调用都要换向"。update-status 路径若误触这些 guard（比如复用了 shiftDirection 的 reason 校验），回归测试会暴露；若绕开（新函数不校验 reason），则出现**两个 code path 各自有 guard，覆盖率割裂**。
- 修复建议:
  - **证伪手段**：让 β 派先在分支上跑这个实验——给 shift-direction.js 加 update-status 子命令，然后跑 `node --test shift-direction.test.js`。如果需要改 parseArgs 或 main 块的任何一行，"原测试通过"就是假话。
  - 更稳的做法：**新建 `update-direction-status.js` 独立脚本**（不碰 shift-direction.js），β §7.3 第 4 条"基线层 18 测试全部保持通过"才能真正成立。把 update-status 塞进 shift-direction.js 是为了"少一个文件"的伪简洁，代价是污染已闭合的基线层。

---

### [B-β-2] pipeline-state.json 三版本（schema_version/pipeline_version/direction_version）的状态空间在零依赖 node:test 下不可覆盖

- 严重度: **MAJOR**
- 证据:
  - 方案 §2.2 schema 冻结三个版本号：`schema_version`（pipeline-state 自身 schema 版本）、`pipeline_version`（工作流版本）、`direction_version`（引用层1 业务版本）。
  - 方案 §7.2 解耦示例：direction v2 下可有 pipeline v1→abandon→pipeline v2→direction.set→direction v3/pipeline v1。即三个版本号在生命周期内会经历**组合迁移**。
  - 方案 §11.1 工作量：「单测：转移函数/gate 触发/回环条件各 3+ 用例」+「新增 pipeline-state 测试（独立测试文件）」。
  - 方案 §2.4 INV-1 扩展：「pipeline-state.direction_version == direction.current_version」——但 §7.2 又说 pipeline_version 与 direction_version 解耦、同一 direction 下 pipeline 可重置。
- 影响:
  - 三个版本号的**合法组合状态空间**：schema_version ∈ {1,2,...} × pipeline_version ∈ {1,2,...} × direction_version ∈ {1,2,...}。每个节点推进、每次 HG 决策、每次换向都是一次状态迁移。INV-1 要求 direction_version 与层1 三文件一致，但 pipeline_version/schema_version 是 pipeline-state 私有——**跨文件一致性校验（INV-1 扩展）只能覆盖 direction_version 一个维度**，另两个维度的"合法迁移"纯靠骨架代码自觉。
  - 用纯 node:test（零依赖，charter C2 约束）覆盖这个状态空间意味着：每个 (schema_version, pipeline_version, direction_version) 组合 × 每个 status 枚举值（running/awaiting_human/loop_back_active/completed/abandoned/idle）× HG decision ∈ {null,continue,shift,abandon}。光是"换向重置 pipeline_version"（§7.2 示例的 direction v2/pipeline v2 → direction v3/pipeline v1）这一条迁移链，就要构造一个多步测试（init→跑 N1-N3→HG1 abandon→重启 pipeline v2→shift→direction v3→校验 pipeline v1）。β §11.1 估的「~15 单测」根本盖不住这个组合爆炸，实际需要 40+ 用例才能达到 cc-goal 的"可证伪性"门槛（每个 must 条件一条 verify）。
  - 真正的落地风险：Claude 实施者写骨架时，三版本号的迁移规则散落在 transition/shouldEnterGate/writePipelineState 多个函数里，**没有类型系统约束**（纯 JS + JSON）。Claude 极易写出一个"忘重置 pipeline_version"的 bug——这种 bug 在单测里若组合覆盖不全就测不出来，要到端到端跑 cc-venture 时才在 HG abandon→重启路径上爆炸。β §11.4 自己估「28-35 轮跨 session」，其中大量轮次会耗在这种"版本号对不上"的 debug 上。
- 修复建议:
  - **证伪手段**：让 β 派列出三版本号的**完整状态迁移表**（每个版本号在哪些事件下 +1/重置/不变），然后对每条迁移写一个 node:test 用例。如果迁移表 > 15 条，§11.1 的「15 单测」就是低估。
  - 进一步：把三版本号**降为两个**（schema_version 合并进 pipeline_version，或干脆砍掉 schema_version——pipeline-state 是新文件，首发就是 v1，不需要 schema 演进门）。β 引入 schema_version 是为了"独立 schema 版本演进"（§7.2），但 frozen-v1→v2 已经是 state-schema.md 的职责，pipeline-state 再来一个 schema_version 是**第二套版本门**，违反 cc-config"单一 schema 版本源"原则。

---

### [B-β-3] INV-8（status 双文件协同）依赖 direction.status 字段，但 shift-direction.js 当前从不写 status:awaiting_human——HG 路径的写者是真空

- 严重度: **CRITICAL**
- 证据:
  - 方案 §2.4 INV-8：「pipeline-state.status == "awaiting_human" ⟺ direction.status == "awaiting_human" 且 direction.gate == pipeline-state.awaiting_human.gate」。
  - 方案 §4.4 HG 进入流程第 3 步：「骨架经 skill 调 direction 字段更新（status:awaiting_human, gate:HG1）……shift-direction.js 需扩展一个 update-status 子命令」。
  - 层1 实现事实：`shift-direction.js` 全文 grep——`status` 字段只在 line 127 `status: 'active'`（构造 newDirObj）出现一次，且**永远是 'active'**（换向后新方向必 active）。direction.json 的 `gate` 字段在 line 128 初始化为 `null`，**换向路径从不写 gate**。
  - 即：direction.json schema 当前有 `status` 和 `gate` 字段（C1 修订加的），但**层1 没有任何代码路径会写 status:awaiting_human 或非 null gate**。这两个字段是"预留位"。
- 影响:
  - β 的 INV-8 双文件协同**建立在 direction.status/gate 有写者的基础上**，但层1 基线层这个写者不存在。β 自己引入 update-status 子命令（§5.2）正是为了补这个写者——但这意味着 **update-status 不是一个"HG 微调"扩展，而是 INV-8 能否成立的唯一支柱**。如果 update-status 子命令的写路径有 bug（见 B-β-1），INV-8 直接失效，HG 停等/恢复整个机制崩。
  - 更隐蔽：β §4.4 说"骨架写 direction.status 经 skill 调，非直写"——但 §6.1 接口表又说 update-status 是 shift-direction.js 子命令（即脚本直写）。**"经 skill 调"和"脚本子命令"是两个不同的写者模型**。如果是脚本直写（subprocess node shift-direction.js update-status），那 direction.json 的 status/gate 写者就是 cc-runtime 脚本；如果是经 skill 调（skill 内部 fs.writeFile），那写者是 skill agent。两个模型的原子性保证不同（脚本路径有 atomicWriteJSON，skill 路径未必），INV-8 的"双文件协同"在两种模型下的一致性强度不同。β 没有厘清这点。
  - 测试可行性：要测 INV-8，必须构造一个"direction.status=awaiting_human 但 pipeline-state.status≠awaiting_human"的损坏态，然后验证骨架能检测/修复。但 direction.status 字段层1 没写者，测试得手动伪造 direction.json——这种"伪造损坏态"的测试在零依赖 node:test 下可写，但**它测的是"骨架能否检测损坏"，不是"损坏会不会发生"**。真正的预防（写路径原子性）被推给了 B-β-1 的 update-status 实现，链条脆弱。
- 修复建议:
  - **证伪手段**：让 β 派明确 direction.status/gate 的**唯一写者**（脚本子命令 vs skill fs 写），并给该写者写一个原子性测试（写一半崩溃后 direction.json 是否保持旧值）。如果写者是 skill fs 写（非 atomicWriteJSON），则 direction.json 的原子性弱于 checkpoint/direction 换向路径，INV-8 的"⟺"等价性无法保证。
  - 强烈建议：update-status 必须复用 atomicWriteJSON（init-state.js:34），不能用 skill 内裸 fs.writeFile。β §5.2 没强制这点。

---

### [B-β-4] F2 自承认的双写竞态（pipeline-state + direction）无事务，"顺序写+INV-8 兜底"在崩溃中段时会留损坏态且无自动恢复

- 严重度: **MAJOR**
- 证据:
  - 方案 §12.1 F2：「HG 进入时层2 同时写 pipeline-state（骨架）和 direction.status（经 skill），两文件写非原子 …… 极端情况（写 pipeline-state 后崩溃）direction 未更新，INV-8 失败需手动修复」。残余风险栏明确写「需手动修复」。
  - 方案 §4.4 HG 进入流程第 2-3 步：「骨架写 pipeline-state: status="awaiting_human"」然后「骨架经 skill 调 direction 字段更新」——明确是两步顺序写，中间无事务。
  - 层1 事实：`atomicWriteJSON`（init-state.js:34-39）是**单文件原子**（write tmp + rename），但跨两个文件（pipeline-state.json + direction.json）的写**没有事务**。shift-direction.js 自己的三文件原子写（line 174-176）也只是"顺序三个 atomicWriteJSON"，中间崩溃同样会留 INV-1 损坏态——层1 之所以能接受，是因为换向是低频人工触发，而 HG 进入/退出是**层2 高频自动触发**（每跑完一个 stage 前的节点就触发一次）。
- 影响:
  - β 把 F2 标"高风险但残余=手动修复"是**严重低估了发生频率**。autocompact thrashing 现实下（本项目已发生 3 turns 内多次 compact），Claude 实施者在写骨架时，每次 HG 进入都是"写 pipeline-state → 写 direction"两步。如果在两步之间 SessionStart/compact 抢占（compact-snapshot-restore.js 会注入 additionalContext，可能中断当前 tool 序列），就留下 INV-8 损坏态。
  - "手动修复"在 OPC（单 Claude）语境下意味着：Claude 自己得在下次 session 启动时识别出"pipeline-status=awaiting_human 但 direction.status=active"的损坏态，然后决定该信哪个。但 INV-8 是"⟺"等价——损坏态下**两边都可能是对的**（pipeline 说该等 HG1，direction 说没在等），Claude 无法机械判定。这是**需要人类 boss 介入的语义歧义**，不是 Claude 能自动修的。β 把它甩给"手动修复"是逃避。
  - 测试覆盖成本：要测这个竞态，得模拟"写 pipeline-state 后进程被杀"。零依赖 node:test 无法注入进程崩溃——最多能测"两个文件状态不一致时骨架检测到 INV-8 违反"，但**无法测"写路径在中段崩溃的概率"**。即这个 CRITICAL 风险的"可证伪性"是空的——你只能证明"检测器在工作"，证明不了"损坏不会发生"。
- 修复建议:
  - **证伪手段**：让 β 派给出"写 pipeline-state 后崩溃"的**自动恢复算法**（不是"手动修复"）。如果给不出，F2 应升级为致命（BLOCK），不是高风险。
  - 真正的修法：把 pipeline-state.status 和 direction.status/gate **合并到同一个文件**（要么 direction.json 增加 pipeline 字段，要么 pipeline-state.json 成为唯一真相源、direction.status 改为只读镜像）。β 坚持"职责正交独立文件"（§2.1），代价就是这个跨文件事务难题。α 派"塞 checkpoint"反而是单文件原子——β 批评 α"写竞态"（§2.1 论点 2）其实是**投射**，β 自己的双文件竞态（F2）比 α 的单文件内嵌更严重。

---

### [B-β-5] N6⇄N7 loop_back 的收敛判据（persona_segment_unchanged）和 force_converge 语义在零依赖测试下无法证伪

- 严重度: **MAJOR**
- 证据:
  - 方案 §3.2 loop_back 原语 schema：「convergence_check: "persona_segment_unchanged"」「on_max_iter: "force_converge_with_current_persona"」。
  - 方案 §9.3 循环合同：「检查 convergence_check（persona_segment 是否本轮与上轮一致）」「on_max_iter: force_converge_with_current_persona（M2 第4轮强制）」。
  - 方案 §12.2 M1：「loop_back 收敛判据（persona_segment_unchanged）定义模糊，可能误判收敛」——β 自己标中风险，缓解="明确 segment 比较算法（字段级 diff）"，但**字段级 diff 算法没有定义**。
  - 层1 基线层事实：shift-direction.test.js 全部是结构性断言（version 相等、文件存在、history 长度），**没有任何"语义内容比较"的测试范式**。
- 影响:
  - "persona_segment_unchanged" 要求骨架比较**两轮 persona 产物的 segment 字段**。但 persona 产物是 venture-persona skill 生成的 markdown（.venture/artifacts/v{N}/06-persona.md），**segment 是 markdown 内的语义片段，不是结构化字段**。骨架要比较它，得先解析 markdown 抽取 segment——这是个 mini 信息抽取问题，零依赖 node:test 下只能用正则 grep，正则 grep 对 markdown 语义片段的鲁棒性极差（M1 自承认"字段级 diff 算法"未定义）。
  - cc-goal 可证伪性要求"每个 must 条件有 verify 命令"。这里 convergence_check 的 verify 命令是什么？`grep -q 'segment: XXX' 06-persona.md` 然后比较两轮？但 segment 值是 skill 生成的自由文本，不是固定枚举。**收敛判据本身不可证伪**——它依赖 markdown 解析的鲁棒性，而 markdown 解析的鲁棒性无法用零依赖测试覆盖。
  - 更糟：force_converge（on_max_iter）语义是"第 4 轮强制以当前 persona 为准"。但"当前 persona"是第 3 轮的产物还是第 4 轮的？M2 说"第 4 轮强制"——如果 max_iter=3，第 4 轮根本不跑（iter 达 max 即止）。β §3.2 写 max_iter:3 但 on_max_iter:force_converge_with_current_persona——**off-by-one 语义歧义**：是 iter=3 时收敛（共 3 轮），还是 iter=3 后再跑第 4 轮强制收敛（共 4 轮）？β 没说清，测试无法写。
- 修复建议:
  - **证伪手段**：让 β 派给出 persona_segment 的**结构化 schema**（不是 markdown 自由文本）。如果 segment 必须是结构化字段（如 `{"segment": "SMB_retail", "narrowed_from": "SMB"}`），那 venture-persona skill 必须同时产 markdown + jsonld（像 venture-judge-extractor 那样），β §10 的 skills 清单漏了 venture-persona 的 extractor。
  - 明确 force_converge 的 iter 边界：max_iter=3 意味着**最多 3 轮**，第 3 轮未收敛则强制以第 3 轮为准，**不存在第 4 轮**。β §9.3 "on_max_iter:force_converge_with_current_persona（M2 第4轮强制）"的"第 4 轮"措辞是 bug，应改为"第 3 轮强制"。

---

### [B-γ-1] evalEdge 的"受限 JS 子集求值器"是自造 DSL，正确性无法在零依赖测试下证伪，且安全边界靠口头约束

- 严重度: **CRITICAL**
- 证据:
  - 方案 §3.3：「条件求值：dag-engine.evalEdge(edge, ctx) 中 ctx = 前驱节点的 out_schema 解析结果（jsonld）。条件表达式用受限 JS 子集（prev_out.field == 'value' / in / 逻辑与或），禁任意代码执行（安全）」。
  - 方案 §5.1 evalEdge 伪代码：「return safeEval(edge.condition, ctx); // 禁任意代码，只允 ==/in/&&/||」。
  - 方案 §5.1 applyLoopBack 也用 safeEval：「converged = safeEval(edge.converge_pred, { prev_out: ..., iter, max_iter: edge.max_iter })」。
  - 方案 §12.2 R-γ2：「evalEdge 条件求值的受限 JS 子集边界模糊（安全 + 表达力）……白名单操作符（==/in/&&/||），禁 eval/Function；单测覆盖」。
- 影响:
  - **γ 要 Claude 实施者从零写一个 JS 表达式求值器**（safeEval）。charter C2 约束"纯 Node fs + path，禁 SDK 子进程"——意味着不能用 `vm` 模块（vm.runInNewContext 算"沙箱"但不是 fs/path），不能用 `new Function`，不能用 `eval`。**那 safeEval 怎么实现？** 只能手写 tokenizer + parser + evaluator。这是一个**完整的解释器子项目**，γ §11.1 只估了「evalEdge ~6k token / 2 轮」——这是**10 倍低估**。一个能正确处理 `prev_out.signal in ['yellow','red','unknown']`（含数组字面量、in 操作符、字符串字面量、短路求值）的手写求值器，现实工作量是 15-25k token / 6-10 轮，而且**正确性极难自证**。
  - 安全边界"禁 eval/Function"是口头约束。Claude 实施者在写 safeEval 时，面对 `'yellow' in [...]` 这种语法，极大概率会**偷懒用 `Function` 构造器**（"反正 condition 是开发者写的声明文件，不是用户输入"）。一旦用了 Function，R-γ2 的"安全"承诺就是空头支票——声明文件若被污染（compact-snapshot 恢复时注入恶意 condition？或 boss 误写），就是 RCE。γ 没有静态检查手段保证实施者不偷懒。
  - 测试可行性：要测 safeEval 的正确性，得覆盖：嵌套表达式 `a == 'x' && (b in ['y','z']) || c`、短路求值 `false && <side-effect>`、类型转换 `1 == '1'`（JS == 的隐式转换）、未知变量 `prev_out.undefined_field`、语法错误 `prev_out.signal ==`（残缺）。**每个边界 case 一个 node:test 用例**，但"未知变量"和"语法错误"的预期行为 γ 没定义（抛错？返回 false？返回 null？）。safeEval 的契约不完整，测试无法写齐。
  - 这不是"中风险"，是 **BLOCK 级**：自造求值器是 γ 方案最大的落地陷阱，γ 把它藏在"受限 JS 子集"这个轻描淡写的词后面。
- 修复建议:
  - **证伪手段**：让 γ 派**先实现 safeEval 的 PoC**（一个能跑通 §9.1 所有 condition 表达式的最小求值器），token 预算封顶 6k。如果 6k 内写不出能处理 `in` + `||` + 数组字面量的求值器，§11.1 的估算就是假的，整个 γ 的"114k token"基线崩。
  - 替代方案：**完全砍掉条件表达式**，改用**声明式路由表**（如 `"signal_green": "advance", "signal_yellow": "advance_with_warning"`，N5 节点的 routing 字段已经是这种形式，见 β §9.1 N5.routing）。γ §3.3 的 condition 表达式是过度工程——cc-venture 实际只有 signal ∈ {green,yellow,red,unknown} 4 个枚举值，用查表即可，不需要求值器。γ 为了"通用"硬上求值器，是 P3"世界最好"驱动的过度抽象。

---

### [B-γ-2] 114k token / 38 轮在 autocompact thrashing 现实下，checkpoint 续跑粒度对"求值器写到一半"不够，中途 compact 后无法续跑

- 严重度: **CRITICAL**
- 证据:
  - 方案 §11.4 总估：「总 token ~114k …… 总轮次 ~38 轮（含调试）」。
  - 方案 §4.3 ScheduleWakeup：「跨 session 续跑（compact 后）→ 1200s」。
  - 方案 §12.2 R-γ7：「loop 跨 session 续跑时 pipeline-state 与 checkpoint 不同步（compact 后）…… compact-snapshot Block⑤ 扩展读 pipeline-state；SessionStart 恢复」。
  - autocompact 事实（本项目实测）：30-score.md:108「在 autocompact 已 thrashing 的现实下，单次 2pp 实施周期承受 38 轮的失败/重试风险最高」。MEMORY/compact-snapshot-hooks.md：BigModel 网关下 claude-mem 失效，已发生 3 turns 内多次 compact，自建 PreCompact+SessionStart 抢救（性能 183ms，JSON 合法）。
- 影响:
  - **γ 的实施周期 38 轮，远超 autocompact 的安全窗口**。本项目已实测 3 turns 内多次 compact——按这个频率，38 轮里会触发 **10+ 次 compact**。每次 compact 后，Claude 实施 session 的上下文被抢救快照（4 块：当前目标/未完成任务/改动文件/最近要点）替代，**代码细节（如 safeEval 写到哪个函数、advance 的 frontier 重算逻辑写到哪行）丢失**。
  - compact-snapshot 抢救的是**任务级**粒度（"未完成任务"是 TaskList 项），不是**代码行级**粒度。γ 的 dag-engine.js 是单文件 ~45k token 的大模块（§11.1），含 loadGraph/computeFrontier/evalEdge/triggerGate/applyLoopBack/enterSubgraph/fanOut 八个函数。如果 Claude 在写 evalEdge 写到一半（比如 tokenizer 写完了，parser 没写完）时 compact，恢复后 Claude 只知道"任务：实现 evalEdge"，**不知道 tokenizer 已经写了哪些 token 类型、parser 期望什么输入**。Claude 得重新读 dag-engine.js 当前状态（再花 ~5k token 重新载入文件），然后推断"我刚才写到哪了"——这个推断本身就有概率出错（Claude 可能误判已完成的部分，重写或漏写）。
  - γ §4.3 的"跨 session 续跑 1200s"是 loop 运行时的策略，**不是实施期的策略**。实施期 Claude 是被 compact 驱动的（不是 ScheduleWakeup 驱动），1200s 这个数对实施期无意义。γ 混淆了"运行时跨 session"和"实施期跨 compact"两个概念。
  - 真实落地：38 轮里每 compact 一次，平均损失 1-2 轮（重新载入上下文 + 推断进度 + 修复推断错误）。10+ 次 compact = 损失 10-20 轮。**γ 的 38 轮实际需要 50-60 轮才能完成**，而且每次 compact 都是 bug 注入点（推断错误 → 写错代码 → 测试失败 → 再 debug）。autocompact thrashing 下，γ 的"38 轮"是**乐观下界**，现实是 60+ 轮且质量打折扣。
- 修复建议:
  - **证伪手段**：让 γ 派把 dag-engine.js 拆成**多个独立小文件**（loadGraph.js / computeFrontier.js / evalEdge.js / triggerGate.js / applyLoopBack.js / subgraph.js / fanOut.js），每个文件 < 8k token，每个文件是一个可独立提交的原子单元。这样 compact 后 Claude 只需重新载入当前在写的小文件（< 8k），而不是整个 45k 大模块。如果 γ 拒绝拆分（坚持单文件 dag-engine.js），则接受"38 轮实际 60+ 轮"的现实，重新估 token（实际 150k+）。
  - 更根本：**砍掉 subgraph + fan_out**（首发 reserved 不用，§9.1 subgraphs:[] / fan_outs:[]）。γ §11.1 给这两个原语估了「enterSubgraph ~6k/2 轮 + fanOut ~6k/2 轮 = 12k/4 轮」——这 12k/4 轮是纯预留成本，首发零回报。autocompact 现实下，**每 1k token / 每 1 轮都是稀缺资源**，花在 reserved 原语上是浪费。γ §12.1 自承认"若对抗证无第二 instance 则降级 β"——本攻击就是那个对抗证据：**autocompact thrashing 下，第二 instance 的并行/嵌套需求不会在 6 个月内出现**（连第一 instance 都要 60 轮才跑通），γ 应立即降级。

---

### [B-γ-3] advance-node.js 的 tick 推进 + Kahn 拓扑序在节点失败重试时，frontier 回退与 in_flight/completed/node_status 四字段一致性无法用纯 Node fs 保证原子

- 严重度: **MAJOR**
- 证据:
  - 方案 §6.1：「需要一个轻量推进接口 direction.advance_node(node)——只更新 checkpoint.current_node + pipeline-state.current_node，不升 version、不归档」。
  - 方案 §7.3 迁移步骤 4：「新增 advance-node.js（轻量推进，不换向）」。
  - 方案 §5.1 advance 伪代码（line 616-631）：写 `completed.push(node)` + `node_status[node]='completed'` + 检查后继边（triggerGate/applyLoopBack/fanOut）+ 重算 frontier + `atomicWriteJSON(ppPath, pp)`。
  - 方案 §2.3 字段表：frontier/in_flight/completed/node_status 四字段，写者分别是「computeFrontier / loop dispatch 前 / advance / advance」。
  - 方案 INV-P1：「completed[] 单调递增（除非 direction 换向重置）—— 已完成节点不退回 pending」。
  - 方案 INV-P3：「frontier[] ⊆ { n | node_status[n]=='pending' ∧ 入度=0 }」。
- 影响:
  - **节点失败重试路径未被 γ 的 advance 覆盖**。γ §5.1 advance 假设"节点完成（result 成功）"才推进。但 cc-venture 节点会失败（N4 judge 超预算、N6 persona exit_check 不过）。失败时怎么办？γ §3.2 node schema 有 `on_failure: "route_gate:HG2"`，但这是**路由到 gate**，不是**重试本节点**。如果节点要重试（iteration += 1，回 pending），advance 的"completed 单调递增"（INV-P1）就冲突了——节点没完成不能进 completed，但 frontier 计算要求"前驱 completed"才放行后继。
  - 四字段一致性：advance 一次写 `completed` + `node_status` + `frontier`（重算）三个字段，加上 `in_flight`（dispatch 前标、advance 后清）共四个。这四个字段必须在**同一次 atomicWriteJSON 调用**里一起写，否则中段崩溃会出现"node_status=N4:completed 但 completed[] 不含 N4"或"frontier 含 N5 但 N4 还 in_flight"。γ §5.1 advance 伪代码确实是"构造完整个 pp 对象后一次 atomicWriteJSON"——**单次写是原子的**。但 **loop dispatch 阶段**（§4.2 step 5-6）是"先 mark_in_flight 再 dispatch 再 advance"，mark_in_flight 是**单独一次写**（dispatch 前），advance 是另一次写。**mark_in_flight 后、advance 前崩溃**，pipeline-state 会留"in_flight=[N4] 但 N4 永远不会 completed"的悬挂态。γ 没有"悬挂 in_flight 清理"机制。
  - Kahn 拓扑序的 frontier 回退：拓扑序是 loadGraph 时算的（§5.2），静态。但回环（applyLoopBack）会把 N6 从 completed 改回 pending（§5.1：「node_status[edge.to]='pending'」）——**这违反 INV-P1 的"completed 单调递增"**！γ §5.1 applyLoopBack 写的是 `node_status[edge.to]='pending'`，但 N6 此时可能已在 completed[] 里（N6 完成才进 N7，N7 完成才触发 loop_back 回 N6）。**applyLoopBack 要么从 completed[] 移除 N6（违反 INV-P1 单调），要么保留 N6 在 completed[] 同时 node_status 改 pending（违反 INV-P3 frontier⊆pending）**。γ 的不变量自相矛盾。
- 修复建议:
  - **证伪手段**：让 γ 派画一张"N6⇄N7 回环第 2 轮开始时的 pipeline-state 完整快照"，明确 N6 在 completed[] 还是 pending、node_status[N6] 是什么、frontier 含谁。如果画不出一个同时满足 INV-P1（completed 单调）和 INV-P3（frontier⊆pending）的快照，γ 的不变量系统就是矛盾的。
  - 修法：引入**第 7 个 node_status 枚举值 `re_entered`**（回环重入态），既不在 completed[] 也不阻塞 INV-P1。或者把 INV-P1 改为"completed[] 在非回环段单调递增"——但这就破坏了不变量的"全局性"，校验复杂度爆炸（γ §12.2 R-γ10 自承认"分层 INV 校验复杂度上升，debug 困难"）。
  - in_flight 悬挂：加一个 SessionStart/loop tick 启动时的"in_flight 超时清理"（如 last_advanced_at 超过 N 分钟仍有 in_flight，则回滚 in_flight 项到 pending）。γ 没这个机制。

---

### [B-γ-4] graph_hash 漂移检测 + SessionStart 恢复依赖 compact-snapshot Block⑤ 扩展，但 compact-snapshot 是抢救 hook（非业务 hook），扩展它违反"基线层 0 新 hook"约束

- 严重度: **MAJOR**
- 证据:
  - 方案 §7.4 向后兼容：「compact-snapshot-write.js Block⑤ 读 .venture/state/ 时，新增读 pipeline-state.json（若存在）」。
  - 方案 §12.2 R-γ7：「compact-snapshot Block⑤ 扩展读 pipeline-state；SessionStart 恢复」。
  - 方案 §2.3 字段表 graph_hash：「声明文件内容 hash …… loop（一致性校验）」「loaded_at：本图版本加载时间」。
  - 层1 基线层事实：50-decision §1.7 明确「基线层 0 新 hook」——compact-snapshot-write.js / compact-snapshot-restore.js 是**用户全局 hook**（`~/.claude/hooks/`，见 MEMORY/compact-snapshot-hooks.md），不是项目级 cc-runtime hook。它们是 autocompact 抢救机制，与 cc-runtime 业务无关。
- 影响:
  - γ 要扩展 compact-snapshot-write.js Block⑤ 读 pipeline-state——**这是修改全局 hook**，不是 cc-runtime 内部扩展。全局 hook 影响用户所有项目（不只 how-claude 项目），把 pipeline-state（层2 业务文件）塞进全局 compact 抢救，**污染了抢救 hook 的通用性**。其他项目（lunwen_writer / hot_repo）的 compact 快照会无端多读一个不存在的 pipeline-state.json（虽然有 if(exists) 守卫，但这是**全局 hook 加业务耦合**）。
  - 更深：γ §7.4 说"基线层 18 测试 fixtures 无 pipeline-state → 原样通过"——但 compact-snapshot-e2e.test.js 是基线层 18 测试之一（~3 测试），**如果修改了 compact-snapshot-write.js Block⑤，compact-snapshot-e2e.test.js 的 fixtures 和断言可能要改**。γ §11.2 估「基线层 18 测试回归 ~3k/1 轮」——这是**只跑不改**的估算。如果实际要改 compact-snapshot 的测试 fixtures（加 pipeline-state 场景），回归成本翻倍，且"18 测试原样通过"的承诺破。
  - graph_hash 漂移检测的时机：γ 说"loadGraph 时校验 graph_hash == sha256(声明文件)"（INV-X2）。但 loadGraph 是**每次 loop tick 重读声明文件**（§4.3 ANCHORS：「.venture/pipelines/venture.dag.json（图声明，每 tick 重读）」）。如果 boss 在 loop 跑到一半时改了声明文件（加节点/改边），graph_hash 变，loadGraph 检测到漂移——**然后呢？** γ 没定义漂移后的行为（拒绝继续？重置图？告警？）。声明漂移在 OPC 单 Claude 下是真实场景（Claude 自己 debug 时可能改声明文件），γ 的"检测"无"处理"，等于只报警不灭火。
- 修复建议:
  - **证伪手段**：让 γ 派明确 graph_hash 漂移后的**处理算法**（不是"检测"）。如果处理是"拒绝继续 + 等 boss 介入"，那这又是一个需要人类介入的悬挂态，和 F2 一样不可自动恢复。
  - compact-snapshot 扩展：**不要碰全局 hook**。pipeline-state 的跨 session 恢复应由 cc-runtime 自己的 SessionStart 逻辑处理（读 .venture/state/pipeline-state.json 注入 additionalContext），不依赖 compact 抢救 hook。γ 把责任推给 compact-snapshot 是为了省事，代价是污染全局 hook 层。

---

### [B-γ-5] advance-node.js（轻量推进）与 direction.set（换向）的写路径割裂，"同 version 推进"破坏 INV-D1 四文件一致的校验时机

- 严重度: **MAJOR**
- 证据:
  - 方案 §6.1：「shift-direction.js 现在只在换向（version+1）时调用。层2 推进节点不换向（同 version 内节点流转），需要一个轻量推进接口 direction.advance_node(node)——只更新 checkpoint.current_node + pipeline-state.current_node，不升 version、不归档」。
  - 方案 §7.3 迁移步骤 3-4：「shift-direction.js 扩展（换向重置 pipeline）」「新增 advance-node.js（轻量推进）」。
  - 方案 INV-D1：「checkpoint.direction_version == direction.current_version == tasks.tree.direction_version == pipeline-state.direction_version（四文件版本一致，原 INV-1 扩展）—— 校验时机：每次 write 后」。
  - 层1 事实：shift-direction.js 的三文件原子写（line 174-176）是 INV-1 的**唯一保证机制**——它一次性写 direction + checkpoint + tasks，保证三者 direction_version 同步。tasks.tree.json 的 direction_version 由 shiftDirection 写（line 150 `newTasks.direction_version`）。
- 影响:
  - **advance-node.js 不写 tasks.tree.json**（γ §6.1 只说更新 checkpoint + pipeline-state）。但 INV-D1 要求 tasks.tree.direction_version == pipeline-state.direction_version。如果 advance-node 不碰 tasks.tree，那 tasks.tree 的内容（tasks 数组）在节点推进时**完全不更新**——tasks.tree 永远是 init 时的空树或 shift 时的空树。这违反 INV-5（tasks.tree 与 TaskList 同构）——节点推进时 TaskList 会变（Claude 执行节点产生 tasks），但 tasks.tree.json 不跟，**tasks.tree 与 TaskList 脱节**。
  - 更深：advance-node 写 checkpoint.current_node + pipeline-state.current_node，但**不写 direction.json**（不换向）。那 direction.json 的 current_node 字段（如果有）谁来更新？γ §2.5 切分表说 direction.json 管"方向语义不管节点位置"，即 direction.json 无 current_node 字段。但 INV-P2 要求 `pipeline-state.current_node == checkpoint.current_node`——这两个写者都是 advance-node，可保证。但 **checkpoint.json 的其他字段**（progress_percent / iteration / continue_from）在节点推进时该不该更新？γ advance-node 只更 current_node，那 checkpoint.progress_percent 永远是 shift 时的 0，**checkpoint 进度信息失真**。compact-snapshot 抢救时读 checkpoint.continue_from 做续跑锚点——如果 advance-node 不更新 continue_from，续跑锚点永远指向 shift 时刻，节点推进后的断点丢失。
  - 写路径割裂导致 INV-D1 校验时机混乱：INV-D1 说"每次 write 后校验"。但 advance-node 写 checkpoint + pipeline-state（两文件），shift-direction 写 direction + checkpoint + tasks + pipeline-state（四文件）。**两种写路径覆盖的文件集不同**，INV-D1 的"四文件一致"在 advance-node 后只能保证"checkpoint.direction_version == pipeline-state.direction_version"（两文件），direction/tasks 的 direction_version 是上次 shift 时的值——**只要不 shift，这两个值就冻在旧值**。如果 pipeline-state 在 advance-node 时误改了 direction_version（bug），INV-D1 校验在 advance-node 后**只能抓 pipeline-state vs checkpoint 的不一致**，抓不到 vs direction/tasks 的不一致（因为后两者没被写，校验逻辑可能跳过它们）。校验覆盖空洞。
- 修复建议:
  - **证伪手段**：让 γ 派列出 advance-node.js 的**完整写字段清单**（写 checkpoint 的哪些字段、pipeline-state 的哪些字段、不写哪些）。如果清单不包含 tasks.tree 和 continue_from，则 INV-5（tasks 同构）和 compact 续跑锚点都失真，γ 要补"advance-node 也微更新 tasks.tree + continue_from"——但这又让它不再是"轻量推进"，复杂度逼近 shift-direction。
  - 更稳：**取消 advance-node.js，节点推进统一走 shift-direction 的一个新子命令 `--advance-node`**（同 version 不归档分支）。这样写路径统一（一个脚本管所有 direction 系写入），INV-D1 校验时机一致。但这又触发 B-β-1 的问题（shift-direction 双职责）——**β 和 γ 在这里踩同一个坑**：层1 的 shift-direction.js 是单职责脚本，层2 硬要塞"不换向的推进"进去，无论塞成子命令还是新文件，都会破坏单职责。根本矛盾：**层1 direction.set 接口设计时没考虑"同 version 节点推进"语义**，层2 强行扩展必然破坏基线层纯洁性。

---

## 总结

### β 能否存活？—— **有条件存活（需修 B-β-1 和 B-β-3，否则 BLOCK）**

- **致命链**：B-β-1（update-status 污染 shift-direction 单职责）+ B-β-3（INV-8 依赖的 direction.status/gate 写者在层1 不存在）是**同一个问题的两面**——β 要让 HG 停等/恢复工作，必须给 direction.json 加 status:awaiting_human 的写者，而这个写者（update-status 子命令）会污染 shift-direction.js。这两个点不解决，β 的 HG 机制（§4.4）整个不成立。
- **可存活路径**：
  1. 把 update-status 拆成**独立脚本** `update-direction-status.js`（不碰 shift-direction.js），复用 atomicWriteJSON。这样 B-β-1 解，B-β-3 的写者也有了。
  2. B-β-2（三版本状态空间）：砍掉 schema_version，只留 pipeline_version + direction_version，状态空间降一个维度，测试覆盖可达。
  3. B-β-4（F2 双写竞态）：接受"手动修复"但**必须给 Claude 一个明确的损坏态判定算法**（如"pipeline-state.status 优先，direction.status 落后时以 pipeline-state 为准并回填 direction"）。不能甩给"手动"。
  4. B-β-5（loop_back 收敛判据）：persona_segment 必须结构化（venture-persona 产 jsonld），force_converge 的 iter 边界明确为"max_iter=3 即最多 3 轮"。
- β 的工作量估算（74k token / 28-35 轮）在 autocompact 现实下偏乐观，实际 90-110k / 40-50 轮，但比 γ 可控。β 的核心风险是**基线层兼容性**（update-status 怎么加不破 18 测试），不是抽象层次。

### γ 能否存活？—— **不能存活（autocompact 现实 + safeEval 是双重致命）**

- **致命链**：B-γ-1（safeEval 自造求值器）+ B-γ-2（114k/38 轮在 autocompact 下实际 60+ 轮）是**叠加致命**。safeEval 单独是 CRITICAL（工作量 10 倍低估 + 安全边界空头），autocompact 单独是 CRITICAL（实施周期翻倍 + 每次 compact 是 bug 注入点）。两者叠加 = γ 的"114k/38 轮"实际是 **180k+/70+ 轮**，且 safeEval 的正确性在 compact 中断下无法保证（写到一半的求值器 + 推断错误的续写 = 必然 bug）。
- **不可存活理由**：
  1. safeEval 是 γ 不可放弃的核心（条件分支 §3.3 + 回环收敛 §3.5 都依赖它），但它是自造解释器，正确性无法证伪，安全边界靠口头。**这是结构性缺陷，不是工作量问题**——给再多 token 也难保证正确。
  2. autocompact thrashing 是**本项目实测事实**（不是假设），γ 的 38 轮在这个事实下不成立。γ §12.1 自承认"若对抗证无第二 instance 则降级 β"——本攻击 B-γ-2 就是那个对抗证据：**autocompact 现实下，60+ 轮才跑通第一 instance，第二 instance（并行/嵌套）6 个月内不会出现**，subgraph/fan_out 的预留成本（12k/4 轮）是即期浪费。
  3. B-γ-3（INV-P1 vs INV-P3 矛盾）+ B-γ-5（advance-node 写路径割裂）是**不变量系统自相矛盾**——这不是工作量能修的，是设计层面的逻辑漏洞。γ 的分层 INV（D/P/X 三系）看起来严谨，实际 P 系内部（P1 单调 vs P3 frontier⊆pending）在回环场景下互斥。
- **唯一存活路径**：γ 必须降级为 β（砍 subgraph/fan_out/evalEdge 求值器，改声明式路由表）+ 预留扩展点（声明文件 schema 支持但首发不实现）。降级后的 γ ≈ β，没有独立存活价值。γ 的"通用性"主张（P3 世界最好）在 autocompact + 单 Claude 约束下**无法兑现**——世界最好的维度不是"表达力"，是"在 autocompact thrashing 下能稳定落地的最小完备集"。

### 攻击者 B 最终裁决

- **β**：有条件存活，条件是 update-status 拆独立脚本 + F2 给明确恢复算法 + 砍 schema_version。不修 B-β-1/B-β-3 则 BLOCK。
- **γ**：不能存活。safeEval + autocompact + INV 矛盾三重致命，降级后等同 β，无独立价值。建议判官组直接采纳 β（或 β 修完后的版本），放弃 γ。
