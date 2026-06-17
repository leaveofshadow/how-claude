---
name: hcc-ops
description: 运维部协议（7×24保活/state/trace/Hook）
trigger: hcc-ops/运维部/保活/state健康
---

# hcc-ops — 运维部协议

> **定位**：hcc 5 部门之一（决策/产品/开发/运维/销售）。引用 `hcc-org/SKILL.md` §1 协作总则 + §2 RACI 总表作为协作地基。protocol_version 闭环见 hcc-org/SKILL.md frontmatter（M2 pipeline-state.cmdInit 读取，记录到 `pipeline-state.protocol_version_read`）。

## §1 部门职责

**一句话**：7×24 保活 / state / trace / Hook，层1 运行时横切贯穿，信息源 = 本地 state/config（charter L64 P2 信息源单一）。

**节点映射**（charter L64 + hcc-org §2.1/§2.2）：
- **state 字段行**（hcc-org §2.2）：运维部对全部 state 字段负 R/A（owns 读写），其他部门只读 C/I。
- 运维部 = 层1 运行时横切贯穿：cc-runtime（state/trace/Hook 地基）+ cc-config（六层配置）+ cc-context（上下文健康）覆盖 7×24 保活全链路（00-explore §四运维部 ✓ 厚实）。

## §2 plan 流程

**引用 cc-2pp 判官小组**（hcc-org 总则2）：6 视角并行起草 → 评分 → Top 2 对抗 → 综合。

**运维部 plan 触发条件**：state/trace 异常、保活策略调整、配置变更时。运维部启动判官小组对"保活方案/配置变更"出 plan，产出 `ops-state-health.md` / `ops-config.md`（hcc-org §3.1）。

## §3 review 流程

**引用 cc-2pp 对抗验证**（hcc-org 总则2）：3 攻击者跨视角。

**运维部 review 触发条件**：配置变更 / 保活方案产出后。决策部对运维部 plan 启动对抗验证；运维部持续监控 state/trace 健康（7×24）。

## §4 交接协议

参见 hcc-org/SKILL.md §2 RACI 总表（运维部行）。

**纯 RACI 引用**（[A-5/B-4] 修复）：运维部 owns state 字段读写（R/A），被 4 部门读（C/I），但**读写规则完全引用 `cc-runtime/state-schema.md` §2.1-§2.5**（hcc-org §4 纯引用段），不自写脚本逻辑。state 字段的写者隔离 / 不变量 / 原子写协议等完整细节，一律以 state-schema.md 为唯一真理源——本文件不复制规则。运维部经层1 脚本/Hook 间接维护 state（hcc-org §4.3 部门读写 state 协议）。回环上限 max_iteration 见 checkpoint.guardrails（hcc-org 总则5）。

## §5 业务能力

参见 hcc-org/SKILL.md §5 工具箱映射表（运维部行）。

- **cc-runtime**（state/trace/Hook 地基）：已在工具箱 ✓
- **cc-config**（六层配置 + CLAUDE.md 诊断）：已在工具箱 ✓
- **cc-context**（上下文健康）：已在工具箱 ✓

**[层3 待装配]**：无 —— cc-runtime/cc-config/cc-context 已覆盖 7×24 保活 / state / trace / Hook / 配置 / 上下文全链路（运维部已厚实，00-explore §四 + hcc-org §5 工具箱映射表）。层3 无新增运维业务技能装配项。

## §6 trigger

`hcc-ops` 独立 trigger。触发词：hcc-ops / 运维部 / 保活 / state 健康 / 配置。
