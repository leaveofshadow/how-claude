# 50-decision.md — 层2 工作流引擎 · 最终裁决（Phase 3 落盘）

> **运行目录**：`.2pp/2026-06-16-layer2-workflow-engine/`
> **日期**：2026-06-17
> **决策模式**：cc-2pp 模式 C（判官小组 → Top 2 对抗验证 → 综合裁决）
> **裁决依据**：[00-explore.md](./00-explore.md)（探索+Q1-Q4 用户决策）→ [30-score.md](./30-score.md)（评分 α=80/β=76/γ=66，Top2={β,γ}）→ [20-attack-{A,B,C}.md](./20-attack-A.md)（28 攻击点，0 失败）→ [40-synthesis.md](./40-synthesis.md)（编排者真综合）
> **交付对象**：boss（决策确认）+ 下游 Phase 4（实施计划）+ cc-loop（循环执行衔接）

---

## §1 裁决一句话

> **裁决方案 = β'（嫁接融合体）**：三原语（node/edge/loop_back）+ dag.json 数据驱动 + pipeline-state.json 独占 HG 停等（嫁接1）+ shift-direction.js **零改动** + 嫁接 γ 的 graph_hash + 接口预留 subgraph/fan_out。
>
> **一句话理由**：对抗验证把 4 条 CRITICAL / 3 攻击者收敛到「双文件 HG 协同」单根，嫁接1（HG 状态职责重新分配）一次性消解；同时嫁接让 β' 既通用（满足 Q4）又零改动（吸收 α 优势），居裁决首位（修正分 79），γ 降级并入、纯 α 否决（违反 Q4）。

---

## §2 核心架构决策（β' 定稿）

### 2.1 三原语

| 原语 | 声明位置 | 职责 |
|------|---------|------|
| `node` | dag.json | DAG 节点（id/type/绑定 skill/退出条件） |
| `edge` | dag.json | 流转（from→to + 条件：signal/green\|yellow\|red\|unknown；**HG 折叠为带停等的特殊 edge**） |
| `loop_back` | dag.json | 收敛循环（N6⇄N7 互锁，MAX_ITER=3，结构化 signal 收敛） |

> **关键取舍**：β 的 `human_gate` 原语**折叠**进 edge（条件=awaiting_human 触发）+ pipeline-state.gate 字段，不单列——HG 本质是"带停等的特殊 edge"，单列徒增认知负荷。

### 2.2 状态职责分配（嫁接1 — 裁决的核心基石）

```
direction.json     ← 回归纯"业务方向指针"（层1 frozen-v1 零改动）
                     永远 status:'active', gate:null（shift-direction.js line 126-127 硬编码）
                     只随 direction.set 换向

pipeline-state.json ← 独占 HG 停等 + 节点推进（层2 新文件，Q2 已决）
    字段: direction_version / current_node / frontier[] / iteration /
          status(active|awaiting_human) / gate(null|HG1|HG2) /
          graph_hash / history[]

层2/层3/H6 读"是否 HG 停等" → 读 pipeline-state.status（非 direction.status）
```

**frozen-v1 兼容性**（编排者核验 shift-direction.js 全文坐实）：零改动 shift-direction.js / 零新建层1 写者 / INV-1 不受影响 / 0 新 hook（HG 注入仍走 H6 SessionStart，读源切到 pipeline-state）/ INV-3 退化为"预留但闲置"死不变量（文档标注，非破坏）。

**为什么嫁接1 是回归而非绕过**：line 126-127 硬编码常量证明层1 原始设计意图就是「direction.json 只表达活跃方向，HG 语义本就不该在此」。β 原方案把 HG 塞进 direction 是违背层1 意图的强行扩展，嫁接1 回归正轨。

### 2.3 通用性边界（诚实定位，回应 M-β-③ 伪通用攻击）

```
β' 通用 = 转移拓扑层（引擎不硬编码业务）:
  ✓ node 流转 / edge 条件 / loop_back 收敛 / HG 触发 —— 引擎驱动
  ✓ 换 DAG（层3 8节点 → 未来其他 venture）只改 dag.json，引擎代码不动

β' 专属 = 业务语义层（由 dag.json 声明 + 节点 skill 兑现）:
  ✗ HG 具体问题文本 / 收敛判据 / signal 字段语义 —— 不进引擎代码
```

---

## §3 理由（为什么是 β'，逐条对齐 charter + Q1-Q4）

| 决策维度 | β' 如何满足 | 对抗验证的修正 |
|---------|------------|---------------|
| **Q4 通用引擎**（用户拒绝专用）| dag.json 数据驱动，三原语，换 DAG 不改代码 | C 提议 α+嫁接即期最优 → 但 α 违反 Q4，β' 既通用又零改动化解（§5 of 40-synthesis）|
| **Q2 pipeline-state.json**（用户已决新增）| 承载节点推进 + 独占 HG（嫁接1）| β 原方案双写竞态（F2）→ 嫁接1 单写点消解 |
| **Q3 /loop+ScheduleWakeup 自调度**| 节点循环套 /loop；跨 session 续传靠 checkpoint+pipeline-state | C-[3] 揭露 ScheduleWakeup 休眠不触发 → 见 §6（charter 层）|
| **Q1 混合形态**（脚本骨架+agent 填肉）| venture-pipeline 骨架=确定性脚本（驱动 dag.json），节点=agent（套 /loop）| — |
| **charter P1 最懒**| HG 面板重编码成 boss 一眼可决策（signal+RedFlag+推荐动作）；嫁接1 消除手动修复 | β 原方案 INV-8 双文件"手动修复"违反 P1 → 嫁接1 消解 |
| **charter P2 三段论**| DAG=转换编排（层2 本质职责）| — |
| **charter C2 纯 Node fs**| 所有脚本 require('fs')+require('path') only | γ 的 evalEdge/safeEval 违背 → 整块砍除（C-γ-②）|
| **基线层 0 新 hook**| HG 注入复用 H6 SessionStart | γ 的 graph_hash 原依赖扩展 compact-snapshot 全局 hook → 改内置 cc-runtime（驳 B-γ-4）|

---

## §4 否决方案 + 否决原因

### 否决①：γ（六原语 + tick 推进 + evalEdge）

**否决原因（三方 CRITICAL 一致）**：

| 攻击点 | 来源 | 致命性 |
|--------|------|--------|
| subgraph/fan_out 首发零调用零验证 | A-[γ-1] + C-[1][2] | CRITICAL — 违反 effort=max ≠ 造未验证特性 |
| evalEdge/safeEval 自造解释器违背 C2 | A-[γ-2] + B-[γ-1] | CRITICAL — charter 硬约束被破 + 工作量 10× 低估（15-25k vs 估 6k）|
| 114k/38 轮 autocompact 下实际 60+ 轮 | B-[γ-2] | CRITICAL — 本项目 autocompact thrashing 实测，γ 必崩 |
| ROI 负 + 编排力造假（fan_out 首发 reserved 不付编排收益）| C-[1][2][5] | CRITICAL — 即期必然降级 β |

**γ 残值（嫁接进 β'）**：graph_hash（防静默漂移）+ subgraph/fan_out **schema 字位预留**（遇即报"未实现"，零运行时代码/零测试/零 frozen INV）。

### 否决②：纯 α（二原语，专用）

**否决原因**：违反 Q4。α 二原语（node+transitions）无 dag.json 数据驱动，换 DAG 需改代码 → 与用户"通用工作流引擎"决策根本冲突。编排者不重新质疑 Q4（对抗修正初判盲点，不推翻用户明确架构决策）。

**α 残值（嫁接进 β'）**：零改动优势 —— 嫁接1 让 shift-direction.js 也零改动，β' 吸收 α 的 28k 基线成本优势。

### 修正后排名（含残值嫁接）

| 排名 | 方案 | 修正分 | 入选 |
|------|------|--------|------|
| ① | **β'** | **79** | ✓ 裁决 |
| ② | α（违反 Q4）| 78 | ✗ 否决② |
| ③ | β（原始，已被 β' 取代）| 74 | — |
| ④ | γ（三方否决）| 64 | ✗ 否决① |

---

## §5 对抗验证摘要

| 指标 | 结果 |
|------|------|
| 攻击者产出 | A（架构，9点）+ B（实现+测试，10点）+ C（产品+运维，9点）= **28 攻击点全部有效落盘** |
| 失败 agent | **0**（3/3 成功，无需 retry，无降级自检）|
| 收敛度 | **高** — γ 存废三方一致；β 存废三方一致；分歧仅在嫁接细节 |
| 有效 CRITICAL | 4 条（归并 2 根：双文件 HG 协同 + γ 编排力超前）→ 全部消解/降级 |
| 有效 MAJOR | 6 条（全部纳入 β' 修复）|
| 独家增量 | C（charter 7×24 + α+嫁接张力）/ B（层1 代码深挖 B-β-3，编排者核验坐实）/ A（架构归并 F2+γ 双 CRITICAL）|
| 度量合规 | A/B/C 全程 Claude 实施者度量（token/轮次），无人天偷渡 |

---

## §6 ⚠️ charter 层待 boss 拍板项（不阻塞推进）

### 7×24 单机重定义（C-[3] 独家揭露）

**问题**：ScheduleWakeup/CronCreate durable 在笔记本休眠时不触发；durable 持久化 ≠ 补跑错过 tick。单机 OPC 语境下，wall-clock 7×24 实质降级为"boss 在线时推进"。

**为何不阻塞**：7×24 是"运行时调度策略"（谁来唤醒引擎），非"引擎架构"（引擎如何流转节点）。无论怎么定义，β' 都是最优基底。层2 只需提供**断点续传能力**，不解决"谁来按表唤醒"（那在层2 之外：OS 唤醒/云端/boss 手动）。

**编排者建议（供 boss 决策）**：

| 选项 | 含义 | charter 一致性 | 倾向 |
|------|------|---------------|------|
| A. 严格 wall-clock 7×24 | 休眠也推进 | ✗ 需常驻/云端，违反单机 | — |
| **B. 会话级断点续传** | session 结束可续，boss 唤醒后 `/venture-resume` | ✓ 单机+OPC 一致，诚实 | **推荐** |
| C. 混合（关键节点上云）| 选定节点常驻 | ✗ 违反纯原生 | — |

> **推进策略**：Phase 4 按 **B 假设**编写（断点续传能力必交付）。boss 最终汇报时拍板；若选 A，后续追加云端常驻子项目（独立于 β' 引擎）。

---

## §7 关键约束（实施期不可妥协，反认知漂移）

| # | 约束 | 来源 |
|---|------|------|
| C1 | shift-direction.js 零改动；HG 语义独占 pipeline-state.json（嫁接1）| 裁决 + 编排者核验 |
| C2 | 所有层2 脚本 require('fs')+require('path') only，禁 vm/eval/Function/SDK 子进程 | charter |
| C3 | 0 新 hook（基线层）；HG 注入复用 H6 SessionStart | 层1 基线约束 |
| C4 | 工作量度量用 token/轮次/skill配置/验证，**禁人天**（出现即返工）| cc-2pp 假设1 |
| C5 | dag.json schema 允许 subgraph/fan_out 字位，但引擎首发遇即报"未实现"（纯数据预留）| γ 降级嫁接 |
| C6 | graph_hash 校验内置 cc-runtime SessionStart 读 pipeline-state，**不碰全局 compact-snapshot hook** | 驳 B-γ-4 |
| C7 | 引擎交付（M0-M2）= 转移拓扑跑通（占位节点）；层3 业务 skill（N5-N8）是独立后续 | 驳 C-[7] 偷藏阻塞 |

---

## §8 下一步 → Phase 4

1. **创造类 agent（opus）基于本裁决产出双文件**：
   - `60-impl-plan.md`（编排契约：技术选型确认含 ROI / 模块拆分 / 里程碑 / 所需 skills 清单（每 skill 标在哪步用）/ 执行编排（智能体配置+技能组合+执行模式+worktree 分配）/ 执行协议（验证闸+提交回滚）/ 风险清单 / 下一步）
   - `70-requirements.md`（保姆级需求清单：R{M}.{n} 每项含 做什么/输入触发/输出交付/可证伪验证/依赖/预估（会话·token）；禁"实现 X 功能"模糊）
2. **按 B 假设写**（断点续传能力必交付，7×24 待 boss 拍板）
3. **编排者校验双文件齐全**：70 每里程碑至少有需求项 + 每项有可证伪验证；缺则 retry
4. 衔接 cc-loop：60 的验证闸 → cc-goal 终态条件 → `/loop`

---

**裁决状态**：✅ 已落盘（β'）。Phase 3 完成。→ Phase 4 启动（60+70 双文件）。
