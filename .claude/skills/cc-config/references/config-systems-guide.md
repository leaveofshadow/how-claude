# 配置系统指南 — Rules/Agents/Memory/Skills/Hooks 深度参考

## 六层配置体系

```
┌──────────────────────────────────────────────────┐
│ Layer 0: Enterprise Policy (IT 管控)              │ ← 只读，最高优先级
│   Windows: C:\ProgramData\ClaudeCode\CLAUDE.md   │
│   macOS: /Library/Application Support/...         │
├──────────────────────────────────────────────────┤
│ Layer 1: 全局 CLAUDE.md (~/.claude/CLAUDE.md)     │ ← 个人身份/风格
├──────────────────────────────────────────────────┤
│ Layer 2: 项目 CLAUDE.md (项目根目录)               │ ← 架构/技术栈/命令
├──────────────────────────────────────────────────┤
│ Layer 3: Skills (.claude/skills/)                 │ ← 按需加载
├──────────────────────────────────────────────────┤
│ Layer 4: Hooks (settings.json)                    │ ← 零上下文成本
├──────────────────────────────────────────────────┤
│ Layer 5: Memory (~/.claude/projects/.../memory/)  │ ← 跨会话持久
└──────────────────────────────────────────────────┘
```

## 配置系统选择器

```
你的需求是？
│
├─ "让 Claude 永远记住 X"
│  ├─ X 是固定的（编码风格、语言偏好）→ 全局 CLAUDE.md
│  ├─ X 是项目特有的（架构约定、命令）→ 项目 CLAUDE.md
│  └─ X 是渐进积累的（经验教训）     → Memory
│
├─ "每次保存/提交时自动 Y"
│  └─ → Hook（PreToolUse / PostToolUse）
│
├─ "复杂多步工作流"
│  └─ → Skill（按需加载，不占常驻空间）
│
├─ "特定领域的专家助手"
│  └─ → Agent（独立上下文窗口，可复用）
│
├─ "权限控制"
│  └─ → Settings（permissions.allow/deny/ask）
│
└─ "跨会话积累经验"
   └─ → Memory（自动过期 + 手动持久）
```

## CLAUDE.md 设计诊所

### 质量评分标准

| 信号 | 好规则 | 坏规则 |
|------|--------|--------|
| 具体 | "Use 2-space indentation" | "Format code properly" |
| 有结构 | 用 markdown 标题分组 | 一大段连续文本 |
| 示例 > 描述 | "Output: `feat(auth): add JWT`" | "Write conventional commits" |
| 说"做什么" | "Always add types to new functions" | "Don't forget types" |
| 适度 | 5-15 条核心规则 | 50+ 条覆盖一切 |

### 诊断清单

1. **检查长度** — 超过 100 行就该拆分（用 import 或 Skill）
2. **检查冲突** — 是否有互相矛盾的指令
3. **检查冗余** — 是否有 Claude 默认就会做的事
4. **检查精度** — 是否有模糊的"适当"、"合理"
5. **检查 import** — 是否可以用 `@path/to/file` 拆分大段参考

### import 语法

```markdown
# CLAUDE.md
## 编码风格
@.claude/rules/coding-style.md

## 架构约定
@.claude/rules/architecture.md
```

- 相对路径和绝对路径都支持
- 最大递归深度 5 层
- 不在 code span 和 code block 内求值

### 常见模板

**最小全局 CLAUDE.md：**
```markdown
# 偏好
- 用中文简体回答
- 代码注释用英文
- 提交信息用 conventional commits 格式
```

**项目 CLAUDE.md 结构：**
```markdown
# 项目名

## 技术栈
- 前端: React 18 + TypeScript
- 后端: Node.js + Express
- 数据库: PostgreSQL

## 常用命令
- 开发: `npm run dev`
- 测试: `npm test`
- 构建: `npm run build`
- Lint: `npm run lint`

## 架构约定
- API 路由在 src/routes/
- 业务逻辑在 src/services/
- 数据访问在 src/repositories/

## 编码规则
- 新函数必须有 TypeScript 类型
- API 端点必须有错误处理中间件
```

## Hook 设计模式

### Hook 事件类型

| 事件 | 触发时机 | 典型用途 |
|------|---------|---------|
| `PreToolUse` | 工具调用前 | 拦截危险命令、自动批准 |
| `PostToolUse` | 工具完成后 | 自动格式化、日志记录 |
| `Notification` | 通知发送时 | 自定义通知渠道 |
| `UserPromptSubmit` | 用户提交 prompt | 注入上下文、验证 prompt |
| `Stop` | Claude 停止响应 | 检查是否有遗漏任务 |
| `SubagentStop` | subagent 完成 | 后处理 subagent 结果 |
| `SessionStart` | 会话启动 | 加载项目状态 |
| `PreCompact` | compact 前 | 保存关键信息 |
| `SessionEnd` | 会话结束 | 清理、统计 |

### 实用 Hook 模式

**模式 1: 保存时自动格式化**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "npx prettier --write \"$CLAUDE_PROJECT_DIR/$FILE_PATH\""
        }]
      }
    ]
  }
}
```

**模式 2: 安全检查**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "echo '$TOOL_INPUT' | jq -r '.command' | grep -qiE 'rm -rf|drop table|truncate' && echo 'BLOCK: 危险命令' && exit 2 || exit 0"
        }]
      }
    ]
  }
}
```

**模式 3: 会话启动时注入上下文**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{
          "type": "command",
          "command": "echo \"当前分支: $(git branch --show-current 2>/dev/null)\"; echo \"最近改动:\"; git diff --stat HEAD~5 2>/dev/null | tail -5"
        }]
      }
    ]
  }
}
```

**模式 4: 阻止过早停止**
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "if [ -f .claude/tasks-pending ]; then echo 'BLOCK: 还有未完成任务'; cat .claude/tasks-pending; exit 2; fi; exit 0"
        }]
      }
    ]
  }
}
```

## Memory 策略

### Memory 文件格式

```markdown
---
name: short-kebab-case-slug
description: 一行摘要（用于判断相关性）
metadata:
  type: user | feedback | project | reference
---

事实内容。
对于 feedback/project：加上 **Why:** 和 **How to apply:** 行。
用 [[name]] 链接相关记忆。
```

### 三种 Memory 类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `user` | 用户身份、偏好、专长 | "用户是全栈工程师，偏好函数式编程" |
| `feedback` | 纠正和工作方式指导 | "用户不喜欢自动 commit，要先确认" |
| `project` | 项目状态、决策、约束 | "认证系统已从 session 迁移到 JWT" |
| `reference` | 外部资源指针 | "API 文档在 http://..." |

### Memory 最佳实践

1. **每个文件一个事实** — 不要把多个不相关的事实放一个文件
2. **写 MEMORY.md 索引** — 每条一行 `- [标题](文件.md) — 钩子`
3. **检查重复** — 写入前先看是否已存在
4. **清理过时** — 不再适用的记忆要删除
5. **链接关联** — 用 `[[name]]` 连接相关记忆

## Settings.json 关键配置

```json
{
  "permissions": {
    "allow": ["Bash(git diff:*)", "Bash(npm test:*)"],
    "deny": ["Read(./.env)", "Read(./secrets/**)"],
    "ask": ["Bash(git push:*)"]
  },
  "hooks": { "...": "..." },
  "env": { "NODE_ENV": "development" }
}
```

### 权限设置技巧

| 规则 | 含义 | 示例 |
|------|------|------|
| `Bash(git diff:*)` | 允许所有 git diff 命令 | 自动批准无害命令 |
| `Bash(git push:*)` | push 前确认 | 防止意外推送 |
| `Read(./.env)` | 拒绝读取 | 保护敏感文件 |
| `Read(./secrets/**)` | 拒绝整个目录 | 保护密钥目录 |

---

## Loop Engineering 视角：锚文件设计

在 Loop Engineering 中，配置系统的核心作用是**为循环提供稳定的锚文件**。每次迭代可能丢失对话上下文，但锚文件是"常量"。

### 锚文件体系

```
VISION.md      → 方向锚：我们在建什么、为什么、完成长什么样
                  位置: 项目根目录
                  谁需要: /goal 驱动的循环、长时间自主 agent
                  设计原则: 用 5-10 行说清方向和约束

CLAUDE.md      → 规则锚：技术栈、命令、护栏
                  位置: 项目根目录（全局 ~/.claude/CLAUDE.md）
                  谁需要: 所有循环，每次迭代都重读
                  设计原则: 具体、可执行、不矛盾

AGENTS.md      → agent 规则锚：每个 agent 的行为约束
                  位置: 项目根目录
                  谁需要: 多 agent 编排循环（Stage 4-5）
                  设计原则: 每个 agent 一段，互不冲突

PROMPT.md      → 循环 prompt 锚：每轮喂给 agent 的固定内容
                  位置: 项目根目录
                  谁需要: ralph 循环（Stage 1）
                  设计原则: 一个离散任务 + 验证 + 退出条件

loop.md        → /loop 默认 prompt 锚
                  位置: .claude/loop.md
                  谁需要: 裸 /loop 命令
                  设计原则: 替代内置 maintenance prompt
```

### 锚文件设计原则

1. **常量 vs 变量分离**：锚文件是常量（不随迭代变化），对话上下文是变量
2. **每次迭代重读**：设计时假设 agent 每次都是"空白的"，只靠锚文件恢复
3. **具体优于抽象**："用 2-space 缩进" 优于 "格式化好"
4. **有说"不"的**：锚文件中包含验证手段（tests/typecheck/lint）

### CLAUDE.md 作为循环锚点

```
CLAUDE.md 不受 compact 影响（每次调用都重新加载）。
在循环场景下，CLAUDE.md 应该包含:

  1. 技术栈和命令（每轮都需要）
  2. 不能破坏的约束（护栏）
  3. 验证方法（反馈）
  4. 项目结构（导航用）

不应包含:
  - 当前任务描述（变化太快，用 PROMPT.md）
  - 临时决策（用 Memory）
  - 长段参考文档（用 Skill 按需加载）
```
