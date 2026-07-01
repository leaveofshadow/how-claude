# Claude Code 最佳实践指南

> **版本基线**：Claude Code v2.1.x 系列（截至 2026-07，滚动发布）— [GitHub Releases](https://github.com/anthropics/claude-code/releases) · [官方 changelog](https://code.claude.com/docs/en/changelog)
> **仓库**：[anthropics/claude-code](https://github.com/anthropics/claude-code) — **135,211 stars / 21,812 forks**（GitHub API 核实，2026-07-01）
> **文档类型**：领域指南（domain-guide）→ 橙皮书风格 + 教程模式
> **深度层**：D3 原理 ✅ · D4 演变 ✅ · D5 心智模型 ✅ · D6 争议 ⭕(开) · D7 方向 ✅
> **置信度图例**：★★★ 官方文档/仓库 + 社区共识 / ★★ 主流但单一源 / ★ 经验或未量化

---

## 一句话核心

> **你不是在写代码，你是在指挥一个会写代码的 agent。Claude Code 真正改变的不是"写代码的效率"，而是"你的角色"——从写代码的人，变成构建产品、设计循环的人。**

这句话决定你用它顺不顺手。把它当"更聪明的代码补全"，你会逐行盯着它改，累且慢；把它当"一个能自主干活、但需要你给方向、设护栏、验收结果的独立工程师"，你才会把精力花在对的地方。

---

# 第一部分：心智转变

## §01 为什么是 Claude Code：AI 编程的三年三级跳

### 痛点：装了一堆 AI 编程工具，分不清差别

如果你用过 GitHub Copilot、Cursor，再到 Claude Code，会觉得"不都是 AI 帮我写代码吗"。这个误解会让你用 Claude Code 时还在用 Copilot 的方式（逐行补全），浪费了它最值钱的能力。先把这三代的演变理清楚——**变的不是技术有多先进，而是你和 AI 之间的关系**。

```
2022  GitHub Copilot    你写上半句，它猜下半句        → AI 是你的"输入法"
2024  Cursor            你说"我想要什么效果"，它改        → AI 是你的"结对伙伴"
2025  Claude Code       你描述需求，它自己规划+写+测+提交  → AI 是你的"独立工程师"
```

Copilot 时代，你还是写代码的人，AI 只让你打字快了点。Cursor 时代，你不用精确描述"怎么写"，说"要什么效果"就行，但它始终长在 IDE 里、需要你在旁边确认。Claude Code 不住在任何编辑器里，它**在终端运行、能完全自主跑完一个任务**——读代码、改代码、跑测试、操作 git，整个循环自动完成。

### Claude Code vs Cursor（被问得最多的问题）

"Cursor 也有 Agent 模式了，不都能干吗？"差异不在"能不能做"，在**做到什么程度**：

| 维度 | IDE Agent（Cursor 等）| 终端 Agent（Claude Code）|
|------|---------------------|------------------------|
| 运行环境 | 编辑器内嵌，依赖 IDE | 终端原生，直接操作操作系统 |
| 自主程度 | 通常需要你在旁边确认 | 可完全无人值守运行 |
| 系统集成 | 通过插件桥接 git/CLI | 直接操作 git、shell、MCP |
| 记忆系统 | 隐式的项目索引 | **显式的 CLAUDE.md 记忆文件** |
| 并行能力 | 主要单实例 | 原生多实例并行（像小团队）|

重点看后三行：**显式记忆**（CLAUDE.md 让你把项目知识写成文件，每次启动读）+ **直接操作 git/shell**（不经 IDE 插件桥接）+ **多实例并行**（同时让几个 Claude Code 处理不同模块）。

打个比方：Cursor 像坐在你 IDE 里的结对伙伴，你们看同一个屏幕协作；Claude Code 更像一个独立干活的工程师，你给需求，他自己拉代码、写、测、提交，你喝杯咖啡回来看结果。

```
推荐                              不推荐
想"从想法到能跑的产品" → Claude Code  只想要补全/逐行帮助 → Copilot 够了，别上重武器
复杂多步任务/无人值守 → Claude Code   单文件小改、要全程盯 → IDE Agent 更顺手
```

> **核心建议**：选工具先问"我要的是补全、对话、还是自主干活"。Copilot=补全、Cursor=对话式 IDE 协作、Claude Code=终端自主 agent。Claude Code 的甜区是"复杂多步任务"和"从想法到能跑的产品"——如果只想要逐行补全，Copilot 更轻。**理解三代演变，你才知道为什么 Claude Code 这么设计**（终端原生、显式记忆、自主循环），而不是把它当 Cursor 用。

---

## §02 最大的坎：从"写代码"到"构建产品"

### 心智转变（全文灵魂）

用 Claude Code，最大的转变是**角色转换**：

```
传统开发：你是写代码的人        → Claude Code 时代：你是指挥、审查、设计的人
你敲键盘                     → 你描述要什么
你决定怎么实现               → 你审它给的方案
你一行行写                  → 你看它干、给反馈
你记着所有上下文             → 你把上下文写进文件让它读
```

但这只是第一层。**更深一层**：Claude Code 解决的不是"代码生产效率"（怎么更快写出这个函数），而是"产品构建效率"（怎么更快从一个想法变成能跑的东西）。传统 AI 编程工具帮你写代码，Claude Code 帮你**构建产品**。

为什么这个 reframe 重要？因为随着 AI 能力提升，"盯着 AI 干活"会越来越不值钱，**"决定做什么产品、判断什么值得做"会越来越值钱**。你用 Claude Code 时，与其把时间花在监督它写每个函数，不如花在产品决策上——它写代码比你快，但"做什么"这个判断，目前还得你来做。

```
推荐                              不推荐
描述终态 + 给它空间自主跑         逐行盯着、每步打断指挥
把精力放在"做什么"产品决策        把精力放在"它每个函数写对没"
把约束写进 CLAUDE.md              每次口头重复"记得用 pnpm"
```

> **核心建议（D5 心智模型）**：把 Claude Code 当一个**能干活但记忆短、需要明确指令、偶尔偷懒走捷径的独立工程师**。你的四个新职责：① 把要什么讲清楚 ② 把约束写进它能一直读到的文件 ③ 审它给的方案和产出 ④ 设计让它稳定重复的流程。**而最高的杠杆**是：把时间从"监督写代码"挪到"产品决策"——这是 AI 时代越来越值钱的能力。

---

## §03 Claude Code 到底是什么（D3 原理层）

### 它不是聊天框，是 agent harness

把它理解成"终端里的 ChatGPT"会错过核心。Claude Code 是一个 **agent harness（智能体运行框架）**：

聊天模型 = 你问它答，它**说**给你听，你手动改代码。
Claude Code = 它能**自己读文件、改文件、跑命令、看结果、再改**——一个自主行动闭环。

三层组成：

```
模型层（Claude：Opus/Sonnet/Haiku）   ← 大脑，决定做什么
   ↓
harness 层（工具 + 权限 + 上下文管理）  ← 手脚和护栏
   ↓
你的指令（prompt + CLAUDE.md + 配置）  ← 方向和约束
```

- **模型层**决定"接下来做什么"——读哪个文件、跑什么命令、怎么改。
- **harness 层**是手和脚：工具（读/写/搜索/bash/subagent…）、权限闸、上下文管理。模型用它干活。
- **你的指令**是方向盘和刹车。

知道这分层，你就会理解为什么"换个更强模型"不总解决问题——约束没给清楚（指令层）或上下文爆了（harness 层），再强的模型也跑偏。**大多数"它不听话"根因在指令层和 harness 层，不在模型层。**

> **核心建议**：遇到"它不听话"先定位是哪层：能力不够（换 Opus）→ 模型层；上下文太长/工具用错（/clear、改 prompt）→ harness 层；约束没写清楚（写进 CLAUDE.md）→ 指令层。三层定位比"换更强模型"有效。

---

## §04 内部机制：TAOR 循环（D3 深度，类独家）

### 它到底是怎么"自主"干活的

理解这个，你才知道怎么"喂"它、它会在哪里卡住。Claude Code 的核心工作循环叫 **TAOR**：Think-Act-Observe-Repeat（[据 2026-03 源码泄露后的社区分析，花叔橙皮书附录 A](https://github.com/anthropics/claude-code)；置信度 ★★，基于泄露源码解读）。

```
Think（想）：理解意图、制定计划
   ↓
Act（做）：选择工具、执行操作（读文件/改/跑命令）
   ↓
Observe（看）：检查结果、判断状态
   ↓
Repeat：继续 or 结束、调整策略
```

你在终端输入一句话后发生的所有事，都是这个循环在驱动。它不是"一次性生成答案"，而是**多轮地想→做→看→再想**，直到任务完成或需要你介入。

**知道 TAOR，你会做的不同决策**：
- **Observe 阶段会读大量文件** → 这就是为什么探索任务该用 subagent 隔离（避免污染主线）。
- **每轮 Act 都过权限闸** → 这就是为什么无人值守要配 auto/bypass 模式（否则它每轮等你）。
- **Think 质量取决于上下文** → 这就是为什么上下文管理（§12-14）是性能生死线。
- **Repeat 没有护栏会一直转** → 这就是为什么循环要有最大迭代数等护栏（§26）。

### 技术栈小记（理解它的设计选择）

据源码分析，Claude Code 用 **Bun**（不是 Node.js）做运行时——因为要频繁起子进程、读写文件、处理并发，Bun 冷启动和这些场景比 Node 快。终端 UI 用 **React + Ink**（在终端里跑 React）——因为它的 UI 很复杂（实时进度条、可折叠 diff、权限弹窗、嵌套工具调用），用组件化思路比手拼字符串好维护。整个 CLI 编译成单个约 785KB 的文件分发。（同上来源，★★）

> **核心建议**：理解 TAOR 循环（想→做→看→重复），你就理解了它所有行为的根——为什么探索要用 subagent 隔离（Observe 读量大）、为什么无人值守要 auto 模式（每轮 Act 过权限闸）、为什么上下文管理是生死线（Think 质量取决于上下文）。**这个"内部视角"是它和 Cursor 那种 IDE 插件的本质区别**——它是按 agent 循环设计的，不是按补全设计的。

---

## §05 演变：从 CLI 到自治化（D4，2026 增量）

**第一步：CLI 助手（2024）**——终端里问 Claude，能读项目，主要问答。
**第二步：agent harness（2025）**——能自主跑多步任务，加 subagent、plan mode、hooks、命令。
**第三步：自治化（2026）**——让 agent 自己跑：后台 agent（被重启能断点续跑）、定时任务、auto mode 安全收紧、组织级模型管理、**插件系统**（plugins/）、多 surface（终端/IDE/桌面/Web）。方向很清楚：**从"你盯着它干"到"你设好目标和护栏，它自己跑，你来验收"**。

最值得盯的 2026 变化（§30 详解）：插件系统（官方 plugins/ 仓库）、Opus 4.7 GA + fast mode 弃用（2026-07-24 移除）、auto mode 拦破坏性 git/terraform、`/rewind`、后台 agent 断点续跑、多 surface 统一引擎。

> **核心建议**：Claude Code 几乎每天滚动更新（v2.1.x），**别背版本号，别全信 2025 老教程**（尤其 `npm install` 已 deprecated、fast mode 已弃用）。每月看一次 [changelog](https://code.claude.com/docs/en/changelog)。

---

# 第二部分：上手

## §06 安装与第一个任务（5 分钟看到它干活）

### 安装（2026 正确方式——npm 已 deprecated）

⚠️ **重要修正**：`npm install -g @anthropic-ai/claude-code` 已 **deprecated**（[官方 README](https://github.com/anthropics/claude-code)）。现在推荐原生安装：

```bash
# macOS / Linux / WSL（推荐）
curl -fsSL https://claude.ai/install.sh | bash

# 或 Homebrew（macOS/Linux）
brew install --cask claude-code
# 注：claude-code 是稳定通道（约落后一周），claude-code@latest 是最新通道

# Windows PowerShell
irm https://claude.ai/install.ps1 | iex
# 或 winget
winget install Anthropic.ClaudeCode

# Linux 包管理器也支持
# apt / dnf / apk（Debian/Fedora/RHEL/Alpine）
```

```
推荐                              不推荐
curl 原生安装 / brew / winget      npm install -g（已 deprecated）
```

装完进项目目录启动：

```bash
cd your-project
claude      # 首次启动会提示登录
```

### 第一个任务

别问"你能做什么"，直接给一个真实的小活（用 §08 的四件套）：

```
> 给这个项目的 README 写一段"快速开始"，读 package.json 找启动命令，
  写完后别改其他文件
```

**看它干活**：它自己读 `package.json`、读现有 README、写一段、可能问你能不能改 README。这就是它的"魔法"——你给目标，它自己规划步骤、用工具、产出结果。

> **核心建议**：装用原生安装（`curl ... | bash` / brew / winget），**别用 npm 了**（deprecated）。第一个任务给一个真实、小、有明确边界的活，重点不是产出，是让你**观察它的工作方式**——它怎么规划、怎么用工具、什么时候问你。

> **过渡叙事**：你刚跑通第一个任务，直接对话给 prompt 够用。但当任务变复杂、要重复、要让它稳定守规矩时，光靠对话不够——你得把约束写进 CLAUDE.md、把流程变成命令、把能力变成技能/插件。后面讲这些。

---

## §07 五个 Surface + 集成矩阵：在哪用它

### 痛点：以为只能在终端用

很多人以为 Claude Code=终端 CLI。其实它有 **5 个 surface**，且**共享同一引擎**——你的 CLAUDE.md、settings、MCP 在所有 surface 都通用（[官方 overview](https://code.claude.com/docs/en/overview)）。

| Surface | 特点 | 适合 |
|---------|------|------|
| **终端 CLI** | 全功能主力 | 日常开发、复杂任务 |
| **VS Code / Cursor** | inline diff、@-mention、plan review | 边写边用、看 diff |
| **JetBrains** | IntelliJ/PyCharm/WebStorm 插件 | JetBrains 用户 |
| **桌面 app** | 独立 app、可视 diff、多会话并排、定时任务 | 多会话、定时 |
| **Web（claude.ai/code）** | 浏览器、无需本地、长任务、并行任务、iOS app | 远程、不在本机的仓库、移动端 |

**关键**：因为同一引擎，你在终端配的 CLAUDE.md/MCP/skill，在 VS Code、桌面、Web 都生效。不用每个 surface 重配。

### 超出 5 个 surface 的集成矩阵

Claude Code 还能接入 CI/CD、聊天、浏览器工作流（[官方 overview](https://code.claude.com/docs/en/overview)）：

| 我想… | 最佳选项 |
|------|---------|
| 从手机/其他设备继续本地会话 | **Remote Control** |
| 把 Telegram/Discord/iMessage/webhook 事件推进会话 | **Channels** |
| 定时跑 Claude | **Routines** / 桌面定时任务 |
| 自动化 PR review / issue 分诊 | **GitHub Actions** / **GitLab CI/CD** |
| 每个 PR 自动代码审查 | **GitHub Code Review** |
| Slack bug 报告路由到 PR | **Slack** |
| 调试线上 web 应用 | **Chrome** |
| 为自己的工作流造自定义 agent | **Agent SDK** |

```
推荐                              不推荐
日常主力 → 终端 CLI               以为只能在终端用（错过 Web/桌面/IDE）
看 diff → VS Code 扩展            终端看 diff（不如 IDE 直观）
长任务/移动端 → Web (claude.ai/code) 本地死磕长任务
PR 自动审查 → GitHub Code Review   手动每个 PR review
```

> **核心建议**：Claude Code 不是只有终端——5 个 surface（终端/VS Code/JetBrains/桌面/Web）共享同一引擎，**你的 CLAUDE.md/MCP/skill 跨 surface 通用**。日常终端主力，看 diff 用 VS Code，长任务/移动端用 Web。再加集成矩阵（Remote Control/Channels/Routines/CI/Slack/Chrome/Agent SDK）覆盖"会话外"场景。

---

## §08 描述需求的艺术：prompt 四件套

### 痛点："帮我优化一下"→ 它改了一堆你不要的

模糊 prompt 是一切效率问题的源头。Anthropic 官方 agentic coding 最佳实践核心一条：**给 agent 清晰、可验证的目标，而不是步骤指令**（[Anthropic Engineering](https://www.anthropic.com/engineering)）。

```
推荐                              不推荐
"把这个 API 响应从 2s 优化到       "帮我优化一下这个代码"
 500ms，瓶颈在数据库查询，别改      （太模糊，它只能猜）
 接口签名"                         
描述终态 + 边界                   描述步骤（先X再Y）——它自己规划
给可验证的完成标准                  "做好了"就行（没法验收）
```

### 一个好 prompt 的四件套

```
1. 终态：做成什么样（可观测、可验收）
   → "加 /health 端点，返回 {status:'ok'}，HTTP 200"
2. 上下文：相关文件/约束/技术栈
   → "用现有的 FastAPI app，路由放 routers/health.py"
3. 边界：什么别碰
   → "别动 main.py 现有路由，别加新依赖"
4. 验收：怎么算做对了
   → "curl 返回 200+JSON，pytest 过"
```

简单任务给终态就够；老跑偏时，九成是这四件套漏了哪件。

> **核心建议**：写 prompt 想象给一个**聪明但不了解你项目的新同事**派活——他会问"做成什么样？""用哪个文件？""不能碰什么？""怎么算完？"。提前答了就是好 prompt。**描述终态，别描述步骤**。

---

# 第三部分：配置与记忆

## §09 CLAUDE.md：最重要的一个文件

### 每次重复"记得用 pnpm""别动 config"——写进 CLAUDE.md

CLAUDE.md 是**项目级、每次会话自动加载的"规矩说明书"**。写一次，每次都读到（[官方 memory 文档](https://code.claude.com/docs/en/memory)，逐字核实）。

### 加载层级（从广到窄，越靠近 cwd 优先级越高）

```
Enterprise（IT/DevOps 策略）     ← 最广
   ↓
User（~/.claude/CLAUDE.md）      ← 你个人全局
   ↓
Project（./CLAUDE.md 或 ./.claude/CLAUDE.md）  ← 项目级，进 git
   ↓
Local（./CLAUDE.local.md）       ← 本机，进 .gitignore
```

**串联拼接**（非覆盖），越靠近 cwd 越晚读取、优先级越高。团队规矩写 `./CLAUDE.md`（进 git），个人偏好写 `CLAUDE.local.md` 或 `~/.claude/CLAUDE.md`。

### 写什么 / 不写什么

写：构建/测试命令、约定（"用 pnpm"）、项目结构、"始终执行 X"规则。
不写：超过 **200 行**（官方建议）、多步流程（移到 skill）、只对局部有效的（移到 `.claude/rules/`）。

```markdown
# CLAUDE.md 示例
## 构建/测试
- 装：`pnpm install` / 跑：`pnpm dev` / 测：`pnpm test`（改完必须跑）
## 约定
- 包管理用 pnpm，禁止 npm/yarn；提交前 `pnpm lint`
## 别碰
- 不改 src/config/production.ts；不加新依赖，先讨论
```

### 两个最常踩的坑

**坑 1：@import 不省 token。** `@path/to/file` 把别的文件拼进 CLAUDE.md，但**导入文件全量加载，不省 token**（[memory 文档](https://code.claude.com/docs/en/memory)）。它的作用是组织（拆大文件），不是省 context。想省 context 用 `.claude/rules/` 路径范围规则（§11）。

**坑 2：CLAUDE.md 是上下文，不是强制层。** 它是"行为引导"，**多数时候遵守但不保证 100%**。要**硬拦**某操作（比如绝不能读 `.env`），用 PreToolUse hook（§19），别指望 CLAUDE.md。

```
推荐                              不推荐
团队规矩写 ./CLAUDE.md（进 git）   每次口头重复约束
个人偏好写 CLAUDE.local.md         个人偏好塞共享 CLAUDE.md
< 200 行，具体（"2 空格缩进"）     800 行巨无霸、"好好格式化"（模糊）
硬拦用 hook（PreToolUse）          指望 CLAUDE.md 100% 强制
@import 组织大文件                 以为 @import 省 token
```

> **核心建议**：写一个精简（< 200 行）的 CLAUDE.md，放构建/测试命令、约定、禁区。**两个反直觉点**：@import 不省 token（只组织）、CLAUDE.md 不是强制层（硬拦用 hook）。Claude 同一个错犯第二次，就往 CLAUDE.md 加一条。

---

## §10 记忆系统：CLAUDE.md vs auto memory vs #

| 机制 | 谁掌控 | 存哪 | 适合放什么 |
|------|--------|------|-----------|
| **CLAUDE.md** | 你（手写） | 项目根 / `~/.claude/` | 编码标准、架构、工作流 |
| **auto memory** | Claude（自己写） | `~/.claude/projects/<project>/memory/` | 构建命令、调试洞察、它发现的偏好 |
| **`#` 快速记忆** | 你（对话触发） | → auto memory 或 CLAUDE.md | 临时记一句 |
| **`.claude/rules/`** | 你（手写） | `.claude/rules/*.md` | 只对部分代码有效的规则 |

**`#` 分流**：说"remember X" / "always use pnpm" → **auto memory**；说"add this to CLAUDE.md" → **CLAUDE.md**。一字之差，去向不同。

**auto memory**：Claude 往 `~/.claude/projects/<project>/memory/` 写 MEMORY.md（索引，前 200 行/25KB 自动加载）+ topic 文件。**同 git 仓库所有 worktree 共享一个 memory 目录**。**`/memory`** 命令管所有记忆。

```
推荐                              不推荐
团队规矩 → CLAUDE.md              把 Claude 发现的偏好手写进 CLAUDE.md
调试发现让 Claude 记 → auto memory  重复口头说同一 build 命令
局部规则 → .claude/rules/（paths）  局部规则塞 CLAUDE.md
定期 /memory 审                    从不管它记了啥
```

> **核心建议**：分清"你掌控"和"Claude 掌控"——编码标准/架构你写 CLAUDE.md；构建命令/调试洞察让它自己记 auto memory。**定期 `/memory` 审**，删过时或记错的。

---

## §11 .claude/rules/：路径范围规则（省 context 正道）

有些规则只对一部分代码有效。全塞 CLAUDE.md 会稀释重点。`.claude/rules/` **只在 Claude 读匹配文件时才加载**：

```markdown
---
# .claude/rules/api-error-handling.md
paths: ["src/api/**/*.ts"]
---
# API 层错误处理规范
- 用统一的 AppError 类；返回 {error:{code,message}}；禁止裸 throw 到路由外
```

`paths` glob 匹配——Claude 读 `src/api/` 下文件时才加载。**这才是省 context 的正确姿势**（对比 @import 不省）。

> **核心建议**：规则分两类——"全局都该知道"进 CLAUDE.md，"只对部分代码有效"进 `.claude/rules/`（带 paths）。CLAUDE.md 保持精简，局部规则按需加载。

---

# 第四部分：上下文管理（性能生死线）

## §12 上下文窗口：用文件当主存

### 聊着聊着它"忘了"——你把它淹了

上下文塞满后**推理质量下降**（越接近 200K 越差，社区俗称"drowning it"，[Medium: you are drowning it](https://medium.com/@nuno.roberto/claude-code-is-not-broken-you-are-drowning-it-7d7635765c10)）。它没坏，你把它淹了。

**根本解法：用文件当主存，别用对话当主存。**

```
对话窗口 = 短期工作记忆（当前任务）
文件      = 长期主存（状态、计划、约束）
```

长任务别把状态留在对话里——让它把中间状态/计划/决策**写进文件**（`.claude/plans/`、`TODO.md`）。即使 `/clear`，新会话读文件接着干。

### /context：随时看用量

```
> /context
```

会话开始和长会话中周期性跑，看 200K 用了多少。**超 60-70% 就该 /compact 或开新会话**——别等 95%。

```
推荐                              不推荐
长任务状态写文件                  所有上下文留对话
定期 /context                     从不管、用到崩
超 70% 主动处理                   拖到 95%（质量已掉）
跨会话靠文件接力                  指望它"记住"上次
```

> **核心建议**：对话=短期工作记忆，文件=长期主存。长任务让 Claude 把状态写文件，能跨 `/clear` 接力。**定期 `/context`，超 70% 主动处理**。

---

## §13 /compact vs /clear vs /resume

| 命令 | 干什么 | 何时用 |
|------|--------|--------|
| **`/compact`** | 摘要当前对话替换进上下文，继续同任务 | 同任务接近上限 |
| **`/clear`** | 清空上下文，完全重来 | 切换任务/方向 |
| **`/resume`** / `claude --resume` | 恢复历史会话 | 回某个之前的会话 |
| **`/rewind`** | 恢复 `/clear` 之前（2026 新，v2.1.191）| 手滑 /clear 想找回 |

**判断**：还要继续当前任务？要 → `/compact`；换任务 → `/clear`。

**自动 compact 的坑**：接近上限自动 compact，但摘要可能丢细节。倾向**手动提前 compact**（70-80%），或开新会话用文件接力。

### 跨 /clear 的标准做法（文件接力）

```
1. 切走前：让 Claude 把状态写文件
   "把当前进度、未完成项、下一步写进 .claude/session.md"
2. /clear 清空
3. 新会话："读 .claude/session.md，接着干"
```

```
推荐                              不推荐
继续同任务 → /compact              继续同任务却 /clear
换任务 → /clear                    换任务硬撑旧上下文
长任务文件接力                     单会话跑到底（必崩）
70-80% 手动 /compact              等 95% 自动 compact
```

> **核心建议**：**继续 `/compact`、换任务 `/clear`、回历史 `/resume`**。别依赖自动 compact，70-80% 手动。跨会话"写文件→`/clear`→读文件"接力。

---

## §14 长会话策略：分段 + 锚定

长会话三衰退：上下文爆（推理变差）、目标漂移（忘了最初要干啥）、累积错误。对策是**分段 + 锚定**。

**分段**：大任务拆成可验收小段，每段做完验收（跑测试/看 diff），别让它一口气跑 50 步你才看。
**锚定**：每过几轮重申目标和约束，或用 `/loop` + 锚文件让它每轮重读关键文件防漂移。

```
推荐                              不推荐
拆小段、每段验收                   一口气跑 50 步才看
定期重申目标 + 重读锚文件           指望它自己记目标
状态写文件接力                     单会话死磕
跑偏早点 /clear 重开               硬撑偏掉的会话
```

> **核心建议**：长会话防衰退靠"分段 + 锚定"。**跑偏了别硬撑，早点 `/clear` 用文件接力重开**。

---

# 第五部分：扩展能力

## §15 Plan Mode：先想后做

复杂任务直接动手，方向错了返工贵。**Plan mode 让它先出方案、你审完再动手**。**进入**：`Shift+Tab` 两次或 `/plan`。**退出**：再按 `Shift+Tab`。Plan 模式只读不写，产出计划给你审。

```
推荐                              不推荐
新功能/大重构 → 先 plan            复杂任务直接改
审 plan 提反馈再放手               plan 不看直接批
简单任务跳过 plan                  简单任务也 plan
```

> **核心建议**：复杂任务先 Plan Mode 出方案、审完再放手——方向错改一行 plan 比改一堆代码便宜。Plan + `/code-review` 是高级工作流标配。

---

## §16 Subagents：委托隔离任务

让 Claude 在主线探索整个代码库，探索过程（读几十个文件）会塞满主线。**Subagent 把隔离任务委托给独立上下文 worker，主线不被污染**。

**何时用**：探索大代码库、并行做几个独立模块、密集研究（只要结论不要过程）。

**自定义 agent**（`~/.claude/agents/` 全局或 `./.claude/agents/` 项目），YAML frontmatter 定义 `name`/`description`/`tools`/`model`：

```yaml
# .claude/agents/code-reviewer.md
---
name: code-reviewer
description: 代码审查专家，找 bug 和可简化处
tools: Read, Grep, Glob    # 限制工具（只读审查）
model: sonnet              # 审查 Sonnet 够，省成本
---
你是代码审查专家...
```

### 并行硬规则

**只有 agent 修改不同文件才能并行**。两个 agent 同时改同一文件 → 冲突。深度上限 **5 层**。

```
推荐                              不推荐
探索/调研/独立模块 → subagent      主线做大量探索（污染）
并行只在不同文件                   为并行而并行同批文件（冲突）
审查类限制工具（只读）             给 subagent 全部工具
```

> **核心建议**：用 subagent 隔离"过程重、结论轻"的活（探索/调研/审查）。**并行铁律：只在不同文件**。为重复任务建固定 agent + 限制工具。

---

## §17 Skills：Claude 自主调用的专业知识

Skill 是**模块化专业能力包**——你把专业知识+流程写进 SKILL.md，Claude **自主判断何时用**（基于 description/触发词），按需加载，不占常驻 context。

**结构**：`.claude/skills/<name>/SKILL.md`（+ 可选 references/、scripts/、模板）。顶部 YAML frontmatter（`name`/`description`/`triggers`/`display-name`/`default-enabled`）。

**Skill vs Command vs Subagent**：

| 机制 | 谁触发 | 本质 |
|------|--------|------|
| Skill | Claude 自主 | 按需加载的**专业知识** |
| Command | 你显式（`/xxx`）| **工作流模板** |
| Subagent | 主线委托 | 隔离 context 的 **worker** |

一句话：Skill=它自己知道何时用的知识；Command=你喊才跑的流程；Subagent=派出去干的工人。

```
推荐                              不推荐
领域能力（多变体）→ skill          每次从头教同一类专业活
固定流程（你手动启动）→ command     把固定流程写成 skill
隔离重活 → subagent                把 subagent 当 skill（不隔离）
```

> **核心建议**：把"同一类专业活"沉淀成 Skill，Claude 自主调用。**Skill/Command/Subagent 三选一**：自主调的知识用 Skill、手动喊的用 Command、要隔离的用 Subagent。

---

## §18 自定义 Slash Commands

重复打的流程，写成 command 一键触发。**位置**：`.claude/commands/`（项目 `/project:xxx`）或 `~/.claude/commands/`（全局 `/user:xxx`）。子目录造命名空间。

```markdown
---
# .claude/commands/fix-issue.md
description: 根据 issue 号修 bug
allowed-tools: Read, Edit, Bash
---
读 issue $ARGUMENTS 的内容，分析根因，改代码，跑测试，给我 diff。
```

**`$ARGUMENTS`**：占位符，`/fix-issue 123` → `"123"`。frontmatter 可选 `description`/`allowed-tools`/`model`。可用 `` !`command` `` 注入 shell 输出。自 v1.0.123 起 Claude 能**自己调你的 command**。

> **核心建议**：重复流程写成 command 一键触发，用 `$ARGUMENTS` 参数化、`allowed-tools` 限权。**Claude 自己也能调你的 command**——写好 description 让它在合适时机自主调。

---

## §19 Hooks：真正的自动化和强制层

要"每次改完自动 lint""绝不许读 .env"——CLAUDE.md 靠不住（§09）。**Hook 是 harness 在工具调用前/后实际执行的脚本**，由不得模型听不听。

**事件**：`PreToolUse`（可拦截）/`PostToolUse`/`Stop`/`SessionStart`/`UserPromptSubmit` 等。**配置**（`.claude/settings.json`）：event → matcher → command：

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "pnpm lint --fix" }]
    }],
    "PreToolUse": [{
      "matcher": "Read",
      "hooks": [{ "type": "command", "command": ".claude/hooks/block-env-read.sh" }]
    }]
  }
}
```

**退出码**：`0`=继续；`2`=阻断该工具调用（PreToolUse 专用，反馈给 Claude）；其他非零=错误给用户。

**典型用法**：PostToolUse 改完自动 lint/format；PreToolUse 拦读 `.env`（exit 2）；Stop 任务结束跑测试。

> **核心建议**：要"硬自动化"或"硬拦截"用 hook，别指望 CLAUDE.md。**退出码 `0` 继续、`2` 阻断**。最常用：PostToolUse 改完自动 lint、PreToolUse 拦危险操作。

---

## §20 MCP：接外部系统

要让它查数据库、调浏览器、读 Notion——原生工具干不了。**MCP（Model Context Protocol）** 是接外部能力的标准接口。

**配置**：`.mcp.json`（项目根，进 git）或 `~/.claude.json`（全局）。**不是** Claude Desktop 的 `claude_desktop_config.json`（常见坑）。CLI：`claude mcp add/login/logout <name>`（v2.1.186+）。

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}
```

```
推荐                              不推荐
接 DB/浏览器/外部 API → MCP        文件能干的事上 MCP
.mcp.json 放项目根进 git           用 claude_desktop_config.json（错文件）
```

> **核心建议**：MCP 接外部系统（DB/浏览器/API），原生干不了才上。用 `.mcp.json`，**别和 Claude Desktop 配置搞混**。

---

## §21 Plugins（2026 新机制）：打包分发的能力集合

### 痛点：skill/command/hook/MCP 散落各处，难跨项目/团队复用

你写了一组好用的 skill+command+hook+agent，想跨项目用、分享给团队。一个个文件拷太碎。**Plugin 把这些打包成一个可分发单元**（[官方 plugins 仓库](https://github.com/anthropics/claude-code/tree/main/plugins)）。

**Plugin 结构**：

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json       # 插件元数据
├── commands/             # slash commands（可选）
├── agents/               # 专用 agent（可选）
├── skills/               # agent skills（可选）
├── hooks/                # 事件处理（可选）
├── .mcp.json             # 外部工具（可选）
└── README.md
```

**安装**：`/plugin` 命令从 marketplace 装，或配置进 `.claude/settings.json`。

### 官方 plugins/ 仓库的 13 个插件（开箱即用）

| 插件 | 含什么 | 干什么 |
|------|--------|--------|
| **code-review** | `/code-review` + 5 并行 Sonnet agent | 自动 PR 审查（CLAUDE.md 合规/bug/历史/PR 历史/注释）|
| **commit-commands** | `/commit` `/commit-push-pr` `/clean_gone` | git 提交/推送/PR 自动化 |
| **feature-dev** | `/feature-dev` + 3 agent | 7 阶段功能开发流程 |
| **pr-review-toolkit** | `/pr-review-toolkit:review-pr` + 6 agent | PR 审查（注释/测试/错误/类型/质量/简化）|
| **hookify** | `/hookify` + agent + skill | 分析对话模式自动造防护 hook |
| **security-guidance** | PreToolUse hook | 监控 9 类安全模式（注入/XSS/eval/pickle…）|
| **frontend-design** | skill（自动触发）| 前端设计指导（避免通用 AI 审美）|
| **ralph-wiggum** | `/ralph-loop` + Stop hook | 自循环迭代直到完成 |
| **plugin-dev** | `/plugin-dev:create-plugin` + 7 skill | 8 阶段造插件工具箱 |
| **agent-sdk-dev** | `/new-sdk-app` + agent | Agent SDK 项目脚手架 |
| **claude-opus-4-5-migration** | skill | 模型字符串/prompt 迁移 |
| **explanatory-output-style** | SessionStart hook | 教学注释输出风格 |
| **learning-output-style** | SessionStart hook | 交互学习模式 |

```
推荐                              不推荐
跨项目/团队复用 → 打成 plugin      一个个文件拷
先看官方 plugins/ 有没有现成的      从零造已有的轮子
/plugin 从 marketplace 装         手动管理一堆散文件
```

> **核心建议**：要跨项目/团队复用一组能力，打成 plugin（commands+agents+skills+hooks 打包）。**先看官方 [plugins/](https://github.com/anthropics/claude-code/tree/main/plugins) 有没有现成的**——code-review（5 并行 agent）、feature-dev（7 阶段）、security-guidance（9 安全模式）这些开箱即用，别重造。

---

## §22 六选一决策树：skill / command / subagent / hook / MCP / plugin

五个变六个了（加了 plugin）。决策树：

```
你要干什么？
│
├─ 接外部系统（DB/浏览器/API）           → MCP
│
├─ 自动化/强制（无需模型同意）           → Hook
│   ├─ 拦截危险（PreToolUse）
│   └─ 改完自动干啥（PostToolUse/Stop）
│
├─ 委托隔离任务（过程重、要隔离 context）→ Subagent
│
├─ 打包复用一组能力（跨项目/团队）       → Plugin
│
└─ 沉淀重复能力/流程
    ├─ 你手动启动的固定流程              → Command
    └─ Claude 自主判断何时用的领域能力    → Skill
```

**一句话判据**：外部系统=MCP；强制自动化=Hook；隔离重活=Subagent；打包复用=Plugin；你喊才跑=Command；它自己知道何时用=Skill。

> **核心建议**：遇到"自动 X"先问"要不要模型同意"——要同意走 Skill/Command/Subagent/Plugin，不要（强制）走 Hook。接外部才是 MCP。**别一上来六个全上**——从 CLAUDE.md + 一个 command 开始，痛点了再加。

---

# 第六部分：权限与安全

## §23 权限模式：给多少自由

| 模式 | 能干什么 | 何时用 |
|------|---------|--------|
| **default** | 只读 + 询问后写 | 默认，最安全 |
| **acceptEdits** | 读 + 文件编辑 + 常见文件命令 | 信任的常规开发 |
| **plan** | 只读规划 | Plan mode |
| **bypassPermissions** | 全部批准（不问）| ⚠️ 仅隔离环境/无人值守 |
| **auto**（新）| 每个工具过闸，破坏性操作拦 | 半自动，带护栏 |

**设置**：CLI `--permission-mode`；settings.json `"defaultMode"`；`/permissions` 查看。

**deny 规则是强制层**：`permissions.deny` **无论模型决定什么都拦**——真正硬墙，比 CLAUDE.md 可靠。

**2026 安全收紧**：auto mode 默认拦破坏性 git（`git reset --hard`/`git checkout -- .`/`git clean -fd`/非本会话的 `git commit --amend`）和 `terraform/pulumi/cdk destroy`；新增 `sandbox.credentials` 阻止读凭证（[权限文档](https://code.claude.com/docs/en/permissions)）。

**危险**：`bypassPermissions` 在 Linux/macOS **拒绝 root/sudo 启动**；Remote Control 不支持 auto/bypass。

```
推荐                              不推荐
常规 → acceptEdits                 全程 default（烦死）
绝不能碰 → permissions.deny         指望 CLAUDE.md 拦
无人值守 → bypass + 护栏            无人值守用 default（卡死）
```

> **核心建议**：常规用 `acceptEdits`；绝不能碰的写 `permissions.deny`（强制层）；无人值守才 bypass 且必配护栏。**别用 root/sudo 跑 bypass**。

---

## §24 安全实践：多层防御

给 agent 自由后，安全靠**多层防御**：
1. **deny 危险操作**（强制层）：拦 `rm -rf`、读 `.env`、改生产配置。
2. **sandbox.credentials**（2026 新）：阻止读凭证/敏感 env。
3. **PreToolUse hook** 拦密钥（exit 2）。
4. **CLAUDE.md 标禁区**（软），配合 deny（硬）。
5. **隔离环境**：危险活在容器/worktree。
6. **审查产出**：`/code-review` 提交前过一遍。

> **核心建议**：安全靠**多层防御**——`deny`（硬墙）+ PreToolUse hook + sandbox.credentials + `/code-review`。**绝不能只靠 CLAUDE.md**。

---

# 第七部分：模型、后台、Git

## §25 模型选择：Opus / Sonnet / Haiku

| 档 | 特点 | 适合 |
|----|------|------|
| **Opus** | 最强最贵 | 复杂长任务、架构、难题 |
| **Sonnet** | 平衡（性价比）| 日常主力 |
| **Haiku** | 快/便宜 | 简单、批量、格式化 |

**切换**：`/model` 或 `/model <id>`，`--model`，`ANTHROPIC_MODEL`。组织可设默认/限制。

**策略**：日常 Sonnet，难题/架构 Opus，简单批量 Haiku。**按任务切 `/model`，别全局锁**。

**2026 生命周期**（时间敏感，[models 文档](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)）：Opus 4.7 GA（编码较 4.6 提升约 13%、速度逼近 Haiku），其 fast mode **2026-07-24 移除**（改 per-task 切模型）；Sonnet 4 / Opus 4 已 **2026-06-15 退役**。具体版本以 `/model` 实际可选为准。

```
推荐                              不推荐
日常 Sonnet                       全程 Opus（烧钱）
难题切 Opus                       难题硬用 Haiku
按任务切 /model                   全局锁一个
```

> **核心建议**：日常 Sonnet，难题 Opus，简单批量 Haiku。**按任务切 `/model`**。fast mode 2026-07-24 已移除，改 per-task 切模型。

---

## §26 后台任务与定时：让它自己跑

| 机制 | 干什么 | 何时用 |
|------|--------|--------|
| **后台 bash/agent** | 长命令/任务后台跑 | 编译、测试套件 |
| **`/loop`** | 连续循环（最长约 3 天）| 持续监控、轮询 |
| **Scheduled Tasks（cron）** | cron 钉死时间 | 定时 |

**后台 agent 韧性**（2026 新）：daemon 重启后**自动断点续跑**；内存压力下自动 reap 空闲后台 shell。

**反模式**：无人值守用 default（每步问）→ 卡死。**无人值守必须 auto/bypass + deny 护栏**。

> **核心建议**：长任务/监控用后台 agent（断点续跑）+ `/loop`（连续）+ cron（定时）。**无人值守铁律：auto/bypass + deny 护栏**。

---

## §27 Git / Worktree 工作流

并行多会话改同一仓库会互相踩。**Worktree 每会话独立目录+分支，共享历史**。`EnterWorktree`/`ExitWorktree`（`.claude/worktrees/`）。

**commit 习惯**：原子提交、**别 amend**；`/code-review` 提交前过一遍。**PR**：worktree + `gh` 天然配合，每分支 `gh pr create`。

> **核心建议**：并行多会话用 worktree 隔离。**原子提交、别 amend、提交前 `/code-review`**。worktree + `gh` = 每分支一 PR。

---

# 第八部分：避坑

## §28 反模式清单（12 个坑）

### 坑 1：过度信任、不审查 ★★★
**现象**：无人值守跑完直接采纳，上线出 bug。**根因**：能跑通≠跑对，它会偷懒走捷径、编造。**推荐**：每段验收（跑测试/看 diff）+ `/code-review`。**影响**：上线事故、技术债。来源：[r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1m6ienr/are_people_actually_getting_bad_code_from_claude/)。

### 坑 2：上下文爆炸 ★★★
**现象**：长会话越跑越差、重复跑偏。**根因**：接近 200K 推理下降。**推荐**：70-80% 手动 /compact 或开新会话；状态写文件。

### 坑 3：多任务挤一个会话 ★★★
**现象**：一会话又改 bug 又加功能又重构，互相污染。**推荐**：换任务 /clear 或开新会话。

### 坑 4：重写重复 prompt ★★
**现象**：同一流程每次重打。**推荐**：重复流程写 command，领域能力写 skill，隔离活建 subagent，一组能力打 plugin。

### 坑 5：CLAUDE.md 太大太模糊 ★★
**现象**：写了还不听，或加载慢。**根因**：超 200 行（稀释）、"format nicely"而非"2 空格缩进"（模糊）。**推荐**：< 200 行，具体可执行。

### 坑 6：把 CLAUDE.md 当强制层 ★★
**现象**：写"别读 .env"它还读。**根因**：CLAUDE.md 是引导非强制。**推荐**：PreToolUse hook + permissions.deny。

### 坑 7：为 Plan Mode 能做的事建 agent ★
**现象**：建一堆 agent 干"先想后做"。**推荐**：规划用 Plan mode，agent 留给隔离重活。

### 坑 8：@import 以为省 token ★★
**现象**：用 @import 拆 CLAUDE.md 以为省了，还满。**根因**：@import 全量加载。**推荐**：省 context 用 `.claude/rules/`。

### 坑 9：不锁权限跑后台 ★★★
**现象**：无人值守卡死或闯祸。**推荐**：无人值守必须 auto/bypass + deny 护栏。

### 坑 10：micromanage 每步打断 ★★
**现象**：逐行盯、每步打断，累且慢。**推荐**：描述终态+给空间，跑偏再纠。

### 坑 11：并行 agent 改同一文件 ★★
**现象**：并行 subagent 互相覆盖。**推荐**：并行只在不同文件。

### 坑 12：prompt 太模糊 ★★★
**现象**："帮我优化一下"→ 改一堆你不要的。**推荐**：终态+上下文+边界+验收四件套。

> **核心建议**：坑 1（不审查）、坑 2（上下文爆）、坑 9（后台不锁权限）是硬伤必排。坑 5/6/8（CLAUDE.md 相关）是认知坑——记住：CLAUDE.md 是引导非强制、@import 不省 token、< 200 行。**共同根因：还在用补全心智**——换到"指挥 agent"，大半坑自动消失。

---

## §29 争议与权衡（D6）

**acceptEdits vs default**：信任的常规开发 → acceptEdits；碰生产/危险 → default + deny。按任务风险切。
**auto memory 开不开**：开，但**定期 `/memory` 审**。收益（省重复）大于风险（只要审）。
**Opus 全开 vs Sonnet 主力**：Sonnet 主力，难题才 Opus。按任务切。

> **核心建议**：争议的共同解是"按情境切换、定期审"——权限按风险切、auto memory 开但定期审、模型按难度切。**没一刀切最优**。

---

# 第九部分：实战

## §30 2026 新特性速览

源自 v2.1.x changelog（[官方 changelog](https://code.claude.com/docs/en/changelog)）+ 仓库：

1. **Plugins 系统**：官方 [plugins/](https://github.com/anthropics/claude-code/tree/main/plugins) 13 个开箱插件（§21）。
2. **多 surface 统一引擎**：终端/VS Code/JetBrains/桌面/Web 共享 CLAUDE.md/MCP/skill（§07）。
3. **Opus 4.7 GA + fast mode 弃用**（2026-07-24 移除）。
4. **auto mode 安全收紧**：拦破坏性 git/terraform；`sandbox.credentials` 拦凭证。
5. **组织级模型管理**：管理员设默认/限制。
6. **`/rewind`**：恢复 `/clear` 之前（v2.1.191）。
7. **`/config key=value`**：prompt 里改配置（v2.1.181）。
8. **后台 agent 韧性**：daemon 重启自动断点续跑。
9. **`/code-review` 与 `/review` 引擎统一**：token 降约 25%。

> **核心建议**：安全相关（auto 收紧、sandbox.credentials）直接受益；工作流（`/rewind`、`/config`、plugins、后台韧性）马上用。**npm install 已 deprecated，改原生安装**。

---

## §31 实战项目：从零做一个能跑的小产品（教程模式）

> 把核心心智（描述→审→看→验→迭代）+ 产品构建视角跑通。

### 项目选型

做一个**能跑的小产品**：比如"GitHub 周报助手"——连接 GitHub，取本周 commit，AI 总结成可分享的周报页。真实有用、半天到一天、涉及前后端+API+AI。

### 第一步：先别急着写代码——让 Claude 采访你（Phase 0）

这是最容易被跳过、但最值钱的一步。**别上来就让它写代码**——先让它把需求问清楚。

```
> 我想做一个 GitHub 周报助手。先别写代码——采访我 5 个问题，
  把需求、用户、核心功能、边界问清楚，然后给我一份需求摘要让我确认。
```

**预期**：它会问你"给谁用？""数据源是 GitHub commit 还是 PR？""周报格式？""要不要登录？""部署在哪？"。你答完，它出需求摘要。

**心态转变点**：你的角色从"想需求的人"变成"被采访、然后审需求的人"——**让 AI 帮你想清楚要什么**，比让它直接写代码值钱。

### 第二步：审查方案（Review the Plan）

需求确认后，让它出技术方案，进 Plan Mode 审：
```
> 基于这份需求，给我技术方案：技术栈、目录结构、分几步实现。
  先别写代码，出 plan 让我审。
```
审：技术栈合理吗（Next.js+Tailwind 是 Claude Code 擅长的）？分步对吗？有异议直接反馈。

### 第三步：看它干活（Watch it Work）

批准后它开始改文件/跑命令，每步问权限（default）。信任的话切 `acceptEdits` 减少询问。**看每步在干啥**，跑偏及时打断。

### 第四步：验证结果（Verify）

```bash
pnpm dev                       # 启动
# 浏览器打开，连 GitHub，看本周 commit 被总结成周报了？
pnpm test                      # 测试得过？
```
跑对了才算完。

### 第五步：迭代改进（Iterate）

```
> 加个"一键分享给同事"的公开链接。配测试，跑完给我。
```

> **核心建议**：五步循环（Describe→Review→Watch→Verify→Iterate）通用于所有任务。**最高杠杆是 Phase 0**——先让 Claude 采访你把需求问清，比直接写代码值钱得多。**底层心智**：你管"要什么+对不对"，它管"怎么做"。

---

# 附录 A：检查清单

### A.1 心智与 prompt
- [ ] 任务给了终态，不只是步骤
- [ ] prompt 含上下文/边界/验收
- [ ] 复杂任务先 Plan Mode
- [ ] 给了自主空间，没 micromanage
- [ ] 产出验收了（跑测试/看 diff）

### A.2 配置与记忆
- [ ] 有项目 CLAUDE.md（< 200 行，具体可执行）
- [ ] 团队规矩 ./CLAUDE.md（git），个人 CLAUDE.local.md
- [ ] 局部规则 .claude/rules/（带 paths）
- [ ] 知道 @import 不省 token、CLAUDE.md 非强制
- [ ] 定期 /memory 审

### A.3 上下文
- [ ] 定期 /context 看用量
- [ ] 超 70% 主动 /compact 或开新会话
- [ ] 长任务状态写文件接力
- [ ] 换任务 /clear

### A.4 扩展机制
- [ ] 重复流程 → command
- [ ] 领域能力 → skill
- [ ] 隔离重活 → subagent
- [ ] 自动化/强制 → hook
- [ ] 接外部 → MCP
- [ ] 跨项目复用 → plugin（先看官方 plugins/）
- [ ] 并行 subagent 改不同文件

### A.5 安全
- [ ] 危险操作 permissions.deny
- [ ] PreToolUse hook 拦密钥
- [ ] sandbox.credentials 开
- [ ] 无人值守 auto/bypass + 护栏
- [ ] 不用 root/sudo 跑 bypass
- [ ] 提交前 /code-review

---

# 附录 B：配置速查

### B.1 关键文件

| 文件 | 作用 |
|------|------|
| `./CLAUDE.md` / `CLAUDE.local.md` / `~/.claude/CLAUDE.md` | 项目/本机/全局规矩 |
| `.claude/settings.json` | 权限/hooks/默认模式 |
| `.claude/commands/*.md` | slash command |
| `.claude/skills/*/SKILL.md` | skill |
| `.claude/agents/*.md` | subagent |
| `.claude/rules/*.md` | 路径范围规则 |
| `.mcp.json` | MCP server |
| `my-plugin/.claude-plugin/plugin.json` | 插件元数据 |

### B.2 settings.json 最小示例

```json
{
  "defaultMode": "acceptEdits",
  "permissions": {
    "allow": ["Read", "Edit", "Bash(git:*)", "Bash(pnpm:*)"],
    "deny": ["Bash(rm -rf:*)", "Read(./.env)", "Read(./.env.*)"]
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "pnpm lint --fix" }]
    }]
  }
}
```

### B.3 命令速查

| 命令 | 作用 |
|------|------|
| `/context` | 看 token 用量 |
| `/compact` / `/clear` / `/resume` / `/rewind` | 压缩/清空/恢复/找回 |
| `/model` | 切模型 |
| `/memory` | 管记忆 |
| `/permissions` | 查权限 |
| `/plan`（或 Shift+Tab×2）| Plan mode |
| `/code-review` | 审 diff |
| `/loop` | 连续循环 |
| `/plugin` | 装/管插件 |

---

# 附录 C：完整骨架（最小 .claude/ 配置）

```markdown
# CLAUDE.md
## 构建/测试
- 装：`pnpm install` / 跑：`pnpm dev` / 测：`pnpm test`
## 约定
- 用 pnpm，禁止 npm/yarn；提交前 `pnpm lint`
## 禁区
- 不改 src/config/production.ts；不加新依赖先讨论
```
```json
// .claude/settings.json
{
  "defaultMode": "acceptEdits",
  "permissions": {
    "allow": ["Read", "Edit", "Bash(pnpm:*)", "Bash(git:*)"],
    "deny": ["Bash(rm -rf:*)", "Read(./.env)"]
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "pnpm lint --fix" }]
    }]
  }
}
```
```markdown
---
# .claude/commands/test.md
description: 跑测试 + 修到全绿
allowed-tools: Bash
---
跑 `pnpm test`，有失败就分析原因、改代码修复、再跑直到全绿。给我结果和改了哪些文件。
```

启动验证：
```bash
cd your-project && claude
> /test                  # 触发自定义命令
> /context               # 看用量
> 帮我看看 src/ 下有什么，给个结构总结   # 试个真实小活
```

---

# 附录 D：官方插件速查（plugins/ 仓库）

| 插件 | 一句话 |
|------|--------|
| code-review | `/code-review` + 5 并行 agent 自动 PR 审查 |
| commit-commands | `/commit` `/commit-push-pr` `/clean_gone` |
| feature-dev | `/feature-dev` 7 阶段功能开发 |
| pr-review-toolkit | `/pr-review-toolkit:review-pr` + 6 agent |
| hookify | `/hookify` 自动造防护 hook |
| security-guidance | PreToolUse 监控 9 安全模式 |
| frontend-design | 前端设计 skill（自动触发）|
| ralph-wiggum | `/ralph-loop` 自循环迭代 |
| plugin-dev | `/plugin-dev:create-plugin` 造插件 |
| agent-sdk-dev | Agent SDK 脚手架 |

安装：`/plugin` 或 `.claude/settings.json`。全部见 [plugins/](https://github.com/anthropics/claude-code/tree/main/plugins)。

---

# 附录 E：参考资源（已核实可访问）

**官方一手**
- [Claude Code 官方文档](https://code.claude.com/docs/en/overview) — overview/记忆/sessions/hooks/权限/skills/mcp/worktrees/插件
- [anthropics/claude-code 仓库](https://github.com/anthropics/claude-code) — 135K stars，README + plugins/ + issues
- [plugins/ 目录](https://github.com/anthropics/claude-code/tree/main/plugins) — 13 官方插件
- [Changelog](https://code.claude.com/docs/en/changelog) · [Releases](https://github.com/anthropics/claude-code/releases)
- [Memory 文档](https://code.claude.com/docs/en/memory)（@import/层级/context非强制）
- [Permissions](https://code.claude.com/docs/en/permissions) · [Hooks](https://code.claude.com/docs/en/hooks) · [Plugins 文档](https://docs.claude.com/en/docs/claude-code/plugins)
- [Anthropic Engineering](https://www.anthropic.com/engineering) — agentic coding best practices
- [models 文档](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)

**社区**
- [wshobson/commands](https://github.com/wshobson/commands) — 57 command 范例
- [MorphLLM 30 hook 示例](https://www.morphllm.com/claude-code-hooks)
- [Medium: you are drowning it](https://medium.com/@nuno.roberto/claude-code-is-not-broken-you-are-drowning-it-7d7635765c10)
- [aiforsystems: 反模式](https://aiforsystems.substack.com/p/the-anti-patterns-i-see-claude-code)
- [Armin Ronacher: what is plan mode](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/)

**标杆对照**
- 花叔《Claude Code 从入门到精通》v2.0.0（75 页，2026-04）— TAOR 循环、三代演变、产品构建论点（本次 v2.0 同题对照标杆）

---

> **Claude Code 的具体命令和特性会变（每天滚动更新），但"指挥 agent + 构建产品"这个心智不会变**。学会描述终态、把约束写进文件、审方案、设计循环、给它空间自主跑——这些能力在 agent 时代越来越值钱。盯紧 §30 的 2026 新特性，把过时做法（npm install、fast mode）清掉。

---

## 更新日志

| 日期 | 版本 | 变更 | 来源 |
|------|------|------|------|
| 2026-07-01 | 2.0.0 | 同题对照橙皮书后重写：①补"vs Copilot/Cursor 三代演变 + Cursor 对比表"（差距1）②主线升华到"构建产品"（差距3）③补 TAOR 内部机制深度（差距2，类独家）④安装修正（npm deprecated→原生）⑤补 Plugins 系统 + 六选一决策树 ⑥补多 surface + 集成矩阵 ⑦实战加 Phase 0"先让 Claude 采访你"（差距4）⑧量化用 135K stars（GitHub API 核实）| anthropics/claude-code 仓库 + 官方文档 + 橙皮书同题对照 |
| 2026-07-01 | 1.0.0 | 首次生成（1276 行）| code.claude.com + 社区源 |
