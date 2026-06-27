---
name: hcc-product-productize
description: 产品部 N6 产品化方法论工具箱：承接 N5 验证通过 decision（设计+市场双轨），转化成 N6_产品化_spec.md（spec 类型）。条目继承 N3.5 PRD R{n}/AC{n} + 叠加产品化字段（impl_boundary 边界仲裁 + 收益转化三维度）。产品 R / 实施 C 边界仲裁（charter §2.1 N6）。
---

> **部门协议引用**（hcc 阶段5 协议降级）：执行前 Read `.claude/contracts/contract-product.md`（产品部契约，§4.1 R3.2 走偏对照基准 + 变更回流机制 + RACI 归属）。

# hcc-product-productize — 产品部 N6 产品化方法论工具箱

> 触发词：`hcc-product-productize` / `N6 产品化` / `产品化` / `产品设计规格` / `收益转化` / `impl_boundary` / `边界仲裁`
> 层级：cc-venture 层3 venture pipeline 节点 N6 实装。
> 部门归属：产品部 R（产品设计 + 收益转化）；实施细节 C 归开发部；边界仲裁决策部兜底 A（charter §2.1 N6）。

## 0. 概述：产品化 = 收敛 + 规格化 + 边界划清

N6 接 N5 验证通过的双轨 decision（设计验证 + 市场验证），转化成可实施 spec（`N6_产品化_spec.md`）。**条目继承 N3.5 PRD R{n}/AC{n}，叠加产品化字段**（不重写，保持 N5 走偏判定的 AC{n}↔verify_cmd 绑定）。

## 1. 工作流程

1. **读输入**：`N5_验证_decision.md`（设计验证 AC{n} 通过 + 走偏）+ `N5_市场验证_decision.md`（persona 命中）+ `N3.5_需求规格_prd.md` §2/§3/§5
2. **收敛**：双轨验证结论 → 单一已验证产品形态（一句话无歧义）
3. **规格化**（条目继承）：PRD R{n}/AC{n} 继承，叠加产品化字段：
   - `AC{n}.verify_cmd`（继承 N5 绑定的可执行验证命令）
   - `priority`（P0 核心路径 / P1 增强 / P2 长尾）
   - `benefit_dim`（收益转化归属）
   - `impl_boundary`（product_owns R / dev_owns C / arbiter）
4. **收益转化**（三维度，可证伪）：user_value / biz_value / cost_cap
5. **设计系统接口**：按 PRD §2 产品类型 → hcc-product-uiux §4 映射表选 slug，预埋 N6⇄N7 loop_back
6. **自检**：跑出口条件清单（§5）→ 通过落盘 / 未通过 self-review 回环
7. **落盘**：`.hcc/product/hcc-product-productize/N6_产品化_spec.md`

## 2. 方法论要点

### 2.1 双轨收敛
N5 设计验证（AC{n} 工程化判据）+ 市场验证（persona 命中）→ 单一产品形态。冲突（设计通过但市场未命中）→ 标 `unresolved` → HG2 停等决策部仲裁。

### 2.2 条目继承（不重写，关键）
继承 N3.5 PRD R{n}/AC{n} ID（保持 N5 走偏判定可寻址性），只叠加 N6 字段。**禁重新编号/重写 AC**（破坏 AC{n}↔verify_cmd 绑定 → N5 验证机制失效）。

### 2.3 收益转化三维度（charter §2.1 N6「收益转化」）
| 维度 | 度量 | 可证伪要求 |
|---|---|---|
| user_value | 完成率 Δ / 耗时下降 Δ | 数值对比，禁"更好用" |
| biz_value | persona 命中率 × 规模预估 | 区间 + 置信度，禁"潜力巨大" |
| cost_cap | 工时上限 / 资源上限 | 数值，超限触发仲裁 |

### 2.4 N6⇄N7 loop_back
按 hcc-product-uiux §4 映射表选 slug（minimal/shadcn/glassmorphism...），预埋 spec §4。规格级变化（功能边界/信息架构重构）→ 回 N6；微调级 → N7 内迭代。

### 2.5 self-review 可证伪自检
跑 §5 出口条件，不可证伪表述（"更好""更强""潜力大"）触发回环修正（沿用 hcc-product-uiux §3 范式）。

## 3. 边界仲裁（charter §2.1 N6 冲突仲裁，核心）

每个 `R{n}.impl_boundary` 工程化边界：
- **product_owns (R)**：交互流程 / 信息架构 / 功能边界 / 优先级 / AC 可观测指标
- **dev_owns (C)**：技术选型 / 数据结构 / 算法 / 实现细节 / 性能优化
- **arbiter**：复用 N3.5 `_request.md` + `_changelog.md` 变更回流（contract-product §4.1），产品部↔开发部争议 → 决策部兜底 A

## 4. 产物模板（N6_产品化_spec.md）

落 `.hcc/product/hcc-product-productize/N6_产品化_spec.md`（spec 类型）：
- frontmatter: node=N6 / type=spec / skill=hcc-product-productize / input_decisions(设计+市场验证) / source_prd / graph_hash_ref
- §1 已验证产品形态（N5 收敛：双轨结论 + 单一产品形态）
- §2 产品设计规格（R{n} 条目继承 + 产品化字段 + impl_boundary）
- §3 收益转化（user_value/biz_value/cost_cap 三维度可证伪数值）
- §4 设计系统（N6⇄N7 loop_back 接口，slug 预埋）
- §5 出口条件（exit_condition 自检清单）
- §6 边界仲裁（charter §2.1 落地，复用 N3.5 变更回流）
- §7 风险登记

**路径铁律**：`.hcc/product/hcc-product-productize/`（by-design hcc-{部门}-{维度}）。

## 5. 度量口径（Claude 实施者度量）
会话 / token / 轮次 / skill 配置 / 验证。**禁**人天/团队/学习成本/排期（org-claude.md #measure）。

## 6. 下游接口
- **HG2 → N4 实施**：N6 spec 通过 HG2 → 开发部 C 按 spec 实施（dev_owns 边界）
- **N3.5 变更回流**：边界争议 → `_request.md` + `_changelog.md`
- **N7 迭代优化**：spec §4 slug → hcc-product-uiux pull
- **N8 规模化**：spec §3.2 biz_value（预估区间+置信度）喂养 N8

## 7. 风险
- **R1 条目继承破坏**（重编号）：§2.2 明禁 + 自检 R{n}/AC{n} ID 与 N3.5 一致
- **R2 收益转化不可证伪**：exit_condition 黑名单（禁更好/更强/潜力大）+ self-review 回环
- **R3 边界仲裁流于形式**：N3.5 变更回流留痕 + 决策部兜底 A 可介入
- **R4 目录命名漂移**：dag 实装同步路径 + graph_hash 防漂移（C6）
- **R5 N5 未实装导致 N6 无输入**：dag N5→N6 前置 edge，N5 green 才推进；本 skill 可独立实装，运行时等 N5
- **R6 biz_value 被当承诺**：spec §3.2 标"预估区间+置信度，非承诺，喂养 N8"
- **R7 C2 纯 Node**：黑名单用 String.includes()（零依赖）
