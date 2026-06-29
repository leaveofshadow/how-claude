# how-claude — Claude Code Loop Engineering 教练套件

> **核心理念**：你不 prompt agent，你设计循环让循环去 prompt agent。

一套 Claude Code **技能（Skill）**，用 **Loop Engineering** 方法论把 Claude Code 从「会出错的助手」调教成「可靠自治的执行系统」。

## 解决什么问题

Claude 作实施者有系统性缺陷：**偷懒走捷径 / 经常忘记约束 / 认知漂移 / 幻觉编造 / 群体思维**。本套件把对抗这些缺陷的工程手段，固化成按需加载的技能——不是教你写更花哨的 prompt，而是设计**循环**让循环去约束 agent。

## 技能清单

**路由器**：`claude-coach` — 诊断问题 → 路由到子技能（不堆领域内容，只做分发）

**8 个子技能**（独立成文，触发时按需加载，省 context）：

| 技能 | 职责 |
|---|---|
| `cc-loop` | **Loop Engineering 核心课**（五阶段演进 + 循环合同 + 护栏 + 闭环反馈 + 锚文件）|
| `cc-goal` | 终态条件设计（五层模型 + supergoal 自评 + 可证伪预检）|
| `cc-2pp` | **两阶段设计决策**（探索 → 判官小组多方案 → 对抗验证 → 裁决 + 实施计划）|
| `cc-orchestration` | 编排决策（subagent / workflow / team 决策树 + 编排循环）|
| `cc-config` | 配置系统 + 锚文件体系（VISION / CLAUDE / AGENTS / PROMPT）|
| `cc-context` | 上下文健康（健康检查 + 持久化策略 + 循环上下文管理）|
| `cc-scanner` | 技能知识库（多源扫描 → 推荐 → 技能作为循环资产）|
| `cc-memory` | 记忆系统审查（5 系统 × 3 级别 + 循环记忆写回）|

**编排 + 契约**：
- `venture-pipeline` — 产品全流程 DAG 编排（销售 → 决策 → 需求 PRD → 架构设计 → 原型 → 验证 → 产品化 → UIUX → 规模化）+ `monitor` 漂移检测（隐式 baseline 对比 + 机械/语义分工）
- `contracts/` — org↔claude / human↔claude / human↔org 三类契约单一来源（语义锚引用，下游不重复）

## 快速开始

```bash
git clone https://github.com/leaveofshadow/how-claude.git
cd how-claude
# .claude/skills/ 下是技能源（claude-coach + cc-* + venture-pipeline）
# 复制/软链到你项目的 .claude/skills/ 即可被 Claude Code 加载
```

在 Claude Code 里触发路由器（自然语言或斜杠命令）：

```
> 我有个长期任务老跑偏，怎么治        → claude-coach 诊断 → 路由 cc-loop + cc-goal
> 帮我用判官小组做个架构决策          → cc-2pp
> 设计一个产品从 0 到 1 的流程        → venture-pipeline
```

详见 [使用指南](使用指南.md)。

## 核心理念：Loop Engineering 五阶段演进

```
1. ralph（持续模式）         单任务自治循环
2. /goal（终态条件）         可证伪的完成判据
3. /loop（自驱循环）         多步自治 + 每轮重读锚文件防漂移
4. 编排循环（subagent/workflow） 多 agent 并行/流水线
5. 全自动编排                循环管循环，人只设目标
   ▲
_loop 工程化的本质是「设计循环」，不是「写 prompt」_
```

参考：[loops-explained-zh](loops-explained-zh.md) / [loop-engineering-how-to-zh](loop-engineering-how-to-zh.md) / [loop-engineering-anthropic](loop-engineering-anthropic.md) / [dynamic-workflows-zh](dynamic-workflows-zh.md)

## 架构：三层正交

```
venture-pipeline   全流程 DAG 编排（产品 0→1 主线 + 变更回溯）
     ↓ 调用
cc-2pp             设计决策切面（领域无关：探索→判官小组→对抗→实施计划）
     ↓ 产出 plan
cc-loop            执行原语（循环合同 + 护栏 + 闭环反馈 + 锚文件）
```

- **路由器 + 子技能**：`claude-coach` 只诊断分发，子技能按需加载（不一次性占满 context）
- **视角库**：`cc-2pp/_roles/perspective-{arch,product,ui}.md`（架构 8 条 / 产品 7 条 / UIUX 7 条检查清单，按域加载）
- **循环合同三件护栏**：最大迭代数 / 无进展检测 / 预算上限
- **契约单一来源**：三类契约在 `contracts/`，下游语义锚引用（`org-claude.md`[`#measure`] 式），不重复定义

## 项目结构

```
.claude/skills/
├── claude-coach/          # 路由器
├── cc-loop/ cc-goal/ cc-2pp/ cc-orchestration/
├── cc-config/ cc-context/ cc-scanner/ cc-memory/   # 8 子技能
├── venture-pipeline/      # 编排 + monitor 漂移检测
└── contracts/             # 三类契约单一来源
```

开发指南见 [CLAUDE.md](CLAUDE.md)。

## 状态

个人技能套件（OPC：单机/单人/单 Claude），持续打磨中。核心模块（cc-loop / cc-2pp / venture-pipeline / monitor）已实装 + 测试覆盖。

## License

MIT
