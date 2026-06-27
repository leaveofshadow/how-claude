---
name: hcc-product
description: 产品部协议（产品设计/UIUX/需求挖掘）
trigger: hcc-product/产品部/产品设计/需求挖掘
---

# hcc-product — 产品部协议

> **定位**：hcc 5 部门之一（决策/产品/开发/运维/销售）。引用 `charter.md` §1 协作总则 + §2 RACI 总表作为协作地基。protocol_version 闭环见 charter.md frontmatter（M2 pipeline-state.cmdInit 读取，记录到 `pipeline-state.protocol_version_read`）。

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

参见 charter.md §2 RACI 总表（产品部行）。产品部对 state 字段只读（运维部 owns 写，hcc-org §4.3）；产品部产出落盘 artifacts（product-*.md，hcc-org §3.1）供开发部实施 / 决策部 review 接力。回环上限 max_iteration 见 checkpoint.guardrails（hcc-org 总则5）。

### §4.1 N5 验证对照基准（产品部被动 review，R3.2）

N5 验证节点产品部被动 review 开发部（hcc-dev）实施是否走偏需求基线：

- **对照基准** = `N3.5_需求规格_prd.md` 的 **§5 验收标准 AC{n}** + **§3 功能需求条目 ID R{n}**（条目化、可寻址），**非整份 PRD 自然语言文本对照**。
- **机制（保留）**：`git diff` 检测 N4 实施代码 vs 基线期望的走偏——机制不变（git diff + 走偏判定），仅把对照粒度从"PRD 基线整体"收敛到"§5 AC{n} + §3 R{n} 条目"。
- **走偏判定**：某 AC{n} 绑定的可执行验证命令（见 hcc-product-requirement §5，主题6 N5 验证映射）在 N5 跑挂 → 标记对应 R{n} 走偏 → 开发部走变更流程（`N3.5_需求变更_request.md`）→ 产品部评审 append（`N3.5_需求变更_changelog.md`）。
- **N5 验证范式（主题6）**：N5 = 跑 AC 绑定的验证命令，**不是 git diff 文本语义对照**（AC 已工程化为可执行判据，文本对照无机器映射）。M5/M6 建立 AC↔验证命令映射表真正消费。

> 条目工程化（R{n}↔AC{n} 一一对应）使 N5 走偏判定可定位到具体需求条目，而非模糊"偏离设计意图"。

## §5 业务能力

参见 charter.md §5 工具箱映射表（产品部行）。

- **cc-loop**（循环工程方法论）：已在工具箱 ✓ —— 非产品技能，提供 plan/review 回环方法论。

**[层3 已装配]**：
- **hcc-product-requirement**（PRD 治理）：✓ 装配（M2）—— N3.5 产 PRD（条目化 AC{n}/R{n}）+ N5 核实走偏（被动 review 开发部实施，§4.1 R3.2 详）+ 变更回流（`N3.5_需求变更_request.md` / `_changelog.md`）。

**[层3 待装配]**：venture-product（产品设计）/ hcc-product-uiux（UIUX 设计，引 Bergside Type UI）—— 层3 cc-venture 新建（charter L80 真空标注；hcc-product-uiux 沙箱验证 M5，项目级待 deploy）。00-explore §四产品部 ❌ 真空。

## §6 trigger

`hcc-product` 独立 trigger。触发词：hcc-product / 产品部 / 产品设计 / 需求挖掘 / UIUX。
