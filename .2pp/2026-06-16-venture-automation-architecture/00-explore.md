---
run: 2026-06-16-venture-automation-architecture
phase: 0
title: Phase 0 充分探索（内部 + 外部）
实施者: Claude + skills（非人类开发团队）—— 认知锚定
created: 2026-06-16
sources: [Explore agent 只读扫描, WebSearch ecc, 本地 venture-judge 实读]
status: active
direction_version: 1
---

# Phase 0 充分探索

> 目标全景：把「商业化流程自动化」三层系统的地基、痛点根因、可复用零件、外部范式全部摸清，给 Phase 2 的判官小组/对抗验证提供**有证据的**输入。不做设计——设计在 Phase 2。

## 0. 规划对象全景（三层）

```
层3  venture 业务流水线      商业调查→竞品→计划→judge→产品设计→用户画像→需求→UIUX
        │ 依赖
层2  harness 工作流引擎      用户7种workflow × cc-orchestration 5种质量模式 → 可配置pipeline + ecc编排层
        │ 依赖
层1  自主循环运行时【地基】   checkpoint/trace/任务记录 + 方向切换 + 长会话驱动  ← 痛点3、4全在这
```

运行载体已定（用户选）：**Claude Code 长会话内** = 复用 OMC 长循环（ralph/autopilot/loop）+ skill/hook，重跨会话/跨压缩恢复。

### 0.1 hcc（how-claude-coach）的定位——判官小组/judge/对抗的前置锚

> 证据：`claude-coach/SKILL.md:11-12`（"使用教练总入口，诊断→路由"）、`cc-loop/SKILL.md:12-13`（"使用教练中的 Loop Engineering 专家，帮用户从手动 prompt 进化到设计循环"）。

- **hcc 原生定位** = Claude Code「使用教练」套件：8 个子技能每个是一个**方法论领域**，范式 `Research→Ask→Route`，**被咨询时按需加载、说完即走**，输出"可执行命令+方法论"，**不 7×24 常驻、不产出业务产物**。
- **hcc 与 venture 自动化的关系**：hcc 是**教练/方法论元层**；venture 自动化是**用 hcc 教的方法论建造的工程**。痛点 3/4 出在 venture 运行时（层1），不在 hcc。
- **D7 产出物归属 ✅（用户 2026-06-16 定）：全面 hcc 化**——venture 整套（自主运行时 + 8 节点流水线）沉淀成 hcc 新技能体系。hcc 从"使用教练"扩展为"教练 + 业务模板库"，venture 成 hcc 一等公民旗舰示范。**此决定重塑 Phase 2 评价框架**：3 判官方案从"3 个 venture 系统"重定位为"3 个 hcc 技能切分/沉淀视角"；judge 标准从"venture 架构好不好"变为"hcc 技能体系切分/边界/可维护性/失焦风险对不对"；对抗验证头号攻击点 = "教练套件 vs 业务模板库的身份张力 + 技能粒度 + 与原 8 技能边界 + 是否失焦"。hcc 新技能雏形：`cc-runtime`（自主运行时：checkpoint/trace/方向切换/Hook 模板，解痛点 3/4 通用方法论）+ `cc-venture`（8 节点 DAG + 产物契约 + human gate + 节点路由）+ 业务节点技能（新建 `venture-persona`/`venture-requirements`，复用 venture-judge 节点）。

---

## 1. 方法论地基（已实读，可直接喂层1/层2）

### 1.1 cc-loop — 层1 地基（循环合同 + 护栏 + 锚文件）
路径：`.claude/skills/cc-loop/{SKILL.md, references/loop-guide.md}`
- **循环合同 6 要素**：`TRIGGER / SCOPE / ACTION / BUDGET / STOP / REPORT`（loop-guide.md L97-138）→ 层1 每个任务记录都应回答这 6 问。
- **护栏三件套**：① 最大迭代数(MAX=10) ② 无进展检测(连续N次同错/空diff→停) ③ 预算上限(token/$双闸)（L153-188）→ **痛点3 缺的"防失控"方法论已存在，运行时没落地**。
- **五阶段演进**：ralph(S1)→/goal(S2)→/loop(S3)→编排循环(S4)→全自动编排(S5)（SKILL.md L26-42）。层1≈S4，层3≈S5。**跃迁本质：人从"循环内"移到"循环外"**。
- **闭环 vs 开环**：循环可信度 = 里面有什么在说"不"（tests/typecheck/review gate）。**痛点3本质 = 循环跑了但没闭环反馈 → 任务记录不更新**。
- **Stage4 worktree SOP 8步**：判定开→开→绑定→并发≤2→闸→合并→回收→监督，含 CONFLICT(FIFO+rebase) 和 RECOVERY(连续不过闸→rollback)（SKILL.md L46-61）。
- **锚文件体系**：VISION/CLAUDE/AGENTS/PROMPT/Tests（loop-guide.md L194-209）。**痛点4解药：换方向=换/失效锚文件，而非删对话**。

### 1.2 cc-orchestration — 层2 地基（决策树 + 5模式 + 编排合同扩展）
路径：`.claude/skills/cc-orchestration/{SKILL.md, references/orchestration-guide.md}`
- **四档决策树**：直接工作 / Subagent / Workflow / Team，核心判据"谁持有计划"（L3-13）→ 层2"选哪种workflow"=这棵树。
- **Workflow 5种质量模式**（L86-151）：①对抗验证(N怀疑者否决) ②判官小组(N草案+judge嫁接) ③循环至干(dry<K轮无新→停) ④多模式扫描(不同盲区并行) ⑤完整性批评("还漏什么")。→ **层2 harness workflow 零件库原型**。
- **代码模式**：pipeline(无屏障) / parallel(屏障) / loop-until-dry（L155-183）→ 层2 调度原语。
- **编排合同扩展**：6要素 + `AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY`（L243-251）→ 层2 ecc编排应继承。
- **Team生命周期**：team-plan→team-prd→team-exec→team-verify→team-fix（fix有最大次数，L194-198）。

### 1.3 cc-config — 痛点4解药地基（六层配置 + 锚文件原则 + Hook）
路径：`.claude/skills/cc-config/references/config-systems-guide.md`
- **六层配置**（L4-21）：状态=独立`.omc/state/`；常量锚=项目CLAUDE.md/VISION.md。
- **锚文件设计原则**（L296-318）：常量vs变量分离、每次迭代重读、具体优于抽象、有说"不"的。→ **痛点4根因：计划文件被当"变量"但无失效标记，agent重读无法区分"当前有效"vs"已被superseded"**。
- **Hook 9种事件**（L121-133）：关键 `Stop`(阻止过早停/检查tasks-pending)、`PreCompact`(compact前保存)、`SessionStart`(加载状态)。→ **层1 checkpoint写入应挂 PostToolUse/Stop/PreCompact hook，而非靠agent自觉 = 痛点3工程解**。
- **Hook模式4**（L188-202）：Stop hook读`.claude/tasks-pending`，有未完成→exit 2 阻止退出 = "强制更新任务记录"原型。

### 1.4 cc-goal — 层1 STOP条件地基（五层质量 + 自评）
路径：`.claude/skills/cc-goal/references/goal-guide.md`
- **五层L0-L4**（L43-50）：L0模糊→L1具体→L2可验证→L3有约束→L4自验证。层1任务完成判定≥L2，循环驱动要L4。
- **终态条件模板**（L128-146）：MUST/MUST NOT/HOW TO VERIFY/SCOPE。每个checkpoint任务都该有此结构。
- **自评三轮**（L150-188）：①可证伪性 ②原子性 ③最弱依赖。→ **痛点3"按计划执行但不更新记录"=缺可证伪性，没"完成了如何自动验证"**。
- **Goal→工作模式映射**（L252-275）：L4→/goal+/loop，L3→Plan+执行，L2→TaskCreate。

**地基结论**：层1 = cc-loop护栏三件套 + cc-goal终态条件 + cc-config Hook强制(Stop/PreCompact写checkpoint)。层2 = cc-orchestration四档决策树+5模式+编排合同扩展。**痛点3、4 的方法论解药全部已存在，缺的是运行时落地**。

---

## 2. OMC 长循环机制清单（= 用户说的"7×24长会话"实际载体）

按完整度排序，均在 `C:\Users\newuser\.claude\plugins\marketplaces\omc\`：

| # | 机制 | 关键文件 | 机制 | 可复用度 |
|---|------|---------|------|---------|
| 1 | **autopilot** | skills/autopilot/{SKILL.md, src/hooks/autopilot/{pipeline,types,state}.ts} | 6阶段流水线 expansion→planning→execution→qa→validation→complete；可配置PipelineConfig可跳过stage；每阶段独立state；QA护栏(5轮/同错3次停)；成功后清state。**ralplan/consensus短路=只认文件存在不认版本(痛点4根因之一)** | ★★★★★ 层1主体骨架 |
| 2 | **OMC ralph** | skills/ralph/{SKILL.md, src/hooks/ralph/progress.ts} | PRD驱动(user story→passes:true+reviewer)；**progress.txt 追加式trace**=`Codebase Patterns`+每story的`{timestamp,storyId,implementation[],filesChanged[],learnings[]}`；getProgressContext()注入下一轮。**唯一有"trace"语义的机制** | ★★★★☆ 层1 trace补丁 |
| 3 | **ralph-loop** | plugins/.../ralph-loop/ | while循环重喂同一prompt直到completion promise；Stop hook拦截退出；无独立state靠git+FS | ★★★☆☆ 最简循环 |
| 4 | **ultrawork** | skills/ultrawork/ | 并行执行引擎非持久模式；读agent-tiers→定intent→并行gather→按独立性分类→task graph(并行波+依赖矩阵+验收)→路由Haiku/Sonnet/Opus。**只提供并行+路由，不提供持久化/验证循环(那些是ralph的层)** | ★★★★☆ 层2调度原语 |

**层1长会话驱动器结论**：推荐主体 = **autopilot 的可配置 pipeline 架构（骨架）+ OMC ralph 的 progress.txt trace 机制（补trace）**。痛点3要补：把 progress.txt 的 `{implementation,filesChanged,learnings}` 扩展为含「探索路径/计划路径/进度%/迭代数/方向版本」的完整 trace，并强制每轮写入。

---

## 3. 痛点 3、4 现状证据（精确，已用文件内容坐实）

### 痛点3：checkpoint 存了什么、缺什么
目录：`.omc/state/checkpoints/`（16文件，2026-06-11~16）。读两端3个文件，**结构完全一致**（283-285字节）：
```json
{
  "created_at": "2026-06-15T21:22:14.883Z",
  "trigger": "auto",
  "active_modes": {},                          // ← 始终空
  "todo_summary": {"pending":0,"in_progress":0,"completed":0},  // ← 始终全0
  "wisdom_exported": false,
  "background_jobs": {"active":[],"recent":[],"stats":null}
}
```
- **存了**：时间戳、触发方式、活跃模式名、todo计数、后台作业。
- **缺（痛点3核心）**：❌任务内容(`active_modes`永远`{}`) ❌探索路径 ❌计划路径 ❌进度(`todo_summary`永远全0) ❌迭代计数 ❌trace。
- `mission-state.json` 也空：`{"missions":[]}`。
- **结论**：checkpoint 是"心跳快照"不是"任务记录"，设计目的(通知/恢复)与用户期望(任务进度+trace)**错配**。层1要补：扩checkpoint JSON字段(active_mode内容/current_task/explore_paths[]/plan_path/progress%/iteration/last_progress_hash/direction_version)，强制每轮写入(挂Stop/PreCompact hook)。

### 痛点4：换方向后旧文件被重读根因
现存探索/计划文件位置：`.2pp/{date}-{slug}/`(2pp产物)、`.omc/plans/`(ralplan-*/consensus-*/autopilot-impl)、`.omc/specs/`、`.omc/autopilot/spec.md`、`docs/superpowers/specs/`。
- **根因证据**：grep 全 cc-2pp 代码库找 `superseded|deprecated|stale|version|失效|作废|过期|废弃` → **零命中业务字段**。
- `.2pp/` 目录设计：编号即流程顺序(00→60)，**无版本号、无状态字段、无supersede标记**，目录间无关联。
- autopilot ralplan 短路：**只检查文件存在不检查被superseded**，glob多个按时间取 → 人换方向没删旧文件就被重读。
- **结论**：层1要补：计划文件加 `status:active|superseded|archived` + `superseded_by` + `direction_version`；或单一"当前方向指针"文件(如`.venture/current-direction.md`)，换方向时**原子更新指针**而非靠agent记得忽略旧文件。

---

## 4. 已安装可复用技能清单（层3 业务流水线零件）

项目内 cc-*（8个，全 how-cc 方法论技能）：cc-2pp/cc-config/cc-context/cc-goal/cc-loop/cc-memory/cc-orchestration/cc-scanner。

全局业务相关技能（`C:\Users\newuser\.claude\skills\`）按层3节点匹配：

| 层3节点 | 可用技能 | 状态 |
|--------|---------|------|
| 商业调查 | venture-judge(/judge /deep)、deep-research、deepsearch、anysearch、academic-researcher | ✅ |
| 竞品 | venture-judge(/compete)、gstack/investigate、deep-dive | ✅ |
| 计划 | cc-2pp、gstack/plan-ceo-review、gsd-plan-phase、ralplan | ✅ |
| **judge** | **venture-judge(主力)**、gstack/retro | ✅ 已确认入口/格式 |
| 产品设计 | gstack/design-consultation、gstack/design-review、web-design-guidelines、typography | ✅ |
| **用户画像** | **(无专用)** deep-interview/deep-research 降级 | ⚠️ 缺口 |
| **需求** | **(无专用)** gsd-add-backlog、deep-interview、ralplan | ⚠️ 缺口 |
| UIUX | gstack/design-review、gstack/ui-phase、gstack/ui-review、typography | ✅ |

### venture-judge 入口与产出格式（确认覆盖 judge 节点）
路径：`skills/venture-judge/SKILL.md`
- **6入口**（L39-46）：`/judge`(文本评判卡最快) `/report`(卡+HTML PPT) `/deep`(卡+24步引导) `/pitch`(HTML路演) `/compete`(竞争+HTML) `/cases`(案例+HTML)。
- **产出**：①文本评判卡(`references/judgment-card.md`+`report-template.md`) ②HTML PPT(`templates/report/index.html`+36主题+runtime.js) ③24步引导(`references/24-steps-detailed-guide.md`)。
- **三轴**（L31-33）：创始人轴(默认)/投资人轴/一人公司轴。**注意：venture-judge 的 axis-switching=评估视角切换，≠ 痛点4的项目执行方向切换**。
- **数据资产**：`knowledge/cases/`(150+案例,gold/normalized/raw三层)、`knowledge/market-patterns/`(11市场模式)、`knowledge/red-flags/`、`references/seven-dimensions.md`(VC 7维评分)、`references/vc-diligence-framework.md`。
- **工作流**（L51-80）：接收诊断→并行三项证据检索(案例匹配+竞争+市场信号)→降级策略→输出。**"并行三项检索"= cc-orchestration parallel 模式实例**，可直接作层3 judge 节点执行体。

**层3技能结论**：8节点里 judge/商业调查/竞品/产品设计/UIUX/计划都有现成技能；**缺口=用户画像、需求节点无专用技能**（需新建或 deep-interview/deep-research 降级）。

---

## 5. harness 7种工作流 vs 现有 cc-*/OMC 对应

| # | 用户工作流 | 现有对应 | 证据 |
|---|-----------|---------|------|
| 1 | Executor(Input→Execute→Output) | ultrawork单任务直委派；cc-orch"直接工作"档 | orchestration-guide.md L20-22 |
| 2 | Plan-Do(Goal→Plan→Execute) | OMC plan skill+执行；cc-goal L3 | goal-guide.md L267 |
| 3 | ExplorePlan-Do | cc-2pp Phase0→Phase2→执行；cc-orch"先侦察再决定" | 2pp-guide全流程 |
| 4 | ExplorePlan-DoReview | cc-2pp全流程+Phase2对抗(攻击者=Review)；ralplan(Critic)；autopilot Phase4 | 2pp SKILL.md L13 |
| 5 | Loop Planner(Goal→(Explore→Plan→Execute→Review)×N) | **OMC ralph**(PRD驱动story-by-story到passes:true+reviewer)；cc-loop S4 | ralph SKILL.md L12 |
| 6 | Discovery Loop(Explore→Hypothesis→Explore→Rank→Output) | cc-orch"循环至干"+多模式扫描；deep-research harness | orchestration-guide.md L116-142 |

**结论**：7种**全部有原型，无全新概念**。层2不需发明新workflow类型，需做：把7种显式建模为可配置`WorkflowType`枚举(类autopilot PipelineConfig)，加 **ecc 编排层**(=cc-orch编排合同扩展 AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY)决定每个venture节点用哪种workflow、节点间如何传递产物。**关键缺口**：现有5模式是"质量保证模式"，7种是"任务执行形状"，二者正交——层2要把"执行形状(7)×质量模式(5)"组合成可配置pipeline，autopilot PipelineStageAdapter 是直接可泛化骨架。

---

## 6. 外部探索：ecc（用户点名借鉴）

**ecc = Everything Claude Code**（作者 affaan-m，GitHub: github.com/affaan-m/ecc，站点 ecc.tools）
- 定位：**Open Agent Harness System** —— 把 Claude Code 转成 production-grade 开发平台。
- 规模：**262 skills / 84 commands / 64 agents**（ClaudePluginHub 描述；SKILL.md 每月~3次同步实际计数）。
- 跨 harness：不仅 Claude Code，还支持 Codex、Cursor、OpenCode 等。
- 核心资产：`.claude/skills/everything-claude-code/SKILL.md` + `the-longform-guide.md`（编排深度指南）。
- **可借鉴的本质**：ecc 是"harness 工作流编排"范例——它把 skills/commands/agents/hooks 组织成可自主运行的开发平台。**对层2的启示**：ecc 证明了"多节点 + 多agent + 自主编排"的 harness 可行；具体编排机制(AGENTS/ROUTING/MERGE)可读 longform-guide 深挖（Phase 2 方案按需补）。

**借鉴边界**：ecc 体量巨大(262技能)，本次不全量引入，**只借鉴其 harness 编排范式**——节点化、agent 路由、产物传递。层2 用 cc-orchestration 已有的决策树+5模式+编排合同扩展来落地这个范式（更贴合用户已有的 how-claude 方法论体系，而非照搬 ecc 的 262 技能）。

---

## 7. 关键发现汇总 + 给 Phase 2 的输入

**已坐实**：
1. 痛点3、4 用文件内容证据坐实（checkpoint JSON 全空字段 / `.2pp` 无版本字段零命中）。
2. 三层地基齐备：层1=cc-loop护栏+cc-goal终态+OMC ralph trace+autopilot pipeline；层2=cc-orch决策树+5模式+autopilot可配pipeline；层3 judge=venture-judge。
3. 运行载体(Claude Code 长会话=OMC长循环)可行，autopilot 是最完整骨架。
4. harness 7种workflow全有原型，缺"显式建模+ecc编排层+执行形状×质量模式正交组合"。
5. 层3缺口=用户画像/需求节点无专用技能。

**给 Phase 2 判官小组/对抗验证的输入（待裁决的关键设计决策）**：
- **D1 范围** ✅(用户2026-06-16定)：**混合**——全景骨架(三层架构总纲+接口契约+数据流) + 层1深度(2pp对抗火力聚焦层1自主循环运行时)。
- **D2 自主边界** ✅(用户定)：**关键节点human gate**——探索→计划→judge后人工确认方向；其余节点(竞品/需求/UIUX生成)全自动串联。
- **D3 地基复用** ✅(用户定)：**复用 autopilot + ralph**——层1=autopilot可配置pipeline(骨架)+ralph progress.txt(trace)，补checkpoint字段+Hook强制写+方向指针。ROI最高。
- **D4 方向切换机制**（痛点4解药）：单一指针文件原子切换 vs 计划文件加版本/状态字段。← Phase 2 方案展开
- **D5 trace存储**：扩 autopilot/ralph 的 state vs 独立 trace store。← Phase 2 方案展开
- **D6 checkpoint 写入时机**：PostToolUse/Stop/PreCompact hook 强制 vs agent 自觉。← Phase 2 方案展开（cc-config 倾向 hook 强制）
- **D7 产出物归属** ✅（用户 2026-06-16 定）：**全面 hcc 化**——venture 整套（运行时 + 流水线）沉淀成 hcc 新技能体系，hcc 扩展为"教练 + 业务模板库"，venture 成旗舰示范。重塑评价框架（见 §0.1）。

**度量提醒（Phase 2 每个 agent prompt 必带）**：实施者=Claude+skills，度量用 token/轮次/skill配置/可验证闸，**禁用人天/人周**。
