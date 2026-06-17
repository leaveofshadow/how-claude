# 自动 Compact 方案设计（spec）

- **日期**：2026-06-16
- **状态**：已实现并**端到端验证通过**（2026-06-16，见 §10）
- **项目**：how-claude（claude-coach 技能套件）
- **非 git 仓库**：spec 写盘但不 commit

---

## 1. 背景与问题

1. **claude-mem 记忆层全空**：根因是 worker 在 BigModel 代理（`ANTHROPIC_BASE_URL=open.bigmodel.cn` + AUTH_TOKEN）下，用 `subscription`（keychain OAuth）认证的 Claude SDK 子进程全部返回 `Not logged in · Please run /login`，退出 code=1 → `observations`/`session_summaries` 一条都没生成。**结论：放弃修 claude-mem**（第三方插件认证机制 vs 非标准代理，不确定性高）。
2. **compact 时无任何抢救**：全局 `settings.json` 有 Stop/SessionStart/PreToolUse/PostToolUse，**但没有 PreCompact** → auto-compact 一发生，未完成任务/改动文件/当前目标就丢。
3. **auto-compact 触发时机不可控**：本地会话默认「达到上下文上限才触发」，无法按需提前。

## 2. 目标

让 compact 这件事做到两件事：① 在期望时机**自动触发**；② 触发时**抢救关键上下文**，compact 后不丢。

## 3. 两层架构

```
层 0  配置 auto-compact 触发（环境变量） —— 让 compact 在期望时机自动发生
层 1  双 hook 上下文抢救                  —— 压缩时保住关键上下文
        PreCompact(matcher *)      → 读 transcript → 规则提取 → 写 snapshot → exit 0
        SessionStart(source compact)→ 读 snapshot → additionalContext 注入
```

### 层 0：配置触发（环境变量，写入 settings.json 的 env）

> ⚠️ `autoCompactEnabled` 这个 settings 键**不存在**（旧认知错误）。控制 auto-compact 的是环境变量。

```jsonc
"env": {
  "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "200000",   // 进入「主动压缩模式」
  "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "60"        // 上下文占用达 60% 时触发（比默认更早；只能调低）
}
```

- `DISABLE_AUTO_COMPACT=1` 可关（默认开）；`DISABLE_COMPACT=1` 全禁（含手动）。
- **限制**：`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 只在主动模式下生效；本地会话默认「到上限才触发」，必须先设 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 才进主动模式；且**只能调低**。
- **已验证（2026-06-16）**：用户报告「其它窗口都自动 autocompact 了」→ BigModel 网关下 `WINDOW=200000` 确实进入主动模式，60% 触发正常。原「待实测」风险**解除**。

### 层 1：双 hook（注册在全局 `~/.claude/settings.json`，snapshot 落各项目）

**数据流**：
```
compact 触发（manual /compact 或 auto）
  ▼
PreCompact hook  matcher: *
  ├─ stdin → { session_id, transcript_path, cwd, trigger }
  ├─ 读 transcript_path 的 .jsonl（只处理 type∈{user,assistant} 且 !isSidechain 且 !isMeta）
  ├─ 规则提取 4 块（见 §5）
  ├─ 写 {cwd}/.claude/compact-snapshots/{session_id}.md
  └─ exit 0（永远放行；绝不 exit 2 阻止 auto，否则请求失败）
  ▼ Claude 执行 compact
SessionStart hook  source: compact
  ├─ 读最新 snapshot
  └─ additionalContext 注入：「【compact 前状态恢复】… <snapshot 正文>」
```

> 关键事实（claude-code-guide 确认，基于官方文档）：
> - PreCompact stdin **不含对话历史**，只给 `transcript_path`（需自己读 .jsonl）。
> - PreCompact **不支持** `additionalContext`，只能放行/阻止；注入必须靠 `SessionStart(source: compact)`。

## 4. snapshot 文件格式

- **路径**：`{cwd}/.claude/compact-snapshots/{session_id}.md`（项目级；compact 是会话内压缩，session_id 不变 → 同名覆盖）
- **格式**：Markdown + frontmatter；**正文 = 纯状态**，注入包装语由 SessionStart hook 加。

```markdown
---
session_id: <id>
project: <name>
created_at: <ISO8601>
trigger: auto|manual
transcript_messages: <N>
snapshot_version: 1
---

# Compact 前状态快照

## 当前目标
<最后 3 条真实 user prompt>

## 未完成任务（来自最后一次 TodoWrite）
- [in_progress] …
- [pending] …

## 本会话改动的文件
- path/a.ts (Edit)
- docs/b.md (Write)

## 最近对话要点
<最后 2 条 assistant text，各 ≤150 字>
```

## 5. 提取规则（选项甲：纯原生，零插件耦合）

**预处理**：逐行 parse .jsonl，只处理 `type∈{user,assistant}` 且 `isSidechain==false` 且 `isMeta==false`。attachment/system/mode/last-prompt 等忽略。

| 块 | 来源 | 规则 |
|---|---|---|
| ① 未完成任务 | **只认原生 `TodoWrite`**（input.todos[].status 自包含全量） | 取最后一次 TodoWrite，列 `pending`/`in_progress` |
| ② 改动文件 | **字段结构识别**：tool_use.input 含 `file_path` 且含写入字段（`old_string`/`new_string`/`content`/`edits`）→ 改动；只有 `file_path` → Read，**排除** | 去重，标 (Edit/Write)，绝对路径转项目相对 |
| ③ 当前目标 | user message.content（str，非 isMeta，非 `<command-`/caveat 前缀） | 最后 3 条 |
| ④ 最近要点 | assistant content[].type=="text"（不抓 thinking） | 最后 2 条，各 ≤150 字 |

**解耦姿态**：hook 只懂原生 transcript 结构 + 字段特征，**不硬编码任何插件工具名**。OMC 的 `TaskCreate`/`TaskUpdate` **不支持**（用户选「甲」：纯原生，不做配置层）。代价：OMC 环境下 Block① 抓不到任务（可接受）。

**工程约束**：静默失败（异常 → exit 0，不阻塞）；session_id 文件名防护（`/[/\\]|\.\./` 拒绝）；stdin 10s 超时保护（Windows/Git Bash，同 gsd hook #775）；显式 UTF-8；整体 <2s（timeout 给 30s）。

## 6. 收尾（默认提议，待审查）

- **保留**：snapshot 目录超过 10 个时按 mtime 删最旧；`.claude/compact-snapshots/` 加 `.gitignore`。
- **开关**：项目根存在 `.claude/compact-snapshot.disable` → hook 跳过（touch 即禁）。
- **测试**：① 提取逻辑单测（fixture=真实 transcript `6e754073…jsonl`）；② 手动触发两 hook；③ 端到端跑 `/compact`；④ 大 transcript 性能 <2s。

## 7. 实现产物清单

1. `~/.claude/hooks/compact-snapshot-write.js`（PreCompact）
2. `~/.claude/hooks/compact-snapshot-restore.js`（SessionStart/compact）
3. 全局 `~/.claude/settings.json` 加两条 hook 注册 + 层 0 的 env
4. cc-context 技能新增「自动 compact + 记忆写回」章节（原选的「3」，顺势融入）
5. 测试脚本 + verify.md

## 8. 待用户审查确认

1. ~~层 0 百分比取值~~ → **已定 60，且已验证**（2026-06-16：其它窗口实测 auto-compact 自动触发，BigModel 网关进主动模式正常，60% 触发点成立。原「网关待实测」风险解除）
2. **§6 收尾默认**：保留 10 个 / `.disable` 开关 / 测试四层——有要改的吗？
3. **cc-context 文档**：要不要做（原选的「3」），还是只交付 hook？

## 9. 关键事实依据（官方文档）

- PreCompact / SessionStart hook 规范：https://code.claude.com/docs/en/hooks.md
- hooks guide（Re-inject context after compaction）：https://code.claude.com/docs/en/hooks-guide.md
- auto-compact 环境变量：https://code.claude.com/docs/en/env-vars.md
- context-window（What survives compaction）：https://code.claude.com/docs/en/context-window.md

## 10. 实现与验证记录（2026-06-16）

### 产物（全部落地）
- ✅ `~/.claude/hooks/compact-snapshot-write.js`（PreCompact，选项甲提取 + 写盘）
- ✅ `~/.claude/hooks/compact-snapshot-restore.js`（SessionStart/compact，additionalContext 注入）
- ✅ 全局 `~/.claude/settings.json`：新增 `PreCompact`（timeout 30）+ `SessionStart` 追加 restore（timeout 10）
- ⏳ cc-context 文档章节：未做（待定，见 §8.3）

### 验证结果
| 项 | 方法 | 结果 |
|---|---|---|
| 提取逻辑 | 真实 transcript（6e754073…jsonl，236 条 user/assistant）跑 write hook | ✅ 4 块正确；compact summary 已排除；改动文件 4 个识别正确 |
| restore 注入 | 模拟 `source=compact` stdin | ✅ 输出 additionalContext JSON（hookEventName=SessionStart） |
| source 过滤 | 模拟 `source=resume` stdin | ✅ 静默无输出，exit 0 |
| 放行（不阻塞） | write/restore exit code | ✅ 均 exit 0 |
| 性能 | PowerShell Measure-Command（236 条） | ✅ **183 ms**（目标 <2000 ms） |
| JSON 合法性 | `node JSON.parse(settings.json)` | ✅ VALID；PreCompact 已注册；SessionStart=3 条 |

### 实现中修复的 2 个 bug
1. compact 后系统注入的「会话续接 summary」会作为 user message 混入「当前目标」→ 加 `COMPACT_SUMMARY_RE` 按模板开头 `^This session is being continued` 排除。
2. 单条 prompt/note 含换行导致列表项跨行渲染 → push 时 `\s+` 压成单空格。

### 工程约束（全部落实）
静默失败（异常 → exit 0）｜session_id 路径遍历防护｜stdin 10s 超时守卫｜显式 UTF-8｜保留最新 10 个｜`.gitignore` 首次自动创建｜`.claude/compact-snapshot.disable` 开关。

### 端到端（§6 ③，已真实确认 ✅）
**2026-06-16 真实 auto-compact 触发**（`trigger: auto`，291 条消息）：
- ① `{cwd}/.claude/compact-snapshots/6e754073-e4e5-4066-bdc8-b517db64ca10.md` ✅ 已生成，4 块提取正确（目标 3 条 / 任务块 TodoWrite 说明 / 改动文件 5 个，含跨目录的绝对路径按设计保留 / 要点 2 条）。
- ② SessionStart(compact) ✅ 对话注入「【compact 前状态恢复】…」完整块。

机制链路全程跑通：**PreCompact 写盘 → Claude 压缩 → SessionStart 恢复注入**。`trigger=auto` 证明它在真实自动 compact 时触发（非手动模拟）。新 hook 在本会话启动时加载 settings.json 即生效。
