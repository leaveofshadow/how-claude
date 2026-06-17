---
run: 2026-06-17-hcc-org-departmentalization
artifact: impl-plan
created: 2026-06-17
status: draft
author: 创造类一等公民 agent（general-purpose，Phase 4 Step 4a）
basis: 50-decision §一/§八（α' 胜出）+ 40-synthesis §五 + 30-score + 00-explore
layer: D10 协议层骨架（本层不装配业务 skill，层3 cc-venture 职责）
---

# 60-impl-plan.md —— D10 hcc 部门化重组实施计划（编排契约）

> 本文件是 **编排契约**：把 α'（50-decision §八）的物理结构 + 4 项裁决必落地修复，拆成可被 Claude Code + 已装载 skills 执行的里程碑 + 智能体配置 + 执行模式 + 验证闸 + 风险。
> **实施者 = Claude Code + 已装载 skills**（非人类团队）。所有工作量按 Claude 度量（token / 上下文轮次 / skill 配置成本 / 验证复杂度 / 依赖风险），禁人天/人周/排期/学习曲线/团队熟练度。

---

## 〇、技术选型确认（裁决倾向 → 定稿）

### 0.1 protocol_version_read 字段 vs H7 hook（[B-2/C-4] 共同缺陷修复的机制选择）

| 选项 | 机制 | 与层2 schema 一致性 | 新增钩子 | 与 state-schema §7.3 变更门 | 裁决 |
|------|------|--------------------|---------|---------------------------|------|
| **A. pipeline-state 加 `protocol_version_read` 字段** | 部门激活时把读到的 hcc-org.protocol_version 写入 pipeline-state.json | ✅ 与现有 8 字段同文件（pipeline-state-schema.md §二），扩展为 9 字段 | **0 新钩子**（方案 C 基线层） | **minor 变更门**（state-schema.md L300：加字段 + init 补默认值 + 重跑 70-requirements §1.1/1.2） | **✅ 采纳** |
| B. PostToolUse H7 hook 注入协议摘要 | 部门 Skill 加载时 hook 把 hcc-org 摘要注入上下文 | ❌ hook 副作用不可观测写入 state | **+1 新钩子**（违反方案 C 基线层"零新钩子"） | 不走 schema 变更门，但破坏基线层纯净 | ❌ 否决 |

**裁决理由（带证据）**：
1. **方案 C 基线层约束**：50-decision §一/§五明确本层"零新钩子基线层"。H7 hook 是新增 PreToolUse/PostToolUse，违反基线层纯净（00-explore §五未列入基线层 hook 清单）。
2. **与层2 schema 一致**：pipeline-state-schema.md §二已定义 8 字段 + §三 init 默认值 + §四写者隔离表（pipeline-state.js + advance-node.js + resolve-hg.js 写）。加第 9 字段 `protocol_version_read` 是 schema 内部扩展，不引入新机制。
3. **state-schema §7.3 变更门 minor**：state-schema.md L300「minor（加字段）：本文档更新 + init-state.js 补默认值 + 重跑 70-requirements §1.1/1.2。不阻塞层3」——protocol_version_read 是 minor 加字段，仅需 pipeline-state.js `cmdInit`（pipeline-state.js L100）补默认值 + 回归 37+29 测试，不动 frozen-v1 语义。
4. **可证伪性强**：字段值可被 `node -e "console.log(require('./.venture/state/pipeline-state.json').protocol_version_read)"` 直接读取断言，hook 副作用则不可观测。

**结论**：**采纳 A（字段方案）**。`protocol_version_read` 加到 pipeline-state.json，由 pipeline-state.js `cmdInit` 写入（C1 写者隔离：pipeline-state.json 写者 = pipeline-state.js + advance-node.js + resolve-hg.js，见 pipeline-state-schema.md §4.3）。

### 0.2 α' 物理结构定稿（50-decision §一）

```
.claude/skills/
├── hcc-org/                              # 组织层·协议宪法（charter L69/L75 物理指定）
│   ├── SKILL.md                          # 协作总则5条 + RACI总表(5部门×节点) + 冲突仲裁§2必读 + 交接协议 + §4纯RACI引用
│   ├── references/                       # 深度参考（按需加载，非必读）
│   │   └── org-protocol-deep.md          # 协作总则深度展开 + RACI 推导 + 交接协议细则
│   └── scripts/
│       └── hcc-org-consistency.test.js   # [A-4/B-3 修复] 一致性测试（纯 Node fs+path）
├── hcc-decision/                         # 决策部·trigger:hcc-decision
│   └── SKILL.md                          # 职责 + plan/review 流程 + trigger + §交接引用总则 RACI 锚点 + §业务能力[层3 待装配]
├── hcc-product/                          # 产品部·trigger:hcc-product
│   └── SKILL.md                          # 同上结构
├── hcc-dev/                              # 开发部·trigger:hcc-dev
│   └── SKILL.md
├── hcc-ops/                              # 运维部·trigger:hcc-ops（state 字段读写由 state-schema owns，§4 纯引用）
│   └── SKILL.md
└── hcc-sales/                            # 销售部·trigger:hcc-sales
    └── SKILL.md
```

**关键设计点（裁决落地）**：
- hcc-org/SKILL.md §4 = **纯 RACI 引用**（[A-5/B-4 修复]）——只列"哪个部门对哪个 state 字段负 R/A/C/I"，**不复制读写规则**（读写规则完全由 cc-runtime/state-schema.md owns，C1 唯一写者源头）。
- 5 部门 SKILL.md §交接段 = **强制引用总则 RACI 锚点**（[β 嫁接]）——引用 `hcc-org/SKILL.md §2 RACI 总表` 具体行号锚点，避免部门不读 RACI。
- 5 部门 SKILL.md §业务能力段 = 标注 `[层3 待装配]`（[A-7/C-7 修复]）——列该部门需哪些 venture-* skill，但装配留层3 cc-venture。

---

## 一、模块拆分（α' 物理结构 + 4 项修复，工作量按 Claude 度量）

| 模块 | 文件 | 职责 | 对应修复 | token 预估 | 验证复杂度 |
|------|------|------|---------|-----------|-----------|
| **hcc-org/SKILL.md** | 1 | 协作总则5条 + RACI总表 + 冲突仲裁§2必读 + 交接协议 + §4纯RACI引用 | [A-5/B-4][A-8] | ~12k | 一致性测试 grep 锚点 |
| **hcc-org/references/org-protocol-deep.md** | 1 | 深度参考（按需加载） | — | ~6k | 无（非必读） |
| **hcc-org/scripts/hcc-org-consistency.test.js** | 1 | 一致性测试（grep 5部门引用锚点 + 总则自检） | **[A-4/B-3]** | ~3k | `node` 跑绿 |
| **hcc-decision/SKILL.md** | 1 | 决策部协议骨架 | — | ~4k | grep trigger + 引用锚点 |
| **hcc-product/SKILL.md** | 1 | 产品部协议骨架 | — | ~4k | 同上 |
| **hcc-dev/SKILL.md** | 1 | 开发部协议骨架 | — | ~4k | 同上 |
| **hcc-ops/SKILL.md** | 1 | 运维部协议骨架（state §4 纯引用） | — | ~4k | 同上 |
| **hcc-sales/SKILL.md** | 1 | 销售部协议骨架 | — | ~4k | 同上 |
| **pipeline-state.js `cmdInit` 扩展** | 改 1 处 | 加 `protocol_version_read` 字段写入（读 hcc-org.protocol_version） | **[B-2/C-4]** | ~1k | 回归 37+29 测试 |
| **pipeline-state-schema.md §二/§三 扩展** | 改 1 文档 | 字段表加第 9 行 + init 默认值加字段 | **[B-2/C-4]** | ~1k | 文档评审 |
| **pipeline-state.test.js 扩展** | 改 1 测试 | 断言 init 后 protocol_version_read 字段存在 + 等于 hcc-org.protocol_version | **[B-2/C-4]** | ~2k | 跑绿 |
| **advance-node.test.js 扩展** | 改 1 测试 | 断言 loop_back 时 iteration 累加（max_iteration 写者验证） | **[B-7]** | ~2k | 跑绿 |
| **venture-resume.test.js 扩展（部门中间态）** | 改 1 测试 | compact 前后部门工作中间态从 trace/tasks.tree 恢复 | **[B-6]** | ~3k | 跑绿 |
| **CLAUDE.md（项目根）** | 改 1 文档 | 项目结构段补 hcc-org + 5 部门目录 | — | ~1k | 文档评审 |

**汇总（Claude 度量）**：
- **文件**：14 个新增 + 5 个改动 = **19 文件触碰**（与 50-decision §九 14-16 文件预估一致，含 4 项修复测试 +2）
- **token**：~47k（新增 41k + 改动 6k），与 50-decision §九 ~70-80k 预估的下半段一致（α' 已剔除 γ 的 sync-protocol.js 重复）
- **上下文轮次**：~20-24 轮（含 4 项修复测试 TDD 红→绿）
- **skill 配置成本**：新增 6 skill 目录（hcc-org + 5 部门）；纯新增不动层1/层2 脚本逻辑（仅 pipeline-state.js 加 1 字段写入点）
- **验证复杂度**：5 个可证伪闸（consistency.test / protocol_version_read 断言 / max_iteration 写者 / 断点续传中间态 / RACI 仲裁段存在性）

---

## 二、里程碑（M1-M5，串并行编排）

> 编排原则：**hcc-org 协议宪法串行先做（5 部门依赖）→ pipeline-state 字段（层2 schema minor）→ 5 部门并行（≤2 worktree 槽位排队）→ 一致性测试 → 断点续传部门中间态测试**。

### M1：hcc-org 协议宪法根（串行，5 部门依赖前置）

**交付物**：
- `hcc-org/SKILL.md`（协作总则5条 + RACI总表 + 冲突仲裁§2必读 + 交接协议 + §4纯RACI引用）
- `hcc-org/references/org-protocol-deep.md`（深度参考）

**可证伪验收条件**：
1. hcc-org/SKILL.md 含 §2 RACI 总表段（grep `## §2 RACI 总表` 命中）
2. hcc-org/SKILL.md §4 为纯 RACI 引用（无 state 字段读写规则复制——grep `atomicWriteJSON\|writeFileSync\|init-state` 在 hcc-org/ 下 0 命中，证明不复制层1 写者逻辑）
3. hcc-org/SKILL.md 含冲突仲裁段（grep `冲突仲裁` 命中且在 §2 必读层，[A-8] 修复）
4. hcc-org/SKILL.md frontmatter 含 `protocol_version` 字段（供 M2 字段写入读取）

### M2：pipeline-state protocol_version_read 字段（层2 schema minor，回归 37+29 测试）

**交付物**：
- `pipeline-state-schema.md` §二字段表加第 9 行 `protocol_version_read` + §三 init 默认值补字段
- `pipeline-state.js` `cmdInit`（L100）扩展：读 hcc-org.protocol_version（若 hcc-org 未装则 fallback=null）写入 `protocol_version_read`
- `pipeline-state.test.js` 扩展：断言 init 后 `protocol_version_read` 字段存在 + 等于 hcc-org/SKILL.md frontmatter protocol_version

**可证伪验收条件**：
1. `node pipeline-state.test.js` 跑绿（含新断言：`state.protocol_version_read === expectedVersion`）
2. `node advance-node.test.js` 跑绿（回归，iteration 字段未被破坏）
3. `node venture-resume.test.js` 跑绿（回归，current_node 续传未被破坏）
4. 全量回归：`scripts/` 下 37+29 测试全绿（state-schema §7.3 minor 变更门要求）

### M3：5 部门 SKILL.md（并行，≤2 worktree 槽位排队）

**交付物**：
- `hcc-decision/SKILL.md` / `hcc-product/SKILL.md` / `hcc-dev/SKILL.md` / `hcc-ops/SKILL.md` / `hcc-sales/SKILL.md`

**每个部门 SKILL.md 必含段（保姆级，详见 70-requirements R3.n）**：
- frontmatter（name + description + trigger:hcc-{dept}）
- §1 部门职责（一句话 + charter L60-65 节点映射）
- §2 plan 流程（cc-2pp 判官 + 对抗）
- §3 review 流程（cc-2pp 对抗验证）
- §4 交接协议（**强制引用 hcc-org/SKILL.md §2 RACI 总表锚点**，[β 嫁接]）
- §5 业务能力（标注 `[层3 待装配]` + 列该部门需哪些 venture-* skill，[A-7/C-7] 修复）
- §6 trigger（hcc-{dept} 独立 trigger，[β 嫁接]）

**可证伪验收条件**：
1. 5 部门 SKILL.md frontmatter trigger 各自独立（grep `trigger:.*hcc-decision` / `hcc-product` / `hcc-dev` / `hcc-ops` / `hcc-sales` 各命中 1 次）
2. 5 部门 §4 交接段引用 hcc-org/SKILL.md §2 RACI 锚点（grep `hcc-org/SKILL.md.*§2\|RACI 总表` 各命中 ≥1 次）
3. 5 部门 §5 含 `[层3 待装配]` 标记（grep `[层3 待装配]` 命中 ≥5 次）
4. hcc-ops/SKILL.md §4 为纯 RACI 引用（grep `atomicWriteJSON\|writeFileSync` 在 hcc-ops/ 下 0 命中——运维部不自写 state，[A-5/B-4] 修复）

### M4：hcc-org 一致性测试（[A-4/B-3] 修复）

**交付物**：
- `hcc-org/scripts/hcc-org-consistency.test.js`（纯 Node fs+path，C2 合规）

**测试覆盖（保姆级，详见 70-requirements R4.n）**：
- ① grep 5 部门 SKILL.md 引用 hcc-org/SKILL.md §2 RACI 锚点（5 部门各命中 ≥1）
- ② 总则自检：hcc-org/SKILL.md §2 RACI 总表每行 R/A/C/I 非空（结构化校验，非自由文本）
- ③ 冲突仲裁段存在性（[A-8] 修复）
- ④ hcc-org/ 下无 state 写者逻辑复制（[A-5/B-4] 修复，grep atomicWriteJSON 0 命中）

**可证伪验收条件**：
1. `node hcc-org/scripts/hcc-org-consistency.test.js` exit 0（跑绿）
2. 故意破坏测试（删某部门 §4 RACI 引用）→ exit 1（证伪性验证）

### M5：断点续传部门中间态测试（[B-6] 修复）

**交付物**：
- `venture-resume.test.js` 扩展（复用层2 已有断点续传测试框架）

**测试覆盖（保姆级，详见 70-requirements R5.n）**：
- 模拟部门 plan 进行中（trace.ndjson 有 node:N3,action:reasoning,direction_version:1 中间态行）
- compact（trace 截断到快照点）
- resume（venture-resume.js 读 checkpoint.continue_from + pipeline-state.current_node 恢复）
- 断言：部门工作中间态从 trace/tasks.tree 恢复（不静默丢）

**可证伪验收条件**：
1. `node venture-resume.test.js` 跑绿（含新断言：resume 后 trace 末行 node/iter 与 compact 前一致）
2. 全量回归：37+29 测试全绿

---

## 三、所需 skills 清单（假设1推论4，消费 00-explore 能力清单）

| skill | 在哪步用（M.n） | 用途 |
|-------|----------------|------|
| **cc-2pp** | M1（hcc-org/SKILL.md §2 plan/review 流程引用）/ M3（5 部门 §2/§3 流程引用） | 部门 plan/review 双能力的判官 + 对抗验证流程来源（00-explore §一 cc-2pp 行） |
| **cc-runtime** | M1（hcc-org/SKILL.md §4 纯 RACI 引用 state-schema）/ M3（hcc-ops §4 纯引用） | state 字段读写规则唯一 owns（state-schema.md frozen-v1），部门只引用不复制（00-explore §二） |
| **venture-pipeline** | M2（pipeline-state.js cmdInit 扩展）/ M5（venture-resume.test.js 扩展） | pipeline-state 字段扩展 + 断点续传测试框架（00-explore §三） |
| **cc-loop** | M1（hcc-org/SKILL.md 交接协议引用循环合同护栏）/ M3（5 部门 §2 plan 引用 max_iteration 护栏） | plan/review 回环上限 max_iteration 护栏（00-explore §6.5） |
| **cc-orchestration** | M1（hcc-org/SKILL.md 部门协作 subagent/workflow 决策树引用） | 部门间协作编排决策（00-explore §一 cc-orchestration 行） |
| **cc-config** | M1（hcc-org/SKILL.md §4 引用六层配置体系） | state/config 信息源单一性约束（charter L64 运维部主信息源） |
| **cc-context** | M3（hcc-ops/SKILL.md 引用上下文健康） | 运维部 7×24 保活的上下文管理（charter L64） |
| **cc-goal** | M3（hcc-decision/SKILL.md §2 引用终态条件） | 决策部 HG 拍板的终态条件设计（charter L61） |
| **venture-judge**（系统级 installed） | M3（hcc-sales/SKILL.md §5 列为 [层3 待装配] 业务 skill） | 销售部 N1/N2/N6 调查/竞品/画像（charter L65，00-explore §四销售部行） |
| **executor / superpowers:\***（外部 agent/skill） | M3（hcc-dev/SKILL.md §5 列为 [层3 待装配]） | 开发部实施执行（charter L63，00-explore §四开发部行） |

**本计划执行所需 skill（执行者装载）**：
- **必装**：cc-2pp（本计划本身是 2pp 产物）、cc-runtime（M1/M3 引用 state-schema）、venture-pipeline（M2/M5 改脚本）
- **按需**：cc-loop / cc-orchestration / cc-config / cc-context / cc-goal（写部门 SKILL.md 时引用其方法论）

---

## 四、执行编排（实施者落地核心）

### 4.1 智能体配置表

| 里程碑 | agent 数 | 类型 | 并行/串行 | 理由 |
|--------|---------|------|----------|------|
| **M1 hcc-org 协议宪法** | 1 | 创造类 general-purpose | **串行** | 5 部门依赖 hcc-org 总则（C-3 回归测串行，40-synthesis §3.2），必须先于 M3 |
| **M2 pipeline-state 字段** | 1 | 创造类 general-purpose | **串行**（M1 后） | 层2 schema minor 变更，需回归 37+29 测试，串行避免测试竞争 |
| **M3 5 部门 SKILL.md** | 2 | 创造类 general-purpose ×2 | **并行（≤2 槽位排队）** | 5 部门相互独立（各自 trigger + §4 引用同总则锚点但业务不同），可 worktree 并行；槽位 ≤2 故 5 部门分 3 批（2+2+1） |
| **M4 一致性测试** | 1 | 创造类 general-purpose | **串行**（M3 后） | 测试需 grep 5 部门 SKILL.md，必须 M3 全交付后 |
| **M5 断点续传部门中间态测试** | 1 | 创造类 general-purpose | **串行**（M4 后） | 复用 venture-resume.test.js 框架，独立于 M3/M4 |

**agent 总数**：M1(1) + M2(1) + M3(2 并行 ×3 批次) + M4(1) + M5(1) = **峰值 2 并发，累计 6 agent 调用**。

### 4.2 技能组合（本计划执行需哪些 skill + 各在哪步用）

| 执行步 | 装载 skill | 用途 |
|--------|-----------|------|
| M1 写 hcc-org/SKILL.md | cc-2pp + cc-runtime + cc-loop + cc-orchestration | §2 RACI 总表（cc-2pp 判官）+ §4 纯引用 state-schema（cc-runtime）+ 交接协议护栏（cc-loop）+ 部门协作（cc-orchestration） |
| M2 改 pipeline-state.js | venture-pipeline + cc-runtime | cmdInit 扩展（venture-pipeline 脚本）+ atomicWriteJSON 复用（cc-runtime init-state.js） |
| M3 写 5 部门 SKILL.md | cc-2pp + cc-runtime + 对应部门工具 skill | §2/§3 plan/review（cc-2pp）+ §4 纯引用（cc-runtime）+ §5 列业务 skill（venture-judge/cc-goal 等） |
| M4 写一致性测试 | 无（纯 Node fs+path） | C2 合规：纯 Node 内建，禁外部依赖（persona-signal.test.js 先例） |
| M5 扩展 venture-resume.test.js | venture-pipeline | 复用层2 断点续传测试框架（spawnSync + 造 fixture） |

### 4.3 执行模式 + 分步表

| 里程碑 | /goal 一次性 or /loop 多步 | 步数 | 每步边界 |
|--------|--------------------------|------|---------|
| **M1** | **/goal 一次性**（单文件 hcc-org/SKILL.md + references，目标清晰） | 1 步 | 写完 hcc-org/SKILL.md + org-protocol-deep.md，跑 grep 验收 4 条 |
| **M2** | **/goal 一次性**（改 1 处 cmdInit + 1 测试，目标清晰） | 1 步 | 改 pipeline-state.js L100 cmdInit + pipeline-state.test.js 加断言，跑 37+29 回归 |
| **M3** | **/loop 多步**（5 部门分 3 批，每批 ≤2 并行） | 3 步 | 步1：hcc-decision + hcc-product（批1）；步2：hcc-dev + hcc-ops（批2）；步3：hcc-sales（批3）。每步边界：写完该批部门 SKILL.md，跑 grep trigger + RACI 引用验收 |
| **M4** | **/goal 一次性**（单测试文件，目标清晰） | 1 步 | 写 hcc-org-consistency.test.js，跑 `node` 跑绿 + 故意破坏证伪 |
| **M5** | **/goal 一次性**（扩展 1 测试文件，目标清晰） | 1 步 | 扩展 venture-resume.test.js 加部门中间态断言，跑绿 + 37+29 回归 |

**总步数**：1+1+3+1+1 = **7 步**（M3 的 3 批是 /loop 多步，其余 /goal 一次性）。

### 4.4 worktree 并发分配（槽位 ≤2 可排队）

```
时间轴 →
─────────────────────────────────────────────────────────
worktree-1 [M1 hcc-org]    [M2 pipeline-state]  [M3 批1 decision+product]  [M3 批3 sales]  [M4 consistency]  [M5 resume-test]
worktree-2                       —                   [M3 批2 dev+ops]            —                —                 —
─────────────────────────────────────────────────────────
```

**编排约束**：
- **M1 串行先于 M3**（hcc-org 总则是 5 部门 §4 引用源，C-3 回归测串行，40-synthesis §3.2）
- **M2 串行**（层2 schema 变更，回归测试竞争敏感，不并行）
- **M3 并行 ≤2 槽位**（5 部门独立，槽位限制分 3 批：批1{decision,product} + 批2{dev,ops} + 批3{sales}）
- **M4 串行 M3 后**（测试 grep 5 部门，必须全交付）
- **M5 串行 M4 后**（独立扩展，无并行收益）

---

## 五、执行协议（闭环反馈）

### 5.1 验证闸表

| 步骤 | 验证命令 | 通过判据（可证伪） | 失败动作 |
|------|---------|-------------------|---------|
| **M1 闸** | `grep -c "## §2 RACI 总表" hcc-org/SKILL.md` + `grep -rcl "atomicWriteJSON\|writeFileSync" hcc-org/` | 前者 ≥1，后者 =0 | 重写 hcc-org/SKILL.md §4 为纯引用 |
| **M2 闸** | `node pipeline-state.test.js` + `node advance-node.test.js` + `node venture-resume.test.js` | 全 exit 0，且 pipeline-state.test.js 含 `protocol_version_read === expectedVersion` 断言 | 检查 cmdInit 是否读 hcc-org.protocol_version；fallback=null 是否生效 |
| **M3 闸** | `grep -rl "trigger:.*hcc-decision\|hcc-product\|hcc-dev\|hcc-ops\|hcc-sales" hcc-*/SKILL.md` + `grep -c "\[层3 待装配\]" hcc-*/SKILL.md` | 前者 5 命中，后者 ≥5 | 补缺失部门 §5 [层3 待装配] 标记 |
| **M4 闸** | `node hcc-org/scripts/hcc-org-consistency.test.js` | exit 0（跑绿） | 故意破坏测试（删某部门 §4 RACI 引用）→ 应 exit 1；若仍 exit 0 则测试无效，重写 |
| **M5 闸** | `node venture-resume.test.js` | exit 0，含部门中间态恢复断言 | 检查 trace.ndjson fixture 是否有 node:N3,action:reasoning 中间态行 |

### 5.2 提交 / 回滚协议

- **一步一 conventional commit**：每个里程碑（M1-M5）交付后 `git add -A && git commit -m "feat(hcc-org): M{n} {里程碑名}"`（项目无 git repo 时改为文件落盘 + 状态记录）
- **失败 git restore 回滚该步**：验证闸失败 → `git restore hcc-org/`（或对应改动文件）→ 重写
- **里程碑全闸过打 tag**：M5 全闸过 → `git tag hcc-org-D10-complete`（标记 D10 协议层骨架交付）

**commit 消息模板**（conventional commits）：
```
feat(hcc-org): M{n} {里程碑简述}

- {交付物1}
- {交付物2}
- 验证闸：{命令} {通过判据}

Refs: 50-decision §八 α' / 60-impl-plan M{n}
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 六、风险清单 + 下一步行动

### 6.1 风险清单

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| **R1. hcc-org/SKILL.md §4 误复制 state 读写规则**（违反 [A-5/B-4]） | 中 | 高（双源真理，C1 唯一写者被破坏） | M1 闸 grep `atomicWriteJSON\|writeFileSync` 在 hcc-org/ 下必须 0 命中；M4 一致性测试覆盖 |
| **R2. pipeline-state.js cmdInit 读 hcc-org.protocol_version 时 hcc-org 未装**（M2 在 M1 后但部署顺序可能乱） | 低 | 中（fallback=null 即可，不阻塞） | cmdInit 加 fallback：`protocol_version_read: hccOrgVersion ?? null`（pipeline-state-schema.md §三 init 默认值补 null） |
| **R3. M3 并行 worktree 合并冲突**（5 部门 SKILL.md 独立但可能同时改 CLAUDE.md 项目结构段） | 中 | 低（CLAUDE.md 改动小） | CLAUDE.md 项目结构段由 M1 串行先改（hcc-org 目录），M3 只新增部门目录不动 CLAUDE.md |
| **R4. M4 一致性测试 grep 锚点脆弱**（部门 §4 引用措辞不统一） | 中 | 中（测试假绿） | 70-requirements R3.n 强制统一引用措辞：`参见 hcc-org/SKILL.md §2 RACI 总表`（固定锚点字符串） |
| **R5. M5 venture-resume.test.js fixture 复杂**（模拟 compact 前后部门中间态） | 中 | 中（测试写不出） | 复用 venture-resume.test.js L46-50 makeIsolatedRoot 框架，trace fixture 用 fs.writeFileSync 追加 node:N3,action:reasoning 行 |
| **R6. 认知锚定失败复发**（C-2：文档误用人天隐喻） | 低 | 高（违反裁决铁律） | 60/70 全文禁"新人/团队/用户理解/学习成本/排期"；M4 闸后人工 grep 复检 |

### 6.2 下一步行动（今天能做的第一件事）

**第一件事：启动 M1（hcc-org 协议宪法根）**

执行命令（给编排者）：
```
启动 1 个创造类 general-purpose agent（worktree-1，串行），装载 skill: cc-2pp + cc-runtime + cc-loop + cc-orchestration，执行 70-requirements R1.1-R1.4：
1. 写 hcc-org/SKILL.md（协作总则5条 + RACI总表 + 冲突仲裁§2必读 + 交接协议 + §4纯RACI引用）
2. 写 hcc-org/references/org-protocol-deep.md（深度参考）
3. frontmatter 加 protocol_version: "D10-2026-06-17"（供 M2 字段读取）
4. 跑 M1 闸：grep §2 RACI 总表 ≥1 + grep atomicWriteJSON 在 hcc-org/ =0
```

**验证 M1 闸过 → 启动 M2（pipeline-state 字段）→ M3（5 部门并行）→ M4 → M5 → tag hcc-org-D10-complete**。

---

## 七、层衔接契约（50-decision §五）

```
D10（本层）交付边界:
  ✅ 交付: 协议层骨架
     · hcc-org/（组织宪法 + RACI 总表 + 交接协议 + 一致性测试）
     · 5 部门 SKILL.md（职责 + plan/review 流程 + trigger + §交接引用总则）
     · pipeline-state 扩展 protocol_version_read 字段（层2 schema minor 变更）
  ❌ 不交付: 业务 skill 装配
     · placeholder → 真实 skill（venture-judge/venture-persona 等）= 层3 cc-venture 职责
     · "节点路由→部门加载"完整链路验证 = 层3

层衔接契约:
  · 本层 5 部门 SKILL.md 的 §业务能力 段标注 [层3 待装配]，列该部门需哪些 venture-* skill
  · 层3 cc-venture 装配业务 skill 时，验证部门 SKILL.md 的 protocol_version_read 闭环
```

---

> **60-impl-plan.md 完。** 5 里程碑（M1-M5），7 执行步，峰值 2 并发，6 agent 调用，~47k token，14 新增 + 5 改动 = 19 文件触碰。技术选型：protocol_version_read 字段（A 方案，零新钩子，minor 变更门）。4 项修复全含验证闸（M2 protocol_version_read / M4 consistency.test / M5 断点续传中间态 / advance-node.test max_iteration）。下一步：启动 M1。
