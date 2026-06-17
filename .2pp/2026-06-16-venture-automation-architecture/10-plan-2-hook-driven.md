---
run: 2026-06-16-venture-automation-architecture
phase: 2
plan: 2
title: 方案2 · Hook 强制,绝不依赖 agent 自觉（Hook-Driven Runtime）
author_perspective: 运维组（sonnet）
core_belief: agent 会偷懒/遗忘/漂移（2pp假设2），只有 Hook 是确定性的
created: 2026-06-16
status: draft
direction_version: 1
度量单位: token / 轮次 / skill配置 / 可验证闸（禁人天/人周/工程师数量）
---

# 方案 2：Hook-Driven Runtime —— Hook 强制,绝不依赖 agent 自觉

> **一句话核心切入点**：痛点 3（执行不更新任务记录/无 checkpoint/无 trace）与痛点 4（换方向后读旧探索/计划文件）的根因同源——**两者都依赖 agent 自觉更新/自觉忽略,而 agent 会偷懒/遗忘/漂移**。本方案的解药是**把所有"应该做的状态写入"和"应该做的旧文件拦截"从 agent 的 prompt 约定下沉到 Hook 的确定性执行**：PostToolUse 强制写 trace、Stop 校验任务更新且未完成则 exit 2、PreCompact 强制存 checkpoint、SessionStart 强制恢复方向、PreToolUse 在 agent 读旧计划文件前检查方向指针拦截重定向。agent 只管"做正确的事",Hook 兜底"状态被正确持久化"。

---

## 1. 前提与硬约束对齐

| 用户已定约束 | 本方案如何对齐 |
|---|---|
| **D1 范围=混合** | 全景三层架构(§2)+层1深度(§3)。层1深度=**完整 Hook 体系总表**,这是本方案的火力焦点。 |
| **D2 关键节点 human gate** | 探索→计划→judge 后人工确认;其余全自动串联。**Hook 在 gate 前 Stop 强制汇总、gate 后 PreToolUse 拦截旧方向文件**,gate 本身由 agent 显式调 TaskUpdate(status:awaiting_gate) 触发 Stop hook exit 2 阻塞。 |
| **D3 复用 autopilot + ralph** | 层1 = autopilot 可配置 pipeline(骨架,不动其核心) + ralph progress.txt(trace 数据结构模板)。**Hook 不侵入 autopilot/ralph 源码,只挂在外部事件上读写它们的状态目录**——这是"运维组"的最小侵入原则。 |
| 运行载体=Claude Code 长会话内 | Hook 是 Claude Code 原生事件机制,零外部依赖,完美贴合长会话载体。 |
| 痛点3证据:checkpoint JSON 全空 | §3.2 直接定义扩展后的 checkpoint 字段,由 PreCompact hook 强制写入。 |
| 痛点4证据:计划文件无版本字段 | §3.4 选**指针文件方案**(D4),由 PreToolUse hook 拦截。论证见 §3.4.3。 |

---

## 2. 全景三层架构(总纲)

### 2.1 架构图（ASCII art）

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  层3  venture 业务流水线（8节点 DAG）                                              ║
║   商业调查 → 竞品 → 计划 → [judge · human gate] → 产品设计 → 用户画像 → 需求 → UIUX  ║
║        ▲ 产品契约(§5)            │ 产物逐节点传递（通过 direction pointer 路由）        ║
║        │                         ▼                                                    ║
║   [gate 触发]           层2 harness 工作流引擎                                        ║
║                          7种 workflow × 5种质量模式 → 可配置 pipeline + ecc 编排层    ║
║                          每个 venture 节点 = 一个 WorkflowSpec(workflow_type, quality_mode)
║        ▲                         │ 节点完成后写产物到 .venture/products/{node}/        ║
║        │ Hook 监督编排           ▼                                                    ║
║   [Stop hook: 节点产物闸]    层1 自主循环运行时【地基 · 本方案焦点】                   ║
║                                                                                      ║
║   ┌──────────────────────────────────────────────────────────────────────────────┐ ║
║   │  确定性层（Hook 强制，本方案核心）                                            │ ║
║   │                                                                              │ ║
║   │  PreToolUse ─→ 读旧计划/探索文件前，查 direction pointer，superseded 则拦截  │ ║
║   │  PostToolUse─→ Write/Edit/Bash 后，增量写 trace（痛点3 trace 解药）          │ ║
║   │  Stop ────────→ 校验任务记录已更新 + 未完成则 exit 2（痛点3 任务记录解药）    │ ║
║   │  PreCompact ──→ compact 前强制写 checkpoint（痛点3 checkpoint 解药）          │ ║
║   │  SessionStart─→ compact/resume 后恢复方向指针 + 当前节点 + 未完成任务         │ ║
║   │  SubagentStop─→ subagent 完成后回收 trace 到主会话                           │ ║
║   └──────────────────────────────────────────────────────────────────────────────┘ ║
║        ▲ 写入确定性层           ▼ 读取                                                ║
║   ┌──────────────────────────────────────────────────────────────────────────────┐ ║
║   │  持久化层（FS 状态目录，复用既有结构）                                        │ ║
║   │                                                                              │ ║
║   │  .venture/                                                                   │ ║
║   │    current-direction.md      ← 方向指针（原子切换，D4 解药）                  │ ║
║   │    products/{node}/          ← 层3 各节点产物（含 frontmatter: status/version）║
║   │    trace/{session}.ndjson    ← 增量 trace（复用 ralph progress.txt 结构）     │ ║
║   │  .omc/state/checkpoints/     ← 扩展后的 checkpoint JSON（补字段，不新建目录）  │ ║
║   │  .omc/state/sessions/{sid}/  ← autopilot/ralph 既有 state（不动）             │ ║
║   └──────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                      ║
║   提示层（agent 约定，Hook 之外的第二道防线，非唯一依赖）                             ║
║     CLAUDE.md 锚文件 + skill SKILL.md ← 告诉 agent "做什么"，不依赖它"记得写状态"   ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

**核心设计意图**：图中的"确定性层"是本方案与方案1/方案3的根本分歧点。其他方案把状态更新放在 agent prompt 约定("记得写 trace")或 skill 流程里;本方案坚持**agent prompt 约定是"提示",Hook 才是"闸"**——提示可以失效(2pp假设2:agent 会漂移),闸不会。

### 2.2 层间接口契约

#### 层1 → 层2 接口（层1 提供给层2 的运行时能力）

| 契约名 | 方向 | 内容 | 实现机制 |
|---|---|---|---|
| `DirectionPointer` | 层1 提供 | 当前有效方向的版本号 + 当前活跃节点 + active 产物路径列表 | `.venture/current-direction.md`(层1 SessionStart hook 读,层2 编排层读) |
| `TraceStream` | 层1 提供 | 追加式 trace,每条含 `{ts,node,action,filesChanged[],progress_delta}` | `.venture/trace/{session}.ndjson`(层1 PostToolUse hook 增量写) |
| `Checkpoint` | 层1 提供 | compact 前的完整快照(扩字段版) | `.omc/state/checkpoints/{session}.json`(层1 PreCompact hook 写) |
| `NodeProduct` | 层1 提供 | 层3 某节点的产物(含 status/version frontmatter) | `.venture/products/{node}/`(层2 编排完成后调 agent 写,Stop hook 校验 frontmatter 存在) |

#### 层2 → 层1 接口（层2 驱动层1 的方式）

层2 不直接调层1 函数,而是通过**触发 Claude Code 事件**间接驱动层1 的 Hook:

| 驱动动作 | 层2 怎么做 | 层1 Hook 怎么响应 |
|---|---|---|
| 启动一个 venture 节点 | 编排层委派 executor/ralph 跑该节点的 WorkflowSpec | PostToolUse 在 executor 写文件时增量 trace |
| 节点完成 | executor 写产物到 `.venture/products/{node}/`,更新 TaskUpdate | Stop hook 校验:产物 frontmatter 有 status + 任务记录已更新 |
| 节点失败/重试 | executor TaskUpdate(status:in_progress) + 重跑 | Stop hook 检测 in_progress 任务存在 → exit 2 阻塞过早退出 |
| human gate | executor 写 `awaiting_gate` 状态 | Stop hook exit 2 阻塞,直到用户在对话里确认后调 TaskUpdate(status:completed) |
| 方向切换 | 用户在对话里说"换方向" → agent 调专用 skill 更新指针 | PreToolUse hook 在 agent 下次读旧文件时拦截重定向 |

### 2.3 数据流（一次 venture 节点执行的完整 trace）

```
用户/编排层
  │
  │  1. 委派 executor 跑"商业调查"节点（WorkflowSpec: workflow=ExplorePlan-Do, quality=对抗验证）
  ▼
executor (Claude + skill)
  │
  │  2. Read 工具读 .venture/current-direction.md（确认当前方向）
  │     └─ [Hook: PreToolUse] matcher=Read,检查 direction pointer 未变,放行
  │
  │  3. Read 旧探索文件 .2pp/.../00-explore.md
  │     └─ [Hook: PreToolUse] 读 direction pointer,该文件 status=superseded → exit 2 拦截
  │        additionalContext 注入:"该文件已被方向v2 取代,请读 .venture/products/explore/00-explore.md"
  │     → executor 改读新文件（痛点4 解药生效）
  │
  │  4. Write 产物 .venture/products/research/01-findings.md（含 frontmatter: status:active, direction_version:2）
  │     └─ [Hook: PostToolUse] matcher=Write,增量写一条 trace 到 .venture/trace/{sid}.ndjson
  │        {ts, node:research, action:write, filesChanged:[".../01-findings.md"], progress_delta:+0.2}
  │
  │  5. TaskUpdate(task_id:research, status:completed)
  │
  ▼  6. executor 准备停止（说"完成了"）
[Hook: Stop]
  │
  │  7a. 读 TaskList,确认 research 任务 status=completed ✓
  │  7b. 读 .venture/products/research/,确认有产物且 frontmatter 含 status ✓
  │  7c. 读 trace 末尾,确认本轮有增量写入 ✓
  │  → 全部通过 → exit 0 放行
  │
  │  (若 7a 失败:research 仍 in_progress → exit 2 阻塞 + 提示"任务未标记完成")
  │  (若 7b 失败:无产物 → exit 2 阻塞 + 提示"节点产物缺失")
  │  (若 7c 失败:trace 无增量 → exit 2 阻塞 + 提示"本轮无状态写入,疑似执行漂移")
  ▼
编排层
  │
  │  8. 读 trace + DirectionPointer,推进到下一节点"竞品"
  ▼
... (循环到 judge 节点 → human gate → Stop hook 阻塞 → 用户确认 → 继续)
```

---

## 3. 层1 深度设计（本次焦点）

### 3.1 Hook 体系总表（本方案的核心交付物）

**设计原则（从 compact-snapshot-write/restore 范式提炼，全程统一）**：
1. **静默失败**：任何异常 → exit 0,绝不阻塞主流程（compact-snapshot-write.js L10, restore.js L10）
2. **stdin 10s 超时守卫**：Windows/Git Bash 下管道可能不正常关闭（compact-snapshot-write.js L34）
3. **session_id 文件名防护**：拒绝路径分隔符/遍历序列（compact-snapshot-write.js L47, restore.js L30）
4. **字段结构识别而非工具名硬编码**：用 `inp.file_path + 写入字段(old_string/new_string/content/edits)` 判断,不硬编码插件工具名（compact-snapshot-write.js L107-113）
5. **exit 0 放行 / exit 2 阻塞**：放行用 exit 0,阻塞用 exit 2 + stderr 提示（config-systems-guide.md 模式4 L188-202）
6. **additionalContext 注入而非对话污染**：拦截时用 JSON 输出 `hookSpecificOutput.additionalContext`（restore.js L38-46）

#### 总表

| # | 事件 | matcher | command | 做什么 | timeout | 失败处理 |
|---|---|---|---|---|---|---|
| H1 | **PreToolUse** | `Read\|Glob\|Grep` | `node .claude/hooks/venture-guard-read.js` | **痛点4 解药**：解析 stdin 的 tool_input.file_path/pattern,查 `.venture/current-direction.md`,若目标文件 status=superseded → exit 2 + additionalContext 重定向到 active 文件 | 5s | 文件不存在/JSON 解析失败 → exit 0 放行(不阻塞读) |
| H2 | **PostToolUse** | `Write\|Edit\|MultiEdit` | `node .claude/hooks/venture-trace-write.js` | **痛点3 trace 解药**：解析 tool_input.file_path + 写入字段,增量追加一条 `{ts,node,inferred_from_path,action,filesChanged[],progress_delta}` 到 `.venture/trace/{session}.ndjson` | 5s | 任何异常 → exit 0(绝不阻塞写) |
| H3 | **PostToolUse** | `Bash` | `node .claude/hooks/venture-trace-write.js` | 同 H2,但解析 tool_input.command 推断 action(git commit/npm test 等) | 5s | exit 0 放行 |
| H4 | **Stop** | (无 matcher) | `node .claude/hooks/venture-guard-stop.js` | **痛点3 任务记录解药**：①读 TaskList(若可用)/`.venture/tasks.json` ②若有 in_progress 或 awaiting_gate 任务 → exit 2 阻塞 ③读 trace 末尾确认本轮有增量,无增量→ exit 2 提示漂移 ④读当前节点产物目录确认 frontmatter 存在 | 8s | 读不到任务文件 → exit 0(不阻塞,降级为只读 trace 校验) |
| H5 | **PreCompact** | (无 matcher) | `node .claude/hooks/venture-checkpoint-write.js` | **痛点3 checkpoint 解药**：复用 compact-snapshot-write.js 范式,但写扩展字段(§3.2)到 `.omc/state/checkpoints/{session}.json` | 10s | 同 compact-snapshot-write.js: exit 0 永远放行 compact |
| H6 | **SessionStart** | (无 matcher, source=compact\|resume) | `node .claude/hooks/venture-direction-restore.js` | **恢复解药**：读 `.venture/current-direction.md` + 最新 checkpoint,通过 additionalContext 注入"当前方向/节点/未完成任务/最近 trace 摘要"。仅 source=compact/resume 触发,initial/clear 不灌(同 restore.js L24-25) | 5s | 无 checkpoint/无 direction 文件 → exit 0 静默 |
| H7 | **SubagentStop** | (无 matcher) | `node .claude/hooks/venture-trace-merge.js` | subagent 完成后,把其 trace 片段回收到主会话 trace(防止 subagent 上下文丢失带走 trace) | 5s | 无 subagent trace 文件 → exit 0 |
| H8 | **UserPromptSubmit** | (无 matcher) | `node .claude/hooks/venture-direction-switch.js` | **方向切换检测**：解析 prompt,若匹配"换方向/重做/改方向/重来/这个方向不对"等关键词 → 写一个 pending_switch 标记到 `.venture/pending-switch.md`,提示 agent 调方向切换 skill 更新指针 | 3s | 不匹配 → exit 0 |

#### Hook 配置(settings.json 节选)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Glob|Grep",
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-guard-read.js",
          "timeout": 5
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-trace-write.js",
          "timeout": 5
        }]
      },
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-trace-write.js",
          "timeout": 5
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-guard-stop.js",
          "timeout": 8
        }]
      }
    ],
    "PreCompact": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-checkpoint-write.js",
          "timeout": 10
        }]
      }
    ],
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-direction-restore.js",
          "timeout": 5
        }]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-trace-merge.js",
          "timeout": 5
        }]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/venture-direction-switch.js",
          "timeout": 3
        }]
      }
    ]
  }
}
```

**为什么 8 个 Hook 而非更少**：痛点3 需要三个独立闸(写 trace / 校验任务更新 / 存 checkpoint),痛点4 需要一个拦截闸(PreToolUse),恢复需要两个(SessionStart 恢复 + SubagentStop 回收),方向切换需要一个检测。每个 Hook 单一职责,任一失败不影响其他(静默 exit 0)。

---

### 3.2 checkpoint 字段补全（H5 写什么）

**现状（痛点3 证据）**：`.omc/state/checkpoints/*.json` 全是 283 字节的"心跳快照",`active_modes:{}`,`todo_summary` 全 0。

**扩展后字段（H5 PreCompact hook 写入）**：

```json
{
  "created_at": "2026-06-16T14:22:14.883Z",
  "trigger": "auto",
  "session_id": "abc123",
  "snapshot_version": 2,

  "active_modes": {
    "autopilot": { "stage": "execution", "node": "research" },
    "ralph": { "story_id": "story-3", "iteration": 5 }
  },

  "direction": {
    "version": 2,
    "slug": "venture-automation-architecture",
    "set_at": "2026-06-16T10:00:00Z",
    "superseded_versions": [1]
  },

  "current_node": "research",
  "pipeline_progress": {
    "completed_nodes": ["explore", "plan"],
    "current_node": "research",
    "pending_nodes": ["compete", "judge", "design", "persona", "requirement", "uiux"],
    "progress_pct": 25
  },

  "tasks": {
    "pending": 3,
    "in_progress": 1,
    "completed": 2,
    "in_progress_details": [
      { "id": "research", "subject": "商业调查", "node": "research" }
    ]
  },

  "trace_tail": [
    { "ts": "...", "node": "research", "action": "write", "files": [".../01-findings.md"] }
  ],

  "last_progress_hash": "a3f2...",
  "stagnation_count": 0,

  "wisdom_exported": false,
  "background_jobs": { "active": [], "recent": [], "stats": null }
}
```

**关键扩展字段**（标 ★ 的为痛点3 直接解药）：
- ★ `direction.version` —— 痛点4 的版本锚,SessionStart 恢复时读这个判断方向是否变过
- ★ `current_node` + `pipeline_progress` —— 痛点3 缺的"进度",从全 0 变成真实节点列表
- ★ `tasks.in_progress_details` —— 痛点3 缺的"任务内容",含 node 关联
- ★ `trace_tail` —— 痛点3 缺的 trace,取最近 N 条(避免 checkpoint 膨胀)
- ★ `last_progress_hash` + `stagnation_count` —— 无进展检测的数据基础(cc-loop 护栏二)

**H5 写入逻辑**（伪代码,复用 compact-snapshot-write.js 的 transcript 解析）：
```
1. 读 transcript_path,提取: 最后一次 TaskUpdate/TaskList、最后一次 Write/Edit 的 file_path、最近 assistant text
2. 读 .venture/current-direction.md 拿 direction version/slug
3. 读 .venture/trace/{session}.ndjson 末尾 5 条
4. 计算 last_progress_hash = hash(trace_tail 的 files 集合),与上次 checkpoint 对比 → stagnation_count
5. 读 .omc/state/sessions/{sid}/ 拿 autopilot stage + ralph story(若激活)
6. 组装 JSON,写 .omc/state/checkpoints/{session}.json(覆盖旧的)
7. exit 0 永远放行 compact
```

---

### 3.3 trace 存储（PostToolUse 增量写 vs 批量）

**决策：增量写（PostToolUse 每次写一条），NDJSON 格式**。

**为什么增量而非批量**：
- **痛点3 本质是"状态丢失"**,批量写(如 compact 时一次性 dump)会丢失 compact 之间的中间状态——而漂移恰恰发生在中间
- 增量写每次只追加一行(NDJSON),写入成本极低(<1ms,5s timeout 绰绰有余)
- compact-snapshot-write.js 的教训:它只在 PreCompact 一次性抓 transcript,导致**只保留最后一次 TodoWrite**(L100-101 注释明确说"input.todos[].status 自包含全量")——这是"批量"的代价。trace 不能重蹈覆辙

**NDJSON 格式（每行一条，复用 ralph progress.ts 的字段名做兼容）**：

```jsonl
{"ts":"2026-06-16T14:20:01Z","session":"abc123","direction_version":2,"node":"research","story_id":null,"action":"write","tool":"Write","filesChanged":[".venture/products/research/01-findings.md"],"progress_delta":0.2,"note":null}
{"ts":"2026-06-16T14:21:15Z","session":"abc123","direction_version":2,"node":"research","story_id":null,"action":"bash","tool":"Bash","filesChanged":[],"progress_delta":0,"note":"git commit -m 'add research findings'"}
{"ts":"2026-06-16T14:22:00Z","session":"abc123","direction_version":2,"node":"research","story_id":"story-3","action":"edit","tool":"Edit","filesChanged":[".venture/products/research/01-findings.md"],"progress_delta":0.1,"note":"refine findings section 2"}
```

**H2/H3 写入逻辑**（伪代码）：
```
1. 解析 stdin tool_input:
   - Write/Edit/MultiEdit → file_path 从 input.file_path;filesChanged=[file_path]
   - Bash → 从 input.command 推断 action(git commit→action:bash,note:命令摘要)
2. 从 file_path 推断 node(正则匹配 .venture/products/{node}/ 或 .2pp/.../{phase}-)
3. 读 .venture/current-direction.md 拿 direction_version
4. progress_delta: 启发式(写产物文件 +0.1~0.2,bash commit +0,edit 现有 +0.05)——仅用于 stagnation 检测,非精确
5. 追加一行 JSON 到 .venture/trace/{session}.ndjson(若文件不存在则创建 + .gitignore)
6. exit 0
```

**与 ralph progress.txt 的关系**：ralph 的 progress.ts 在 ralph 循环内部写 `{storyId, implementation[], filesChanged[], learnings[]}`,是 **story 级**的。本方案的 trace 是 **工具调用级**的(更细粒度),两者互补:ralph trace 回答"这个 story 做了什么",venture trace 回答"这次工具调用改了什么"。H7 SubagentStop hook 负责**把 ralph subagent 的 progress.txt 片段转换格式后合并到主 venture trace**。

---

### 3.4 方向切换机制（D4：PreToolUse 拦截 + 文件组织选择）

#### 3.4.1 两个选项

- **选项甲：单一指针文件**（`.venture/current-direction.md`）—— 一个文件原子更新,所有产物文件不动
- **选项乙：计划文件加版本字段**（每个产物 frontmatter 加 `status:active|superseded|archived` + `superseded_by` + `direction_version`）

#### 3.4.2 本方案选：**选项甲（指针文件）为主，选项乙（frontmatter）为辅**

#### 3.4.3 论证：为什么指针文件更利于 Hook 拦截

| 维度 | 选项甲（指针文件） | 选项乙（frontmatter 版本字段） |
|---|---|---|
| **Hook 拦截成本** | PreToolUse 只读**一个固定路径** `.venture/current-direction.md`(O(1) 读取),拿到 active 路径列表,直接比对 | PreToolUse 要**打开被读的每个文件**解析 frontmatter(O(n) 文件读),每次 Read 都触发文件打开 |
| **拦截确定性** | 指针文件由方向切换 skill **原子写**(write-rename),读到的一定是完整的最新版本 | frontmatter 散落在 N 个文件,任一文件漏改 status 字段 → Hook 漏配(2pp假设2:agent 会遗忘) |
| **方向切换原子性** | 一个文件 write-rename = 原子操作(POSIX/NTFS 保证) | 更新 N 个文件的 frontmatter = 非原子,中途 crash 会半新半旧 |
| **痛点4 根因匹配** | 痛点4 根因是"autopilot 只认文件存在不认版本"——指针文件把"版本"外置到单一文件,Hook 不依赖被读文件自身的字段 | 依赖被读文件自带版本字段,仍是"靠文件自觉"——只是把"agent 自觉"换成"文件自觉",没解决确定性 |
| **新增方向的成本** | 指针文件加一条 `active_products:[]` 列表,旧版本整体 superseded | 要遍历所有旧产物改 frontmatter,文件越多越容易漏 |
| **失败模式** | 指针文件损坏 → 整个方向失效(显式失败,易发现) | 某文件漏改 frontmatter → 静默漏配(隐性 bug,难发现) |

**结论**：Hook 视角下,**确定性的核心是"单一真相源"**。指针文件是单一真相源,frontmatter 是分布式真相源(易漂移)。所以主用指针文件。

**为什么 frontmatter 仍保留为辅**：作为**第二道防线**(defense in depth)。指针文件告诉 Hook"当前 active 的是哪些",frontmatter 让人/agent 直接打开文件时也能看到 status。两者不一致时,**以指针文件为准**(Hook 信任指针)。这复用了 cc-config 锚文件原则"常量 vs 变量分离":指针文件是"当前方向的常量",产物文件是"变量"。

#### 3.4.4 指针文件格式（`.venture/current-direction.md`）

```markdown
---
direction_version: 2
slug: venture-automation-architecture
set_at: 2026-06-16T10:00:00Z
set_by: user-explicit
superseded_versions: [1]
---

# 当前方向

## Active 产物（Hook 信任此列表，PreToolUse 只放行这些路径）
- .venture/products/explore/00-explore.md
- .venture/products/plan/10-plan-2-hook-driven.md
- .venture/products/research/01-findings.md

## Superseded 产物（PreToolUse 拦截，重定向到 active）
- .2pp/2026-06-15-old-direction/00-explore.md → superseded, active: .venture/products/explore/00-explore.md

## 当前节点
node: research
pipeline_stage: execution
```

#### 3.4.5 PreToolUse 拦截逻辑（H1，痛点4 核心解药）

```
1. 解析 stdin: tool_name, tool_input.file_path (Read) 或 tool_input.pattern (Glob/Grep)
2. 读 .venture/current-direction.md(若不存在 → exit 0 放行,降级)
3. 解析 active_products[] 和 superseded 列表
4. 对 file_path:
   - 若 file_path ∈ active_products → exit 0 放行
   - 若 file_path ∈ superseded 列表 → exit 2 阻塞 + additionalContext:
     "⚠️ 该文件已被方向v{N} 取代。当前 active: {active_path}。请改读 active 文件。"
   - 若 file_path 不在任何列表 → exit 0 放行(非 venture 文件,不干预)
5. 对 Glob/Grep 的 pattern:
   - 若 pattern 匹配 superseded 目录前缀(如 .2pp/2026-06-15-old-direction/) → exit 2 + 重定向
   - 否则 exit 0
6. 任何异常(JSON 解析失败/文件读失败) → exit 0(不阻塞读,宁可漏拦不可误杀)
```

**关键设计：宁可漏拦不可误杀**。PreToolUse 拦截的是"读",误杀会让 agent 卡死。所以异常路径全部 exit 0 放行,只有"明确匹配 superseded 列表"才 exit 2。这与 compact-snapshot-write.js 的"永远 exit 0 放行 compact"哲学一致(L9)。

---

### 3.5 与 autopilot / ralph 的复用边界（D3 落地）

| 组件 | 复用什么 | 不动什么 | Hook 怎么接 |
|---|---|---|---|
| **autopilot pipeline** | PipelineConfig 结构(stages 可配置/可跳过)、每阶段独立 state、QA 护栏(5轮/同错3次停) | 不动其 src/hooks/autopilot/*.ts 源码、不改其 state 文件格式 | venture 的 H4 Stop hook **读** autopilot state(只读)判断当前 stage;不写 autopilot state。venture checkpoint(H5)**复制** autopilot stage 到自己的字段,不依赖 autopilot 自己存 |
| **ralph progress.txt** | `{storyId, implementation[], filesChanged[], learnings[]}` 字段结构作为 trace 的**子集**模板 | 不动 ralph 循环逻辑、不改 progress.ts 写入时机 | venture 的 H2 PostToolUse 在 ralph subagent 外层**额外**写 venture trace(更细粒度);H7 SubagentStop 把 ralph progress.txt 的 story 级条目**转换**合并到 venture trace |
| **autopilot state 目录** | `.omc/state/sessions/{sid}/` 作为 checkpoint 的**数据源之一** | 不改其结构 | H5 PreCompact 读它拿 stage/node,写进 venture checkpoint 的 `active_modes` |
| **OMC TaskCreate/TaskList** | 作为 H4 Stop hook 的任务校验数据源 | 不改其 API | H4 优先读原生 TaskList(若 hook 能访问),降级读 `.venture/tasks.json`(venture 自己维护的镜像) |

**最小侵入原则**：本方案的 8 个 Hook **全部是外部挂载**,不修改 autopilot/ralph 的任何源码。如果 autopilot 升级、ralph 改版,venture 的 Hook 仍工作(只要 state 目录结构兼容)。这是运维组的核心信念:**Hook 是外部观测者,不是内部补丁**。

---

## 4. 层2 骨架（harness 工作流引擎）

### 4.1 7种 workflow 枚举（显式建模，类 autopilot PipelineConfig）

| # | WorkflowType | 执行形状 | 现有原型 |
|---|---|---|---|
| W1 | `Executor` | Input → Execute → Output | ultrawork 单任务;cc-orch"直接工作" |
| W2 | `PlanDo` | Goal → Plan → Execute | OMC plan + 执行;cc-goal L3 |
| W3 | `ExplorePlanDo` | Explore → Plan → Execute | cc-2pp Phase0→2;cc-orch"先侦察" |
| W4 | `ExplorePlanDoReview` | + Review(对抗) | cc-2pp 全流程;ralplan Critic;autopilot Phase4 |
| W5 | `LoopPlanner` | (Explore→Plan→Execute→Review)×N | OMC ralph;cc-loop S4 |
| W6 | `DiscoveryLoop` | Explore→Hypothesis→Explore→Rank | cc-orch"循环至干";deep-research |
| W7 | `AdversarialJudge` | N草案 → judge嫁接 | cc-orch"判官小组";venture-judge |

### 4.2 5种质量模式（cc-orchestration 原封复用）

Q1 对抗验证 / Q2 判官小组 / Q3 循环至干 / Q4 多模式扫描 / Q5 完整性批评。

### 4.3 执行形状 × 质量模式 正交组合

每个 venture 节点的 `WorkflowSpec`:

```yaml
node: research
workflow_type: W3  # ExplorePlanDo
quality_mode: Q1   # 对抗验证
executor: ralph    # 载体（ralph/autopilot/直接 executor）
gate:              # 完成闸（Stop hook 校验）
  product_required: .venture/products/research/01-findings.md
  frontmatter_required: [status, direction_version]
  quality_check: venture-judge --node research --min-score 6
```

**Hook 在编排中的角色**：
- WorkflowSpec 的 `gate` 字段 → **翻译成 H4 Stop hook 的校验规则**(H4 读 WorkflowSpec 配置,动态校验当前节点的 gate)
- 节点间传递 → 通过 DirectionPointer 的 `current_node` 字段(H6 SessionStart 恢复时读)
- quality_mode 触发的 subagent → H7 SubagentStop 回收其 trace

### 4.4 ecc 编排层（cc-orchestration 编排合同扩展）

继承 6 要素 + AGENTS/ROUTING/MERGE/CONFLICT/RECOVERY(orchestration-guide.md L243-251),其中:
- **ROUTING** = 决定每个 venture 节点用哪个 WorkflowSpec(可配置表)
- **MERGE** = worktree 物理隔离(cc-loop Stage4 SOP)
- **RECOVERY** = 节点失败时,H4 Stop hook 检测到 stagnation_count 超阈值 → exit 2 + 提示"节点停滞,需人工介入或降级"

---

## 5. 层3 骨架（venture 业务流水线）

### 5.1 8节点 DAG + human gate 位置（D2）

```
[商业调查] → [竞品] → [计划] → [judge · ★HUMAN GATE] → [产品设计] → [用户画像] → [需求] → [UIUX]
   W3+Q1     W3+Q4    W4+Q2       W7+Q2                 W3+Q1       ⚠️缺口      ⚠️缺口    W3+Q1
                                                                          │           │
                                                                          ▼           ▼
                                                                  deep-interview  gsd-add-backlog
                                                                  降级            降级
```

**★ HUMAN GATE（judge 后）**：探索→计划→judge 完成后,Stop hook(H4)检测到 judge 节点完成 + 下游节点未启动 → exit 2 阻塞 + 提示"方向已判定,请人工确认后输入 'continue' 推进到产品设计"。用户确认后 agent 调 TaskUpdate 解除阻塞。

### 5.2 节点产物契约（每节点写什么到 `.venture/products/{node}/`）

| 节点 | 产物路径 | frontmatter 必填 | 接 judge |
|---|---|---|---|
| 商业调查 | `research/01-findings.md` | status, direction_version, sources[] | 喂 venture-judge /judge |
| 竞品 | `compete/01-landscape.md` | status, direction_version, competitors[] | /compete |
| 计划 | `plan/{plan-id}.md` | status, direction_version, plan_type | /deep |
| judge | `judge/01-verdict.md` + HTML | status, direction_version, score, axis | ★ gate 触发 |
| 产品设计 | `design/01-spec.md` | status, direction_version | design-review |
| 用户画像 | `persona/01-profiles.md` | status, direction_version | ⚠️ deep-interview 降级 |
| 需求 | `requirement/01-backlog.md` | status, direction_version | ⚠️ gsd-add-backlog 降级 |
| UIUX | `uiux/01-mockup.md` | status, direction_version | ui-review |

**缺口（用户画像/需求）**：无专用 skill,H4 Stop hook 对这两个节点的 gate 校验**降级为"产物存在 + frontmatter 完整"**(不强制质量分),避免卡死。

### 5.3 venture-judge 接入

judge 节点 = `WorkflowSpec(workflow_type: W7 AdversarialJudge, executor: venture-judge)`。venture-judge 的 6 入口(/judge /report /deep /pitch /compete /cases)映射到不同节点:judge 节点用 /deep(24步引导),竞品节点用 /compete,商业调查用 /judge。

---

## 6. 度量（Claude 实施者，禁人天）

### 6.1 实施成本

| 维度 | 度量 | 说明 |
|---|---|---|
| **token** | 一次性写 8 个 Hook 脚本 ≈ 8 × 3000 token(含调试) ≈ 24k token | Hook 是 JS 脚本,写一次,后续零 token 成本 |
| **轮次** | 写+测 8 Hook ≈ 16 轮(每 Hook 2 轮:写+测) | 比方案1(改 autopilot 源码)轮次少——Hook 不碰核心逻辑 |
| **skill 配置** | 1 个 settings.json hooks 段 + 0 新 skill(Hook 自包含) | 零新增 skill 上下文成本 |
| **可验证闸** | 每个 Hook 独立可测:`node hook.js < test-input.json` 验证 exit code + stdout | 8 个闸,全部可单元测试 |

### 6.2 运行时成本

| 维度 | 度量 | 说明 |
|---|---|---|
| **每轮 token 增量** | ≈ 0(Hook 不进对话上下文) | **Hook 的零上下文成本优势**(config-systems-guide.md L17): Hook 在对话外执行,不占 context window |
| **每轮延迟** | PostToolUse/PreToolUse ≈ 50-200ms/次(Node 启动) | 8s timeout 绰绰有余;批量操作可接受 |
| **FS 写入** | trace 每次追加 ~200 字节(NDJSON 一行) | 1000 次工具调用 ≈ 200KB,可接受 |
| **checkpoint 大小** | ≈ 1-2KB/次 compact | 扩展字段后仍远小于 transcript |

### 6.3 Hook 零上下文成本的优势（重点论证）

对比三种状态持久化方式:

| 方式 | 上下文成本 | 确定性 | 漂移风险 |
|---|---|---|---|
| **agent prompt 约定**("记得写 trace") | 高(每次提示占 token) | ❌ 低(agent 会忘) | 高 |
| **skill 流程**("第N步写 trace") | 中(skill 加载占 token) | 🟡 中(skill 可能被跳过) | 中 |
| **Hook 强制**(本方案) | **零**(对话外执行) | ✅ 高(确定性) | 低(仅 Hook bug) |

**这就是本方案的根本 ROI**:用零上下文成本换取最高确定性。agent prompt 从"请记得做X"瘦身成"做X"(Hook 兜底持久化),省下的 token 全部用于实际工作。

---

## 7. 自评

### 7.1 三个强点

1. **痛点3/4 根因精准打击**：两者根因都是"靠 agent 自觉",本方案用 Hook 的确定性直接替换"自觉"。痛点3(PostToolUse 写 trace + Stop 校验 + PreCompact 存 checkpoint)和痛点4(PreToolUse 拦截 superseded 文件)各有专门 Hook,不是含糊的"改善流程"。

2. **零上下文成本 + 最小侵入**：8 个 Hook 全部外部挂载,不动 autopilot/ralph 源码,不新增常驻 skill。对比方案1(可能改 autopilot 核心)风险更低;运行时每轮零 token 增量(Hook 在对话外执行)。这是 config-systems-guide.md 六层配置里 Layer4 Hook 的"零上下文成本"特性的最大化利用。

3. **与已验证范式统一**：所有 Hook 复用 compact-snapshot-write.js/restore.js 的工程范式(静默 exit 0 / stdin 10s 超时 / session_id 防护 / 字段结构识别 / additionalContext 注入)。这意味着实施者(Claude)有一个**已在用户环境跑通的参考样板**,不是从零设计——大幅降低实现风险。

### 7.2 三个最易失败假设

1. **假设:PreToolUse 能稳定拦截 Read** —— **失败模式:matcher 漏配 / 网关下 hook 行为差异**。
   - **matcher 漏配**：若 agent 用 `MultiRead`(若存在)或 MCP 工具读文件,matcher `Read|Glob|Grep` 不命中 → Hook 不触发 → 痛点4 漏拦。缓解:matcher 尽量宽(`.*`?但会拖慢所有工具),或接受"主要拦截原生 Read"。
   - **网关下 hook 行为差异**：用户 CLAUDE.md 提到"网关下 claude-mem 失效"——若某些网关/代理环境下 PreToolUse hook 不触发或 stdin 格式不同,H1/H2 全部失效。缓解:H4 Stop hook 作为**兜底闸**(即使前面 Hook 全失效,Stop 仍能检测 trace 无增量 → exit 2 提示漂移)。这是 defense in depth。
   - **timeout**：PreToolUse 5s,若 `.venture/current-direction.md` 在网络盘/慢盘,读超时 → 静默 exit 0 漏拦。缓解:指针文件必须在本地盘。

2. **假设:Stop hook exit 2 能真正阻塞 agent 退出** —— **失败模式:agent 绕过 / 用户嫌烦禁用**。
   - **agent 绕过**：若 agent 在 exit 2 后直接调 Bash 杀进程或换工具,Stop 阻塞失效。缓解:这是极端情况,2pp假设2说的是"偷懒/遗忘"不是"对抗",正常 agent 会读 additionalContext 提示后补做。
   - **用户嫌烦禁用**：Stop hook 频繁 exit 2(因 stagnation 误判)会让用户设 `OMC_SKIP_HOOKS=Stop` 或 `.venture/hooks.disable`。缓解:H4 的 stagnation 阈值要保守(连续 3 轮无 trace 增量才阻塞,非 1 轮),且提示要可操作("请 TaskUpdate 标记完成"而非模糊"有任务未完成")。
   - **stdin 异常**：Stop hook 的 stdin 是否含 TaskList 数据依赖 Claude Code 版本,若格式变动 H4 解析失败 → 降级为只读 trace(不阻塞),痛点3 任务校验失效。缓解:支持多种 stdin 格式(try-catch 多个字段路径)。

3. **假设:方向指针文件是唯一真相源** —— **失败模式:指针与 frontmatter 不一致 / 指针文件损坏**。
   - **不一致**：方向切换 skill 更新了指针但漏改某产物 frontmatter → 人/agent 直接打开产物看到旧 status,与 Hook 判断矛盾。缓解:文档明确"以指针为准",frontmatter 仅为辅助;方向切换 skill 尽量批量更新 frontmatter(但不依赖其完整性)。
   - **指针文件损坏**：方向切换中途 crash → 指针文件半写(write 非 rename)。缓解:用 **write-rename 原子模式**(写临时文件再 rename,POSIX/NTFS 保证原子),指针文件永远完整。
   - **并发写**：两个 session 同时切方向 → 指针文件 race。缓解:指针文件含 session_id,后写者覆盖(最后方向胜出);venture 流水线设计上不应有两个 session 同时跑同方向(单 venture 单 session)。

---

## 附:与方案1/方案3 的预期分歧点（供对抗验证）

| 分歧点 | 本方案(运维组) | 预期方案1(可能改源码) | 预期方案3(可能靠 skill) |
|---|---|---|---|
| 状态持久化主体 | **Hook** | autopilot/ralph 源码扩展 | skill 流程 + agent 约定 |
| 侵入性 | 零(外部 Hook) | 中-高(改核心) | 低(skill 新增) |
| 确定性 | 最高(Hook 确定性) | 中(源码改动有 bug 风险) | 低(靠 agent 自觉) |
| 上下文成本 | 零 | 零(源码层) | 中(skill 占 token) |
| 最大风险 | Hook 不触发(网关/matcher) | 改源码引入回归 | agent 漂移(痛点重现) |
