# 60-impl-plan.md — 层2 工作流引擎 · Phase 4 编排契约

> **运行目录**：`.2pp/2026-06-16-layer2-workflow-engine/`
> **日期**：2026-06-17
> **上游输入**：[50-decision.md](./50-decision.md)（β' 裁决）+ [00-explore.md](./00-explore.md)（硬约束/原语/灰度）+ shift-direction.js line 126-127（嫁接1 前提核验坐实）
> **交付对象**：执行编排者（驱动创造类 agent 落地）/ cc-loop（衔接执行协议的验证闸）
> **实施者认知锚定**：Claude Code + 已装载 skills，工作量度量用 **token / 上下文轮次 / skill 配置成本 / 验证复杂度**，禁用人天/人周/团队熟练度/上手时间。
> **裁决一句话**：β' = 三原语 + dag.json 数据驱动 + pipeline-state.json 独占 HG（嫁接1）+ shift-direction.js 零改动 + graph_hash + subgraph/fan_out 字位预留。

---

## §1 技术选型确认（含 ROI）

### 1.1 dag.json 数据驱动（vs 硬编码流转逻辑）

```
                      换 DAG 成本对比
  ┌─────────────────────────────────────────────┐
  │ 硬编码流转（α 路线）                          │
  │   换 DAG = 改 advance-node.js 代码           │
  │   token 成本：每次 ~3-5k（读+改+回归测试）   │
  │   上下文风险：改核心代码触发 autocompact      │
  ├─────────────────────────────────────────────┤
  │ dag.json 数据驱动（β' 裁决）                 │
  │   换 DAG = 改 dag.json 一个数据文件           │
  │   token 成本：~0.5k（编辑 JSON + 跑 graph_hash）│
  │   上下文风险：零（引擎代码不动）              │
  └─────────────────────────────────────────────┘
```

**ROI 论证**：
- **投入**：M0 多写一个 `load-graph.js` 解析器（约 1 会话 · 3k token）+ dag.json schema 文档。
- **产出**：
  1. 满足 Q4（通用工作流引擎，用户拒绝专用）——一次性投入换取「未来任何 venture 复用」。
  2. 满足 C7（引擎交付 = 转移拓扑跑通，换占位 DAG 即可验证，无需等层3 业务节点）。
  3. 驳回 α 否决②（α 违反 Q4 的硬伤被 β' 化解）。
- **回本预期**：层3 8 节点 DAG 接入时即回本（若 α 路线，层3 接入需改代码 → 远超 M0 投入）。

### 1.2 纯 Node fs（vs 引入库 / 自造解释器）

```
  选项对比（charter C2 硬约束下的 ROI）
  ┌──────────────────┬──────────────┬───────────────┬────────────────┐
  │ 选项              │ 依赖         │ token 成本    │ 风险           │
  ├──────────────────┼──────────────┼───────────────┼────────────────┤
  │ A. 纯 fs+path     │ 0（Node 内建）│ 最低          │ 无             │
  │ B. require 第三方 │ npm install  │ +打包/版本锁  │ 单机 OPC 冗余   │
  │ C. vm/eval 解释器 │ 0            │ ×10（γ 估值） │ 安全 + autocompact│
  └──────────────────┴──────────────┴───────────────┴────────────────┘
```

**ROI 论证**：
- **投入**：手写 edge 条件求值（只支持 signal=green/yellow/red/unknown 四枚举字面比较，禁动态求值）。
- **产出**：
  1. charter C2 合规（禁 vm/eval/Function/SDK 子进程）——零妥协空间。
  2. 驳回 γ 否决①（evalEdge/safeEval 自造解释器工作量 10× 低估 + 违背 C2）。
  3. 单机 OPC 零外部依赖，复用 cc-runtime `atomicWriteJSON` 已有工具函数（init-state.js line 34-40）。
- **回本预期**：即时（任何引入库的 token 成本都高于纯 fs 手写）。

### 1.3 断点续传自建（vs 外部 durable 引擎）

```
  断点续传方案对比（charter 单机纯原生约束）
  ┌──────────────────────┬────────────┬──────────────┬──────────────────┐
  │ 方案                  │ 依赖       │ 跨 session   │ charter 一致性   │
  ├──────────────────────┼────────────┼──────────────┼──────────────────┤
  │ A. 自建（B 假设）     │ 层1 落盘   │ checkpoint续 │ ✓ 单机 OPC       │
  │ B. Temporal/Conductor │ 外部服务   │ 服务端持久   │ ✗ 违反单机/纯原生 │
  └──────────────────────┴────────────┴──────────────┴──────────────────┘
```

**ROI 论证**：
- **投入**：M4 写 `venture-resume.js`（约 1 会话 · 4k token）+ /venture-resume slash 衔接。
- **产出**：
  1. 满足 7×24 B 假设（session 结束可续，boss 唤醒后 `/venture-resume`）。
  2. 复用层1 checkpoint.continue_from 腿已就绪（00-explore §E 素材表）。
  3. Augment Code 事实坐实「durable execution SDK 不提供，必须自建」——自建是 charter 唯一可行路径，非可选。
- **回本预期**：M4 交付即回本（无外部方案可比，charter 约束下 A 是唯一选项）。

> **三件套 ROI 总结**：dag.json（Q4 通用性 ROI）、纯 fs（C2 合规 ROI）、自建续传（charter 唯一可行 ROI）——三者皆是「约束驱动」而非「收益驱动」，ROI 论证焦点在「违反约束的代价远高于投入」。

---

## §2 模块拆分（Claude 实施者度量）

> **度量单位**：会话（session）· 上下文轮次（round）· token · skill 配置成本 · 验证复杂度（测试数）。
> **禁用度量**：人天 / 人周 / 团队熟练度 / 上手时间。

### 2.1 层1 复用（已存在，零改动）

| 模块 | 路径 | 复用内容 | 改动 |
|------|------|---------|------|
| init-state.js | `.claude/skills/cc-runtime/scripts/` | atomicWriteJSON（line 34-40）| 零 |
| shift-direction.js | 同上 | direction.set（line 87-187）+ line 126-127 硬编码 | **零（C1 嫁接1）** |
| 3 测试文件 | 同上 | init-state.test / shift-direction.test / compact-snapshot-e2e.test | 零（18/18 基线） |

**复用成本**：0 token（require 引入即可）。

### 2.2 层2 新建（venture-pipeline skill）

| 里程碑 | 模块 | 路径 | 工作量（会话·token）| 测试 |
|--------|------|------|--------------------|------|
| **M0** | dag.json schema | `venture-pipeline/dag.json` | 1 会话 · 2k token | graph_hash 单测 |
| | load-graph.js | `scripts/load-graph.js` | 同上 · 1.5k token | parse + 字位预留单测 |
| **M1** | pipeline-state.js | `scripts/pipeline-state.js` | 1 会话 · 3k token | 读写 + graph_hash + HG 字段单测 |
| | schema 文档 | `references/pipeline-state-schema.md` | 同上 · 1k token | 文档审阅 |
| **M2** | advance-node.js | `scripts/advance-node.js` | 2 会话 · 6k token | node 流转 + edge 条件 + loop_back + HG 触发单测 |
| **M3** | SKILL.md | `venture-pipeline/SKILL.md` | 1 会话 · 2k token | 无（文档）|
| | pipeline-guide.md | `references/pipeline-guide.md` | 同上 · 3k token | 无（文档）|
| | H6 注入逻辑 | SKILL.md 内 SessionStart 段 | 同上 · 1k token | HG 面板渲染冒烟 |
| **M4** | venture-resume.js | `scripts/venture-resume.js` | 1 会话 · 4k token | 续传单测 |
| | /venture-resume slash | `commands/venture-resume.md` | 同上 · 0.5k token | 冒烟 |
| **M5** | 占位 dag.json | `venture-pipeline/dag.placeholder.json` | 0.5 会话 · 1k token | M0-M2 集成验证用 |
| | persona signal 收敛 | `references/persona-signal.md` | 1 会话 · 2k token | 结构化判据单测 |

**总工作量（M0-M5）**：约 8-9 会话 · 30k token（含 20% autocompact 缓冲）。

### 2.3 测试基线对齐

- TDD：每个 M0-M2 脚本配 `.test.js`，先红后绿。
- cc-runtime 18/18 基线不破（M2 接入 direction.set 需回归 shift-direction.test 通过）。

---

## §3 里程碑（每阶段交付物 + 验收条件 + 工作量）

### M0：dag.json schema + load-graph.js

- **交付物**：dag.json schema（三原语 node/edge/loop_back + subgraph/fan_out 字位预留）+ load-graph.js（解析 dag.json → 内存图）。
- **验收条件（可证伪）**：
  1. `node load-graph.js --dag dag.json` 输出合法内存图 JSON。
  2. dag.json 含 subgraph/fan_out 字段时，load-graph.js 输出 stderr：`未实现：subgraph/fan_out 字位预留（C5）`。
  3. graph_hash 对同一 dag.json 输出稳定哈希。
- **Claude 实施者工作量**：1 会话 · 3.5k token · 3 个测试。
- **依赖**：无。

### M1：pipeline-state.js + schema 文档

- **交付物**：pipeline-state.js（pipeline-state.json 读写 + graph_hash 校验 + HG 字段 status/gate）+ schema 文档。
- **验收条件（可证伪）**：
  1. `node pipeline-state.js init` 生成 `.venture/state/pipeline-state.json`，含 status:active/gate:null/graph_hash:<M0 哈希>。
  2. `node pipeline-state.js set-hg --gate HG1` 写入 status:awaiting_human/gate:HG1。
  3. dag.json 改动后 graph_hash 不匹配时，`pipeline-state.js verify` exit 1 + 报错。
- **Claude 实施者工作量**：1 会话 · 4k token · 4 个测试。
- **依赖**：M0。

### M2：advance-node.js（引擎核心）

- **交付物**：advance-node.js（node 流转 + edge 条件评估 + loop_back 收敛 + HG 触发 + direction.set 驱动接入）。
- **验收条件（可证伪）**：
  1. 占位 DAG（M5）跑通 N1→N2→N3→HG1→N4→HG2 转移拓扑（C7）。
  2. edge 条件 signal=green 自动流转 / signal=red 停等。
  3. loop_back N6⇄N7 MAX_ITER=3 后收敛（不再回环）。
  4. HG 触发写 pipeline-state.status:awaiting_human，direction.json **不动**（C1 核验：读 direction.json status 仍 'active'）。
  5. shift-direction.test 回归 18/18 通过。
- **Claude 实施者工作量**：2 会话 · 6k token · 8 个测试。
- **依赖**：M1。

### M3：SKILL.md + pipeline-guide.md + H6 注入

- **交付物**：venture-pipeline/SKILL.md（层2 编排核心 skill 定义）+ references/pipeline-guide.md（深度参考）+ H6 SessionStart 注入逻辑（读 pipeline-state 显示 HG 停等面板，P1 最懒重编码）。
- **验收条件（可证伪）**：
  1. SessionStart 读 pipeline-state.status:awaiting_human 时，注入面板含「当前节点 / 待决策项 / RedFlag / 推荐动作」四要素。
  2. status:active 时注入面板含「当前节点 / 进度% / 下一步」。
  3. 面板字符数 ≤ 200（P1 最懒，不刷屏）。
- **Claude 实施者工作量**：1 会话 · 6k token · 2 个冒烟测试。
- **依赖**：M2。

### M4：venture-resume.js + /venture-resume slash（B 假设）

- **交付物**：venture-resume.js（断点续传）+ commands/venture-resume.md。
- **验收条件（可证伪）**：
  1. 模拟 session 中断（kill 进程）后，`/venture-resume` 读 checkpoint.continue_from + pipeline-state.current_node 恢复到中断前节点。
  2. 续传后 trace.ndjson 追加 resume 事件。
  3. graph_hash 不匹配时续传 exit 1（防止静默漂移）。
- **Claude 实施者工作量**：1 会话 · 4.5k token · 3 个测试。
- **依赖**：M2 + checkpoint 腿（层1 已有）。

### M5：占位节点 dag.json + persona signal 收敛判据

- **交付物**：dag.placeholder.json（M0-M2 引擎验证用）+ references/persona-signal.md（venture-persona 结构化 signal 收敛判据，驳 B-β-5 N6⇄N7 互锁）。
- **验收条件（可证伪）**：
  1. dag.placeholder.json 跑通 8 节点转移拓扑（C7）。
  2. persona-signal.md 定义 signal=green/yellow/red/unknown 四态结构化字段（非 free text）。
  3. N6⇄N7 互锁 MAX_ITER=3 后 persona-signal 收敛（迭代差 < 阈值）。
- **Claude 实施者工作量**：1.5 会话 · 3k token · 2 个测试。
- **依赖**：M2。

---

## §4 所需 skills 清单（假设1 推论4 · 消费 Phase 0 能力清单）

> 每个 skill **必须标在哪步用**，不可只列名字。

| Skill | 用途 | 用在哪步 |
|-------|------|---------|
| **cc-runtime** | 层1 地基（atomicWriteJSON + direction.set + checkpoint 腿）| M1/M2/M4 require 引入 init-state.js + shift-direction.js |
| **cc-loop** | 循环合同（六要素 + 护栏三件套）+ /loop 执行模式 | M3 SKILL.md 定义节点循环套此合同；M4 续传后 /venture-resume 内部套 /loop |
| **cc-goal** | 终态条件（五层模型 + 自评通过 + 可证伪）| M2 advance-node.js 每节点退出条件设计；M3 验证闸衔接 cc-goal |
| **cc-orchestration** | 编排决策树 + 编排循环五字段（AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY）| M2 loop_back N6⇄N7 互锁编排；M3 SKILL.md 编排核心定义 |
| **cc-config** | 六层配置 + 锚文件体系 | M3 pipeline-state.json 落地层；SKILL.md 锚文件设计 |
| **cc-context** | 上下文健康 + 持久化策略 | M4 断点续传的上下文恢复策略 |
| **skill-creator** | 新建 skill 骨架 | M3 venture-pipeline/SKILL.md 初始化 |
| **superpowers:test-driven-development** | TDD 红→绿→重构 | M0-M2 每脚本先写测试 |
| **superpowers:verification-before-completion** | 完成前验证 | 每里程碑验收闸 |
| **cc-2pp** | 两阶段设计决策（本计划本身的方法论）| M0-M5 设计决策引用 50-decision |

**不需要的 skill**：cc-memory（层2 不动记忆系统）/ cc-scanner（不扫描技能库）/ claude-coach（不路由）。

---

## §5 执行编排（实施者落地核心）

### 5.1 智能体配置（按里程碑）

| 里程碑 | agent 数 | 类型 | 并行/串行 | 理由 |
|--------|---------|------|-----------|------|
| M0 | 1 | 创造类 general-purpose（opus）| 串行 | dag.json + load-graph 强耦合，单 agent 上下文连贯 |
| M1 | 1 | 创造类 general-purpose（sonnet）| 串行 | pipeline-state.js 依赖 M0，单 agent 即可 |
| M2 | 2 | 创造类 general-purpose（opus）×1 + 探索类 Explore（haiku）×1 | 半并行 | opus 写引擎核心；haiku 并行扫 cc-runtime 脚本接口（B-β-3 证据复用） |
| M3 | 1 | 创造类 general-purpose（opus）| 串行 | SKILL.md + 文档 + H6 注入需连贯上下文 |
| M4 | 1 | 创造类 general-purpose（sonnet）| 串行 | 续传逻辑依赖 checkpoint 腿，单 agent |
| M5 | 2 | 创造类 general-purpose（sonnet）×1 + 探索类 Explore（haiku）×1 | 并行 | sonnet 写 dag.placeholder；haiku 扫 persona-signal 既有判据 |

**总 agent 调用**：8 个（6 创造类 + 2 探索类）。

### 5.2 技能组合（执行期装载）

| 阶段 | 装载 skill | 用途 |
|------|-----------|------|
| M0-M2 编码期 | cc-runtime + cc-loop + cc-goal | 引擎核心三件套 |
| M0-M2 测试期 | superpowers:test-driven-development | TDD 流程 |
| M3 文档期 | skill-creator + cc-config + cc-orchestration | skill 骨架 + 锚文件 + 编排 |
| M4 续传期 | cc-context + cc-loop | 上下文恢复 + /loop 衔接 |
| 验收期 | superpowers:verification-before-completion | 闸门验证 |

### 5.3 执行模式 + 分步

| 里程碑 | /goal 一次性 or /loop 多步 | 步数 | 每步边界 |
|--------|---------------------------|------|---------|
| M0 | /goal 一次性 | 1 步 | dag.json + load-graph.js + 3 测试一气呵成 |
| M1 | /goal 一次性 | 1 步 | pipeline-state.js + schema 文档 + 4 测试 |
| M2 | /loop 多步 | 4 步 | ①node 流转 ②edge 条件 ③loop_back ④HG 触发（每步独立 commit）|
| M3 | /goal 一次性 | 1 步 | SKILL.md + guide + H6 注入连贯写 |
| M4 | /goal 一次性 | 1 步 | venture-resume.js + slash + 3 测试 |
| M5 | /loop 多步 | 2 步 | ①dag.placeholder ②persona-signal（并行）|

> **M2 用 /loop 的理由**：引擎核心是头号 autocompact 风险点（2 会话 6k token），/loop 护栏（最大迭代 4 / 无进展检测 / 预算上限）防 thrashing。

### 5.4 worktree 并发分配（槽位 ≤ 2 可排队）

| 里程碑/任务 | 进 worktree? | 槽位 | 分支名 | 依据（依赖关系）|
|------------|-------------|------|--------|----------------|
| M0 | 否（主干）| - | - | 无依赖，主干直接做 |
| M1 | 否（主干）| - | - | 依赖 M0（主干已合）|
| M2 | **是** | 1 | `layer2/advance-node` | opus 写引擎；haiku 探索可主干并行只读 |
| M3 | 否（主干）| - | - | 依赖 M2（merge 后）|
| M4 | **是** | 1 | `layer2/venture-resume` | 依赖 M2，可与 M5 并行 |
| M5 | **是** | 2 | `layer2/placeholder-persona` | 与 M4 无依赖，槽位 2 并行 |

**worktree 调度**：M2 单槽 → M3 主干 → M4+M5 双槽并行。

---

## §6 执行协议（闭环反馈落地）

### 6.1 验证闸（表格）

| 步骤 | 验证命令/手段 | 通过判据（可证伪）| 失败动作 |
|------|--------------|------------------|---------|
| M0-load-graph | `node load-graph.js --dag dag.json` | exit 0 + 内存图 JSON | 修 schema → 重跑 |
| M0-字位预留 | dag.json 含 subgraph 字段跑 load-graph | stderr 输出「未实现：subgraph」| 加字位检测分支 |
| M0-graph_hash | 同 dag.json 跑两次 graph_hash | 哈希相等 | 修哈希算法（确定性）|
| M1-init | `node pipeline-state.js init` | 生成 pipeline-state.json + status:active | 检查 atomicWriteJSON |
| M1-set-hg | `node pipeline-state.js set-hg --gate HG1` | status:awaiting_human/gate:HG1 | 修 set-hg 分支 |
| M1-verify | 改 dag.json 后 `pipeline-state.js verify` | exit 1 + graph_hash 不匹配报错 | 修哈希校验逻辑 |
| M2-拓扑 | 占位 DAG 跑 N1→HG2 转移 | 8 节点全流转 | 修 edge 条件评估 |
| **M2-C1 核验** | HG 触发后读 direction.json | **status 仍 'active'/gate 仍 null**（line 126-127）| **STOP：误改 shift-direction.js，git restore 回滚** |
| M2-loop_back | N6⇄N7 跑 4 次 | 第 4 次收敛不再回环 | 修 MAX_ITER 逻辑 |
| M2-回归 | `node shift-direction.test.js` | 18/18 通过 | 修 M2 对 direction.set 调用 |
| M3-面板 | SessionStart 读 awaiting_human | 面板含四要素 ≤ 200 字符 | 重编码面板模板 |
| M4-续传 | kill 进程后 /venture-resume | 恢复到中断前节点 + trace 追加 resume | 修 continue_from 读逻辑 |
| M5-拓扑 | dag.placeholder 跑 8 节点 | 全流转 | 与 M2-拓扑对齐 |
| M5-signal | persona-signal 四态 | 结构化字段非 free text | 修 schema |

**需人工确认才提交的闸**：M2-C1 核验（嫁接1 不可破，需 boss 一眼确认 direction.json 未动）/ M3-面板（P1 最懒，boss 验收面板可读性）。

### 6.2 提交/回滚

```
  ┌──────────────────────────────────────────────┐
  │ 通过闸流程                                     │
  │  验证闸通过 → conventional commit（一步一commit）│
  │  里程碑全闸过 → git tag layer2-M{n}            │
  ├──────────────────────────────────────────────┤
  │ 失败闸流程                                     │
  │  验证闸失败 → git restore <该步文件> 回滚       │
  │  → 重做该步（不累积半成品）                     │
  │  → 连续 2 次失败同一步 → STOP 报 boss           │
  └──────────────────────────────────────────────┘
```

**commit 规范**：`feat(venture-pipeline): M{n}-{module} {描述}` / `test(venture-pipeline): M{n}-{module} {描述}`。

**tag 规范**：`layer2-M0` … `layer2-M5`（每里程碑全闸过打 tag）。

---

## §7 风险清单

### 7.1 autocompact thrashing（本项目头号风险）

- **证据**：00-explore 未直接量化，但 50-decision §5「114k/38 轮 autocompact 下 γ 实际 60+ 轮」证明本项目 autocompact 阈值激进。
- **触发条件**：M2 引擎核心 2 会话 6k token + /loop 4 步累积。
- **缓解**：
  1. M2 用 /loop 多步（每步独立 commit + 验证闸，防上下文累积）。
  2. 每步 commit 前跑 shift-direction.test 回归（防 compact 丢状态）。
  3. 上下文健康检查（cc-context skill）每会话开场跑。
- **失败信号**：连续 2 步 /loop 无进展 → 触发护栏 STOP。

### 7.2 嫁接1 误改 shift-direction.js（C1 不可妥协）

- **证据**：shift-direction.js line 126-127 硬编码 status:'active'/gate:null，是嫁接1 的物理前提。
- **触发条件**：M2 advance-node.js 误把 HG 语义写进 direction.set 调用。
- **缓解**：
  1. M2-C1 验证闸（HG 触发后读 direction.json 必须仍 'active'）。
  2. advance-node.js HG 分支**禁止**调 direction.set（只调 pipeline-state.set-hg）。
  3. code-review 专项检查（code-reviewer agent 扫 direction.set 调用点）。
- **失败动作**：git restore 回滚 + 重写 HG 分支。

### 7.3 7×24 B 假设若 boss 选 A 的追加项

- **证据**：50-decision §6「ScheduleWakeup 休眠不触发」。
- **B 假设（本计划默认）**：session 级断点续传，M4 交付 venture-resume 即满足。
- **若 boss 选 A（严格 wall-clock 7×24）追加项**：
  1. 新增云端常驻子项目（独立于 β' 引擎）。
  2. venture-resume 改为 OS 唤醒触发（cron job / systemd timer）。
  3. 追加工作量：约 3-5 会话 · 15k token（云端部署 + 调度）。
- **推进策略**：本计划按 B 写，boss 汇报时拍板；若 A 追加独立子项目不阻塞 β'。

### 7.4 C5 字位预留误用

- **证据**：γ 否决① subgraph/fan_out 首发零调用零验证。
- **缓解**：load-graph.js 遇 subgraph/fan_out 必须 stderr 报「未实现」（C5），严禁写运行时代码。
- **失败动作**：若有人误实现 → 降级回 β'（删运行时代码，留字位）。

### 7.5 C7 偷藏阻塞

- **证据**：50-decision §7 C7 驳 C-[7] 偷藏业务阻塞。
- **缓解**：M0-M2 引擎交付 = 占位 DAG 跑通（dag.placeholder.json），层3 N5-N8 业务 skill 是独立后续。
- **失败动作**：若 M0-M2 试图实现真实业务节点 → STOP，退回占位。

---

## §8 下一步行动（今天能做的第一件事）

```
  今天第一件事（M0 启动）
  ┌─────────────────────────────────────────────┐
  │ 1. 新建 .claude/skills/venture-pipeline/    │
  │ 2. 写 dag.json schema（三原语 + 字位预留）   │
  │ 3. 写 load-graph.js（解析 + 字位报未实现）   │
  │ 4. TDD：先写 load-graph.test.js（红）        │
  │ 5. 跑 M0 三验证闸（load-graph/字位/hash）    │
  │ 6. 全闸过 → git tag layer2-M0               │
  └─────────────────────────────────────────────┘
  预估：1 会话 · 3.5k token · 3 测试
  衔接：M0 通过后 → M1（pipeline-state.js）
```

---

## §9 约束对照（C1-C7 自检）

| 约束 | 本计划体现位置 | 状态 |
|------|--------------|------|
| C1 shift-direction.js 零改动 + HG 独占 pipeline-state | §6.1 M2-C1 核验闸 / §7.2 风险 | ✓ |
| C2 纯 Node fs 禁 vm/eval/Function | §1.2 技术选型 / §2.1 复用 atomicWriteJSON | ✓ |
| C3 0 新 hook 复用 H6 | §3 M3 H6 注入逻辑 | ✓ |
| C4 度量禁人天 | §2 全程会话·token | ✓（零人天）|
| C5 subgraph/fan_out 字位预留遇即报未实现 | §6.1 M0-字位预留闸 / §7.4 风险 | ✓ |
| C6 graph_hash 内置 cc-runtime 不碰全局 hook | §3 M1 graph_hash 校验 / §4 cc-runtime skill | ✓ |
| C7 引擎交付 = 转移拓扑跑通占位节点 | §3 M5 dag.placeholder / §7.5 风险 | ✓ |

---

**计划状态**：✅ 已落盘。衔接 → 70-requirements.md（保姆级需求清单）+ cc-loop（执行协议验证闸）。
