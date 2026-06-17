---
name: hcc-sales
description: 销售部协议（画像/收益转化/市场验证）
trigger: hcc-sales/销售部/画像/市场验证
---

# hcc-sales — 销售部协议

> **定位**：hcc 5 部门之一（决策/产品/开发/运维/销售）。引用 `hcc-org/SKILL.md` §1 协作总则 + §2 RACI 总表作为协作地基。protocol_version 闭环见 hcc-org/SKILL.md frontmatter（M2 pipeline-state.cmdInit 读取，记录到 `pipeline-state.protocol_version_read`）。

## §1 部门职责

**一句话**：画像、收益转化、市场验证，对应 venture N1 调查 / N2 竞品 / N6 画像，信息源 = web + 知识库。

**节点映射**（charter L65 + hcc-org §2.1 节点行）：
- **N1 调查**：销售部负 A（销售自治节点，决策部转 C）。
- **N2 竞品**：销售部负 A（销售自治）。
- **N6 画像**：销售部负 A（销售自治）；N6 产品化若与产品部 R 冲突 → 决策部仲裁（hcc-org §2.1）。

销售部对外感知市场：调查 / 竞品 / 画像，产出市场信号供决策部方向判断、产品部需求输入。

## §2 plan 流程

**引用 cc-2pp 判官小组**（hcc-org 总则2）：6 视角并行起草 → 评分 → Top 2 对抗 → 综合。

**销售部 plan 触发条件**：N1/N2/N6 节点推进时。销售部启动判官小组对"调查方向/竞品分析框架/画像构建"出 plan，产出 `sales-research.md` / `sales-competitor.md` / `sales-persona.md`（hcc-org §3.1）。

## §3 review 流程

**引用 cc-2pp 对抗验证**（hcc-org 总则2）：3 攻击者跨视角。

**销售部 review 触发条件**：调查 / 竞品 / 画像产出后。决策部对销售部 plan 启动对抗验证（N1/N2/N8 销售自治，决策部转 C 但兜底 review）。

## §4 交接协议

参见 hcc-org/SKILL.md §2 RACI 总表（销售部行）。销售部对 state 字段只读（运维部 owns 写，hcc-org §4.3）；销售部产出落盘 artifacts（sales-*.md，hcc-org §3.1）供决策部 review / 产品部需求输入接力。回环上限 max_iteration 见 checkpoint.guardrails（hcc-org 总则5）。

## §5 业务能力

参见 hcc-org/SKILL.md §5 工具箱映射表（销售部行）。

- **cc-loop**（循环方法论）：已在工具箱 ✓ —— plan/review 回环。

**[层3 待装配]**：venture-judge（系统级 installed skill，创业评估师）—— N1 调查 / N2 竞品 / N6 画像的创业评估能力，层3 cc-venture 装配承接；销售技能（画像/收益转化/市场验证）层3 新建（charter L80 真空）。00-explore §四销售部 ❌ 真空。

## §6 trigger

`hcc-sales` 独立 trigger。触发词：hcc-sales / 销售部 / 画像 / 市场验证 / 竞品。
