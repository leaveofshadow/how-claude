---
name: hcc-product
description: 产品部协议（产品设计/UIUX/需求挖掘）
trigger: hcc-product/产品部/产品设计/需求挖掘
---

# hcc-product — 产品部协议

> **定位**：hcc 5 部门之一（决策/产品/开发/运维/销售）。引用 `hcc-org/SKILL.md` §1 协作总则 + §2 RACI 总表作为协作地基。protocol_version 闭环见 hcc-org/SKILL.md frontmatter（M2 pipeline-state.cmdInit 读取，记录到 `pipeline-state.protocol_version_read`）。

## §1 部门职责

**一句话**：产品设计、UIUX、需求挖掘，对应 venture N5 设计 / N7 需求 / N8 UIUX，信息源 = 本地产物 + 用户反馈。

**节点映射**（charter L62 + hcc-org §2.1 节点行）：
- **N5 设计**：产品部负 A（产品设计主导）。
- **N7 需求**：产品部负 A（需求挖掘）。
- **N8 UIUX**：产品部负 A（UIUX 设计）；销售自治场景（市场验证）决策部仲裁 A 归属（hcc-org §2.1）。

产品部把"做什么"从模糊变清晰：产出设计/需求/UIUX 产物，供开发部实施、决策部 review。

## §2 plan 流程

**引用 cc-2pp 判官小组**（hcc-org 总则2）：6 视角并行起草 → 评分 → Top 2 对抗 → 综合。

**产品部 plan 触发条件**：N5/N7/N8 节点推进时。接到销售部市场信号（sales-research/persona）或决策部方向后，产品部启动判官小组对"产品形态/需求优先级/UIUX 方案"出 plan，产出 `product-design.md` / `product-requirements.md` / `product-uiux.md`（hcc-org §3.1）。

## §3 review 流程

**引用 cc-2pp 对抗验证**（hcc-org 总则2）：3 攻击者跨视角。

**产品部 review 触发条件**：设计/需求/UIUX 产物产出后。决策部对产品部 plan 启动对抗验证（产出 decision-review.md）；产品部亦可 review 开发部实施是否偏离设计意图。

## §4 交接协议

参见 hcc-org/SKILL.md §2 RACI 总表（产品部行）。产品部对 state 字段只读（运维部 owns 写，hcc-org §4.3）；产品部产出落盘 artifacts（product-*.md，hcc-org §3.1）供开发部实施 / 决策部 review 接力。回环上限 max_iteration 见 checkpoint.guardrails（hcc-org 总则5）。

## §5 业务能力

参见 hcc-org/SKILL.md §5 工具箱映射表（产品部行）。

- **cc-loop**（循环工程方法论）：已在工具箱 ✓ —— 非产品技能，提供 plan/review 回环方法论。

**[层3 待装配]**：venture-product（产品设计）/ venture-product-uiux（UIUX 设计）—— 层3 cc-venture 新建（charter L80 真空标注，本项目当前无产品/UIUX 业务技能）。00-explore §四产品部 ❌ 真空。

## §6 trigger

`hcc-product` 独立 trigger。触发词：hcc-product / 产品部 / 产品设计 / 需求挖掘 / UIUX。
