---
name: hcc-sales-scale
description: 销售部 N8 规模化教练——把已验证的 PMF 放大为可重复、可复制、收益可结算的商业模式。收益转化（定价/支付/单位经济）+ 市场规模化（四杠杆）+ 销售自治（N8 销售部 R，决策部 C 不干预）。产出 N8_规模化_plan.md。
---

> **部门协议引用**（hcc 阶段5 协议降级）：执行前 Read `.claude/contracts/contract-sales.md`（销售部契约：画像/收益转化/市场验证 + RACI 归属）。

# hcc-sales-scale — N8 规模化教练

> 触发词：`N8` / `规模化` / `放大` / `收益转化` / `市场规模化` / `sales-scale` / "怎么放大收钱" / "怎么扩张"
> 层级：cc-venture 层3 venture pipeline 节点 N8 实装。
> 部门归属：销售部 R（自治，charter §2.1 N8：C/I/I/I/R）；决策部 C（咨询不拍板）；兜底 A（无 A 行规则）。
> 接力：承接 venture-sales-judge（N1/N2/N6 判断轴），负责 N8 规模化（执行轴）。

## 0. 核心定位

**N8 规模化 = 把已验证的 PMF 放大为可重复、可复制、收益可结算的商业模式。**
- **venture-sales-judge**：N1/N2/N6 "值不值得做"（判断轴）
- **hcc-sales-scale**：N8 "怎么放大收钱"（执行轴）

## 1. 三支柱

### 支柱1：收益转化（Monetization）
五要素收益模型（缺一不可规模化）：
| 要素 | 问题 | 字段 |
|---|---|---|
| 定价模型 | 怎么收钱（订阅/买断/抽成/免费增值/按量）| monetization.pricing_model |
| 定价锚点 | 收多少（锚定用户感知价值，非成本加成）| monetization.price_anchor |
| 支付通道 | 钱怎么进来（微信/支付宝/Stripe/Paddle）| monetization.payment_channel |
| 单位经济 | LTV > 3× CAC（终身价值 > 3倍获客成本）| monetization.unit_economics |
| 收益里程碑 | M1/M3/M6 现金流目标 | monetization.milestones |

**反模式**（规模化判定否决）：定价=成本加成 / 单位经济负且无收敛 / 支付单一渠道无 Plan B / 里程碑无具体数字。

### 支柱2：市场规模化（Scaling）
四杠杆（OPC 单人/单机语境）：
| 杠杆 | OPC 适用性 | 字段 |
|---|:---:|---|
| 获客（口碑/SEO/内容复利）| ✅ 高 | scaling.acquisition_lever |
| 履约（自动化/数字产品）| ✅ 高 | scaling.fulfillment_lever |
| 复购（订阅/社区/生态）| ✅ 中 | scaling.retention_lever |
| 渠道（相邻渠道复制）| ⚠️ 谨慎（单人带宽）| scaling.channel_lever |

**OPC 铁律**：优先自动化履约 + 内容复利获客，慎选人力渠道；规模化标志 = 单位经济放大中保持/改善（非用户数涨）；拒"先烧钱圈地后变现"（违背 OPC 收益为标）。

### 支柱3：销售自治（Autonomy，charter §2.1 N8）
| 决策 | 归属 |
|---|---|
| 定价 ±20% / 渠道选择 / 营销内容 | 销售部 R 自治 |
| 定价模型变更（订阅↔买断）| ⬆️ 升级决策部（影响 PMF）|
| 单位经济转负无收敛 | ⬆️ 升级 + 回环 N8→N5 |
| 目标市场切换 | ⬆️ 升级 + 回环 N8→N1 |

决策部 C：咨询不主动干预；兜底 A 触发条件命中才拍板。

## 2. 规模化判定（Definition of Scaled）
三硬标准（全满足 `scale_achieved: true`）：
1. **收益可结算**：已产生实际收入（非预售/非意向）+ LTV/CAC ≥ 2（3 为健康线）
2. **模式可复制**：获客或履约杠杆跑通 + 可重复 SOP（非靠创始人个人能力）
3. **自治可持续**：销售部独立运营 ≥ 1 完整收益周期（如月度订阅一个月）

**判定流程**：销售部自评三标准 yes/no + 证据 → 全 yes `scale_achieved: true`（HG2 可推进）/ 任一 no 标 gap + 升级路径（N8→N5 或 N8→N1）。

## 3. 工作流程
1. **输入校验**（前置阻塞）：读 N6 画像报告（venture-sales-judge）+ N6 产品化 spec（hcc-product-productize）；缺失 → 回环 N8→N6
2. **三支柱并行设计**：收益转化五要素 + 市场规模化四杠杆 + 销售自治边界
3. **规模化自评**：三硬标准逐条 + 证据
4. **落盘**：`.hcc/sales/hcc-sales-scale/N8_{feature}_plan.md`（type=plan, owner=sales, scale_achieved 驱动 exit_condition）

## 4. 产物模板（N8_规模化_plan.md）
落 `.hcc/sales/hcc-sales-scale/N8_{feature}_plan.md`（plan 类型）：
- frontmatter: node=N8 / department=sales / skill=hcc-sales-scale / type=plan / status / scale_achieved / owner=sales
- §0 输入依赖（N6 画像 + spec 校验，缺失回环）
- §1 PMF 基线（核心价值主张 + 付费意愿证据 + 基线指标）
- §2 收益转化（定价模型/锚点/支付通道/单位经济 LTV-CAC/收益里程碑 M1-M6）
- §3 市场规模化（获客/履约/复购/渠道杠杆 + 可复制 SOP）
- §4 销售自治边界（自治范围 + 升级触发条件）
- §5 规模化判定（三硬标准逐条 + scale_achieved 结果）
- §6 风险与回环（Top3 风险 + loop_back 预案）

**路径铁律**：`.hcc/sales/hcc-sales-scale/`（by-design hcc-{部门}-{维度}）。

## 5. 度量口径（Claude 实施者度量）
会话 / token / 轮次 / skill 配置 / 验证。**禁**人天/团队/学习成本/排期（org-claude.md #measure）。

## 6. 接力协议
- **输入**：N6 画像（venture-sales-judge）+ N6 spec（hcc-product-productize）
- **输出**：N8 plan（scale_achieved）→ HG2 闸门（决策部 A 拍板）
- **回环**：N8→N5（PMF 重验）/ N8→N1（市场重调）/ N8→N6（画像补齐）

## 7. 风险
- **R1 PMF 未充分验证强规模**：输入校验 + 单位经济 <2 必须收敛路径否则阻塞
- **R2 销售自治异化孤岛**：升级触发硬编码（定价模型/单位经济/市场切换）+ artifact 同步机制
- **R3 OPC 误用 SaaS 烧钱打法**：四杠杆 OPC 适用性标注 + 铁律优先自动化+内容复利
- **R4 三硬标准过严/松**：LTV/CAC ≥2 最低（3 健康）+ 自治"1 收益周期"具体化（阈值首跑后校准）
- **R5 与 venture-sales-judge 职责重叠**：接力协议标定（judge 判断轴 N1/N2/N6 / scale 执行轴 N8，N6 画像是 scale 输入非重复产出）
