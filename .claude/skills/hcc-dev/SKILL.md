---
name: hcc-dev
description: 开发部协议（按plan实施/交付）
trigger: hcc-dev/开发部/实施/交付
---

# hcc-dev — 开发部协议

> **定位**：hcc 5 部门之一（决策/产品/开发/运维/销售）。引用 `hcc-org/SKILL.md` §1 协作总则 + §2 RACI 总表作为协作地基。protocol_version 闭环见 hcc-org/SKILL.md frontmatter（M2 pipeline-state.cmdInit 读取，记录到 `pipeline-state.protocol_version_read`）。

## §1 部门职责

**一句话**：按 plan 实施/交付，对应 venture 实施节点，信息源 = 本地代码。

**节点映射**（charter L63 + hcc-org §2.1 节点行）：
- **实施节点**：开发部负 A（按产品部设计 + 决策部 plan 实施）。
- 开发部把"设计/需求"变成"可运行产物"：代码实施 + 测试 + 交付记录。

## §2 plan 流程

**引用 cc-loop worktree SOP + 循环合同 + 护栏三件套**（hcc-org 总则2/5，charter L63）：把产品部 plan 拆成可独立验证的实施步骤，套循环合同（max_iteration / budget_tokens 护栏），独立文件进 worktree 并行（≤2 槽位排队）。

**开发部 plan 触发条件**：接到产品部 product-*.md 或决策部 decision-plan.md 后。开发部拆实施步骤 + 测试闸，产出 `dev-impl.md` / `dev-test.md`（hcc-org §3.1）。

## §3 review 流程

**引用 cc-2pp 对抗验证**（hcc-org 总则2）：3 攻击者跨视角。

**开发部 review 触发条件**：实施 + 测试产出后。决策部对开发部产出启动对抗验证；开发部亦可 review 自身测试覆盖（TDD 红→绿可靠性）。

## §4 交接协议

参见 hcc-org/SKILL.md §2 RACI 总表（开发部行）。开发部对 state 字段只读（运维部 owns 写，hcc-org §4.3）；开发部产出落盘 artifacts（dev-*.md，hcc-org §3.1）供决策部 review / 运维部保活接力。回环上限 max_iteration 见 checkpoint.guardrails（hcc-org 总则5）。

## §5 业务能力

参见 hcc-org/SKILL.md §5 工具箱映射表（开发部行）。

- **cc-loop**（worktree SOP + 循环合同 + 护栏三件套）：已在工具箱 ✓ —— §2 plan 流程来源。

**[层3 待装配]**：executor（OMC autopilot/ralph，外部 agent）/ superpowers:* 系列（外部 skill 生态，代码质量/测试/重构专项）—— 层3 装配承接（依赖外部 skill 生态，非本项目技能）。00-explore §四开发部 ⚠️ 中等。

## §6 trigger

`hcc-dev` 独立 trigger。触发词：hcc-dev / 开发部 / 实施 / 交付 / 编码。
