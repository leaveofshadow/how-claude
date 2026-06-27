---
description: 组织层·协议宪法 charter（5 部门协作总则 + RACI 总表 + 交接协议；阶段5 协议降级，原 hcc-org skill → contracts/charter.md 文档）
protocol_version: "D11-2026-06-22"
---

# charter — 组织层·协议宪法

> **定位**：本目录是**组织宪法容器，不是第 6 个部门**（50-decision §一/§六裁决）。5 个业务部门（决策/产品/开发/运维/销售）共同引用本文件的 §2 RACI 总表作为协作地基，类比「公司章程」。
>
> **实施者契约**（单一来源 `.claude/contracts/org-claude.md`）：实施者 = Claude Code + 已装载 skills（[`#cognitive-anchor`](../../contracts/org-claude.md)）；部门协作成本按 token / 上下文轮次 / 文件交接开销度量，禁人天隐喻（[`#measure`](../../contracts/org-claude.md) C-2）。5 部门皆由 Claude 分饰（charter「单 Claude」部署约束）。
>
> **触发协议版本**：`protocol_version: "D11-2026-06-22"` 供层2 pipeline-state.js 的 cmdInit 读取（M2 R2.1），记录到 `pipeline-state.protocol_version_read` 字段，闭合「部门激活时协议是否被读了」的可证伪闸（50-decision §八 [B-2/C-4] 修复）。

---

## §0 初始化自检（env-scan，会话启动协议）

> **位置**：M6 R6.4（charter 块3 自检机制）。hcc-org 是组织宪法容器，5 部门激活协作前先自检外部 skill 依赖（grill-me / bergside-type-ui）是否就位，避免运行到 N3.5/N7 才发现缺依赖。自检脚本写 `.hcc/ops/`（非层1 state），不触碰 §4 纯引用约束。

### 自检协议（触发：会话启动 / env-scan.json TTL 过期 > 24h）

1. **跑 preflight**：`node .claude/skills/hcc-org/scripts/hcc-preflight.js`（纯 Node fs + path，C2 合规；exit 0 总是，缺失在 json 里分级而非硬闸）
2. **读 env-scan.json**：`.hcc/ops/hcc-org/env-scan.json`（preflight 自动落盘，含 timestamp + 依赖状态 + summary；TTL 24h 缓存：< 24h 返 cached:true，>= 24h 重扫）
3. **缺失分级处置**：
   - **阻断（required:true 缺失）** → 对应节点无法启动：
     - `grill-me` 缺失 → **N3.5 需求规格**停摆（hcc-product-requirement 激活 grill-me 追问挖需求）→ 补装 `npx skills add mattpocock/skills@grill-me -g -y`（`-g` 用户级，charter L21 全局装）后重跑
   - **告警（required:false 缺失）** → 不阻断主闭环，用到时再补：
     - `bergside-type-ui` 缺失 → N7 迭代优化用到时补 `npx typeui.sh pull <slug> -p claude`（slug 按 PRD 产品类型动态选）
4. **依赖清单**：`.claude/skills/hcc-org/scripts/hcc-dependencies.json`（声明 check_paths 项目级 + 用户级 fallback + required 分级 + install 命令）

### 自检四态（读 env-scan summary）

| env-scan summary 字段 | 处置 |
|----------------------|------|
| `missing_block=0 且 missing_warn=0` | ✅ 全部就绪 → 正常进 §1 协作总则 |
| `missing_block=0 且 missing_warn>=1` | ℹ️ optional 缺失（N7 才用），记录告警，继续 |
| `missing_block>=1` | ⚠️ required 缺失，对应节点（N3.5）无法启动 → 补装后重跑自检 |

> 自检非硬闸（exit 0）：env-scan.json 的缺失分级供部门激活时参考，部门遇阻断级缺失须先补装再启动对应节点。

---

## §1 协作总则（5 条，5 部门共同站立的地基）

### 总则1：部门间不直接对话，经层1 state/direction/trace 交换上下文

部门之间不通过自然语言互相传话，而是把产出落到层1 状态文件（checkpoint/direction/trace/tasks.tree）+ 层2 pipeline-state，下游部门读文件接力（charter §组织架构「部门间不直接对话，通过层1 产物契约 + 方向指针 + 执行记忆交换上下文」原话）。物理基础（层1 四文件 + 层2 pipeline-state）已闭合，与业界 state-driven handoffs 范式同构（00-explore §5.2/§6.1）。部门激活时 Read 自己负责节点的 state 字段 + 跨目录协议文件，无跨部门实时对话开销。

### 总则2：plan/review 遵循 cc-2pp（判官 + 对抗验证）

任何部门的 plan（规划）与 review（审查）双能力，统一遵循 cc-2pp 两阶段设计决策流程：判官小组多视角并行起草 → 评分 Top 2 → 对抗验证（3 攻击者跨视角）→ 综合裁决（cc-2pp SKILL.md「充分探索 → 多方案生成 → 对抗验证 → 裁决输出」）。plan/review 不是自由发挥，而是落盘到 `.2pp/{YYYY-MM-DD}-{slug}/` 的结构化产物，下游部门读文件继续，符合 cc-2pp 假设4「agent 写文件 / 编排者读文件」协作原型（00-explore §5.4）。

### 总则3：换向必经 shift-direction.js（C1 约束）

任何部门判定需要换向（升 direction_version）时，**必须调用** 层1 `cc-runtime/scripts/shift-direction.js`（`--reason` / `--to` / `--dry-run`），**严禁** 部门直接写 `.venture/state/direction.json`（C1 核心约束：direction.json 唯一写者是 shift-direction.js，00-explore §2.3/§5.7）。这保证 INV-1..6 跨文件不变量不被破坏（state-schema.md §6）。决策部判定换向 → 调 shift-direction.js，不绕过（Ruh「Manager 经层1 工具而非直写 state」原则，00-explore §6.7）。

### 总则4：state 字段读写规则由 cc-runtime/state-schema.md owns

本文件 §4 只列「哪个部门对哪个 state 字段负 R/A/C/I」，**绝不复制读写规则**。所有 state 字段的读写规则、写者隔离、不变量完全由 `cc-runtime/references/state-schema.md` §2.1-§2.5 + §6（INV-1..6）+ §7.3（变更门）owns，pipeline-state 字段由 `venture-pipeline/references/pipeline-state-schema.md` §二字段表 + §四写者隔离 owns（50-decision §八 [A-5/B-4] 修复：消除双源真理）。hcc-org/ 全目录下禁出现任何 state 写者函数的**调用名或实现逻辑**（含层1 原子写工具 / 同步写盘 API / 层1 init 脚本 / 换向脚本的具体函数符号），只可提脚本**职责名**做引用（如「换向脚本负责 direction 写入」），不得出现函数符号或实现逻辑。

### 总则5：plan/review 回环上限 max_iteration（checkpoint.guardrails）

部门 plan → 下游 review → 驳回 → 重 plan 的回环**必须**有上限：`checkpoint.guardrails.max_iteration`（state-schema.md §1.1，循环合同护栏一）+ `budget_tokens_cap`（护栏三，token 预算上限）。回环达上限 → 决策部仲裁（§2.1）或上报 boss 换向。防 plan/review 死循环（Ruh 反模式#3 循环检测，00-explore §6.5/§6.6）。iteration 计数由层2 `advance-node.js` handleLoopBack owns（50-decision §八 [B-7] 修复），部门只读不写。

---

## §2 RACI 总表（必读层，5 部门 × 关键节点/状态字段）

> **图例**：R = Responsible（负责执行）/ A = Accountable（批准拍板，唯一）/ C = Consulted（咨询，双向）/ I = Informed（知会，单向）。
>
> **每行至少 1 个 R**；**A 默认归决策部**（N3-N7 总表显式标 A；销售自治节点 N1/N2/N8 决策部转 C，其 A 由 §2.1「无 A 行」规则兜底）；HG1/HG2 闸门行决策部独占 A（[A-8] 冲突仲裁基准，见 §2.1）。节点行按部门节点归属（charter L60-65 + 00-explore §四/§5.5 + references §B.1 推导）；state 字段行运维部 owns 读写（R/A），其他部门只读（C/I）——这正是 §4 纯引用的精髓。

### 2.1 节点行（venture 节点 N1-N8 + HG1/HG2）

| 节点 / 闸门 | 语义 | 决策部 | 产品部 | 开发部 | 运维部 | 销售部 |
|------------|------|:----:|:----:|:----:|:----:|:----:|
| **N1 启动** | 机会启动 / 方向锚定 | C | I | I | C | **R** |
| **N2 机会识别** | 调研 / 竞品分析 | C | I | I | I | **R** |
| **N3 方案** | 计划起草（判官小组） | **R/A** | C | C | I | C |
| **N3.5 需求规格** | PRD 产出（hcc-product-requirement 激活） | **A** | **R** | C | I | C |
| **HG1** | 方案→原型 boss 决策闸 | **A** | C | I | I | C |
| **N4 原型** | 按方案实施原型 | **A** | C | **R** | I | I |
| **HG2** | 原型→验证 boss 决策闸 | **A** | C | I | I | C |
| **N5 验证** | 设计验证 / 市场验证 | **A** | **R** | C | I | C |
| **N6 产品化** | 产品设计 / 收益转化 | **A** | **R** | C | I | C |
| **N7 迭代优化** | 需求挖掘 / UIUX（loop_back N7→N6） | **A** | **R** | C | I | I |
| **N8 规模化** | 收益转化 / 市场规模化 | C | I | I | I | **R** |

> **批准（A）归属说明**：N3-N7 的「批准」归**决策部**（总表决策部列标 A：决策部 review 部门 plan 后拍板推进，总则2 + Ruh Manager 角色，推导见 references §B.1）。销售部 own 的 N1/N2/N8 业务节点，决策部对销售部 plan 的批准转 C（咨询），销售部自身 R（销售部「方案自治」），其 A 由 §2.1「无 A 行→决策部临时 A」兜底，跨节点升级时仍可由决策部仲裁。HG1/HG2 是显式 boss 决策闸，决策部独占 A（阶段闸门批准，与工作节点的 plan 批准粒度不同）。

### 2.2 state 字段行（运维部 owns 读写，其他部门只读）

| state 字段 | 所属文件 | 决策部 | 产品部 | 开发部 | 运维部 | 销售部 |
|-----------|---------|:----:|:----:|:----:|:----:|:----:|
| `direction_version` | direction.json / pipeline-state.json | C | C | C | **R**/**A** | C |
| `current_node` | pipeline-state.json | C | C | C | **R**/**A** | C |
| `iteration` | pipeline-state.json / checkpoint.json | I | I | I | **R**/**A** | I |
| `status`（active\|awaiting_human） | pipeline-state.json | C | I | I | **R**/**A** | I |
| `gate`（null\|HG1\|HG2） | pipeline-state.json | C | I | I | **R**/**A** | I |
| `trace`（trace.ndjson 每行） | trace.ndjson | I | I | I | **R**/**A** | I |
| `checkpoint.continue_from` | checkpoint.json | C | C | C | **R**/**A** | C |

> **运维部 owns 说明**：运维部对全部 state 字段负 R/A（运维部 = 层1 运行时横切贯穿，charter L64 + 00-explore §四运维部「厚实」：cc-runtime/cc-config/cc-context 覆盖 7×24 保活/state/trace/Hook 全链路）。其他部门对 state 字段负 C/I（只读不写，经脚本/Hook 间接读写）。读写规则的**完整细节**（写者隔离、不变量、原子写协议）见 §4 纯引用——本表只标 R/A/C/I 归属，不复制规则。

---

## §2.1 冲突仲裁规则（必读层，[A-8] 修复）

> **位置**：本冲突仲裁规则位于 §2 必读层（非下沉 references），因为它是「每行至少 1 R + 1 A」基准的执行机制（50-decision §八 [A-8]：RACI 冲突仲裁无基准 → 上提到 SKILL.md §2 必读层）。

### 仲裁基准

**R 冲突**（同一节点 2 个部门都标 R，职责重叠）：
- → **决策部仲裁**：决策部 review 两部门 plan，裁定 R 归属（哪个部门实际执行），另一部门降为 C。
- 例：N6 产品化若产品部与开发部都标 R（产品设计 vs 实施边界模糊）→ 决策部仲裁：产品部 R（产品设计），开发部 C（实施细节）。

**A 冲突**（同一节点 2 个部门都标 A，批准权争夺）：
- → **决策部 HG 拍板**：决策部对显式 HG 闸门（HG1/HG2）独占 A；非 HG 节点的 A 冲突 → 决策部 review 后指定唯一 A。
- 例：N5 验证若产品部（设计验证）与销售部（市场验证）都主张 A → 决策部仲裁：若属设计验证 A 归产品部，若属市场验证 A 归销售部，跨域升级时决策部兜底 A。

**无 R 行**（某节点无人负责，gap）：
- → **决策部兜底指定 R**：决策部 review 节点语义，指派归属部门 R（按 charter L60-65 节点归属表）。

**无 A 行**（某节点无批准者，无人拍板）：
- → **决策部临时 A**：决策部对该节点临时负 A，直到 review 后指派常驻 A。

### 仲裁路径

```
部门 plan 产出 → 下游 review 发现 R/A 冲突
   │
   ├─ R 冲突 → 决策部 review 两 plan，裁定 R 归属，另一部门降 C
   ├─ A 冲突 → 决策部 HG 拍板（HG1/HG2 显式 A；非 HG 指定唯一 A）
   ├─ 无 R   → 决策部按 charter 节点归属指派 R
   └─ 无 A   → 决策部临时 A，review 后指派常驻 A
   │
   └─ 仲裁结果落盘 → 更新 §2 RACI 总表（本文件）→ 通知相关部门
```

> 仲裁不是无上限循环：plan/review 回环受总则5 `max_iteration` + `budget_tokens_cap` 护栏约束，达上限 → 上报 boss 换向或终止。

---

## §3 交接协议（部门 A 产出 → 落盘 → 部门 B 读文件接力）

> **原型**：cc-2pp 假设4「agent 写文件 / 编排者读文件」+ LangChain handoff pair 铁律「不灌完整 trace，只传 handoff pair + summarize」（00-explore §5.4/§6.3）。
>
> **物理路径**：`.venture/artifacts/v{n}/`（v{n} = direction.current_version 绑定，换向时新建空 artifacts 目录）。

### 3.1 交接文件命名约定（5 部门）

| 部门 | 产出文件（落盘 `.venture/artifacts/v{n}/`） | 下游读者 |
|------|-------------------------------------------|---------|
| **决策部** | `decision-plan.md`（判官小组 plan）/ `decision-review.md`（对抗验证裁决） | 产品部 / 开发部 / 销售部 |
| **产品部** | `product-design.md`（N5 设计）/ `product-requirements.md`（N7 需求）/ `product-uiux.md`（N8 UIUX） | 开发部（实施）/ 决策部（review） |
| **开发部** | `dev-impl.md`（实施记录）/ `dev-test.md`（测试结果） | 决策部（review）/ 运维部（保活） |
| **运维部** | `ops-state-health.md`（state/trace 健康报告）/ `ops-config.md`（配置变更） | 决策部（review）/ 全部门（读 state） |
| **销售部** | `sales-research.md`（N1 调查）/ `sales-competitor.md`（N2 竞品）/ `sales-persona.md`（N6 画像）/ `sales-validation.md`（N8 市场验证） | 决策部（review）/ 产品部（需求输入） |

### 3.2 交接规则

1. **direction_version 绑定**：所有交接文件落盘到 `.venture/artifacts/v{n}/`，v{n} = 当前 `direction.current_version`（00-explore §6.3）。换向时旧 artifacts 随 shift-direction.js 归档到 `.venture/archived/v_old/`，下游读新版本目录（痛点4 机制腿）。
2. **handoff pair 不灌完整 trace**：交接文件只含「触发消息 + 确认消息 + 关键 learnings summarize」，**不复制完整 trace.ndjson**（00-explore §6.3 LangChain 教训：灌完整历史致 bloat + 干扰接收部门）。需更多上下文 → 交接文件里 summarize，接收部门按需 Read trace 特定行（带 node/iter/direction_version 过滤）。
3. **state 字段交接经脚本/Hook**：部门不直接读写 state 文件，而是经层1 Hook（H2 PostToolUse 写 trace/tasks）+ 层2 脚本（advance-node 推进 current_node）间接交换。部门 plan/review 产出落盘 artifacts，state 字段由运维部 owns 的脚本/Hook 维护（总则4 + §4 纯引用）。

### 3.3 .hcc 产物目录体系（charter 块4，层3 统一落盘规范）

> **并行关系**（charter L122 + hcc 目录统一阶段1-3）：层3 产物按 `.hcc/{部门}/{skill}/` 落盘（本段，入库基线）；runtime 数据落 `.hcc/state`（阶段2：写固定 .hcc/state + 读 fallback .venture/state）；决策文档落 `.hcc/decisions/`（阶段3：从 .2pp 统一，旧 .2pp 向下兼容作历史归档）。`.hcc/{部门}/{skill}/` 入库；`.hcc/{state,decisions,artifacts,archived}/` + `.venture/` + `.2pp/` gitignore（层3业务产物入库，运行态/决策沙箱不入库）。

**路径模板**：`.hcc/{部门}/{venture业务skill}/{phase}_{feature}_{type}.md`
- **部门** = decision / product / dev / ops / sales（与 §2 RACI 五部门对齐）
- **agent 层** = 产出该 artifact 的 venture 业务 skill（`venture-{部门}-{维度}` 命名规范，charter L128-135）
- **命名** = `{phase=N1-N8|N3.5}_{feature}_{type}`
- **type 枚举** = prd / spec / decision / plan / architecture / report / changelog

**节点→部门→skill→type 映射**（charter 块4 L103-114，全节点 N1-N8+N3.5）：

| 节点 | 部门 | agent（venture skill） | type | 文件 |
|------|------|------------------------|------|------|
| N1 机会调查 | sales | venture-sales-judge | report | `N1_机会调查_report.md` |
| N2 竞品 | sales | venture-sales-judge | report | `N2_竞品_report.md` |
| N3 决策方案 | decision | hcc-decision（引用 cc-2pp） | decision | `N3_决策方案_decision.md` |
| **N3.5 需求规格** | **product** | **hcc-product-requirement** | **prd** | `N3.5_需求规格_prd.md` |
| (变更日志) | product | hcc-product-requirement | changelog | `N3.5_需求变更_changelog.md` |
| N4 原型 | dev | hcc-dev（引用 executor/superpowers） | plan | `N4_原型_plan.md` |
| N5 验证 | product | hcc-product-validate | decision | `N5_验证_decision.md` |
| N6 产品化 | product | hcc-product-productize | spec | `N6_产品化_spec.md` |
| N7 迭代优化 | product | hcc-product-uiux | spec | `N7_迭代优化-uiux_spec.md` |
| N8 规模化 | sales | hcc-sales-scale | plan | `N8_规模化_plan.md` |

> **agent 层前缀混合**（charter L116 (b) Boss 定）：`venture-*`（product 三件 + sales judge/scale）+ `hcc-*`（decision/dev）。decision/dev 无 venture 业务 skill = 设计正确（这两个部门本质「引用外部生态」，非缺口），不补自建方法论。

**写者归属**（C1，charter L124）：各 artifact 由对应 venture skill 经 venture 流程写；引擎（venture-pipeline）只推进节点（advance-node/resolve-hg 写 state），不直写 artifact。

> **可证伪闸**（R4.1）：grep `.hcc/{部门}` ≥1；grep `N3.5.*hcc-product-requirement.*prd` ≥1（映射表 N3.5 行）。

---

## §4 state 字段 RACI 引用（纯引用，[A-5/B-4] 修复）

> **核心修复**（50-decision §八 [A-5/B-4]）：本段**只列**「哪个部门对哪个 state 字段负 R/A/C/I」（见 §2.2 state 字段行），**绝不复制读写规则**。读写规则完全由下列 schema 文档 owns，消除双源真理。

### 4.1 引用的 schema 文档（读写规则唯一真理源）

| state 字段族 | 读写规则 owns 文档 | 引用章节 |
|-------------|------------------|---------|
| `checkpoint.json`（含 continue_from / guardrails / iteration / direction_version） | `cc-runtime/references/state-schema.md` | §1（schema）+ §1.2（字段语义）+ §6（INV-1/4/6） |
| `trace.ndjson`（每行 direction_version/node/iter） | `cc-runtime/references/state-schema.md` | §2（行 schema）+ §2.2（字段语义）+ §6（INV-4） |
| `direction.json`（current_version，唯一写者 shift-direction.js） | `cc-runtime/references/state-schema.md` | §3（schema）+ §3.4（原子写协议）+ §6（INV-1） |
| `tasks.tree.json`（direction_version 绑定） | `cc-runtime/references/state-schema.md` | §4（schema）+ §6（INV-1/5） |
| `pipeline-state.json`（current_node/frontier/iteration/status/gate/graph_hash） | `venture-pipeline/references/pipeline-state-schema.md` | §二（字段表）+ §四（写者隔离 C1）+ §六（与层1 协同） |

### 4.2 为何本段无写者函数名（纯引用验证）

本段（及 hcc-org/ 全目录）**不出现** 任何 state 写者函数的**调用符号或实现逻辑**（含层1 原子写工具 / 同步写盘 API / 层1 init 脚本 / 换向脚本的具体函数符号），原因：
- 写者函数的实现与调用属于层1/层2 脚本职责，**不属于组织协议层**（hcc-org 是协作协议容器，非运行时实现）。
- 读写规则的真理源在 schema 文档（§4.1 引用表），复制实现逻辑会制造双源真理（50-decision §八 [A-5/B-4] 否决理由）。
- 部门 SKILL.md（M3）§4 引用本段时，统一措辞「参见 charter.md §2 RACI 总表」，不复制规则（[β 嫁接]，grep 锚点固定）。

> **可证伪闸**：在 hcc-org/ 全目录下 grep 层1 原子写工具符号 / 同步写盘 API / 层1 init 脚本名 → 命中 = 0（M1 R1.1 闸2 + M4 R4.1 测试④）。本文件用「写者函数」「层1 init 脚本」「换向脚本」等职责名指代，不写具体函数符号，既表达约束又通过字面闸。

### 4.3 部门读写 state 的协议（经脚本/Hook，非直写）

部门对 state 字段的读写**经层1 Hook + 层2 脚本**间接完成，不直写文件：
- **写 trace/tasks**：H2 PostToolUse 自动写（部门产出文件时 Hook 触发，无需部门主动调函数）。
- **推进 current_node**：层2 advance-node.js（部门 plan 完成 → 引擎推进，部门不直写 pipeline-state）。
- **换向 direction**：决策部判定 → 调 shift-direction.js（总则3），不直写 direction.json。
- **读 state**：部门激活时 Read 自己负责节点的 state 字段（只读，运维部 owns 写）。

详细写者隔离表见 `pipeline-state-schema.md §四`（pipeline-state.json 写者 = pipeline-state.js + advance-node.js + resolve-hg.js）+ `state-schema.md §0`（四文件写者 = H2/H4/H5/H8 Hook）。

---

## §5 工具箱映射（5 部门 → cc-*/venture-* 工具箱技能）

> **来源**：charter L60-65 部门工具箱 + 00-explore §四覆盖度核实。技能 = 跨部门工具箱（charter A 模型：部门 = 协议层，技能 = 工具箱，原位保留按需调用，00-explore §5.1）。

| 部门 | 节点 | 工具箱技能（已 installed） | 覆盖度 | 缺口（层3 待装配） |
|------|------|--------------------------|:------:|------------------|
| **决策部** | N3/N4/HG | cc-2pp（判官小组 + 对抗验证）/ cc-goal（终态条件）/ cc-orchestration（编排决策树） | ✓ 厚实 | 无（venture-sales-judge 系统级 installed，层3 装配承接） |
| **产品部** | N5/N7/N8 | cc-loop（循环工程方法论，非产品技能） | ❌ 真空 | hcc-product-validate/productize（产品验证/产品化）/ hcc-product-uiux（UIUX 设计）—— 层3 新建（charter L80 真空标注） |
| **开发部** | 实施节点 | cc-loop（worktree SOP + 循环合同 + 护栏三件套）/ executor（OMC autopilot/ralph，外部 agent）/ superpowers:* 系列（外部 skill 生态） | ⚠️ 中等 | 代码质量/测试/重构专项（依赖外部 skill 生态，非本项目技能） |
| **运维部** | 层1 贯穿（横切） | cc-runtime（state/trace/Hook 地基）/ cc-config（六层配置 + CLAUDE.md 诊断）/ cc-context（上下文健康） | ✓ 厚实 | 无（三者覆盖 7×24 保活全链路） |
| **销售部** | N1/N2/N6 | venture-sales-judge（系统级 installed skill，创业评估师）/ cc-loop（循环方法论） | ❌ 真空 | venture-sales-judge 层3 装配承接（N1 调查/N2 竞品/N6 画像无本项目技能）+ 销售技能层3 新建（charter L80 真空） |

> **trigger 竞争规避**（00-explore §5.3）：hcc-org 是协议层，无业务 trigger（本文件 trigger 仅 `hcc-org/部门协作/部门交接`），避免与 cc-* 工具箱技能的 trigger 竞争。5 部门各自独立 trigger（hcc-{dept}），与 cc-2pp 的「2pp/judge」正交。

> **层边界声明**（50-decision §五）：本层（D10）交付协议层骨架，业务 skill 装配（placeholder → 真实 skill）= 层3 cc-venture 职责。5 部门 SKILL.md（M3）的 §业务能力 段标 `[层3 待装配]`。

---

## §6 产出项目部署契约（框架级声明，随产出等级裁剪）

> **位置**：charter 块1 复盘 P2（REVIEW MINOR 3.x 修复）。hcc 是**开发框架**，用它产出的代码项目分等级（类型集与 `hcc-product-requirement §2` 单源：PoC / MVP / 通用框架 / 生产级；Boss 口语「产品/product」对应生产级）。**部署要求随产出等级裁剪**——框架不预设静态部署档位。
>
> **为何 charter 不替项目定部署档（伪问题标注）**：「部署位置」是**下游产出项目**的属性（由其 §2 产品定位决定），而非 hcc 框架自身的属性。charter 只声明**裁剪规则**（各等级如何变），不替每个产出项目定档（那是项目 §2 cite 证据的职责）。把「框架自身是单机还是多机」当成 charter 静态属性来问 = **伪问题**（产出项目的动态属性错装成框架静态属性）——所以 REVIEW Open Question #1「charter 文档未找到此声明」不是缺陷，是必然结果。

### 6.1 三类部署位置（hcc 视角）

| 代号 | 物理位置 | git 跟踪 | 典型内容 |
|------|---------|:-------:|---------|
| `project` | 项目内 `.claude/skills/` | ✅ 入库 | 引擎 + 协议 + 治理 skill（cc-runtime / venture-pipeline / hcc-org / hcc-* / hcc-product-requirement） |
| `sandbox` | 本机临时目录（如 `E:\tmp\hcc\`） | ❌ 不入库 | 业务实装 skill（PoC 期实装，尚未固化入项目） |
| `user` | 用户级 `~/.claude/skills/` | ❌（全局） | 第三方外部 skill（venture-sales-judge / grill-me / bergside） |

### 6.2 四档 × 部署要求矩阵（复用 hcc-product-requirement §2 类型集，单源真理）

| 项目类型（§2 cite） | project | sandbox | user（外部依赖） | 可移植性要求 |
|-------------------|:------:|:------:|:------------:|------------|
| **PoC** | ✅ 随项目走 | ✅ 散落 OK | ✅ 装即可（required 缺→preflight block 提示补装；optional 缺→warn） | 无（单机验证即弃） |
| **MVP** | ✅ 必入库 | ⚠️ 实装迁回 project | ⚠️ 需可重装脚本（install 可复现） | 单机部署可重建 |
| **通用框架** | ✅ 必入库 | ❌ 禁散落（框架 = project 资产） | ⚠️ 版本锁 + 安装声明 | 可移植（作为库分发） |
| **生产级** | ✅ 必入库 | ❌ 禁散落 | ❌ 打包进项目 / 迁移 SOP | 多机横向扩展（配置外置 + 版本锁） |

### 6.3 charter block1 现状标注（PoC 档实例，合规）

charter block1 自身 = 用 hcc 框架产出的 **PoC 档**实例（业务实装验证框架）：

- **引擎层**（19 skill：cc-runtime / venture-pipeline / hcc-org / hcc-* / hcc-product-requirement）：`project` 位置，git 入库 ✅ 天然可移植
- **业务实装**（hcc-product-uiux 已迁主项目 `.claude/skills/` + N7.skill 装配）：`project` ✅（2026-06-24 从 sandbox `E:\tmp\hcc\` 迁回，PoC 档 project 位置合规；反幻觉同步契约与实际位置）
- **外部依赖**（venture-sales-judge / grill-me / bergside）：`user` ✅ PoC 档可接受（preflight warn 不阻断 N3.5 主闭环）

> **升级触发**：产出项目 §2 类型声明从 PoC → MVP / 生产级时，按矩阵触发部署升级——sandbox 业务实装迁回 project；user 依赖补可复现 install 脚本；生产级再补迁移 SOP + 配置外置。这是**项目方的职责**，非框架自动完成。

> **联动 + 单源**：本矩阵的类型集与裁剪逻辑由 `hcc-product-requirement/SKILL.md §2` 单源 owns（类型 ∈ {PoC,MVP,通用框架,生产级}，必 cite §2 证据防 agent 自选）。hcc-org 只声明「部署维度」如何随类型裁剪，不复制类型定义。
>
> **可证伪闸**（`hcc-org/scripts/hcc-deploy-contract.test.js`）：① hcc-dependencies.json 每条有 `location` ∈ {project,sandbox,user} + `required_for` 数组（元素 ∈ §2 类型集）；② venture-sales-judge 条目存在（required:true / location:user / 全档）；③ 本文件含 `hcc-product-requirement §2` 联动锚点。

---

## 深度参考

- **`references/org-protocol-deep.md`**：协作总则推导（§A）+ RACI 推导（§B）+ 交接细则（§C）+ 冲突仲裁案例库（§D）。按需加载，非必读。

---

> **charter.md 完。** 7 段：§0 初始化自检 + §1 协作总则5条 + §2 RACI 总表（节点行 + state 字段行）+ §2 冲突仲裁规则（必读层）+ §3 交接协议 + §4 state 字段纯 RACI 引用 + §5 工具箱映射 + §6 产出项目部署契约。protocol_version: "D11-2026-06-22" 供 M2 cmdInit 读取。hcc-org/ 全目录 0 state 写者函数调用（§4 纯引用验证）；§0 自检脚本写 .hcc/ops/（非层1 state）；§6 部署要求随产出等级裁剪（单源 hcc-product-requirement §2）。
