# 循环工程：如何让你的 AI agent 自己跑

## 你才是瓶颈，不是模型

大多数人用编码 agent 都一个样：打一个请求，看它干活，读 diff，打下一个请求。你整段时间都坐在椅子上。agent 闪光 30 秒然后等你。

这是在手工操作一个本该自己跑的工具。真正从这些工具里拿到杠杆的人，已经不这么干了。

他们搭了一个 **loop**：一个小系统，找活、交给 agent、对照目标检查结果、记下学到的东西、决定下一步。他们设置一次。之后 loop 坐在椅子上，不是他们。

你和他们之间的差距，不是更聪明的模型或秘密 prompt。是 **12 个动作，分三层**：先决定你到底需不需要 loop，再搭核心，然后让它安全且能复利。这里每一部分用的都是你已经有的东西。

> 收藏这篇。你会读两遍。

---

## 第一层 — 动手前先决定

### 1. 转变：你不再是操作员

两年来，这工作是手工操作工具。更好的 prompt、更好的上下文、更好的单次输出。这个阶段正在结束。

新工作在上一层：**设计一个系统，决定 agent 干什么、什么时候干、用什么检查、运行之间记住什么。** 你不再写"下一条消息"了。你在搭那个写消息的东西。

如果你只记一句话：**loop 就是一个由系统而不是你发出的 prompt。**

### 2. 四条件测试（搭任何东西前先跑一遍）

loop 不总是值得的。只有当四条全真时它才赚回成本。**漏一条就成本大于收益。**

1. **任务重复**。loop 把搭建成本摊到多次运行。一次性的活，一个好 prompt 更快更便宜。不重复，你有的不是 loop，是你跑过一次的脚本。
2. **验证是自动化的**。得有东西在你不在场时让活失败：测试、类型检查、linter、构建。没有自动闸，你就回到椅子上读每个 diff——这正是 loop 本该去掉的活。
3. **你的预算能吸收浪费**。loop 重读上下文、重试、探索。这烧 token，不管运行有没有产出任何东西。不限量计划免费，20 美元计划肉疼。
4. **agent 有真正的工具**。日志、能跑它自己写的代码、看到什么坏了。没这些，loop 瞎迭代。

如果你没过其中一条，诚实答案是：**先别搭 loop**。对于一次性和判断题活，一个瞄准的好 prompt 还是赢。

### 3. 知道把哪些活交给它

**好的第一批 loop 无聊且可机器检查：**
- **CI 失败分流**：每晚，分类失败，给容易的起草修复。
- **依赖升级**：每周，测兼容，开 PR。
- **每个 PR 的 lint-and-fix 扫描**。
- **flaky 测试复现**：loop 到一个理论活下来。

**坏的第一批 loop 需要人坐在椅子上：** 架构重写、认证或支付代码、生产部署、任何"完成"是判断题的东西。**把 loop 限制在测试套件能拒绝的小改动上。**

---

## 第二层 — 搭核心

### 4. 先把一次手动跑跑可靠

loop 会放大下面的任何东西。在一个弱设置外面套 loop，你得到的不是自主，是**更快的垃圾**。

所以在自动化任何东西之前，先把一次手动跑跑扎实。CLAUDE.md 里的既定事实、连好的对的工具、一个清晰的可验证的东西。loop 每次迭代都复用所有这些，所以**每个弱点都被它跑的次数放大**。先修好这次跑，再 loop 它。

### 5. 给它一个目标和独立的评分者

loop 需要一个不是"agent 觉得完了"的停止条件。目标给你一个：一个 loop 迭代对照的客观目标，直到独立检查说它达成了。

```
> /goal All tests pass and lint is clean.
  Triage failures, draft fixes, repeat until the goal holds.
```

关键词是**独立**。决定"完成"的东西不能是干活的那个。**这一个分离让 loop 可信，而不是一台自我祝贺的机器。**

### 6. 把制造者和检查者分开

为什么独立评分者胜过自审是结构性的，不是努力问题。模型评判自己的输出时，看到的是自己的推理，偏好匹配它已经写的结论。一个全新的 agent，用自己的干净上下文，只看到产物和标准。**它对制造者的选择没有利益关系。**

所以把验证器定义成子 agent：

```yaml
---
name: verifier
description: Independent check of the maker's output against the goal. Use every iteration.
tools: Read, Grep, Bash
---
You did not produce this work. Check it against the goal and the
project rules. Run the tests yourself. Report pass or fail with
concrete reasons and file references. Do not be generous.
```

现在 loop 有一个制造者和一个检查者，**检查者握着闸**。

### 7. 放定时器上，然后放云端

目标驱动的运行还是等你启动。加个节奏。循环 loop 按间隔重跑 prompt，所以 agent 啃一个 backlog 而不是等人。

```
> /loop 30m
  Pull new failing tests, draft fixes in claude/ branches,
  hand each to the verifier. /goal main is green.
```

然后把你的笔记本从中拿掉。云端例程在托管基础设施上按 schedule 或事件跑一个保存的配置，你的机器关着。**定时器把一次运行变成习惯。云端把习惯变成基础设施。**

### 8. 给它能恢复的记忆

这一步把配置好的 loop 变成一个会改进的系统。agent 运行之间忘掉一切。loop 不必。一个状态文件记录试过什么、什么有用、什么失败、什么成了规则。

```markdown
# State - payments-service

## Verified facts
- Webhook secret is in STRIPE_WEBHOOK_SECRET, not the dashboard.
- prc column is integer cents. Confirmed via SELECT MIN/MAX.

## Lessons learned
- e2e checkout flakes on a webhook race. Add a settle delay in tests.

## Last run
2026-06-22 - 3 fixes merged, 2 escalated. Next: verify the rate-limit fix.
```

两条规则让它复利而不是只增长：**运行结束前写，下次开始时读**。漏一条，明天就从零重启。

---

## 第三层 — 让它安全且能复利

### 9. 把教训蒸馏成 skill

状态文件是项目记忆。它随项目死去。那些通用的教训——也会在下一个项目帮上忙的——毕业成 **skill**：agent 跑的程序，每次以新方式失败时磨利。

```yaml
---
name: ci-triage
description: Classify CI failures, draft fixes for the easy ones, escalate the rest.
---
## Known failure modes
- tls-handshake: Windows runners fail TLS 1.2 in PowerShell. Use bash.
- db-migration: ALTER on tables over 1M rows times out. Batch in 10k chunks.

## Anti-patterns
- Never disable a failing test to make CI green. File it instead.
```

当 loop 撞墙，教训进 skill，未来每个项目的每个 loop 都继承它。**这是一个每次重新推导你设置的 agent 和一个站在它之前学到一切上的 agent 之间的区别。**

### 10. 用护栏让它 fail safe

无人值守的 loop 也是无人值守的攻击面。没人看每一步，所以护栏不是可选的。**hook 是模型说不过去的墙。**

```json
{
  "permissions": {
    "allow": ["Read(*)", "Bash(npm run test *)"],
    "deny": ["Bash(git push origin main)", "Bash(rm *)", "Edit(.env)"]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [ { "type": "command", "command": "./.claude/hooks/block-dangerous.sh" } ] }
    ]
  }
}
```

一个无人值守且做不了任何不可逆操作的 loop，才是你能真正 leave alone 的。**把人留在合并按钮和任何不可逆的东西上。**

### 11. 按成本路由活

一个全时段在顶配模型上跑每一步的 loop，在工作上大出血，而便宜模型干得也行。路由它：编排器在重量级模型上，高频跑在便宜的上面，顶配拒绝的任务一个 fallback。**验证器和简单分类器可以跑便宜的。把贵模型留给难推理。**

### 12. 跟踪一个数字，知道 loop 怎么死

唯一重要的指标是**每个被接受的改动的成本**。不是花的 token、不是尝试的任务、不是调度的 loop。如果你接受的不到 loop 产出的一半，你在干它本该省掉的审查活，**它在亏**。

**loop 安静地死的三种方式：**

- **Ralph Wiggum loop**。它把半成品叫完成，因为"完成"是 agent 的意见，不是测试。修复：一个真能让活失败的闸。
- **目标漂移**。长运行中原约束褪色。"别碰支付"的规则在第 47 轮消失。修复：一个 agent 每次运行重读的既定 spec。
- **理解债务**。loop 越快产出你没写的代码，仓库包含的和你理解的差距越大。修复：读 diff，把 loop 限制在小改动，绝不让它碰架构。

---

## 把 loop 变成吞钱坑的错误

- **跳过四条件测试**。大多数人至少没过一条还是搭了。
- **没有客观闸**。被要求"review"的第二个 agent 没有测试，只是第二个乐观主义者。
- **一个 agent 既干活又验证**。它总给自己打 A。
- **没有状态文件**，所以每次运行从零重启。
- **没有硬停止**，所以 loop 跑到你注意到账单。
- **无人值守 loop 上宽权限**。deny 和 hook 不是可选的。
- **每次迭代都用顶配模型**。按任务路由否则大出血。

---

## 重点是

prompt 工程师有一个强大工具，手工操作它。**loop 设计师建一个自己操作自己的系统，只在需要人的部分叫人：目标、标准、合并按钮、任何不可逆的东西。**

从一个到另一个的移动是一个**序列**，不是秘密：把 agent 看作 loop，让一次跑可靠，给它一个目标和诚实的评分者，放定时器上，然后教它记住和 fail safe。中心的模型从不变。改进的一切是你裹在它外面的 loop。

**挑一个你还没做的步骤——可能是独立评分者、状态文件、或一个安全 hook——今天加上。然后下一个。停止手工操作。搭 loop。**

> 如果这有帮助，关注我。我每周拆解 AI 工具和预测市场，没废话。
