# 技能知识库构建与推荐协议 — 深度参考

> 本文件是 claude-coach 技能知识库系统的完整实现参考。
> 核心流程：**扫描 → 持久化知识库 → 场景推荐**

## 目录

1. [整体架构](#整体架构)
2. [Phase 1: 多源扫描](#phase-1-多源扫描)
3. [Phase 2: 构建知识库](#phase-2-构建知识库)
4. [Phase 3: 场景推荐引擎](#phase-3-场景推荐引擎)
5. [Phase 4: 更新检测](#phase-4-更新检测)
6. [可移植性保障](#可移植性保障)

---

## 整体架构

```
用户请求 "审查我的技能" 或 "推荐技能"
         │
         ▼
┌─────────────────────────┐
│  Phase 1: 多源扫描       │
│  6 个来源并行扫描         │
│  提取 name/desc/触发词   │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  Phase 2: 构建知识库      │
│  去重 → 分类 → 打标签     │
│  保存 .claude/skills-kb.json (结构化数据)
│  生成 .claude/skills-kb.md  (可读索引)
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  Phase 3: 场景推荐        │
│  A: 单场景匹配           │
│  B: 工作流组合推荐        │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  Phase 4: 更新检测        │
│  Skills CLI / Git / 文件  │
└─────────────────────────┘
```

---

## Phase 1: 多源扫描

### 扫描来源（6 个，按顺序，每个失败静默跳过）

**来源 A: 个人技能**
```
Glob: ~/.claude/skills/*/SKILL.md
→ Read 前 20 行，提取 frontmatter: name + description
→ 标记 source: "personal"
→ 容错: Glob 空结果 → 跳过
```

**来源 B: 项目技能**
```
Glob: .claude/skills/*/SKILL.md
→ 同上提取，标记 source: "project"
```

**来源 C: 官方内置技能**
```
无文件系统操作，使用已知清单：
  update-config, keybindings-help, verify, code-review, simplify,
  fewer-permission-prompts, loop, claude-api, run, init, review,
  security-review, remember:remember
→ 标记 source: "builtin", category 按下表分配
```

| 官方技能 | 自动分类 |
|---------|---------|
| code-review, review, simplify, security-review | code-quality |
| verify, run, init | development |
| loop | automation |
| claude-api | reference |
| update-config, keybindings-help, fewer-permission-prompts | configuration |
| remember:remember | memory |

**来源 D: Skills CLI 管理**
```
Bash: bunx skills ls --json 2>$null || npx skills ls --json 2>$null
→ 解析 JSON，提取 name, source, version
→ 标记 source: "skills-cli"
→ 容错: bunx/npx 不可用 → 跳过
```

**来源 E: OMC 插件技能**
```
Glob: ~/.claude/plugins/oh-my-claudecode/skills/*/SKILL.md
→ 提取 frontmatter，标记 source: "omc"
→ 容错: 路径不存在 → 跳过
```

**来源 F: 自定义路径**
```
Read: .claude/settings.json → skills.scanPaths 数组
→ 对每个路径 Glob: {path}/*/SKILL.md
→ 标记 source: "custom"
→ 容错: 无 scanPaths → 跳过
```

### Frontmatter 提取模板

对每个 SKILL.md 文件，提取以下字段（缺失字段用 fallback）：

| 字段 | 提取方式 | Fallback |
|------|---------|----------|
| `name` | frontmatter `name` | 目录名 |
| `description` | frontmatter `description` | SKILL.md 第一行标题 |
| `triggers` | 从 description 中提取关键词 | 空 |
| `category` | 基于分类规则自动推断 | `"general"` |
| `source` | 扫描来源标记 | 必填 |
| `path` | SKILL.md 文件路径 | — |

---

## Phase 2: 构建知识库

### 去重规则

```
优先级（高 → 低）:
  project > personal > skills-cli > omc > custom > builtin

去重逻辑:
  1. 按 name 收集所有来源条目
  2. 只有一个来源 → 直接使用
  3. 多个来源:
     a. 选最高优先级作为主条目
     b. 合并: 低优先级的 version/path 信息附加到主条目
     c. 冲突标注: builtin + 其他来源同名 → "用户覆盖官方"
```

### 自动分类规则

基于 name 和 description 中的关键词，自动为技能分配 category：

| 分类 | 关键词匹配 |
|------|-----------|
| `code-quality` | review, lint, simplify, refactor, security |
| `development` | run, init, dev, build, deploy, test |
| `automation` | loop, cron, schedule, hook, 自动, 定时 |
| `research` | research, search, deep, academic, paper |
| `writing` | write, article, publish, writer, 写作, 发布 |
| `wechat` | wechat, wx, wecom, 微信 |
| `ai-ml` | model, train, huggingface, llm, gpt |
| `configuration` | config, settings, rules, memory, hook |
| `reference` | api, doc, guide, 参考 |
| `general` | 其他所有 |

### 保存: JSON 知识库

**文件**: `.claude/skills-kb.json`

```json
{
  "version": "1.0",
  "scannedAt": "2026-06-12T10:30:00Z",
  "claudeCodeVersion": "2.1.173",
  "stats": {
    "total": 120,
    "bySource": {
      "builtin": 13,
      "personal": 95,
      "project": 1,
      "skills-cli": 10,
      "omc": 5,
      "custom": 0
    },
    "byCategory": {
      "code-quality": 8,
      "development": 12,
      "automation": 5,
      "wechat": 15
    }
  },
  "skills": [
    {
      "name": "code-review",
      "description": "Review the current diff...",
      "source": "builtin",
      "category": "code-quality",
      "triggers": ["review", "code review", "审查代码", "代码审查"],
      "updateStatus": "builtin",
      "path": null
    },
    {
      "name": "deep-research",
      "description": "Deep research harness...",
      "source": "personal",
      "category": "research",
      "triggers": ["research", "deep research", "研究", "调研"],
      "version": "1.2.0",
      "cliSource": "owner/repo",
      "updateStatus": "up-to-date",
      "lastGitCommit": "2026-05-20",
      "path": "~/.claude/skills/deep-research/SKILL.md"
    }
  ]
}
```

**字段说明**:

| 字段 | 必须 | 说明 |
|------|------|------|
| `name` | ✅ | 技能唯一标识 |
| `description` | ✅ | frontmatter 描述 |
| `source` | ✅ | builtin/personal/project/skills-cli/omc/custom |
| `category` | ✅ | 自动分类 |
| `triggers` | ✅ | 触发关键词数组 |
| `version` | ❌ | Skills CLI 提供的版本号 |
| `cliSource` | ❌ | Skills CLI 来源 (owner/repo) |
| `updateStatus` | ✅ | up-to-date/updatable/stale/unknown/builtin |
| `lastGitCommit` | ❌ | Git 仓库最后提交时间 |
| `path` | ❌ | SKILL.md 文件路径（builtin 无此字段） |

### 生成: Markdown 索引

**文件**: `.claude/skills-kb.md`

```markdown
# 📦 技能知识库索引

> 自动生成于 2026-06-12 | Claude Code v2.1.173
> 共 120 个技能 (官方 13 | 个人 95 | 项目 1 | CLI 10 | OMC 5)

## 🔒 官方内置 (13)
- `code-review` — 代码审查 [code-quality]
- `simplify` — 代码简化 [code-quality]
- `loop` — 定时循环 [automation]
- ...

## 🔧 代码质量 (8)
- `gsd-code-review` — GSD 代码审查 [personal]
- `code-simplicity-reviewer` — 代码简洁度审查 [personal]
- ...

## 🤖 自动化 (5)
- `wx-cron` — 微信定时任务 [wechat]
- `deepsearch` — 深度搜索 [research]
- ...

## ✍️ 写作 (6)
- `wechat-article-writer` — 微信文章写作 [wechat]
- ...

## 📚 研究 (4)
- `deep-research` — 深度调研 [research]
- `academic-researcher` — 学术研究 [research]
- ...

> 💡 说"推荐技能"查看完整推荐，说"我要做 X"获取场景匹配
```

---

## Phase 3: 场景推荐引擎

### 推荐模式 A: 单场景匹配

用户描述一个场景或需求，匹配最相关的技能。

**匹配流程**:
```
1. 读取 .claude/skills-kb.json
2. 解析用户意图 → 提取关键词
3. 对每个技能:
   a. triggers 关键词匹配（精确 > 模糊）
   b. description 语义匹配
   c. category 相关性
4. 按匹配度排序，返回 Top 3-5
5. 每个推荐附带"为什么推荐"
```

**输出格式**:
```
🎯 场景: "我要做代码审查"

推荐技能:
  1. ⭐ code-review (官方内置) — 专门做 diff 审查
     为什么: 精确匹配"代码审查"，官方内置零配置
  2. gsd-code-review (个人) — GSD 代码审查流程
     为什么: 更结构化的审查流程，适合大型项目
  3. security-review (官方内置) — 安全审查
     为什么: 如果代码涉及认证/权限，建议叠加使用

组合建议: code-review + security-review 覆盖全面
```

### 推荐模式 B: 工作流组合推荐

用户描述一个完整工作流，推荐技能组合方案。

**预置工作流模板**:

```
模板 1: 软件开发全流程
  需求分析 → 编码 → 测试 → 审查 → 部署
  推荐组合:
    深度研究(调研方案) → run(开发运行) → verify(验证)
    → code-review(审查) → security-review(安全)

模板 2: 论文写作流程
  文献调研 → 写作 → 排版 → 发布
  推荐组合:
    academic-researcher(文献) → writing-skills(写作)
    → typography(排版) → wechat-article-publisher(发布)

模板 3: 内容创作流程
  选题 → 调研 → 写作 → 发布 → 监控
  推荐组合:
    deep-research(调研) → wechat-article-writer(写作)
    → wechat-publisher(发布) → wx-cron(定时监控)

模板 4: 代码质量保障
  编码 → 审查 → 安全 → 简化 → 验证
  推荐组合:
    code-review(审查) → security-review(安全)
    → simplify(简化) → verify(验证)

模板 5: 自动化运维
  监控 → 告警 → 执行 → 报告
  推荐组合:
    loop(定时监控) → wx-notify(告警) → wecom-unified(执行通知)
```

**匹配流程**:
```
1. 读取 .claude/skills-kb.json
2. 解析用户工作流阶段（关键词: "开发流程"/"论文"/"内容"/"质量"/"运维"）
3. 匹配最接近的工作流模板
4. 用知识库中实际拥有的技能填充模板
5. 标注缺失的技能（模板推荐但用户未安装）
6. 输出完整方案
```

**输出格式**:
```
📋 工作流推荐: 软件开发全流程

阶段 1: 需求调研
  → ✅ deep-research (已安装)

阶段 2: 编码开发
  → ✅ run (官方内置)

阶段 3: 代码审查
  → ✅ code-review (官方内置)
  → ✅ security-review (官方内置)

阶段 4: 验证部署
  → ✅ verify (官方内置)
  → ⚠️ 缺少 deploy 相关技能 → 推荐: `bunx skills find deploy`

📊 覆盖率: 5/6 阶段 (83%)
💡 安装建议: 补充部署技能可达 100% 覆盖
```

### 智能推荐触发词

当用户说以下内容时，自动进入推荐模式：

| 用户说 | 推荐模式 | 示例 |
|--------|---------|------|
| "推荐技能" / "我要做 X" | A: 单场景 | "我要做代码审查" |
| "开发流程" / "工作流" / "全流程" | B: 工作流组合 | "推荐开发全流程技能组合" |
| "审查技能" / "技能组合" | A+B | 先单场景，再推荐组合 |
| "技能太多了" / "不知道用哪个" | A: 单场景 | "我要做 X，该用哪个" |

---

## Phase 4: 更新检测

### 检测方法

**Skills CLI 技能**:
```bash
bunx skills check 2>$null || npx skills check 2>$null
```
→ 标记 `updatable`

**Git 仓库技能**:
```bash
git -C <skill-dir> log -1 --format="%ci" 2>$null
```
→ > 30 天: `stale` | > 90 天: `deprecated`

**对比已有知识库**:
```
读取 .claude/skills-kb.json 的 scannedAt
如果距离上次扫描 > 7 天 → 提示"建议重新扫描"
```

### 更新状态值

| 状态 | 含义 | 显示 |
|------|------|------|
| `up-to-date` | 最新 | ✅ |
| `updatable` | 有新版本 | 🔄 |
| `stale` | 30天+未更新 | ⚠️ |
| `deprecated` | 90天+未更新 | ❌ |
| `unknown` | 无法检测 | ❔ |
| `builtin` | 随 Claude Code 更新 | 🔒 |

---

## 可移植性保障

### 核心原则

1. **路径**: 所有路径用 `~` 或相对路径，Claude 自动解析
2. **容错**: 每个扫描来源失败静默跳过，不阻塞
3. **命令**: `bunx` 优先，`npx` 备选，不可用跳过
4. **配置**: 自定义路径通过 `settings.json` 的 `skills.scanPaths`
5. **知识库**: JSON + MD 文件存在 `.claude/` 下，跟随项目，可版本控制

### 跨环境兼容

| 环境 | 处理 |
|------|------|
| Windows | `~` 自动解析，`2>$null` 抑制错误 |
| macOS | 同上 |
| Linux | 同上 |
| 无 bunx/npx | 跳过 Skills CLI 来源 |
| 无 git | 跳过 Git 更新检测 |
| 无 OMC | 跳过 OMC 来源 |

### 用户可配置额外路径

```json
// .claude/settings.json
{
  "skills": {
    "scanPaths": [
      "~/my-custom-skills",
      "../shared-skills"
    ]
  }
}
```

---

## Loop Engineering 视角：技能作为循环资产

在 Loop Engineering 中，技能是**循环的资产**。循环是管道，技能是内容。

### 技能复用的核心原则

> 如果一件事你做了两次，把它变成自动 skill。如果一件事很难，做完后把它变成 skill，下次就免费了。
> — Steinberger

```
循环不调用 skill 时:
  → while true 围绕一个陌生人
  → 每轮重新推导一切

循环调用精心设计的 skill 时:
  → 一个复利系统
  → 每次复用，成本递减
```

### 技能 → 循环资产的转化路径

```
1. 发现重复模式
   "我总是做同样类型的代码审查"
   → 提取为 skill: /code-review

2. 封装为命名配方
   skill = prompt + 工具策略 + 验证步骤
   → 一个完整的、可复用的工作单元

3. 注册到循环
   /loop 30m /code-review
   /loop 15m /fix-ci
   /loop 1h /dependency-audit

4. 持续优化
   每次循环运行后，根据结果优化 skill prompt
   → 技能越用越好
```

### 技能知识库在循环中的角色

```
场景: "我要设计一个持续运行的审查循环"

1. cc-scanner 扫描知识库 → 找到可用技能
2. 用户选择: code-review + security-review + simplify
3. 组合为循环:
   /loop 30m 运行 code-review，
   发现安全问题时触发 security-review，
   代码可简化时触发 simplify
4. 循环合同:
   TRIGGER: 每30分钟
   SCOPE: src/ 目录变更文件
   ACTION: 审查 → 安全 → 简化
   BUDGET: 每轮最多 3 个 sub-agent
   STOP: 无变更文件或 20 轮
   REPORT: 输出审查摘要
```

### 扫描知识库时关注循环适配性

```
在审查技能时，额外评估:
  □ 这个技能可以在无人值守下运行吗？
  □ 有内置的验证/反馈步骤吗？
  □ 输出格式是否结构化（方便循环解析）？
  □ 失败时是否有明确的退出信号（BLOCKED）？
  □ 是否有预算约束机制？
```
```
