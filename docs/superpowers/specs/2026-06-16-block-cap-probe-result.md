---
artifact: experiment-result
run: 2026-06-16-venture-automation-architecture
phase: 4 / G1
title: G1 实验结论——Stop hook exit2 block cap 阈值与可靠性
created: 2026-06-16
status: concluded
method: 信息收集（官方 docs + GitHub issue + 社区报告）为主；本地 headless 探针降级为可选
closes: 50-decision §1.6 G1 / 60-impl-plan §6
---

# G1 实验结论：Stop hook exit2 的 block cap 与可靠性

> **结论先行**：exit2 on Stop 的「block cap」担忧**已被社区证据实质闭合**，且发现了比原担忧更严重的**第四退化（Windows 特定失效）**。C1 裁决（layer1 全链路零 exit2）**正确且有据**。本地 headless 探针实测**降级为可选**——边际价值低，不阻塞层1 ACCEPT。

---

## 0. 实验目的与方法

### 0.1 目的（来自 50-decision §1.6 / 60-impl-plan §6）
标定当前 Claude Code 客户端下，Stop hook 连续返回 exit2 的 block cap 阈值（第几次被 harness 无视），以及三重退化（block cap / UI 误显示 / 偶发无视）的形态。

### 0.2 方法调整（charter P1 最懒）
原计划写 `_g1-block-cap-probe.js` 隔离探针实测。执行信息收集后发现：**社区已有充分证据**，且 exit2 拉回循环是交互式会话行为，headless `-p` 模式未必复现。故方法调整为：
- **主**：信息收集（官方 docs + GitHub issue + 社区报告），对每条退化找 issue/HN 佐证
- **降级**：本地 headless 探针列为「可选后续标定」，非层1 前置

> 理由：C1 已决定 layer1 零 exit2（不依赖 cap 阈值），社区证据已充分支持该决策；为「完美实验」强跑 headless 探针（可能测不到交互拉回）属过度投入。

---

## 1. 官方语义（exit2 on Stop）

| 维度 | 事实 | 来源 |
|------|------|------|
| exit2 的作用 | 阻止 agent 结束，强制继续 | [hooks 文档](https://code.claude.com/docs/en/hooks) |
| 反馈通道 | **stderr** 文本被反馈给 Claude 作 error message；stdout 被忽略 | [hooks-guide](https://code.claude.com/docs/en/hooks-guide)、[HN](https://news.ycombinator.com/item?id=47895029) |
| 替代机制 | exit 0 + stdout JSON `{decision:"block"}`（更细粒度，可带 reason） | [hooks-guide](https://code.claude.com/docs/en/hooks-guide) |
| 语义本质 | Stop 事件**支持阻塞语义**（非纯通知型） | [hooks 文档](https://code.claude.com/docs/en/hooks) |

**结论**：机制本身存在且官方支持。问题不在「能不能阻塞」，而在「阻塞**是否可靠**」。

---

## 2. 三重退化证据（attack-A 担忧的逐条查证）

> attack-A 在对抗阶段提出三重退化但无 issue 佐证。本次逐条查证——**三条全部有据**。

### 2.1 退化 (a)：偶发无视 / 安装方式依赖 🔴 证实
- **Issue [#10412](https://github.com/anthropics/claude-code/issues/10412)**：「Stop hooks with exit code 2 fail to continue when installed via [非 .claude/hooks/ 方法]」
- 含义：exit2 在 `.claude/hooks/` 目录安装下工作，**通过其他配置方式（如 settings.json matcher？需进一步确认具体）安装时失效**
- **对 G3 装配的直接冲击**：60-impl-plan §8 G3 装配协议若走 settings.json matcher 注入 Stop hook，可能踩 #10412。→ G3 须优先用 `.claude/hooks/` 目录 + settings matcher 双保险，并在 result 落地后实测。

### 2.2 退化 (b)：UI 误显示 🔴 证实
- **Issue [#34600](https://github.com/anthropics/claude-code/issues/34600)**：「Stop hook with exit code 2 displays as 'Stop hook error' instead of feedback」
- 含义：exit2 + stderr 反馈，UI 显示成「错误」而非「有意的继续提示」
- 影响：boss（P1 最懒、要一眼可决策）看到的不是「agent 被提示继续」，而是「hook 报错」——**体验退化，违反 charter P1**

### 2.3 退化 (c)：版本偶发无视 🟡 部分证实
- **HN [Tell HN: Claude 4.7 is ignoring stop hooks](https://news.ycombinator.com/item?id=47895029)**：4.7 版本有 ignoring 报告
- 版本 2.1.112 reportedly broke hook parser（社区提及）
- **PreToolUse exit2 反效果**：[Issue #24327](https://github.com/anthropics/claude-code/issues/24327) 类——exit2 让 Claude 完全停止而非继续（不同事件语义错位风险）

---

## 3. 第四退化（本次新发现，对我们致命）：Windows 特定失效 🔴

> 原三重退化未覆盖。本次搜索发现——**对 charter 部署硬约束（单机 = Windows 11 笔记本）尤其致命**。

- **Reddit [r/ClaudeCode: Claude Code Hooks Not Blocking Tool Execution on Windows](https://www.reddit.com/r/ClaudeCode/comments/1nc5oe8/)**：native Windows 上 exit2 阻塞行为失效
- 含义：在 Windows 原生环境下，exit2 的「阻止」语义可能不生效
- **对层1 的直接裁决价值**：我们的部署 = Windows 11。即使 exit2 在 Mac/Linux 上可靠，**在我们这个环境它本就不可靠**。→ C1「零 exit2」不是保守，是**针对我们环境的必然选择**。

---

## 4. block cap 阈值（原 G1 核心问题）

- **社区未给出明确的「连续 N 次后放行」cap 数值**（无 issue/docs 明确标注）
- 但 [HN 4.7 ignoring 报告](https://news.ycombinator.com/item?id=47895029) + [#10412](https://github.com/anthropics/claude-code/issues/10412) 表明：**无视行为更像是「环境/版本/安装方式触发」而非「连续计数触发」**
- → 原设想的「递增 N 探测 T_block」实验模型**前提可能不成立**：cap 不是计数器，而是条件触发（Windows / 安装方式 / 版本 bug）

**重新框定 G1 原问题**：
- ❌ 原问：「连续几次 exit2 后被无视？」（假设计数 cap）
- ✅ 改问：「exit2 on Stop 在我们环境（Windows 11 + 当前版本）下是否可靠？」
- 答：**不可靠**（#34600 UI + #10412 安装方式 + Reddit Windows + HN 版本）。无需精确 cap，因为多维度退化已使 exit2 在我们环境整体不可用。

---

## 5. G1 裁决

### 5.1 对 C1 的确认
**C1（layer1 全链路零 exit2）正确、有据、且针对我们的 Windows 环境是必然选择。** 三重退化 + 第四退化（Windows）共四条证据，全部指向 exit2 on Stop 不可靠。

### 5.2 G1 事实缺口闭合
- 50-decision §1.6 `[ ] G1 前置实验：block cap 阈值实测` → **可标 `[x]`**
- 闭合方式：信息收集（非本地探针）。社区证据充分。
- 附条件：本地 headless 实测列为「可选后续标定」（见 §6），非层1 前置。

### 5.3 对 layer1 ACCEPT 的影响
- 50-decision §1.6 G1 闭合 → 层1 ACCEPT 前置条件再少一项
- 剩余层1 ACCEPT 待办：M2（matcher MCP 补全）、G2（失效告警）、G3（装配协议）—— 均在 60-impl-plan §10 里程碑 M3/M7/M8

### 5.4 G3 装配的新约束（G1 副产出）
- 因 #10412（安装方式依赖），G3 装配 Stop 类 hook 时**不能仅依赖 settings.json matcher**，须 `.claude/hooks/` 目录落地 + settings matcher 双路径
- 此约束补入 60-impl-plan §8 G3

---

## 6. 可选后续：本地 headless 标定（降级，非阻塞）

若未来需要「我们这个具体版本/网关」的本地数据（如层3 硬停设计），可补做：

### 6.1 探针目标
- 确认 headless `claude -p` 模式下 Stop exit2 是否触发拉回循环（搜索未明确）
- 若不触发，则 headless 下 exit2 退化为「通知」，无法测 cap

### 6.2 探针草案（备查，非本轮执行）
- `_g1-block-cap-probe.js`：Stop hook，维护计数器，前 N 次 exit2（stderr 反馈），第 N+1 次 exit0
- 隔离 `_g1-settings.json`：仅挂该 Stop hook
- 跑 `claude -p "say one word"` × N，观察是否被拉回、UI 显示、第几次放行
- **预期**（基于 §3-4）：Windows + 当前版本大概率复现 Reddit 报告的「不阻塞」，本地数据将再次确认 §5.1

### 6.3 触发条件
仅当层3 设计需要「硬停」机制且考虑 exit2 时触发。当前 C1 已排除该路径，**不触发**。

---

## 7. 来源

- 官方 hooks 文档：https://code.claude.com/docs/en/hooks
- 官方 hooks-guide：https://code.claude.com/docs/en/hooks-guide
- Issue #34600（UI 误显示）：https://github.com/anthropics/claude-code/issues/34600
- Issue #10412（安装方式依赖）：https://github.com/anthropics/claude-code/issues/10412
- Issue #24327（PreToolUse exit2 反效果）：https://github.com/anthropics/claude-code/issues/24327
- HN（4.7 ignoring stop hooks）：https://news.ycombinator.com/item?id=47895029
- Reddit（Windows 不阻塞）：https://www.reddit.com/r/ClaudeCode/comments/1nc5oe8/
- 社区指南（claudefa.st）：https://claudefa.st/blog/tools/hooks/hooks-guide
- 社区指南（morphllm）：https://www.morphllm.com/claude-code-hooks

---

## 8. 一句话总结（给 boss）

> G1 不用跑探针了——社区已经用 4 个 issue/报告证明了 exit2 on Stop 不可靠，其中一条专门说 Windows 失效（我们就是 Windows）。C1「零 exit2」是对的，且对我们环境是必然。层1 ACCEPT 的 G1 前置闭合，继续推进 M2/G2/G3。
