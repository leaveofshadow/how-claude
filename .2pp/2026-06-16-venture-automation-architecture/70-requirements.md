---
run: 2026-06-16-venture-automation-architecture
phase: 4
artifact: requirements
title: 层1 cc-runtime 保姆级验收需求
author: 编排者
created: 2026-06-16
status: draft
direction_version: 1
inputs:
  - 60-impl-plan.md（§13 验收标准展开源）
  - 50-decision.md（C1/C2/M1-M4/G1-G3 条款）
  - 00-charter.md（部署硬约束 + 收益为标）
---

# 70-requirements：层1 cc-runtime 保姆级验收需求

> **文档性质**：验收合同。执行者（boss 或 executor agent）照此逐条做，每条给「前置 / 步骤 / 预期 / 失败诊断」。对应 60-impl-plan §13，不引入新设计。

> **验收哲学**（charter P1 最懒 + P4 超越）：验收不是让 boss 苦思，而是把每条「解码重编码」成「照做 → 看结果 → 判通过」的机械步骤。失败时给「查哪里」，不丢回 boss。

---

## 0. 验收前置

### 0.1 环境（charter 部署硬约束，不可妥协）
- [ ] **单机**：Windows 11 笔记本，无服务器/集群/外部 AI
- [ ] **单 Claude**：所有 agent 角色 = Claude 分饰（subagent/skill），无外部模型
- [ ] **7×24**：会话可断点续传（checkpoint/direction/trace 是其基础设施）
- [ ] **存储根**：`.venture/state/`（与 `.omc/` 隔离，60-impl-plan §2）

### 0.2 验收工具
- 一个干净 venture 项目目录（含 `.venture/`）
- 临时 settings.json（`_accept-settings.json`）只挂待验收 hook，隔离 gsd/compact-snapshot 干扰（除非验收共存）
- `claude` CLI（带当前 settings）
- 文本编辑器看 `.venture/state/` 文件

### 0.3 验收总原则
- 每条独立验收，通过打 `[x]`
- 任一「致命项」（标 🔴）失败 = 层1 不可用，必须修后重来
- 「增强项」（标 🟡）失败 = 降级可用，记入风险
- 全部通过 = 层1 ACCEPT，解锁层3

---

## 1. 四文件 schema 验收（对应 60-impl-plan §2）

### 1.1 初始化 🔴
- **前置**：干净项目，`.venture/state/` 不存在
- **步骤**：跑 cc-runtime 装配的初始化命令（态2，60-impl-plan §8.1）
- **预期**：`.venture/state/` 下生成 4 文件：
  - `checkpoint.json`（含 autopilot 原字段 + venture 扩展 + C1 字段，60-impl §2.1）
  - `trace.ndjson`（空文件或首行）
  - `direction.json`（current_version:1, status:"active", history:[]）
  - `tasks.tree.json`（direction_version:1, tasks:[]）
- **失败诊断**：文件缺 → 初始化脚本漏建；字段缺 → 对照 60-impl §2.1-2.4 逐字段核

### 1.2 checkpoint.json 字段完备性 🔴
- **步骤**：JSON 解析 checkpoint.json，校验字段存在性
- **预期**（必填）：`created_at, trigger, active_modes, todo_summary, current_node, current_task, progress_percent, iteration, last_progress_hash, direction_version, guardrails{max_iteration,no_progress_streak,budget_*}, continue_from, stagnation_count, health`
- **失败诊断**：字段名拼错 → 脚本常量；autopilot 原字段缺 → 兼容性破（方案1 §2.1 零迁移承诺违反）

### 1.3 direction.json 原子性 🔴（M4）
- **前置**：direction v1 active
- **步骤**：模拟 `direction.set({version:2,...})`（连续触发 10 次，模拟竞态）
- **预期**：`current_version` 最终=2，无中间态（半写 v1/v2 混合）；Windows 下 `fs.renameSync` 无 EPERM
- **失败诊断**：出现混合态 → 未用临时文件+rename；EPERM → 文件被占用，查是否有读时锁

### 1.4 trace.ndjson 追加性 🟡
- **步骤**：触发 3 次 PostToolUse Write
- **预期**：3 行合法 JSON（每行可独立 `JSON.parse`），字段含 `ts,node,iter,action,tool,filesChanged,progressHash`
- **失败诊断**：行不可解析 → 写入被中断（检查是否 atomic append）；字段缺 → H2 解析逻辑漏

### 1.5 tasks.tree.json 同构性 🟡
- **步骤**：跑一次含 TaskCreate 的会话
- **预期**：tasks.tree.json 的 tasks[] 与 TaskList 输出同构（id/status/subject 对齐）
- **失败诊断**：不同步 → H2 的「启发式匹配 tool→task」失效（60-impl §3.2），查匹配规则

---

## 2. 七 Hook 逐项验收（对应 60-impl-plan §3）

> 每个 hook 验收：正常路径 ✅ + 边界/反例 ⚠️ + 安全 🛡️

### 2.1 H1 方向守卫（PreToolUse Read）🔴 痛点4 核心
- **前置**：direction 切到 v2，v1 产物在 `superseded_paths`
- **步骤 ✅**：agent Read `.venture/artifacts/v1/03-plan.md`
- **预期**：注入 additionalContext「⚠️ 此文件属于已废弃方向 v1，当前有效 v2（{current_plan}）」
- **步骤 ⚠️ 反例**：Read v2 文件 → 无注入（不误报）
- **步骤 ⚠️ Bash 绕过**：agent 用 Bash `cat v1/03-plan.md` → H1 拦不住（M2 已知），H6 SessionStart 方向提示兜底
- **步骤 🛡️**：`.venture/hooks.disable` 存在 → H1 跳过
- **失败诊断**：v1 文件无提示 → H1 未读 superseded_paths，或 matcher 未命中 Read

### 2.2 H2 进度（PostToolUse Write|Edit|Bash，合并 H3）🔴 痛点3 核心
- **步骤 ✅**：Write 一个文件 → trace.ndjson +1 行，checkpoint.progress_percent 更新，tasks.tree 同步
- **步骤 ✅ 推理节点**（M1）：纯 Think 无文件变动 → trace 写 `reasoning_step` 行，progressHash 基于 `(node,iter,step_index)` 变化，**不算 stagnation**
- **步骤 ⚠️ MCP 工具**（M2）：用 MCP 文件工具写 → trace +1 行（matcher 已加 mcp__*）
- **步骤 🛡️ 非 venture 项目**：在无 `.venture/` 的目录 Write → 脚本早退 exit0，零成本
- **失败诊断**：推理节点误判停滞 → M1 三元组 hash 未实现；MCP 漏配 → matcher 清单不全（60-impl §3.2 M2）

### 2.3 H4 Stop 提示（C1 降级）🔴
- **步骤 ✅**：任务有 pending 时 agent Stop → 注入「⚠️ 还有 N 个 pending：{list}」，**exit0**（不阻塞）
- **步骤 ⚠️ 连续 M=3 轮**：Stop 时仍 pending → checkpoint 标 `health:"blocked"`
- **步骤 🛡️**：确认 task 真做完后 Stop → 无提示（不误报）
- **失败诊断**：出现 exit2 → C1 违反（致命），查脚本是否误用 exit2；误报 → M 阈值太低（应=3）

### 2.4 H5 PreCompact 快照（C1 兜底）🔴
- **步骤 ✅**：触发 compact（上下文达阈值）→ checkpoint 全量快照（含 continue_from），stagnation_count 计算，**exit0 放行**
- **步骤 ⚠️ stagnation**：连续无 trace 增量 → health 标 `"stagnant_warn"`（N 轮）/`"blocked"`
- **步骤 🛡️**：`.venture/hooks.disable` → 跳过；stdin 超时 10s → exit0
- **失败诊断**：compact 后 checkpoint 残缺 → 快照未含全部字段；出现 exit2 → C1 违反（致命，compact 会失败）

### 2.5 H6 SessionStart 恢复（source=compact）🔴 痛点3 恢复
- **步骤 ✅**：compact 后新会话 → 注入「【层1 断点续传】当前方向 v{M} / 续跑锚点 / 最近 trace / 健康状态」
- **步骤 ⚠️ awaiting_human**（C1）：direction.status=="awaiting_human" → 注入「⏸️ 等待你对 {gate} 的决定」
- **步骤 ⚠️ blocked**：health=="blocked" → 注入强提示
- **步骤 ⚠️ 非 compact 启动**：source==initial/resume/clear → 立即 exit0，不注入（避免每次启动都弹）
- **步骤 🛡️**：去 YAML frontmatter 干净（compact-snapshot-restore 范式）
- **失败诊断**：每次启动都弹 → source 门控失效；YAML 残留 → 清洗逻辑漏

### 2.6 H7 SubagentStop 方向注入（G4）🟡
- **步骤 ✅**：委派 subagent → subagent 返回前注入 direction 版本 + VENTURE_TRACE_FILE 路径
- **步骤 ⚠️**：subagent 读对方向、trace 写对文件（M3）
- **失败诊断**：subagent 仍读旧 → 注入内容未被执行，查 VENTURE_TRACE_FILE 环境变量是否传递

### 2.7 H8 方向变更探测（UserPromptSubmit）🟡
- **步骤 ✅**：用户输入「换方向/重来/推翻」→ 注入「检测到方向变更意图，建议先 direction.set」
- **步骤 ⚠️ 去抖**：连续命中只首次提示
- **步骤 ⚠️ 反例**：正常对话含「换」字（如「换行」）→ 不误触发（关键词需上下文）
- **失败诊断**：误报多 → 去抖/关键词太宽

---

## 3. G1 前置实验验收（对应 60-impl-plan §6）🔴

### 3.1 block cap 实测
- **步骤**：按 60-impl §6.1 跑 `_g1-block-cap-probe.js`，N=1,2,3...递增
- **预期产出**：`docs/superpowers/specs/2026-06-16-block-cap-probe-result.md`，记录：
  - T_block（第几次 exit2 开始被 harness 拒绝/忽略）
  - 退化形态（rate-limit / 忽略 / UI 误显示，哪一种先现）
- **判据**：
  - T_block < 3 → 坐实 C1（层1 永不用 exit2）✅ 通过
  - T_block ≥ 5 → exit2 备用可行，但 C1 已选不依赖，记录为「未来层3 硬停参考」✅ 通过
  - 实验无法运行 / 无结论 → 🔴 阻塞（必须先拿到事实）

---

## 4. 痛点3 端到端验收（长会话不丢状态）🔴

### 4.1 场景
> 痛点3 原文：「它按照实施计划执行，但没有更新任务记录；没有 checkpoint 和 trace」

- **步骤**：
  1. 初始化 venture 项目，direction v1
  2. 跑一个含 5+ 工具调用（Write/Edit/Bash）的实施会话
  3. 中途触发 compact（或手动 `claude --compact`）
  4. compact 后继续会话
- **预期**：
  - trace.ndjson 累积所有工具调用记录 ✅
  - tasks.tree.json 与 TaskList 同步（任务记录更新，痛点3 直解）✅
  - checkpoint.progress_percent 单调增，continue_from 非空 ✅
  - compact 后 H6 注入续跑锚点，agent 从断点续（不重头）✅
- **失败诊断**：
  - trace 缺记录 → H2 未挂或早退
  - 任务记录不同步 → H2 启发式匹配失效
  - compact 后重头 → H6 注入失败或 continue_from 空

### 4.2 7×24 断点续传（charter 硬约束）
- **步骤**：会话 A 跑到 checkpoint → 关 CLI → 重开（非 compact，纯 resume）
- **预期**：SessionStart 注入续跑点，状态完整恢复
- **失败诊断**：resume 丢状态 → state.snapshot 未持久化

---

## 5. 痛点4 端到端验收（方向切换不读旧）🔴

### 5.1 场景
> 痛点4 原文：「通过 human 确认想换个方向，推翻旧计划，但依然会读旧的探索、计划文件」

- **步骤**：
  1. v1 产出 `artifacts/v1/01-research.md` + `v1/03-plan.md`
  2. judge 后用户确认换向 → `direction.set({version:2, supersedePath:"v1/"})`
  3. direction.json 更新：current_version:2, v1 进 history.status:"superseded", superseded_paths 含 v1/
  4. 后续节点 agent 尝试 Read `v1/03-plan.md`
- **预期**：
  - H1 注入「⚠️ v1 已废弃，当前 v2（{current_plan}）」✅
  - agent 改读 `v2/03-plan.md` ✅
  - Bash 读 v1 时 H6 方向提示纠偏 ✅（M2 兜底）
- **失败诊断**：
  - H1 无提示 → matcher 未命中或 superseded_paths 空
  - agent 仍读 v1 → H1 提示未被遵循（advisary 局限，记风险）

### 5.2 human gate awaiting（C1）
- **步骤**：judge 节点结束 → direction.status 设 "awaiting_human", gate:"HG2"
- **预期**：H6 注入「⏸️ 等待决定」，agent 自然停等，**不靠 exit2 阻塞** ✅
- **失败诊断**：agent 继续 → awaiting 未注入或 agent 无视提示

---

## 6. C1/C2 验收 🔴

### 6.1 C1（零 exit2）
- **步骤**：grep 所有 cc-runtime hook 脚本 `process.exit(2)`
- **预期**：**零命中**（除 G1 实验探针）
- **失败诊断**：任何 cc-runtime hook 有 exit2 → C1 违反，致命

### 6.2 C2（范式收窄）
- **步骤 ✅ H5/H6**：与 compact-snapshot-write/restore 骨架对照（stdin 超时/session_id 防护/exit0/.disable 开关/prune）
- **预期**：骨架一致，仅业务逻辑不同
- **步骤 ✅ H1/H2/H4/H7/H8**：各有独立单测（`tests/cc-runtime-*.test.js`）
- **预期**：单测覆盖正常+边界+安全
- **步骤 ✅ 纯 Node fs**：grep 脚本 `require('child_process')` 或 SDK
- **预期**：零命中（C2 禁 SDK 子进程）
- **失败诊断**：有 child_process → C2 违反

---

## 7. M1-M4 验收 🟡

| ID | 验收步骤 | 预期 | 失败诊断 |
|----|---------|------|---------|
| M1 | 跑纯推理会话（Think 多轮无文件） | progressHash 变化（三元组），不算 stagnation | hash 仍基于文件 → M1 未实现 |
| M2 | MCP 文件工具写 + Bash cat 旧文件 | MCP 进 trace；Bash 旧文件被 H6 提示 | MCP 漏配 / Bash 无兜底 |
| M3 | 委派 subagent 设 VENTURE_TRACE_FILE | subagent trace 写入指定文件 | 环境变量未传递 |
| M4 | direction 并发切换 10 次 | 无混合态，无 EPERM | 未用 rename / 有锁 |

---

## 8. G2 健康告警验收 🟡

### 8.1 失效检测
- **步骤**：人为让某 hook 抛错（改坏一行）连续 3 次
- **预期**：
  - `.venture/state/hook-health.ndjson` 累积 3 行错误
  - 第 3 次后 H6 SessionStart 注入「⚠️ {hook} 连续 3 次失败」
  - 微信收到一次 push（不刷屏）
- **步骤 🛡️**：告警自身不崩（hook-health.ndjson 写失败也静默）
- **失败诊断**：无告警 → G2 计数/注入失效；刷屏 → 去抖未实现

---

## 9. G3 装配协议验收 🟡

### 9.1 三态走通
- **步骤**：cc-runtime skill 走 诊断 → 装配 → 运行 → 卸载
- **预期**：
  - 诊断：识别痛点3/4 症状 → 给配方
  - 装配：拷脚本到 `~/.claude/hooks/` + settings.json 追加（**合并 matcher 不覆盖**）
  - 运行：hook 常驻，skill 可卸载（不占上下文）
  - 卸载：移除 settings.json 条目，保留 `.venture/state/` 存档
- **失败诊断**：装配覆盖现有 hook → settings.json 合并逻辑错（致命，会破坏 gsd/wechat）

### 9.2 matcher 叠加清单（P1 最懒）
- **步骤**：装配后输出 §1.1 核算表（每事件 hook 数 + 增量延迟）
- **预期**：boss 一眼看到落了几个 hook、热点在哪
- **失败诊断**：无清单 → G3 透明化未做

---

## 10. 性能验收 🔴

### 10.1 PostToolUse 热点（3 hook 叠加）
- **步骤**：在装了 gsd + cc-runtime 的项目，连续 Write 10 个文件，计时
- **预期**：单次 Write 的 hook 延迟增量 < 300ms（60-impl §1.1 估算 3×80ms）
- **失败诊断**：> 300ms → R10 触发，评估合并 gsd-context-monitor（打破隔离边界，需 boss 定夺）

### 10.2 非 venture 零成本
- **步骤**：在无 `.venture/` 的项目 Write
- **预期**：cc-runtime hook 早退 exit0，延迟 < 10ms
- **失败诊断**：高延迟 → 早退逻辑未实现

---

## 11. 收益指向验收（charter 阶段标准）🟡

> 层1 是基础设施不直接产生收益，但 charter 要求回答「如何指向收益」。

### 11.1 解锁验证
- **步骤**：层1 落地后，**手演**层3 venture 流水线的关键操作（不真跑全流水线）：
  - 调查节点 pause → resume（用 checkpoint/trace）
  - judge 后换向（用 direction 原子切换）
  - compact 后续跑（用 H6 恢复）
- **预期**：三个操作均依赖层1 基础设施且**已可用**
- **判据**：层1 是层3 的「断点续传 + 方向切换 + trace 回放」地基——地基齐备 = 解锁 venture 流水线跑出可变现方向的能力 ✅
- **失败诊断**：任一操作缺地基 → 层1 不完备，返工

---

## 12. 验收清单总表

### 致命项（全过才 ACCEPT，标 🔴）
- [ ] 1.1 四文件初始化
- [ ] 1.2 checkpoint 字段完备
- [ ] 1.3 direction 原子性（M4）
- [ ] 2.1 H1 方向守卫（痛点4）
- [ ] 2.2 H2 进度（痛点3）
- [ ] 2.3 H4 Stop 提示（C1）
- [ ] 2.4 H5 PreCompact 快照（C1）
- [ ] 2.5 H6 SessionStart 恢复（痛点3）
- [ ] 3.1 G1 block cap 实测有结论
- [ ] 4.x 痛点3 端到端（含 7×24 续传）
- [ ] 5.x 痛点4 端到端（含 awaiting gate）
- [ ] 6.1 C1 零 exit2
- [ ] 6.2 C2 范式 + 纯 Node + 独立单测
- [ ] 9.1 装配不覆盖现有 hook
- [ ] 10.1 性能 < 300ms

### 增强项（降级可用，标 🟡）
- [ ] 1.4 trace 追加性
- [ ] 1.5 tasks 同构
- [ ] 2.6 H7 subagent 方向（G4）
- [ ] 2.7 H8 方向探测
- [ ] 7.x M1-M4
- [ ] 8.x G2 健康告警
- [ ] 9.2 matcher 清单透明
- [ ] 10.2 非 venture 零成本
- [ ] 11.1 收益指向（解锁层3）

### 通过判据
- **致命项全 [x] + 增强项 ≥ 80% [x]** → 层1 ACCEPT，解锁层3
- **致命项任一失败** → 修后重来，不得进层3
- **增强项失败** → 记入 50-decision §5 风险登记，降级推进

---

## 13. 验收产出物

通过后须归档：
- [ ] `docs/superpowers/specs/2026-06-16-block-cap-probe-result.md`（G1 实测数据）
- [ ] `.venture/state/` 四文件 schema 文档（cc-runtime/references/state-schema.md）
- [ ] 七 hook 脚本 + 单测（cc-runtime/references/hook-templates/）
- [ ] G3 装配清单（matcher 叠加核算表）
- [ ] 验收报告（本清单打 [x] 版 + 实测数据）

> 层1 ACCEPT 后，进 50-decision §4 节奏：**层3 启动**（cc-venture + extractor，前置 = direction.json/trace.ndjson schema 已稳定，本验收 1.x 已冻结）。
