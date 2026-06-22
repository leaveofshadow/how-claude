---
name: hcc-decision
description: 决策部协议（方向设定/可行性判断/judge）
trigger: hcc-decision/决策部/judge/方案拍板
---

# hcc-decision — 决策部协议

> **定位**：hcc 5 部门之一（决策/产品/开发/运维/销售）。引用 `hcc-org/SKILL.md` §1 协作总则 + §2 RACI 总表作为协作地基。protocol_version 闭环见 hcc-org/SKILL.md frontmatter（M2 pipeline-state.cmdInit 读取，记录到 `pipeline-state.protocol_version_read`）。

## §1 部门职责

**一句话**：方向设定、可行性判断、judge，对应 venture N3 计划 / N4 judge / HG 闸门，信息源 = 知识库 + web。

**节点映射**（charter L61 + hcc-org §2.1 节点行）：
- **N3 计划**：决策部负 A（plan 主导）—— 判官小组出方案。
- **N4 judge**：决策部负 A —— 对抗验证裁决。
- **HG1/HG2**：决策部独占 A —— 闸门拍板（hcc-org §2.1「A 默认归决策部」+ HG 闸门行决策部独占 A）。
- **N1/N2/N8**（销售自治节点）：决策部转 C —— 销售部负 A，决策部兜底（§2.1「无 A 行」规则）。

决策部是组织"大脑"：不直接产出代码/设计/产物，而是对其他部门的 plan 做 review、对 HG 闸门拍板、对 RACI 冲突仲裁（hcc-org §2.1）。

## §2 plan 流程

**引用 cc-2pp 判官小组**（hcc-org 总则2）：6 视角并行起草 → 评分 → Top 2 对抗 → 综合。

**决策部 plan 触发条件**：HG1/HG2 拍板前。当 venture 推进到 HG 闸门（`pipeline-state.status=awaiting_human`），决策部启动判官小组对"是否换向/是否继续"出 plan，产出 `decision-plan.md`（hcc-org §3.1 文件命名）。

## §3 review 流程

**引用 cc-2pp 对抗验证**（hcc-org 总则2）：3 攻击者跨视角。

**决策部 review 触发条件**：其他部门（产品/开发/销售）plan 产出后。决策部作为组织 review 枢纽，对部门 plan 启动对抗验证，产出 `decision-review.md`。RACI 冲突时决策部仲裁（hcc-org §2.1 冲突仲裁规则）。

## §4 交接协议

参见 hcc-org/SKILL.md §2 RACI 总表（决策部行）。决策部对 state 字段读写（经脚本/Hook，非直写，hcc-org §4.3）：
- **direction_version**：只读 + 判定后调 shift-direction.js 换向（不直写 direction.json，C1，hcc-org 总则3）。
- **pipeline-state.status/gate**：HG 拍板后经 resolve-hg.js 解除 awaiting_human（不直写 pipeline-state.json）。
- **trace / tasks.tree**：经层1 Hook 间接读写（hcc-org 总则1）。

回环上限 max_iteration 见 checkpoint.guardrails（hcc-org 总则5）。交接文件命名见 hcc-org §3.1（`decision-plan.md` / `decision-review.md`）。

## §5 业务能力

参见 hcc-org/SKILL.md §5 工具箱映射表（决策部行）。

- **cc-2pp**（判官小组 + 对抗验证）：已在工具箱 ✓ —— §2/§3 流程来源。
- **cc-goal**（终态条件设计）：已在工具箱 ✓ —— HG 拍板的终态条件。
- **cc-orchestration**（编排决策树）：已在工具箱 ✓ —— 部门协作编排。

**[层3 待装配]**：venture-sales-judge（系统级 installed skill，创业评估师）—— N1 调查 / N2 竞品 / N6 画像的创业评估能力，层3 cc-venture 装配承接（本项目当前无承接，charter L80 真空）。

## §6 trigger

`hcc-decision` 独立 trigger（与 cc-2pp 的 "2pp/judge" 正交，00-explore §5.3 trigger 不竞争）。触发词：hcc-decision / 决策部 / judge / 方案拍板。
