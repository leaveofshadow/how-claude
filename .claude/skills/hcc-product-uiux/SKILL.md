---
name: hcc-product-uiux
description: >
  产品部 UIUX 方法论工具箱：引用 Bergside Type UI（67 风格 registry）。承接 N7 迭代优化 UIUX 维度 + N6 产品化设计系统生成。
  Triggers on keywords: hcc-product-uiux, UIUX, 界面优化, 设计系统, 视觉规范, 迭代优化, Bergside, typeui
---

> **部门协议引用**（hcc 阶段5 协议降级）：执行前 Read `.claude/contracts/contract-product.md`（产品部协作契约，含 RACI 归属 + 与开发/运维交接锚点）。

# hcc-product-uiux — 产品部 UIUX 方法论工具箱

> **定位**：层3 cc-venture 业务能力 skill（工具箱引用模式）。服务产品部骨架 `hcc-product` §5 业务能力段，承接 venture DAG 的 **N7 迭代优化 UIUX 维度** + **N6 产品化设计系统生成**（hcc-org §2.1：N6/N7 归产品部 R）。
>
> N7⇄N6 是 loop_back（max_iter=3）收敛回环——每轮迭代的 UIUX 维度由本 skill 支撑。节点执行循环第 2 步「执行 skill」时激活。**作为 N7 专属 skill 进 dag.json skill 字段**（hcc-org §3.3 N7→venture-product-uiux 产物归属；2026-06-24 装配 N7.skill=venture-product-uiux）。"工具箱引用模式"指本 skill 内部引 bergside 67 slug 外部方法论（§1，非内置骨架），非"不进 skill 字段"——旧表述已修正。
>
> **方法论来源**（charter 块2，2026-06-22 Boss 三源对比后定）：引 **bergside/awesome-design-skills（Type UI）**——67 个独立设计风格 registry。本 skill 删除原内置方法论骨架（交互流程/信息架构/可用性启发式/视觉规范），改为引用外部成熟实践（契合层3「纯引用外部生态、不自创方法论」原则，同 hcc-dev §5 引 superpowers 模式）。

## §1 引 Bergside Type UI（charter 块2）

**形态**：bergside/awesome-design-skills 是 67 个独立设计风格 registry（glassmorphism / minimal / brutalism / shadcn / neumorphism / editorial / luxury ...）。每个 slug = 一个独立 skill：
- `SKILL.md`（AI 指令）+ `DESIGN.md`（人类可读设计规范）
- 内容覆盖：Brand / Style foundations（token + 色板 + 排版）/ Component families / **WCAG 2.2 AA** / **Quality gates（可测试验收标准）** / Do-Don't

**安装**（按需 pull，npx 轻量无全局 CLI）：

```bash
npx typeui.sh pull <slug> -p claude
```

→ 拉取该 slug 的 SKILL.md + DESIGN.md 到本地，激活时按风格引用。

**为何引 Bergside**（决策依据，charter 块2）：
1. 纯 markdown 零依赖（无 Python，解决备选 A nextlevelbuilder 的环境痛点）
2. 全公开可核实（SKILL.md + DESIGN.md，反黑盒，符反幻觉约束）
3. **Quality gates 可证伪** + **WCAG 2.2 AA** 契合本 skill §3「UIUX 改进必须可观测可证伪」
4. 67 风格可按产品类型动态选（§4 默认 slug 集保底，修复 #10）

### N6 产品化设计系统生成（选风格 pull 覆盖）

N6 产品化「从 0 生成设计系统」：根据 PRD §2 产品概述（产品类型）→ §4 映射表选 slug → `npx typeui.sh pull <slug> -p claude` → 引该 slug 的 Style foundations（token + 色板 + 排版）+ Component families 作为产品 UIUX 基底。

### N7 迭代优化（风格规范 + 检查验收）

N7 迭代时：已 pull 的 slug 提供 Style foundations + Quality gates，UIUX 改进按 Quality gates 的可测试验收标准做（非「更好看」式不可证伪表述）。

### loop_back 收敛触发判据

当 UIUX 改动触及「产品规格」级变化（功能边界 / 信息架构重构）→ 触发 N7→N6 回环（重做产品规格，含重新选 slug）；仅视觉 / 微交互优化（token 调整 / 组件微调）→ N7 内迭代，不回环。

## §2 工作流程（对接 dag exit_condition 关键词）

1. 读输入：N6 产品规格（`.hcc/product/venture-product/N6_产品化_spec.md`）+ PRD §2 产品概述（产品类型，选 slug 依据）+ 反馈来源（用户测试 / 数据 / review 意见）。
2. 按 §4 映射表选 slug → 确认已 pull（缺则 `npx typeui.sh pull <slug> -p claude`，preflight 告警级 optional，不阻断）。
3. 应用该 slug 的 Quality gates 做 UIUX 维度分析。
4. 产出：迭代记录 UIUX 段（§3 格式）→ 落 `.hcc/product/venture-product-uiux/N7_迭代优化-uiux_spec.md`（hcc-org §3.3 .hcc 产物目录规范）。

## §3 产出格式（迭代记录 UIUX 段必含要素）

```
## 本轮迭代记录（UIUX 维度）
- 选用 slug：[slug 名 + 产品类型依据]
- 发现的问题：[按 Bergside Quality gates 分类，标注严重度]
- 改进项：[具体改动 + 关联 token / 组件]
- 可证伪验收：[Quality gates 可测试标准，如「核心任务点击数 5→3」/ WCAG 对比度达标 / 完成率，非「更好看」]
- 是否触发 loop_back：回 N6（规格级，含重选 slug）/ 否（微调级）
```

> **可证伪要求**：UIUX 改进必须有可观测指标（点击数 / 完成率 / 时长 / 错误率 / WCAG 对比度），避免「更优雅」「体验更好」等不可证伪表述。Bergside Quality gates 提供可测试验收标准，是本 skill 可证伪性的来源。

## §4 默认 slug 集 + 动态选规则（R5.3，修复 #10）

**默认 slug 集**（不全装 67 省 token，7 个按产品类型保底）：

| slug | 适用产品类型 | 风格特征 |
|------|-------------|---------|
| **minimal** | 工具类 / 效率应用 | 极简、信息密度优先 |
| **shadcn** | 通用 SaaS / 后台 | 现代组件库、中性专业 |
| **glassmorphism** | 消费类 / 社交 | 玻璃拟态、年轻时尚 |
| **brutalism** | 内容类 / 创意工具 | 粗野主义、强表达 |
| **editorial** | 媒体类 / 资讯 | 编辑排版、阅读优先 |
| **neumorphism** | 沉浸类 / 情境应用 | 拟物柔和、沉浸感 |
| **luxury** | 高端类 / 品牌站 | 奢华精致、留白克制 |

**动态选规则**（R5.3）：N6/N7 时根据 **PRD §2 产品概述的产品类型** → 上表映射选 slug → `npx typeui.sh pull <slug> -p claude`。

**可选扩展**：agent 可提默认集外的 slug（67 全集见 bergside/awesome-design-skills registry），但默认集保底——确保常见产品类型有确定映射（修复 #10：固定映射表，避免「砍 taste 却全装 67」的矛盾；taste 审美维度 Boss 定不纳入层3，正交于风格 slug）。

## §5 深度参考

- **Bergside Type UI**（bergside/awesome-design-skills，charter 块2 定源）：67 slug registry，每 slug = SKILL.md + DESIGN.md。pull 命令 `npx typeui.sh pull <slug> -p claude`。
  - 默认 slug 集见 §4（minimal / shadcn / glassmorphism / brutalism / editorial / neumorphism / luxury）。
  - preflight 告警级 optional（required:false，N7 才用；hcc-org §0 自检 + `hcc-dependencies.json` bergside-type-ui 条目）。
- 关联骨架：`hcc-product/SKILL.md` §5（本 skill 被其名称引用）。
- 产出落盘：charter.md §3.3 `.hcc/product/venture-product-uiux/N7_迭代优化-uiux_spec.md`。
