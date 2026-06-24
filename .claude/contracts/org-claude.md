---
name: org-claude
type: contract
scope: shared（cc-2pp + hcc-org + venture-product-requirement + 所有 hcc-* 引用）
version: v1（2026-06-24，契约单一来源落地）
---

# org-claude 契约 —— 组织 ↔ Claude 实施者

> **单一来源声明**：本文件是「组织实施者是谁 + 怎么度量」的唯一真理源。
> cc-2pp / hcc-org / venture-product-requirement / hcc-* 等下游引用本文件语义锚，**不内联重复**。
> **抽取自三处同源**（消除双源真理，2026-06-24 勘察实证）：
> - cc-2pp/SKILL.md（假设1「范式转移」+ Prompt 注入约束块 L122/136-159）
> - hcc-org/SKILL.md §定位（L12「实施者=Claude+skills」+ C-2 禁人天隐喻）
> - venture-product-requirement/SKILL.md §度量口径（L254 token ROI + L266-269 Claude 度量）

---

## <a id="cognitive-anchor"></a>① 认知锚定：实施者 = Claude Code + 已装载 skills

**钉死一句**：实施者 = Claude Code + 已装载 skills，**不是人类团队**。开始任何方案起草/评估前先在心里钉死这句。

- **组织皆由 Claude 分饰**：hcc 5 部门（决策/产品/开发/运维/销售）由同一 Claude 分饰（charter「单 Claude」部署约束）。无岗位/人手/团队编制概念。
- **交接对象是 Claude**：Plan/锚文件/契约按「Claude 好读、好执行、好自验证」设计，不是给人读的传统设计文档。
- **能力边界重塑**：缺能力 → 先找/造 skill（联动 cc-scanner），**不评估团队学习成本**。本框架下「学习成本」对象 = skill 配置/制造成本，不是人学新技术的成本。
- **校准失败信号**：方案/估算冒出「学习成本 / 人手 / 排期 / 团队熟练度 / 人岗 / 学习曲线」→ 立刻停，换回 Claude 视角。

---

## <a id="measure"></a>② Claude 实施者度量口径（禁人天隐喻）

实施者是 Claude + skills，工作量估算**禁用**以下度量词：
人天 / 人周 / 人月 / 学习成本 / 排期 / 团队 / 人岗 / 熟练度。

**改用以下度量**：

| 度量 | 含义 |
|------|------|
| **token 成本** | 输入 + 输出，含 retry 预算 |
| **上下文轮次** | 需几轮对话 / 几个 agent 并行 |
| **skill 配置成本** | 要新造/装载哪些 skill（联动 cc-scanner 能力清单） |
| **验证复杂度** | 验收条件多可证伪 / 需多少测试检查 |
| **依赖与风险** | 外部 API / 数据 / 人工确认点 |

**部门协作成本**按 **token / 上下文轮次 / 文件交接开销** 度量（hcc-org C-2 约束）。

---

## <a id="token-roi"></a>③ token ROI 降级（Boss 方法论修正）

Claude 实施者的 **token ROI 不好估**：
- **投入侧** = token 是 Claude 运行成本，非用户直接感知
- **产出侧** = 规格/闸/契约的价值难提前货币化
- 两端都模糊

→ **token ROI 不作方案比较/裁决的主轴**。token 仍作实施成本度量（见②），但**不作决策依据**。

方案裁决改用**三项好估维度**：
1. **功能需求** — 方案是否完整满足功能职责（不换皮、不偷工）
2. **技术选项** — 选用的技术/结构是否合理、是否为下游铺正确接口
3. **运维成本（全生命周期）** — 含「现在省 vs 未来返工」权衡

---

## 引用规约（给下游 skill）

下游 skill 引用本契约时，用**语义锚名**（非 § 号，防章节重排致引用漂移）：

| 引用目标 | 锚名 |
|---------|------|
| 认知锚定（实施者是谁） | `org-claude#cognitive-anchor` |
| Claude 度量口径 | `org-claude#measure` |
| token ROI 降级 | `org-claude#token-roi` |

**改本契约不动锚名**（锚名是 API）；改锚名 = 破坏性变更，须 bump `version` + grep 全引用点同步更新。

---

## 引用点清单（下游改造状态）

| 下游 skill | 原内联位置 | 引用本契约锚 |
|-----------|-----------|-------------|
| cc-2pp/SKILL.md | L122 token ROI 段 | `#token-roi` |
| cc-2pp/SKILL.md | L142-146 实施者认知锚定判定（定义已抽 `_roles/injection-template.md`） | `#cognitive-anchor` |
| cc-2pp/SKILL.md | L36/L151 Claude 度量（定义已抽 `_roles/injection-template.md`） | `#measure` |
| hcc-org/SKILL.md | L12 实施者锚定 + C-2 | `#cognitive-anchor` + `#measure` |
| venture-product-requirement/SKILL.md | L254 token ROI | `#token-roi` |
| venture-product-requirement/SKILL.md | L266-269 度量口径 | `#measure` |
| cc-2pp/references/2pp-guide.md | L30/53/122/648 token ROI 降级（见假设5） | `#token-roi` |

> 改造原则：下游保留**判定/触发逻辑**（何时引用、违反信号→扣分），只把**契约定义**改为引用本文件。判定逻辑不可移走（cc-2pp F2 修复原则：契约只放定义，判定留调用方）。

> **✅ 改造完成状态（2026-06-24）**：上表下游引用点全部改造完成（SKILL.md 6 处 + 2pp-guide.md 4 处）——内联契约定义/内部跳转已替换为语义锚引用，判定逻辑（校准信号/扣分规则/落点判定）保留在调用方。验证（grep）：所有锚引用命中且锚名与本文件 `<a id>` 一致；"token ROI 不好估"完整论证仅存本文件 ③（L51 真理源），下游均为一句话提及 + 指针（"见假设5 / `#token-roi`"），无违规双源。下游双源真理已消除（含 2pp-guide.md L30/53/122/811 接入真理源）。
