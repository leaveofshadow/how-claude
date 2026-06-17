---
run: 2026-06-16-venture-automation-architecture
phase: 3
artifact: decision
title: 裁决——全面 hcc 化框架下的实施定型（层1 先行）
author: 编排者（judge 综合）
created: 2026-06-16
status: decided
direction_version: 1
inputs:
  - 3 判官方案（10-plan-1/2/3）
  - 2 对抗报告（20-attack-A REVISE / 20-attack-B REVISE）
  - 用户决策 D8a（层3 C1=新建 extractor）/ D8b（节奏=层1 地基先行）
---

# 裁决：venture 自动化三层架构 → hcc 新技能体系（层1 先行）

> **裁决性质**：综合独立 critic 对抗结果 + 用户形态决策的收敛，非编排者单方批准。方案出自判官、攻击出自 critic、形态出自用户——编排者只做编排收敛。

---

## 0. 裁决输入摘要

| 输入 | verdict | 采纳 |
|------|---------|------|
| 方案1 状态中心（架构组 opus） | — | schema 嫁接到层1 |
| 方案2 Hook驱动（运维组 sonnet） | attack-A: REVISE（2 致命可修补） | 层1 主导方向（附修订条款） |
| 方案3 流水线优先（产品组 opus） | attack-B: REVISE（C1 改形态） | 层3 独占（附 extractor 修订，延后） |
| 用户 D8a | C1 三选一 | **新建 venture-judge-extractor** |
| 用户 D8b | 推进节奏 | **层1 地基先行** |
| 用户 D9（宪章） | 项目根约束 | 见 §0.5，对齐 `00-charter.md` |

---

## 0.5 根约束对齐（项目宪章 charter 锚定，2026-06-16 补）

> 完整宪章见 `00-charter.md`。以下为裁决须遵守的根约束（D9）：

- **部署硬约束（单机/单人/单 Claude/7×24）**：层1 组件必须**本地可跑**，不引入服务器/集群/外部 AI。所有 agent 角色都是 Claude 分饰（subagent/skill）。→ Phase4 选型禁区：任何需联网服务/外部模型的组件。
- **验收根补收益维度（charter 阶段标准）**：层1 验收 = 技术验收（不丢状态/不读旧方向）+ **收益指向**（解锁的层3 流水线能跑出可变现方向）。纯基础设施阶段也须回答「这如何指向收益」。
- **human gate 最懒原则（charter P1）**：HG1/HG2 不是把无解态丢给 boss 苦思，而是把信息**解码重编码成「boss 一眼可决策」的面板**。→ 调和 attack-B M3「原样送 HG2」与「最懒」的张力：送的是**已重编码的决策面板**（信号 + top RedFlag + 推荐动作），非原始三轴数据堆。
- **创新不降级（charter 创新倾向）**：D8a 选 extractor 的内因 = 热爱创新。emoji 解析脆弱性用工程稳健（锚定结构化位置）兑现，不退回人工读卡。
- **世界最好维度（charter P3）**：Phase4 每个 Hook/schema/面板产出要标注「哪个维度力求世界最好」，至少一维。

---

## 1. 层1 cc-runtime 裁决：方案2 Hook 主导 + 方案1 schema 嫁接

**方向不推翻**——attack-A 的两个致命点是工程确定性可修补，不是架构否定。痛点4 的 PreToolUse 机制级拦截（拦的就是 agent 的读操作本身）仍是方案2 相对方案1「agent 读指针」的实质优势。

### 1.1 采用（方案2 主导）
- **8 Hook 体系**：H1 PreToolUse（拦截旧文件读，痛点4）/ H2-H3 PostToolUse（写 checkpoint+trace）/ H4 Stop（降级，见 C1 修订）/ H5 PreCompact / H6 SessionStart / H7 SubagentStop / H8 UserPromptSubmit（方向变更探测）
- **Hook 设计六原则**：静默 exit 0 / stdin 10s 超时 / session_id 防护 / 字段结构识别 / additionalContext 注入 / 与 compact-snapshot 范式统一（收窄，见 C2 修订）
- **痛点4 机制级拦截**：H1 PreToolUse matcher 命中旧 direction 的文件读 → 注入「此文件已被 superseded」提示

### 1.2 嫁接（方案1 schema）
- **四文件 state schema**：`checkpoint.json` / `trace.ndjson` / `direction.json` / `tasks.tree.json`（方案1 §2.1-2.3 已详尽）
- **层间接口契约 V1**（方案1 §1.2）
- **与 OMC state 隔离边界**（方案1 §2.6：隔离为主、单向桥接）
- **复用边界表**（方案1 §2.5：autopilot 骨架 + ralph 语义 + 新建 direction/Hook）

### 1.3 C1 修订条款（致命，ACCEPT 前置）
**Stop exit2 因三重退化（block cap / UI 误显示 / 偶发无视）不能当确定性闸。修订：**
- **痛点3 兜底迁移到 PreCompact（H5）**：checkpoint 记 `stagnation_count`，连续 N 轮无进展在 checkpoint 标 BLOCKED，SessionStart（H6）注入提示。exit 0 永远放行，无 block cap。
- **human gate 改 awaiting 状态文件**：不靠 Stop exit2 阻塞。写 `direction.json: {status: "awaiting_human", gate: "HG1"}`，H6 SessionStart 注入「等待用户 continue」，agent 自然停在等输入。
- **H4 Stop 降级**为「尽力而为提示闸」：1 轮提示不阻塞，连续 N 轮才标 BLOCKED，避免撞 cap。

### 1.4 C2 修订条款（致命，ACCEPT 前置）
**compact-snapshot 范式只验证过 PreCompact/SessionStart 2 个事件，6/8 Hook 跨事件迁移零背书。修订：**
- **范式定位收窄**为「H5 PreCompact + H6 SessionStart 样板」。明确 H1/H2/H3/H4/H7/H8 需独立设计 + 独立验证。
- **成本重估**：2 复用（各 1 轮）+ 6 新建（各 3-4 轮含调试）≈ **26 轮**（非原估 16 轮）。
- **plan 附真实脚本片段**：`~/.claude/hooks/compact-snapshot-write.js` 关键片段（exit0 守卫 / stdin 读取 / session_id 防护）。
- **H1-H8 约束纯 Node fs**，禁用任何 SDK 子进程调用（compact-snapshot 范式本身成立，但 plan 未声明，补上）。

### 1.5 M1-M4 缓解条款（严重，进 plan）
- **M1**（progressHash 误判推理节点）：基于 `(node, iter, step_index)` 三元组，非文件 hash；trace 增 `reasoning_step` 类型。
- **M2**（matcher 漏配 MCP + Bash 绕过）：matcher 加已知 MCP 文件工具名；Bash 旧文件读取由 H6 SessionStart 方向提示兜底（H1 拦不住 Bash，但提示可纠偏）。
- **M3**（三套 state 并存）：venture 委派 subagent 时用 `VENTURE_TRACE_FILE` 环境变量指定 trace 落点，省跨目录回收。
- **M4**（Windows rename 竞态）：direction 写用符号链接指向 `direction-v{N}.md`（切换只改链接），或 SessionStart 读时 `FILE_SHARE_READ`。

### 1.6 层1 ACCEPT 条件（进 Phase4 实施计划的前置 gate）
- [x] C1 修订：兜底迁 PreCompact + human gate 改 awaiting 文件 ✅ 已定方向
- [x] C2 修订：范式收窄 + 成本 26 轮 + 附脚本 ✅ 已定方向
- [x] **G1 前置实验** ✅ 闭合（信息收集非探针，2026-06-16）：社区四证（#34600 UI 误显 / #10412 安装方式依赖 / Reddit Windows 失效 / HN 4.7 ignoring）证 exit2 on Stop 不可靠，其中 Windows 失效对我们（Win11）致命 → C1「零 exit2」必然。详见 `docs/superpowers/specs/2026-06-16-block-cap-probe-result.md`。本地探针降级可选（非阻塞）。G3 副产出：Stop 类 hook 须 `.claude/hooks/` 目录 + settings 双路径（#10412）
- [ ] M2 修订：matcher MCP 补全 + Bash 兜底
- [ ] G2：Hook 失效降级告警机制（连续 N 次异常告警，非静默）
- [ ] G3：身份张力装配协议（技能何时加载 / 配方如何落 settings.json / 落地后技能是否卸载）

---

## 1.7 基线层转向（2026-06-16 修订 · hook 过度收敛）

**触发**：用户重审 charter P1（最懒）质问「hook 是必要的吗？」。结论——§1「8 Hook 主导」对 P1 过度：8 hook = 8 失效点（R2）+ 8 轮装配（G3 未解）+ 8 处 Windows 风险（C1），而痛点3/4 核心价值可用**已验证的 compact-snapshot 双 hook + 文件归档**零新 hook 兑现。

**决策**：层1 默认路径改为「**基线层 = 扩展 compact-snapshot（0 新 hook）+ 换向归档**」，§1.1-1.5 的 8 Hook 体系降为**增强储备**（H2 备选清单，需要时再装配）。
- **痛点3 续跑锚点**：扩展全局 PreCompact hook `compact-snapshot-write.js` 加 Block⑤ 读 `.venture/state/`（direction+checkpoint），compact 快照天然带方向状态；SessionStart `restore.js` 零改动（注入整个 snapshot 正文）。
- **痛点4 不读旧方向**：`scripts/shift-direction.js` 物理归档旧方向目录（`artifacts/v{N}/`→`archived/v{N}/`），旧文件 ENOENT 自然拦截；Block⑤ 同时列 `superseded_paths` 告警。不依赖 H1 matcher（M2 matcher 漏配/Bash 绕过的根因消失）。

**落地证据**（基线层四件套，18/18 测试通过）：
- ✅ 基线-A：`compact-snapshot-write.js` Block⑤ 扩展（向后兼容：非 venture 项目 venture=null 零影响）
- ✅ 基线-B：`compact-snapshot-e2e.test.js` 端到端三场景（兼容性/正确性/健壮性）
- ✅ 基线-C：`scripts/shift-direction.js` + 单测（实现 schema §5 direction.set + INV-1 三件套 + 归档 + INV-4 trace）
- ✅ 真实 auto-compact 快照证明 Block⑤ 工作（`.claude/compact-snapshots/`）

**Hook 降级表**（原 M2-M6，默认路径不再依赖）：

| 原 Hook | 功能 | 基线层替代 | 何时需要原 hook |
|---------|------|-----------|----------------|
| H5 PreCompact | compact 续跑 | ✅ compact-snapshot-write.js Block⑤ | — |
| H6 SessionStart | 方向恢复 | ✅ compact-snapshot-restore.js（零改动） | — |
| H1 PreToolUse | 拦旧方向读 | ✅ shift-direction.js 归档（ENOENT）+ Block⑤ 告警 | 需拦 Bash 读旧文件时（归档拦不住 Bash） |
| H2 PostToolUse | 写 trace/tasks/checkpoint | agent/skill 显式调 init-state + 脚本 | 需自动 trace（非显式）时 |
| H4 Stop / H7 SubagentStop / H8 UserPromptSubmit | 停止/方向探测 | （基线层无） | C1 已证 exit2 on Stop 不可靠，H4 弃用 |

**不变**：C1 零 exit2 · C2 compact-snapshot 范式 · 四文件 schema frozen-v1 · INV-1..6 · 脚本纯 Node fs（M4 原子写）。

> **裁决更新**：§1「方案2 Hook 主导」从层1 默认路径降为**增强选项**。基线层（扩展 compact-snapshot + 归档）是新的层1 ACCEPT 基线。原 §1.1-1.5 的 Hook 体系细节作为「需要时再装配」的储备保留，不删除。

---

## 2. 层3 cc-venture 裁决：方案3 独占 + extractor 修订，延后启动

**方向保留**——方案3 的 8 节点 DAG + 产物契约 + human gate 思路本身成立。C1 是「核心契约建立在虚构上游字段」，修订后架构思路可兑现。但因层3 客观依赖层1 基础设施（D8b），**延后到层1 稳定后启动**。

### 2.1 采用（方案3 核心）
- **8 节点 DAG**：N1 调查 → N2 竞品 → N3 计划 → HG1 → N4 judge → HG2 → N5 产品设计 → N6 画像 ⇄ N7 需求 → N8 UIUX
- **产物契约**（jsonld_header 改为每节点真实 in/out schema，层2 校验）
- **human gate 3 动词**（继续/换向/放弃），pipeline-state.json 自动判断分支
- **缺口节点新建**：venture-persona / venture-requirements / venture-pipeline

### 2.2 C1 修订条款（致命，用户 D8a = 新建 extractor）
**judgment-card.jsonld_header 是方案3 凭空捏造。venture-judge 只产出 markdown emoji 评判卡。修订：**
- **新建 `venture-judge-extractor` skill**：把 markdown 评判卡（🟢🟡🔴 文本）解析成 jsonld `{signal, axis_scores, top_red_flags}`，供 N5 自动路由。
- **N4→N5 链路改为**：`N4 venture-judge（markdown 卡）→ [extractor] → jsonld{signal} → N5 自动路由 if signal==green`。
- **保留「judge 即路由器」卖点**，但承担 extractor 脆弱性（emoji 正则解析需稳健设计：锚定信号灯 emoji 位置 + 七维分数行 + Red Flags 段落结构化提取，而非全文正则）。

### 2.3 M1 修订条款（严重，与 C1 同根必同步）
**案例库 gold 仅 30 条 100% indie 向，对 B2B/硬科技产生假🟢。extractor 只转格式不解决数据源偏差。修订：**
- **judge 加真对抗**：N4 跑 `venture-judge（蓝队）` + `红队 reviewer`，分歧 > 阈值强制 🟡，禁止自动升 🟢。
- **方向类型探测前置**：N4 前探测方向（indie / B2B / 硬科技），非 indie 方向强制输出 ⚠️「案例库覆盖不足，signal 降一级置信」。
- **文档诚实化**：案例库描述改「30 金标 + ~120 参考，均偏 indie/solo」。

### 2.4 M2-M3 缓解条款（严重）
- **M2**（N6⇄N7 互锁无收敛）：显式绑定 `MAX_ITER=3`（第 4 轮强制以当前 persona 为准）；互锁改单向——N6 仅允许收窄 segment 不允许新增，单调收缩保证收敛。
- **M3**（三轴 merge 无解态）：**放弃自动 merge**。三轴 🟢/🟡/🔴 + 各轴 top-2 RedFlag 原样送 HG2 人工裁决（venture-judge 信号灯本就是单轴人工判定，不是聚合函数）。

### 2.5 minor 修订
- **m1**：human gate CronCreate 用 `durable:true`（默认 in-memory 关 session 即失效）。
- **m2**：度量预算计入 N6⇄N7 互锁迭代（6-9 轮 token 翻倍），budget_cap 余量预警。
- **m3**：venture-pipeline 工作量重估（~25k token / 3-4 会话，非 15k）。
- **missing#5**：HG1/HG2 pause 产物完整性自检（事务性写入，防消费残缺产物）。
- **missing#6**：trace.jsonl 进 PreCompact 快照（否则业务记忆回放失效）。
- **missing#7**：「失败跳过」与契约矛盾调和（N4 失败 → extractor 无输入 → 显式标记 `signal:unknown` 走 HG2，非空产物骗过校验）。

### 2.6 层3 ACCEPT 条件（延后，待层1 稳定后）
- [ ] C1 extractor skill 设计 + emoji 稳健解析
- [ ] M1 红队对抗 + 方向类型探测
- [ ] M2 N6⇄N7 收敛护栏
- [ ] M3 放弃自动 merge
- [ ] 层1 接口冻结（direction.json / trace.ndjson schema 稳定）

---

## 3. hcc 技能体系定型（基于裁决更新 40-synthesis §5）

```
.claude/skills/（hcc 扩展：8 方法论 + N 业务/运行时）
│
├── [原 8 方法论不变] cc-loop/cc-goal/cc-orchestration/cc-config/
│   cc-context/cc-scanner/cc-memory/cc-2pp
│
├── cc-runtime/                      ← Phase4 聚焦（层1，解痛点3/4 通用方法论）
│   ├── SKILL.md                     路由器式：诊断"长会话丢状态/读错方向"→给配方
│   └── references/
│       ├── state-schema.md          ← 方案1 §2.1-2.3（四文件 schema）
│       ├── hook-templates/          ← 方案2 §3.1（8 Hook 脚本骨架，含 C1/C2 修订）
│       ├── compact-snapshot-ref.md  ← C2：范式真实覆盖面 + 真实脚本片段
│       ├── omc-isolation.md         ← 方案1 §2.6
│       └── reuse-boundary.md        ← 方案1 §2.5
│
├── cc-venture/                      ← 延后（层3，venture 旗舰示范）
│   └── references/（node-contracts / judge-routing / gate-state-machine）
│
├── venture-judge-extractor/         ← 延后（层3 依赖，C1 修订新建）
├── venture-persona/                 ← 延后（N6 缺口节点）
├── venture-requirements/            ← 延后（N7 缺口节点）
└── venture-pipeline/                ← 延后（层2 编排核心）
```

**身份张力定论**（attack-A 未否定，采纳）：cc-runtime/cc-venture 教「怎么搭 + 配置配方」，7×24 运行由 autopilot/ralph/Hook（原生能力）驱动，技能不常驻。装配协议见层1 G3。

---

## 3.5 D10 部门化对齐（2026-06-16 补）

用户 D10 把 hcc 重塑为「AI 公司员工指南」，组织成 5 部门（决策/产品/开发/运维/销售）。形态定论 = **A 工具箱模型**（见 `00-charter.md` 组织架构段）：

- **部门 = 协作协议层**（新增 `hcc-org/`，定义职责 + plan/review + 交接协议 + 信息源），**技能 = 跨部门工具箱**（§3 技能树原位保留）。
- **对层1 的影响 = 零技术变更**：cc-runtime 即「运维部核心工具」，Phase4 八 Hook / 四文件 schema / 痛点3/4 解法原样适用。部门化是 hcc 上层组织框架，不推翻本裁决任何技术内容。
- **覆盖度缺口（D10 暴露，非阻塞层1）**：决策部/运维部 ✓ 厚实；开发部 ⚠️；**产品部/销售部 ❌ 真空**（N5 产品设计/UIUX、画像/收益转化无技能）→ 待层3 启动补齐。
- **推进节奏不变**（D8b 仍成立）：Phase4 层1 cc-runtime 照常先行；`hcc-org/` 协议层与缺口技能随后/并行。

---

## 4. 推进节奏（D8b = 层1 地基先行）

```
Phase4 现在 → cc-runtime（层1）实施计划 + 保姆级需求
   │  产出：60-impl-plan.md（层1 编排契约）+ 70-requirements.md（保姆级）
   │  聚焦：4 文件 schema + 8 Hook（含 C1/C2 修订）+ G1 前置实验
   ▼
层1 落地 → cc-runtime skill 可用，痛点3/4 通用解法上线
   │  验收：长会话不丢状态 + 方向切换不读旧文件
   ▼
层3 启动 → cc-venture + extractor（待层1 接口冻结）
   │  前置：direction.json / trace.ndjson schema 已稳定
   ▼
venture 旗舰 → 8 节点流水线 7×24 跑通
```

**理由**：venture 流水线的 pause/resume/方向切换/trace 全靠层1 的 state + Hook 基础设施。无层1 则层3 是痛点3/4 重现——先有地基，再起业务。

---

## 5. 风险登记（剩余风险 + 监控点）

| ID | 风险 | 等级 | 缓解 / 监控 |
|----|------|------|------------|
| R1 | ~~block cap 阈值未知（G1）~~ ✅ 已闭合 | ~~高~~ → 低 | G1 闭合（result.md）：exit2 on Stop 四重退化（含 Windows 失效）证不可靠，C1 零 exit2 必然，无须实测阈值 |
| R2 | Hook 静默失效无感（G2） | 中 | 连续 N 次异常告警机制进 plan |
| R3 | 身份张力装配协议缺（G3） | 中 | Phase4 定义「技能加载/配方落地/卸载」协议 |
| R4 | subagent 方向注入缺（G4） | 中 | `VENTURE_TRACE_FILE` + SessionStart 方向提示 |
| R5 | 层3 案例库偏差根因未除 | 中 | extractor 不解决数据源，靠 M1 红队兜底；长期需扩充 B2B 案例库 |
| R6 | extractor emoji 解析脆弱 | 中 | 锚定结构化位置（信号灯行/七维表/RedFlag 段），非全文正则 |

---

## 6. 裁决结论

- **层1 cc-runtime**：ACCEPT（附 C1/C2 修订条款 + G1 前置实验）→ **立即进 Phase4**
- **层3 cc-venture**：ACCEPT（附 extractor + M1-M3 修订条款）→ **延后，待层1 接口冻结**
- **hcc 定型**：8 方法论 + cc-runtime（先）+ cc-venture/extractor/persona/requirements/pipeline（后）
- **Phase4 范围**：仅层1 cc-runtime 的 `60-impl-plan.md`（编排契约）+ `70-requirements.md`（保姆级需求）
