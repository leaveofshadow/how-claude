---
run: 2026-06-16-venture-automation-architecture
phase: 2
artifact: synthesis
title: 判官综合（judge）—— 全面 hcc 化框架下的方案重定位 + Top2 对抗目标
author: 编排者（judge）
created: 2026-06-16
status: draft
direction_version: 1
---

# 判官综合：3 视角融合为 hcc 新技能体系蓝图

> **前提变更**：D7「全面 hcc 化」让 3 个判官方案从"3 个 venture 系统"重定位为"3 个 hcc 技能切分视角"。本综合不再"淘汰一个 venture 系统"，而是**把 3 视角映射到 hcc 新技能的不同层**，并在层1 内部裁决"状态主导 vs Hook 主导"。

---

## 1. 3 方案 → hcc 技能映射

| 判官方案 | 视角 | 沉淀为 hcc 技能的层 | 核心交付物 |
|---------|------|-------------------|-----------|
| **方案1** 状态中心 | 架构组(opus) | `cc-runtime` **状态/数据层** | checkpoint/trace/direction/tasks 四文件 schema（§2.1-2.3）+ 层间接口契约 V1（§1.2）+ 与 OMC state 隔离边界（§2.6）+ 复用边界表（§2.5） |
| **方案2** Hook驱动 | 运维组(sonnet) | `cc-runtime` **确定性执行层**（≈ cc-config 的 Hook 扩展） | 8 Hook 总表（§3.1）+ PreToolUse 机制级拦截痛点4（§3.4）+ 与 compact-snapshot 范式统一（§3.1 设计原则）+ defense in depth（Stop 兜底） |
| **方案3** 流水线优先 | 产品组(opus) | `cc-venture` **业务编排层** | 8节点 DAG（§2.1）+ 每节点产物契约 jsonld_header（§2.2）+ judge 接入三轴流水线化（§2.4）+ human gate 3动词状态机（§2.3）+ 缺口节点新建 venture-persona/requirements/pipeline（§2.5） |

**洞察**：方案1 和方案2 **都贡献 `cc-runtime`**（一个给状态模型，一个给 Hook 实现），不冲突；方案3 **独占 `cc-venture`**（另两方案未深度触及业务流水线）。3 视角天然分层互补。

---

## 2. 层1 取舍：cc-runtime 谁主导？（方案1 vs 方案2）

### 2.1 核心分歧

- **方案1 状态中心**：统一 store 是脊梁，Hook 是 store 的"强制写者"；痛点4 靠 agent **读** `direction.current()` 拿当前方向。
- **方案2 Hook驱动**：Hook 是闸，状态是 Hook 写出的副产物；痛点4 靠 PreToolUse hook 在 agent **读旧文件那一刻拦截**。

### 2.2 判决矩阵

| 维度 | 方案1 状态中心 | 方案2 Hook驱动 | 判决 |
|------|---------------|---------------|------|
| **痛点4 解法彻底度** | agent 读指针（残留"记得读指针"依赖） | PreToolUse 机制级拦截（零 agent 自觉，连读都拦） | **方案2 胜** |
| 与 2pp 假设2（agent 会漂移）契合 | 中（读靠 agent） | **高（Hook 既写又拦）** | 方案2 |
| 与 cc-config「自动行为必须 Hook」契合 | 中 | **高** | 方案2 |
| 状态 schema 完备性 | **高**（四文件 schema 详尽） | 中（checkpoint 趋同方案1，未独立论述 state 边界） | 方案1 |
| OMC 隔离边界分析 | **有**（§2.6 隔离为主单向桥接） | 弱 | 方案1 |
| Hook 覆盖面 | 4 个 | **8 个** | 方案2 |
| 已验证范式复用 | 中 | **高**（与 compact-snapshot-write/restore 统一） | 方案2 |

### 2.3 判决：层1 = 方案2 Hook 架构主导 + 方案1 状态 schema 嫁接

> **方案2 定"怎么写 / 怎么拦"，方案1 定"写到什么 schema / 与 OMC 怎么隔离"。**

- **采用方案2**：8 Hook 体系（含 PreToolUse 机制级拦截痛点4）、Hook 设计六原则（静默exit0/stdin10s超时/session_id防护/字段结构识别/additionalContext注入/与compact-snapshot统一）、defense in depth（Stop 兜底）。
- **嫁接方案1**：checkpoint/trace.ndjson/direction.json/tasks.tree.json 四文件 schema（方案1 §2.1-2.3 已详尽，方案2 §3.2 趋同）、层间接口契约 V1、与 OMC state 隔离边界（方案1 §2.6 隔离为主单向桥接）、复用边界表（方案1 §2.5 autopilot骨架+ralph语义+新建direction/Hook）。

**理由**：痛点4 是本次两大痛点之一，方案2 的 PreToolUse 是**唯一从机制上消灭"agent 记得"**的解法（拦的就是 agent 的读操作本身）；方案1 的"agent 读指针"仍有漂移残留。状态层二者趋同，嫁接零成本。

---

## 3. 层3 取舍：cc-venture = 方案3 独占

方案3 是唯一深度设计 8 节点业务流水线的视角，独占 cc-venture。核心采用：

- **8节点 DAG**（N1调查→N2竞品→N3计划→HG1→N4judge→HG2→N5产品设计→N6画像⇄N7需求→N8UIUX）
- **产物契约 jsonld_header**（每节点 in/out schema，层2 校验，抗变化稳定面）
- **judge 接入三轴流水线化**（创始人/投资人/一人公司都跑，信号灯系统仲裁；评判卡 signal/go_score 作 N5 是否开工的路由控制信号——方案3 独到洞察）
- **human gate 3 动词**（继续/换向/放弃），pipeline-state.json 自动判断分支
- **缺口节点新建**：venture-persona / venture-requirements / venture-pipeline

---

## 4. Top 2 对抗目标确定

| 标签 | 对抗目标 | 来源 | 对抗焦点 |
|------|---------|------|---------|
| **A** | 层1 cc-runtime 融合设计 | 方案2主导 + 方案1嫁接 | Hook 可靠性（matcher/网关/timeout）、双 state 读错家、纯推理节点 progressHash、Windows 原子 rename、Stop exit2 被绕过/被禁用、**身份张力（技能"说完即走" vs venture 7×24）** |
| **B** | 层3 cc-venture 业务流水线 | 方案3 | judge 误判传错下游（案例库偏差假🟢）、契约不匹配（新建 skill 字段命名）、HG 体验差致放弃（7天丢状态）、三轴 merge 仲裁、N6⇄N7 互锁死循环、**技能粒度过细致 hcc 失焦** |

**对抗不碰全景**（全景三层 3 方案趋同），集中火力攻层1/层3 的深度部分（地基 + 业务，痛点3/4/自动化主体）。

---

## 5. hcc 新技能体系雏形（裁决后实施目标）

```
.claude/skills/（hcc 扩展：8 方法论 + N 业务/运行时）
│
├── [原 8 方法论技能不变] cc-loop/cc-goal/cc-orchestration/cc-config/
│   cc-context/cc-scanner/cc-memory/cc-2pp
│
├── cc-runtime/                      ← 方案1+2 沉淀（层1，解痛点3/4通用方法论）
│   ├── SKILL.md                     路由器式：诊断"我的长会话丢了状态/读错方向"→给配方
│   └── references/
│       ├── state-schema.md          ← 方案1 §2.1-2.3（四文件 schema）
│       ├── hook-templates/          ← 方案2 §3.1（8 Hook 脚本骨架）
│       ├── omc-isolation.md         ← 方案1 §2.6（与 .omc 隔离边界）
│       └── reuse-boundary.md        ← 方案1 §2.5（autopilot/ralph 复用）
│
├── cc-venture/                      ← 方案3 沉淀（层3，venture旗舰示范）
│   ├── SKILL.md                     8节点 DAG 路由 + human gate
│   └── references/
│       ├── node-contracts/          ← 方案3 §2.2（8节点 jsonld_header 契约）
│       ├── judge-routing.md         ← 方案3 §2.4（评判卡作路由信号）
│       └── gate-state-machine.md    ← 方案3 §2.3（3动词 pause/resume）
│
├── venture-persona/                 ← 方案3 §2.5 新建（N6 缺口节点）
├── venture-requirements/            ← 方案3 §2.5 新建（N7 缺口节点）
└── venture-pipeline/                ← 方案3 §5.3 新建（层2 编排核心）
```

**身份张力预案**（对抗头号靶）：hcc 技能本应"被咨询即加载、说完即走"，但 venture 要 7×24。预案解法——**cc-runtime/cc-venture 教的是"怎么搭 + 配置配方"，7×24 运行由 autopilot/ralph/Hook（Claude Code 原生能力）驱动，不是技能本身常驻**。技能是"装配手册 + 配方"，装配后由原生循环跑，技能仍按需加载。此解法须经对抗检验。

---

## 6. 待对抗验证的关键假设（给攻击者的靶子清单）

**层1（A）**：① PreToolUse 可靠拦截旧文件读 ② Stop exit2 真能阻塞退出 ③ 双 state 隔离不让 agent 读错家 ④ 纯推理节点 progressHash 不误判 ⑤ Windows 原子 rename 可靠 ⑥ 身份张力解法成立。

**层3（B）**：① judge signal 准确作路由信号 ② 产物契约字段稳定可消费 ③ human gate 体验不致放弃 ④ 三轴 merge 仲裁合理 ⑤ N6⇄N7 互锁不死循环 ⑥ 技能粒度不让 hcc 失焦。

---

## 7. 下一步

派 2 个 opus critic（对抗思维）并行攻击 A、B → 落盘 `20-attack-A.md` / `20-attack-B.md` → 据攻击结果裁决（Phase 3 `50-decision.md`）。
