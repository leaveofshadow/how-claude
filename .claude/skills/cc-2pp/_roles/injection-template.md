---
name: injection-template
type: prompt-fragment
skill: cc-2pp
loaded_by: 编排者 Phase 2/4 spawn 创造类 agent 时 Read 本文件，拼入 agent prompt 末尾
version: v1（2026-06-24，抽自 SKILL.md L137-167 + 2pp-guide.md L221-235）
---

# injection-template —— 必注入约束 prompt 片段

> **cc-2pp 专属 prompt 片段**（非 subagent 定义）。从 SKILL.md「Prompt 注入约束」+ 2pp-guide.md「agent prompt 末尾追加」抽离合并，消除三处重复。
> **F2 原则**：本文件只放**可注入的 prompt 片段**（定义引用 org-claude.md 契约）；**判定逻辑**（校准失败信号/扣分规则/落点判定）**留 SKILL.md**，不抽走。

## 用法

编排者 spawn 创造类 agent（general-purpose/executor）时，在 prompt 末尾追加以下内容。探索类 agent（Explore/analyst）只读不写，不追加末尾块，但仍需认知锚定。

---

## 注入块（拼入 agent prompt）

```
★ 实施者认知锚定（假设1 认知层——必注入）
  定义（单一来源）：.claude/contracts/org-claude.md[#cognitive-anchor]——实施者 = Claude Code + 已装载 skills，组织皆由 Claude 分饰，能力边界靠 skill 扩展。

★ 按需补齐方法论（假设1 推论1 执行版——缺认知先读 cc-* 子技能，不是读路由器）
  方案涉及 Claude Code 方法论时，起草/攻击前先 Read 00-explore.md（Phase 0 能力清单）
  定位的对应 cc-* 子技能深度参考，补齐认知再动手:
    · 涉及自动循环        → cc-loop/references/loop-guide.md
    · 涉及验收标准        → cc-goal/references/goal-guide.md
    · 涉及多 agent 编排   → cc-orchestration/references/orchestration-guide.md
    · 涉及工程配置/锚文件 → cc-config/references/config-systems-guide.md
  ⚠️ 不读 claude-coach 路由器——它是分诊台不是知识库

★ Claude 实施者度量（假设1 下沉——必注入）
  定义（单一来源）：.claude/contracts/org-claude.md[#measure]——禁用人天/人周/人月/学习成本/排期/团队/人岗/熟练度；改用 token 成本/上下文轮次/skill 配置成本/验证复杂度/依赖风险。
  [#token-roi]——上述度量用于估算实施成本，但 token ROI 不作方案比较/裁决主轴。

★ 其他必注入约束（反 LLM 缺陷）
    · 不走捷径、不省步骤（effort=max，反偷懒）
    · 事实声明必须有证据来源（反幻觉）
    · 缺能力先找/造 skill，不算"团队学习成本"
    · 方案必须列出"需要哪些 skills"（消费 Phase 0 能力清单）
    · ★保姆级细化（Phase 4 产出）: 每个需求项写到"新实例只看这一条就能动手"；
      禁"实现 X 功能"式模糊；验证必须可证伪（命令+期望输出）
```

## 末尾追加块（仅创造类 agent: general-purpose/executor）

```
Prompt 末尾追加:
  "把完整产出写到文件 {路径}，必须包含以下章节:
   {章节清单}
   章节内自由发挥，不要只写'已完成'之类的空话。
   ★ 先钉死认知: 实施者 = Claude + skills，评估的是"Claude 能不能落地"，不是"团队能不能排期"。
   ★ 方案涉及 Claude Code 方法论（循环/终态/编排/配置）→ 先 Read 00-explore.md 定位的对应
     cc-* 子技能深度参考补齐认知（不读 claude-coach 路由器）。
   ★ 工作量按 Claude 实施者度量（token/轮次/skill配置/验证），禁用'人天/人周'。
   写完文件后回复一句确认即可。"
```

## 编排者校验（留编排者侧，非注入）

读文件时检查必需章节是否齐全；缺失或空壳 → 触发 retry。
