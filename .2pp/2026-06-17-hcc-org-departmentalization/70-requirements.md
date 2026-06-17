---
run: 2026-06-17-hcc-org-departmentalization
artifact: requirements
created: 2026-06-17
status: draft
author: 创造类一等公民 agent（general-purpose，Phase 4 Step 4b）
basis: 60-impl-plan.md M1-M5（保姆级需求，M 划分对齐）+ 50-decision §八 α'
layer: D10 协议层骨架
---

# 70-requirements.md —— D10 hcc 部门化重组保姆级需求（配套 60）

> 本文件是 **保姆级需求**：每项拆到"新实例只看一条就能动手"，禁"实现 X 功能"模糊。验证闸全部可证伪（命令 + 期望输出，禁"适当/合理"）。
> M 划分与 60-impl-plan.md 完全对齐（同一 M0-M5）。
> **实施者 = Claude Code + 已装载 skills**。预估按会话·token（禁人天/人周/排期/学习曲线）。

---

## 度量与约束（前置，所有 R 项适用）

- **C1 写入隔离**：direction.json 仅 shift-direction.js 写；pipeline-state.json 由 pipeline-state.js + advance-node.js + resolve-hg.js 写（protocol_version_read 字段加在 pipeline-state.js 的 cmdInit 写入点，pipeline-state-schema.md §4.3）。
- **C2 技术约束**：所有脚本纯 Node 内建（fs + path + crypto），禁 vm/eval/Function/外部依赖/子进程 spawn（persona-signal.test.js L18 先例）。venture-resume.test.js 用 spawnSync 造 fixture 是测试侧豁免（被测脚本仍纯内建）。
- **C5/C6/C7**：subgraph/fan_out 字段保留触发错误；graph_hash 反静默偏移；占位符节点转移拓扑运行≠业务运行（本层 5 部门 §5 标 [层3 待装配]）。
- **事实声明带证据**：引用 charter/score/attack/state-schema 标行号或节号。
- **禁人天隐喻词**：全文禁"新人/团队/用户理解/学习成本/上手成本/排期/熟练度"（C-2 修正，30-score.md L74 已犯此错）。

---

## M1：hcc-org 协议宪法根（串行，5 部门依赖前置）

### R1.1 写 hcc-org/SKILL.md 主文件

**做什么**：创建 `.claude/skills/hcc-org/SKILL.md`，含组织层协议宪法。

**输入触发**：60-impl-plan M1 启动；50-decision §一物理结构（hcc-org/ 目录）；charter L69/L75 物理指定（反引号+ASCII 树）。

**输出交付**：`.claude/skills/hcc-org/SKILL.md`，必含以下段（按顺序）：
1. **frontmatter**：
   ```yaml
   ---
   name: hcc-org
   description: 组织层·协议宪法（5 部门协作总则 + RACI 总表 + 交接协议）
   protocol_version: "D10-2026-06-17"
   trigger: hcc-org/部门协作/部门交接
   ---
   ```
   （protocol_version 供 M2 R2.1 cmdInit 读取）
2. **§1 协作总则5条**（编号 1-5，每条一句话 + 一段说明）：
   - 总则1：部门间不直接对话，经层1 state/direction/trace 交换上下文（charter L67 原话）
   - 总则2：plan/review 遵循 cc-2pp（判官 + 对抗验证）
   - 总则3：换向必经 shift-direction.js（C1 约束，部门不直写 direction.json，00-explore §5.7）
   - 总则4：state 字段读写规则由 cc-runtime/state-schema.md owns（hcc-org §4 只列 RACI 不复制规则，[A-5/B-4] 修复）
   - 总则5：plan/review 回环上限 max_iteration（checkpoint.guardrails，00-explore §6.5）
3. **§2 RACI 总表（必读层）**：表格 5 部门 × 关键节点/状态字段，每格填 R/A/C/I 之一（非空）。行 = venture 节点（N1-N8 + HG1/HG2）+ 状态字段（direction_version/current_node/iteration/status/gate/trace/checkpoint.continue_from）；列 = 5 部门（决策/产品/开发/运维/销售）。每行每列 R/A/C/I 至少 1 个 R + 1 个 A（[A-8] 冲突仲裁基准）。
4. **§2.1 冲突仲裁规则（必读层，[A-8] 修复）**：多部门协作节点的 R/A 冲突仲裁规则（如同一节点 2 个部门都标 R → 决策部仲裁；A 冲突 → 决策部 HG 拍板）。
5. **§3 交接协议**：部门 A 产出 → 落盘 `.venture/artifacts/v{n}/` 约定文件名 → 部门 B 读该文件继续（cc-2pp 假设4 agent 写文件/编排者读文件原型，00-explore §5.4）。列 5 部门交接文件命名约定。
6. **§4 state 字段 RACI 引用（纯引用，[A-5/B-4] 修复）**：只列"哪个部门对哪个 state 字段负 R/A/C/I"，**不复制读写规则**（读写规则引用 cc-runtime/references/state-schema.md §2.1-§2.5 + pipeline-state-schema.md §二）。本段禁出现 `atomicWriteJSON`/`writeFileSync`/`init-state`/`shift-direction` 等写者函数名（只引用脚本职责，不复制实现）。
7. **§5 工具箱映射**：5 部门 → cc-*/venture-* 工具箱技能映射表（charter L60-65 + 00-explore §四）。

**可证伪验证**：
```bash
# 闸1：§2 RACI 总表段存在
grep -c "## §2 RACI 总表" .claude/skills/hcc-org/SKILL.md
# 期望输出：1（≥1）

# 闸2：§4 纯引用，无 state 写者逻辑复制
grep -rcl "atomicWriteJSON\|writeFileSync\|init-state\.js" .claude/skills/hcc-org/
# 期望输出：0（hcc-org/ 下 0 命中）

# 闸3：冲突仲裁段在 §2 必读层
grep -c "§2.1 冲突仲裁\|冲突仲裁规则" .claude/skills/hcc-org/SKILL.md
# 期望输出：≥1

# 闸4：frontmatter protocol_version 字段
grep -c "^protocol_version:" .claude/skills/hcc-org/SKILL.md
# 期望输出：1

# 闸5：协作总则5条编号
grep -cE "^### 总则[1-5]" .claude/skills/hcc-org/SKILL.md
# 期望输出：5
```

**依赖**：无（M1 是起点）。

**预估**：1 会话 · ~12k token（含 RACI 总表 8 节点 × 5 部门 = 40 格填充 + 5 总则 + 交接协议）。

---

### R1.2 写 hcc-org/references/org-protocol-deep.md 深度参考

**做什么**：创建 `.claude/skills/hcc-org/references/org-protocol-deep.md`，按需加载的深度参考（非必读）。

**输入触发**：R1.1 完成后；hcc-org/SKILL.md §2/§3 的深度展开需求。

**输出交付**：`.claude/skills/hcc-org/references/org-protocol-deep.md`，含：
- §A 协作总则深度推导（每条总则的设计理由 + charter/explore 证据锚点）
- §B RACI 总表推导过程（每个 R/A/C/I 分配的依据，charter L60-65 节点归属）
- §C 交接协议细则（文件命名约定规范格式 + direction_version 绑定规则 + handoff pair 不灌完整 trace，00-explore §6.3）
- §D 冲突仲裁案例库（≥3 个多部门协作节点的 R/A 冲突场景 + 仲裁路径）

**可证伪验证**：
```bash
# 闸1：深度参考文件存在且非空
node -e "const fs=require('fs');const s=fs.statSync('.claude/skills/hcc-org/references/org-protocol-deep.md');console.log(s.size>1000?'OK':'FAIL')"
# 期望输出：OK

# 闸2：含冲突仲裁案例库
grep -c "§D 冲突仲裁案例\|冲突仲裁案例库" .claude/skills/hcc-org/references/org-protocol-deep.md
# 期望输出：≥1
```

**依赖**：R1.1（深度参考展开 SKILL.md 总则）。

**预估**：1 会话 · ~6k token。

---

## M2：pipeline-state protocol_version_read 字段（层2 schema minor，回归 37+29 测试）

### R2.1 扩展 pipeline-state.js cmdInit 写入 protocol_version_read

**做什么**：改 `.claude/skills/venture-pipeline/scripts/pipeline-state.js` 的 `cmdInit` 函数（L100），加 `protocol_version_read` 字段写入。

**输入触发**：60-impl-plan M2；50-decision §八 [B-2/C-4] 修复；技术选型确认（60 §0.1 采纳 A 字段方案）。

**输出交付**：pipeline-state.js `cmdInit`（L100 附近）扩展，init 时读 hcc-org/SKILL.md frontmatter 的 protocol_version 写入新字段：
```javascript
// cmdInit 扩展（伪代码，实际贴合现有 L100 结构）
const hccOrgVersion = readHccOrgProtocolVersion(); // 读 hcc-org/SKILL.md frontmatter protocol_version
const state = {
  direction_version: directionVersion,
  current_node: null,
  frontier: [],
  iteration: 0,
  status: 'active',
  gate: null,
  graph_hash: graphHash,
  protocol_version_read: hccOrgVersion ?? null,  // [B-2/C-4] 新增：hcc-org 未装时 fallback=null
  history: [/* init 事件 */],
};
atomicWriteJSON(fp, state);
```

`readHccOrgProtocolVersion()` 函数（新增辅助函数，纯 fs+path）：
- 读 `<skillRoot>/hcc-org/SKILL.md` frontmatter（前 10 行 YAML）
- 解析 `protocol_version:` 字段值
- 文件不存在/frontmatter 无此字段 → 返回 null（fallback，不阻塞层2 引擎，[B-2/C-4] R2 风险缓解）

**可证伪验证**：
```bash
# 闸1：cmdInit 含 protocol_version_read 写入
grep -c "protocol_version_read" .claude/skills/venture-pipeline/scripts/pipeline-state.js
# 期望输出：≥2（字段定义 + 写入点）

# 闸2：fallback null 处理
grep -c "hccOrgVersion ?? null\|protocol_version_read.*null" .claude/skills/venture-pipeline/scripts/pipeline-state.js
# 期望输出：≥1
```

**依赖**：R1.1（hcc-org/SKILL.md frontmatter protocol_version 必须先存在供读取）。

**预估**：1 会话 · ~1k token（改 1 函数 + 加 1 辅助函数）。

---

### R2.2 扩展 pipeline-state-schema.md 字段表 + init 默认值

**做什么**：改 `.claude/skills/venture-pipeline/references/pipeline-state-schema.md`，字段表加第 9 行 + init 默认值补字段。

**输入触发**：R2.1；state-schema.md §7.3 minor 变更门（L300：加字段 + 补默认值 + 重跑 70-requirements §1.1/1.2）。

**输出交付**：
1. **§二字段定义表加第 9 行**：
   ```
   | `protocol_version_read` | string\|null | hcc-org 协议版本号或 null | [B-2/C-4] 部门激活时记录读到的 hcc-org.protocol_version；hcc-org 未装时 null（fallback，不阻塞引擎） |
   ```
2. **§三 init 默认值 JSON 补字段**：在现有 8 字段后加 `"protocol_version_read": null`（init 默认 null，cmdInit 实际写入时覆盖为 hcc-org 版本号）。
3. **§四写者隔离表补注**：protocol_version_read 的写者 = pipeline-state.js cmdInit（与现有 pipeline-state.json 写者一致，C1 不破）。

**可证伪验证**：
```bash
# 闸1：字段表含第 9 行
grep -c "protocol_version_read" .claude/skills/venture-pipeline/references/pipeline-state-schema.md
# 期望输出：≥3（字段表 + init 默认值 + 写者表）

# 闸2：init 默认值含字段
grep -A2 "init 默认值\|§三 init" .claude/skills/venture-pipeline/references/pipeline-state-schema.md | grep -c "protocol_version_read"
# 期望输出：≥1
```

**依赖**：R2.1。

**预估**：1 会话 · ~1k token。

---

### R2.3 扩展 pipeline-state.test.js 加 protocol_version_read 断言

**做什么**：改 `.claude/skills/venture-pipeline/scripts/pipeline-state.test.js`，加 init 后 protocol_version_read 字段断言。

**输入触发**：R2.1；TDD 红→绿（先写测试断言失败，再改 cmdInit 转绿）。

**输出交付**：pipeline-state.test.js 加测试用例（复用 persona-signal.test.js L20-44 assert 函数范式）：
```javascript
// 新增测试用例（伪代码）
function testProtocolVersionRead() {
  // 造 fixture：hcc-org/SKILL.md frontmatter 含 protocol_version: "D10-2026-06-17"
  // 调 cmdInit
  // 断言：state.protocol_version_read === "D10-2026-06-17"
  assert(state.protocol_version_read === 'D10-2026-06-17',
    'protocol_version_read 等于 hcc-org.protocol_version');
}

function testProtocolVersionReadFallback() {
  // 造 fixture：hcc-org/SKILL.md 不存在
  // 调 cmdInit
  // 断言：state.protocol_version_read === null（fallback）
  assert(state.protocol_version_read === null,
    'hcc-org 未装时 protocol_version_read fallback null');
}
```

**可证伪验证**：
```bash
node .claude/skills/venture-pipeline/scripts/pipeline-state.test.js
# 期望：exit 0，stdout 含 "protocol_version_read" 相关 PASS 行（≥2 个 assert 通过）
echo $?
# 期望输出：0
```

**依赖**：R2.1（cmdInit 写入逻辑）+ R2.2（schema 文档）。

**预估**：1 会话 · ~2k token（2 个测试用例）。

---

### R2.4 全量回归 37+29 测试（state-schema §7.3 minor 变更门要求）

**做什么**：跑层1 + 层2 全量测试，确认 protocol_version_read 字段扩展未破坏现有不变量。

**输入触发**：R2.1-R2.3 完成；state-schema.md L300 minor 变更门要求"重跑 70-requirements §1.1/1.2"。

**输出交付**：回归测试运行记录（stdout 摘要）。

**可证伪验证**：
```bash
# 层1 测试（cc-runtime scripts/）
node .claude/skills/cc-runtime/scripts/init-state.test.js 2>&1 | tail -5
node .claude/skills/cc-runtime/scripts/shift-direction.test.js 2>&1 | tail -5
node .claude/skills/cc-runtime/scripts/compact-snapshot-e2e.test.js 2>&1 | tail -5
# 期望：每个 exit 0，无 FAIL

# 层2 测试（venture-pipeline scripts/）
node .claude/skills/venture-pipeline/scripts/load-graph.test.js 2>&1 | tail -5
node .claude/skills/venture-pipeline/scripts/pipeline-state.test.js 2>&1 | tail -5
node .claude/skills/venture-pipeline/scripts/advance-node.test.js 2>&1 | tail -5
node .claude/skills/venture-pipeline/scripts/resolve-hg.test.js 2>&1 | tail -5
node .claude/skills/venture-pipeline/scripts/venture-resume.test.js 2>&1 | tail -5
node .claude/skills/venture-pipeline/scripts/persona-signal.test.js 2>&1 | tail -5
# 期望：每个 exit 0，无 FAIL
```
（37+29 测试基线 = 层1 cc-runtime 3 脚本测试 + 层2 venture-pipeline 6 脚本测试的累计断言数；具体脚本名以实际存在为准）

**依赖**：R2.1-R2.3。

**预估**：1 会话 · ~1k token（跑测试 + 记录摘要）。

---

## M3：5 部门 SKILL.md（并行，≤2 worktree 槽位排队，分 3 批）

> 5 部门 SKILL.md 结构同构，差异在职责/节点映射/工具箱。每部门独立 trigger（[β 嫁接]）。每部门 §4 强制引用 hcc-org/SKILL.md §2 RACI 锚点（[β 嫁接]，固定措辞"参见 hcc-org/SKILL.md §2 RACI 总表"避免 grep 锚点脆弱，60 §6.1 R4 风险缓解）。

### R3.1 写 hcc-decision/SKILL.md（批1，并行槽位1）

**做什么**：创建 `.claude/skills/hcc-decision/SKILL.md`（决策部协议骨架）。

**输入触发**：M1 完成（hcc-org 总则就绪供引用）；charter L61 决策部定义（方向设定/可行性判断/judge；N3 计划/N4 judge/HG；信息源=知识库+web）。

**输出交付**：`.claude/skills/hcc-decision/SKILL.md`，必含段：
1. **frontmatter**：
   ```yaml
   ---
   name: hcc-decision
   description: 决策部协议（方向设定/可行性判断/judge）
   trigger: hcc-decision/决策部/judge/方案拍板
   ---
   ```
2. **§1 部门职责**：一句话（"方向设定、可行性判断、judge，对应 venture N3 计划/N4 judge/HG，信息源=知识库+web"）+ charter L61 节点映射详述。
3. **§2 plan 流程**：引用 cc-2pp 判官小组（6 视角并行起草 → 评分 → Top 2 对抗 → 综合）。列决策部 plan 触发条件（HG1/HG2 拍板前）。
4. **§3 review 流程**：引用 cc-2pp 对抗验证（3 攻击者跨视角）。列决策部 review 触发条件（其他部门 plan 产出后）。
5. **§4 交接协议**：**固定措辞**"参见 hcc-org/SKILL.md §2 RACI 总表（决策部行）"（[β 嫁接]，grep 锚点）。列决策部读/写哪些 state 字段（direction_version 只读经 shift-direction.js，不直写，C1）。
6. **§5 业务能力 [层3 待装配]**：列决策部需 venture-* skill（cc-2pp/cc-goal/cc-orchestration 已在工具箱；venture-judge 层3 装配）。标 `[层3 待装配]`。
7. **§6 trigger**：hcc-decision 独立 trigger（与 cc-2pp 的"2pp/judge"正交，00-explore §5.3 trigger 不竞争）。

**可证伪验证**：
```bash
# 闸1：frontmatter trigger 独立
grep -c "^trigger:.*hcc-decision" .claude/skills/hcc-decision/SKILL.md
# 期望输出：1

# 闸2：§4 引用 hcc-org RACI 锚点（固定措辞）
grep -c "参见 hcc-org/SKILL.md §2 RACI 总表" .claude/skills/hcc-decision/SKILL.md
# 期望输出：≥1

# 闸3：§5 层3 待装配标记
grep -c "\[层3 待装配\]" .claude/skills/hcc-decision/SKILL.md
# 期望输出：≥1
```

**依赖**：R1.1（hcc-org/SKILL.md §2 RACI 总表必须先存在供引用）。

**预估**：1 会话 · ~4k token。

---

### R3.2 写 hcc-product/SKILL.md（批1，并行槽位2）

**做什么**：创建 `.claude/skills/hcc-product/SKILL.md`（产品部协议骨架）。

**输入触发**：M1 完成；charter L62 产品部定义（产品设计/UIUX/需求；N5 设计/N7 需求/N8 UIUX；信息源=本地产物+用户反馈）；00-explore §四产品部 ❌ 真空（业务技能留层3）。

**输出交付**：`.claude/skills/hcc-product/SKILL.md`，结构同 R3.1（frontmatter trigger:hcc-product + §1 职责 + §2 plan + §3 review + §4 交接引用 + §5 [层3 待装配] + §6 trigger）。差异：
- §1 职责：产品设计/UIUX/需求挖掘，N5/N7/N8 节点，信息源=本地产物+用户反馈
- §5 [层3 待装配]：venture-product / venture-uiux（层3 新建，charter L80 真空标注）

**可证伪验证**：同 R3.1 三闸（trigger:hcc-product / §4 引用锚点 / §5 [层3 待装配]）。

**依赖**：R1.1。

**预估**：1 会话 · ~4k token。

---

### R3.3 写 hcc-dev/SKILL.md（批2，并行槽位1）

**做什么**：创建 `.claude/skills/hcc-dev/SKILL.md`（开发部协议骨架）。

**输入触发**：M1 完成；charter L63 开发部定义（按 plan 实施/交付；实施节点；信息源=本地代码）；00-explore §四开发部 ⚠️ 中等（executor/cc-loop，依赖外部 skill）。

**输出交付**：`.claude/skills/hcc-dev/SKILL.md`，结构同 R3.1。差异：
- §1 职责：按 plan 实施/交付，实施节点，信息源=本地代码
- §2 plan：引用 cc-loop worktree SOP + 循环合同 + 护栏三件套（max_iteration/budget_tokens）
- §5 [层3 待装配]：executor（OMC autopilot/ralph）/ superpowers:* 系列（外部 skill 生态）

**可证伪验证**：同 R3.1 三闸（trigger:hcc-dev）。

**依赖**：R1.1。

**预估**：1 会话 · ~4k token。

---

### R3.4 写 hcc-ops/SKILL.md（批2，并行槽位2）

**做什么**：创建 `.claude/skills/hcc-ops/SKILL.md`（运维部协议骨架，§4 纯引用 state，[A-5/B-4] 修复重点）。

**输入触发**：M1 完成；charter L64 运维部定义（7×24 保活/state/trace/Hook；层1 运行时贯穿；信息源=本地 state/config）；00-explore §四运维部 ✓ 厚实（cc-runtime/cc-config/cc-context）。

**输出交付**：`.claude/skills/hcc-ops/SKILL.md`，结构同 R3.1。差异：
- §1 职责：7×24 保活/state/trace/Hook，层1 运行时贯穿，信息源=本地 state/config（charter L64 P2 信息源单一）
- §4 交接协议：**纯 RACI 引用**（[A-5/B-4] 修复）——运维部 owns state 字段读写（R），被 4 部门读（C/I），但**读写规则完全引用 cc-runtime/state-schema.md §2.1-§2.5**，不自写脚本逻辑。**本文件禁出现** `atomicWriteJSON`/`writeFileSync`/`init-state`/`shift-direction` 函数名调用（只引用脚本职责）。
- §5 业务能力：cc-runtime/cc-config/cc-context 已在工具箱（非 [层3 待装配]，运维部已厚实）

**可证伪验证**：
```bash
# 闸1-3：同 R3.1（trigger:hcc-ops / §4 引用锚点 / §5 标记）
# 闸4（运维部专属）：纯引用，无 state 写者逻辑复制
grep -rcl "atomicWriteJSON\|writeFileSync\|require.*init-state\|require.*shift-direction" .claude/skills/hcc-ops/
# 期望输出：0（[A-5/B-4] 修复验证）
```

**依赖**：R1.1（state-schema.md owns 读写规则）。

**预估**：1 会话 · ~4k token。

---

### R3.5 写 hcc-sales/SKILL.md（批3，串行槽位1）

**做什么**：创建 `.claude/skills/hcc-sales/SKILL.md`（销售部协议骨架）。

**输入触发**：M1 完成；charter L65 销售部定义（画像/收益转化/市场验证；N1 调查/N2 竞品/N6 画像；信息源=web+知识库）；00-explore §四销售部 ❌ 真空（venture-judge 系统级 installed，本项目无承接）。

**输出交付**：`.claude/skills/hcc-sales/SKILL.md`，结构同 R3.1。差异：
- §1 职责：画像/收益转化/市场验证，N1/N2/N6 节点，信息源=web+知识库
- §5 [层3 待装配]：venture-judge（系统级 installed skill，层3 装配承接）+ 销售技能（层3 新建，charter L80 真空）

**可证伪验证**：同 R3.1 三闸（trigger:hcc-sales）。

**依赖**：R1.1。

**预估**：1 会话 · ~4k token。

---

## M4：hcc-org 一致性测试（[A-4/B-3] 修复）

### R4.1 写 hcc-org/scripts/hcc-org-consistency.test.js

**做什么**：创建 `.claude/skills/hcc-org/scripts/hcc-org-consistency.test.js`（纯 Node fs+path，C2 合规，persona-signal.test.js L20-44 assert 范式）。

**输入触发**：M3 完成（5 部门 SKILL.md 全交付，供 grep）；50-decision §八 [A-4/B-3] 修复。

**输出交付**：`.claude/skills/hcc-org/scripts/hcc-org-consistency.test.js`，含 4 类测试函数：

**测试① grep 5 部门 SKILL.md 引用 hcc-org §2 RACI 锚点**：
```javascript
function testDepartmentsReferenceRaci() {
  const depts = ['hcc-decision','hcc-product','hcc-dev','hcc-ops','hcc-sales'];
  for (const d of depts) {
    const content = fs.readFileSync(path.join(SKILL_ROOT, d, 'SKILL.md'), 'utf8');
    assert(content.includes('参见 hcc-org/SKILL.md §2 RACI 总表'),
      `${d}/SKILL.md §4 引用 hcc-org RACI 锚点`);
  }
}
```

**测试② 总则自检：hcc-org/SKILL.md §2 RACI 总表每行 R/A/C/I 非空**（结构化校验，非自由文本）：
```javascript
function testRaciTableCompleteness() {
  // 解析 §2 RACI 总表 markdown 表格行
  // 每行业务行（非表头/分隔行）：5 部门列每格 ∈ {R,A,C,I}（非空）
  // 每行至少 1 个 R + 1 个 A（[A-8] 冲突仲裁基准）
  const rows = parseRaciTable(fs.readFileSync(...));
  for (const row of rows) {
    assert(row.cells.every(c => ['R','A','C','I'].includes(c)), `行 ${row.name} R/A/C/I 非空`);
    assert(row.cells.filter(c => c==='R').length >= 1, `行 ${row.name} 至少 1 个 R`);
    assert(row.cells.filter(c => c==='A').length >= 1, `行 ${row.name} 至少 1 个 A`);
  }
}
```

**测试③ 冲突仲裁段存在性（[A-8] 修复）**：
```javascript
function testConflictArbitrationSection() {
  const content = fs.readFileSync(path.join(SKILL_ROOT,'hcc-org','SKILL.md'),'utf8');
  assert(/§2\.1 冲突仲裁|冲突仲裁规则/.test(content), 'hcc-org §2.1 冲突仲裁段存在');
}
```

**测试④ hcc-org/ 无 state 写者逻辑复制（[A-5/B-4] 修复）**：
```javascript
function testNoStateWriterDuplication() {
  // 递归扫 hcc-org/ 所有文件
  // grep atomicWriteJSON/writeFileSync/require.*init-state → 0 命中
  const files = walkDir(path.join(SKILL_ROOT,'hcc-org'));
  for (const f of files) {
    const content = fs.readFileSync(f,'utf8');
    assert(!/atomicWriteJSON|writeFileSync|require.*init-state/.test(content),
      `${f} 无 state 写者逻辑复制`);
  }
}
```

**main 函数**：跑 4 测试，统计 passed/failed，failed>0 → process.exit(1)。

**可证伪验证**：
```bash
# 闸1：测试跑绿
node .claude/skills/hcc-org/scripts/hcc-org-consistency.test.js
# 期望：exit 0，stdout 含 4 类测试全 PASS

# 闸2（证伪性验证）：故意破坏测试
# 临时删 hcc-sales/SKILL.md §4 引用锚点 → 重跑
# 期望：exit 1，stderr 含 "hcc-sales/SKILL.md §4 引用 hcc-org RACI 锚点" FAIL
# （破坏后恢复）
```

**依赖**：R1.1 + R3.1-R3.5（5 部门 SKILL.md 全交付）。

**预估**：1 会话 · ~3k token（4 测试函数 + parseRaciTable/walkDir 辅助）。

---

## M5：断点续传部门中间态测试（[B-6] 修复）

### R5.1 扩展 venture-resume.test.js 加部门中间态恢复断言

**做什么**：改 `.claude/skills/venture-pipeline/scripts/venture-resume.test.js`，加 compact 前后部门工作中间态恢复测试（复用 L46-50 makeIsolatedRoot 框架）。

**输入触发**：50-decision §八 [B-6] 修复；venture-resume.test.js 已有断点续传测试框架（spawnSync 调被测脚本 + 造 fixture）。

**输出交付**：venture-resume.test.js 加测试用例：

**测试场景：部门 plan 进行中 → compact → resume → 中间态恢复**：
```javascript
function testDepartmentMidStateResume() {
  // 1. 造隔离 state root（makeIsolatedRoot，复用 L46-50）
  const root = makeIsolatedRoot();

  // 2. 造 fixture：部门 plan 进行中的中间态
  //    trace.ndjson 有 node:N3,action:reasoning,direction_version:1 行（决策部 plan 中间态）
  //    checkpoint.continue_from = "node:N3,task:占位,iter:2"
  //    pipeline-state.current_node = "N3"
  //    tasks.tree.json 有 status:in_progress 任务（部门 plan 任务）
  fs.appendFileSync(tracePath, JSON.stringify({
    ts: '...', session: '...', direction_version: 1,
    node: 'N3', iter: 2, step_index: 1,
    action: 'reasoning', tool: 'Think',
    filesChanged: [], learnings: ['部门 plan 中间态：方案 α 草拟中'],
    progressHash: '...', progress_delta: 5, tokensUsed: 1000
  }) + '\n');

  // 3. 模拟 compact（trace 截断到快照点——实际 compact-snapshot Block⑤ 已写快照）
  //    本测试简化：直接验证 resume 读 checkpoint + pipeline-state 恢复

  // 4. 调 venture-resume.js resume
  const result = spawnSync('node', [SCRIPT, 'resume', '--state-root', root], { encoding: 'utf8' });

  // 5. 断言：部门工作中间态恢复
  assert(result.status === 0, 'resume exit 0');
  assert(/resumed at N3 iter:2/.test(result.stdout), 'resume 恢复到 N3 iter:2');
  // 断言 trace 末行 node/iter 与 compact 前一致（中间态未静默丢）
  const traceLines = fs.readFileSync(tracePath,'utf8').trim().split('\n');
  const lastTrace = JSON.parse(traceLines[traceLines.length - 1]);
  assert(lastTrace.node === 'N3' && lastTrace.iter === 2, 'trace 末行中间态 node:N3 iter:2 恢复');
  // 断言 tasks.tree in_progress 任务恢复
  const tasks = JSON.parse(fs.readFileSync(tasksTreePath,'utf8'));
  assert(tasks.tasks.some(t => t.status === 'in_progress'), 'tasks.tree in_progress 任务恢复');
}
```

**可证伪验证**：
```bash
# 闸1：测试跑绿
node .claude/skills/venture-pipeline/scripts/venture-resume.test.js
# 期望：exit 0，stdout 含 "部门工作中间态" 相关 PASS 行

# 闸2（全量回归，M5 不破坏现有断点续传）
# 同 R2.4 回归命令
# 期望：37+29 测试全 exit 0
```

**依赖**：R2.4（pipeline-state 字段扩展回归过）+ venture-resume.test.js 现有框架。

**预估**：1 会话 · ~3k token（1 测试用例 + fixture 造中间态 trace 行）。

---

## 汇总（与 60-impl-plan 对齐校验）

| 里程碑 | R 项数 | token 预估 | 验证闸数 | 依赖 |
|--------|-------|-----------|---------|------|
| **M1** | R1.1-R1.2（2 项） | ~18k | 5 闸（R1.1）+ 2 闸（R1.2） | 无（起点） |
| **M2** | R2.1-R2.4（4 项） | ~5k | 2+2+1+回归闸 | R1.1 |
| **M3** | R3.1-R3.5（5 项） | ~20k | 每部门 3-4 闸（共 ~17 闸） | R1.1 |
| **M4** | R4.1（1 项） | ~3k | 2 闸（跑绿 + 证伪破坏） | R1.1 + R3.1-R3.5 |
| **M5** | R5.1（1 项） | ~3k | 2 闸（跑绿 + 回归） | R2.4 |
| **合计** | **13 项** | **~49k** | **~31 闸** | M 划分与 60 §二对齐 |

**4 项裁决必落地修复覆盖校验**：
| 修复 | R 项 | 验证闸命令 |
|------|------|-----------|
| [A-4/B-3] 一致性测试 | R4.1 | `node hcc-org/scripts/hcc-org-consistency.test.js` exit 0 + 故意破坏 exit 1 |
| [B-2/C-4] protocol_version_read 字段 | R2.1-R2.4 | `node pipeline-state.test.js` 含 protocol_version_read 断言 exit 0 |
| [B-7] max_iteration 写者 | （层2 advance-node.js 已有 handleLoopBack iter++，advance-node.js L166）R2.4 回归覆盖 | `node advance-node.test.js` 回归 exit 0（iter 累加断言已存在） |
| [B-6] 断点续传部门中间态 | R5.1 | `node venture-resume.test.js` 含中间态恢复断言 exit 0 |

> **注**：[B-7] max_iteration 写者的明确化 = advance-node.js handleLoopBack（L161-181）已 owns iter 累加（newIter = currentIter + 1，L166），部门 SKILL.md §4 纯引用标注"iteration 计数由 advance-node.js owns，部门只读不写"（R3.1-R3.5 §4 段统一声明）。验证闸 = M2 R2.4 回归 advance-node.test.js 跑绿（现有 iter 累加断言不破）+ M3 各部门 §4 grep"iteration 计数由 advance-node.js owns"固定措辞。

---

> **70-requirements.md 完。** 13 项保姆级需求（M1:2 + M2:4 + M3:5 + M4:1 + M5:1），M 划分与 60-impl-plan 完全对齐。4 项裁决修复全含可证伪验证闸（命令 + 期望输出，禁"适当/合理"）。全文 0 人天隐喻词（C-2 修正）。下一步：编排者按 60 §6.2 启动 M1 R1.1。
