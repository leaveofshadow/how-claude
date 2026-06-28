# 从提示词工程师到循环工程师：Anthropic 全员在用的新工作流具体怎么做

**作者**：winkrun  
**日期**：2026-06-16  
**分类**：人工智能

---

两年来，和 AI 编码的杠杆都在提示词上，拼谁写得好，拼谁给的上下文准。这个阶段已经结束了。现在 AI 能力足够了，下一个杠杆点，变成了**设计系统**：让系统决定 AI 该做什么，什么时候做，结果怎么验证，哪些信息要保留到下次运行。

Claude Code 作者 Boris 最近说，Anthropic 现在 100% 的 PR 都是 Claude Code 处理，80%-90% 的代码评审也由它完成。他自己用的最多的功能是 `/loops`——早就不是手动给 Claude 发提示词了，现在都是搭好循环让系统自己跑。

现在已经迅速在社区里火了起来，还起了一个新名字叫做**循环工程**，核心就是把之前你手动做的「写提示词→等结果→改提示词→再等」变成自动循环的系统。杠杆已经变了，现在比拼的不是谁提示词写得好，而是谁能设计好自动干活的系统。

循环到底是怎么跑通的？你设计完一次规则，循环自己找活干，交给 AI 代理，检查结果，记录过程，再决定下一步该做什么。**AI 每次跑都会忘，存在文件里的状态不会忘。** 目前主流的编程 AI 工具，Claude Code 和 Codex 都支持这套玩法，对比下来差异不大。

Anthropic 工程师用了这套方法之后，每天合并的代码量是 2024 年的 8 倍。官方自己都说是数据肯定有夸大，但杠杆转移这件事是真的。

---

## 先测四个条件，再决定要不要搭循环

大多数人上来就搭循环，最后发现 token 烧了一堆，效率还不如手动提示。文章里给了一个四条件测试，**缺一个循环的成本都比收益高**：

翻译成大白话就是四个要求：

1. **任务至少每周重复一次**。循环的搭建成本要摊到多次运行里，一次性的活写个好提示比搭循环快得多。
2. **结果可以自动验证**。得有测试用例、类型检查、构建工具这些能自动判错的东西，不然你还是得坐在那一个 diff 一个 diff 看，和没循环一样。
3. **你的 token 预算能扛得住浪费**。循环会反复读上下文、重试、探索，不管最后能不能产出可用代码，token 都会烧。对免费额度或者按用量付费的用户来说，很可能账单先来，收益后到。
4. **AI 代理有高级工程师工具**。得能读日志、能在复现环境里跑自己写的代码，不然循环就是闭着眼瞎迭代。

### 谁能真从循环工程里拿到收益？

- 有大量重复、可机器检查工作，预算充足的团队
- 已经有完善测试用例的代码库
- 习惯异步协作，已经在用多代理模式的团队

### 谁现在别碰？

- 用个人消费版计划的独立开发者
- 没有自动验证能力的代码项目
- 瓶颈在评审产能、而不是打字速度的团队

对一次性工作、探索性工作，或者好坏需要人为判断的任务，手动写提示依然比循环好用。**说白了就是：循环工程是真东西，但大多数开发者现在还不需要。**

---

## 搭循环的五个核心模块

过了测试，接下来就是搭模块，循环工程一共五个基础块：

### 1. 自动化触发：循环的心跳

自动化就是定时、或者按事件触发循环运行，不用你手动启动。Claude Code 里直接用 `/loop` 做定时、`/goal` 定终止条件，Codex 直接在自动化面板里配置就行。

举个现成的例子：

```
> /loop 30m /goal All tests in test/auth pass and lint is clean.
  Scan src/auth for new failures, propose fixes in claude/auth-fixes,
  open draft PR when goal condition holds.

▲ Claude
  CronCreate(*/30 * * * * : auth quality loop)
  Stop condition: tests pass + lint clean (verified by checker)
✓ Scheduled. Will continue past intermediate completions
  until /goal condition is met by independent checker.
```

这里最关键的设计是，**把终止条件的判断交给独立的小模型，不让写代码的模型自己判对错**，避免自我陶醉。

### 2. 工作树：避免多任务文件冲突

只要同时跑多个代理，一定会出现两个代理改同一个文件的问题，和两个工程师同时改同一行代码没区别。用 git 工作树就能解决，每个代理有自己独立的工作目录，共享同一个仓库历史，改东西碰不到一起。

Codex 已经内置了这个能力，Claude Code 直接开放了 git 工作树接口，加参数就能给每个子代理开独立的隔离空间。

要注意的是，**工作树解决的是机械冲突，你的评审带宽才是并行数量的上限**，工具解决不了人的产能问题。

### 3. Skills：项目知识写一次，循环每次都能用

不用每次跑循环都重新给 AI 讲一遍项目规则，把项目约定、构建步骤、禁忌都写进 `SKILL.md` 放在文件夹里，每次运行都会自动读。

没有 Skills 的循环，每次都要从零推导一遍项目上下文，有了 Skills，意图才能积累下来。一个成熟的 CI 分流 Skill 长这样：

```markdown
---
name: ci-triage
description: Classify CI failures by root cause (env, flake, real bug,
  dependency, infra), draft fixes for the easy ones, escalate the rest.
  Trigger whenever a workflow run fails or on the morning triage loop.
---

# CI triage skill

## Classification rules
- env: missing secret, wrong env var, infra not provisioned. # human
- flake: passes on retry without code change. # retry once, then file
- bug: deterministic failure tied to recent commit. # draft fix
- dependency: failure tied to a version bump. # draft rollback
- infra: timeout, OOM, runner issue. # escalate

## Fix patterns
- Auth tests → check src/auth/middleware first
- Database tests → verify migration applied in CI env
- E2E tests → check selectors against the latest UI snapshot

## Never do
- Disable failing tests — always file as escalation instead
- Modify CI config without human approval
- Touch src/payments/ or src/billing/ (in claude/permissions.md)

## State
Update STATE.md after each run: file paths checked, classifications,
PRs opened, items escalated.
```

### 4. 连接器：让循环能碰你真正在用的工具

只靠 AI 读文件的循环能力太有限，基于 MCP 协议的连接器能让 AI 读你的问题追踪系统、查数据库、调用测试接口、发 Slack 消息。

现在 Claude Code 和 Codex 都支持 MCP，写一次连接器两边都能用。有了连接器，循环才能真的干完一整套活：**修复问题→开 PR→关联工单→通知团队**，而不是只给你输出一段文本说我改完了。

目前回报率最高的连接器依次是：GitHub、Linear/Jira、Slack、Sentry/错误追踪工具。

### 5. 子代理：让写代码的和查代码的分开

循环里最有用的设计就是拆分：**让一个代理写代码，另一个代理做验证**。写代码的模型总是容易自我感动，觉得自己写的全对，换个带不同指令的模型，更容易查出问题。

这个其实就是 Anthropic 在 2024 年 12 月就提过的「评估者-优化者模式」，只是现在换了个名字流行起来。

不管是 Codex 还是 Claude Code，都支持自定义子代理，常见拆分方式就是：一个探索需求，一个实现，一个对照规格验证。

---

## 避开这些坑，循环才不会变成 token 黑洞

过了测试，搭完模块，还要注意几个常见的失败模式，一不小心就烧了一堆钱还没产出。

> 烧吧！Loop 一小时烧了 1400 美元，Cursor CEO 全额退款

### 状态文件：循环的脊梁

这个东西听起来太简单，没人当回事，但实际上**所有能用的循环都靠它撑着**。只要是单个对话之外的内容，不管是 markdown 文件还是 Linear 看板还是 JSON，把已经做完的事、接下来要做的事记下来就行。

AI 默认记性差，这次跑完的内容下次就忘了，不写下来，每次循环都要从头开始。文章里给了一个现成的状态文件示例：

```markdown
# Loop state · ci-triage

## Last run
2026-06-09 03:30 UTC · 7 failures classified, 3 fixes drafted, 4 escalated

## In progress
- claude/fix-auth-token-refresh — tests passing locally, awaiting CI
- claude/fix-flaky-payment-webhook — retry pattern applied, monitoring

## Completed today
- claude/bump-axios-1.7.4 → merged (CI green, deps loop verified)
- claude/lint-fix-pass-june-9 → merged

## Escalated to humans
- src/billing/refund.ts — tests failing in 3 ways, root cause unclear
- ci/staging-runner — infra timeouts, not a code issue

## Lessons learned (write here, not in chat)
- 2026-06-08: PowerShell hits TLS 1.2 issue on this Windows runner. Use bash.
- 2026-06-07: tests/e2e/checkout requires Stripe webhook secret in env. Skip if missing.

## Stop conditions met since last review
- /goal "all tests pass + lint clean" achieved on commit 3a7b8c1 at 02:14 UTC
```

小团队用仓库里的 markdown 就行，生产环境循环用外部系统方便团队看进度。长期运行的循环，最好配一个顶层规格文件，每次运行都重读，避免跑着跑着偏离目标。**状态告诉 AI 现在在哪，规格告诉 AI 要去哪。**

### 先搭最小可用循环，别上来就搞复杂

过了测试，第一件事是搭最小能用的循环，四个部分就行，不用搞多代理集群：

- 一个**自动化触发**：定时运行，带清晰终止条件
- 一个 **Skill**：存好项目上下文
- 一个**状态文件**：记录进度
- 一个**验证门**：自动判错

顺序也不能乱：**先把手动跑通了，再整理成 Skill，再包进循环，最后配置定时。** 跳过任何一步，都是循环失败的开始。

真正该关心的指标是**「每个可用变更的成本」**，不是跑了多少循环、烧了多少 token。如果通过率低于 50%，说明你还要做很多评审，循环反而帮倒忙。

### 悄悄失败的 Ralph Wiggum 循环

这个失败模式是 Geoffrey Huntley 命名的：**循环没跑完就提前退出，留下半拉活，因为没有硬验证门，它还会悄悄一直烧 token。**

为什么会出这个问题？三个原因：

1. 没有真的验证器，只让另一个 AI 做主观评审
2. 终止条件模糊，全靠 AI 自己判断
3. 没有硬停止，一直跑到有人发现 token 不对才停

解决方法也简单，就是上**客观验证门**：要么测试过了，要么构建成功，要么 lint 通过，不能要 AI 的主观判断。

### 容易被忽略的理解债务和认知放弃

循环跑得越好，这个问题越严重：

- **理解债务**：循环输出代码越快，仓库里的代码和你团队能理解的代码差距就越大。真正疼的不是 token 账单，是哪天要改 bug，整个团队没人看得懂循环写出来的系统。
- **认知放弃**：忍不住停止自己思考，不管循环输出什么都直接接受。设计循环是要帮你省力气，不是让你把思考都交出去，做同一件事，心态不一样结果完全相反。

解决方法也不是技术问题：一定要读 diff，一定要定期抽查验证门有没有失效，不要让循环碰架构级工作，设计循环的时候拉队友一起看，能少很多盲区。

### 安全税一定要交

没人盯着的循环，就是没人盯着的攻击面：

- 没评审的代码直接合，不安全的代码自动合并
- 第三方 Skill 可能带提示注入，装之前一定要审
- 调试日志容易漏出凭证，生产循环要关详细日志，还要做脱敏
- 权限越来越大从不审计，每 30 天一定要重新审一遍循环权限

---

## 最后说句实在的

两年来，和 AI 编码的杠杆都在提示词上，拼谁写得好，拼谁给的上下文准。这个阶段已经结束了。现在 AI 能力足够了，下一个杠杆点，变成了**设计系统**：让系统决定 AI 该做什么，什么时候做，结果怎么验证，哪些信息要保留到下次运行。

但这不是说所有人都要立刻去搭循环。大多数开发者现在还不需要，除非你真的满足那四个条件。**缺一个，循环的成本就比收益高。**

真满足条件，就从小做，一个自动化，一个 Skill，一个状态文件，一个验证门。先把手跑通，再整理，再包循环，最后定时。**顺序错了，最后就是养了一个没人看得懂的吞钱黑洞。**

杠杆点变了，不代表就可以做甩手掌柜了。搭好循环，你还是要需要继续迭代优化，就像经营一家公司，业务跑通只是开始。
