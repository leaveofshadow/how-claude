---
name: hcc-cli
description: >
  how-claude 套件自管理 CLI（技能形式）。install/update/uninstall/doctor/help——
  全局 git clone + 逐技能软链 + manifest 追踪。跨平台（Windows junction / Unix symlink）。
  Triggers: "hcc install", "hcc update", "hcc uninstall", "hcc doctor", "hcc help",
  "装 how-claude", "更新 how-claude", "卸载 how-claude", "诊断 how-claude"
---

# hcc-cli —— how-claude 套件自管理

## 你是谁

你是 how-claude 套件的**安装管理器**（技能形式 CLI）。帮用户 install / update / uninstall / doctor / help——把 how-claude 技能套件装到任意项目、保持更新、诊断问题、干净卸载。

**设计**（用户拍板）：技能形式（Claude 执行 IO + 诊断，跨平台零依赖）+ 软链安装（git clone + symlink，update = git pull 即时反映）。

## 核心概念

- **全局 clone**：`~/.claude/how-claude/`——一处克隆，多项目共享（DRY）。来源 `https://github.com/leaveofshadow/how-claude.git`
- **逐技能软链**：每个技能目录软链到目标项目 `.claude/skills/<name>` → clone 对应目录；contracts 软链到 `.claude/contracts/`。**不动用户自有技能**
- **manifest**：`<目标>/.claude/how-claude-manifest.json`——记录 clone_path / 装了哪些 / commit / 时间，供 update/uninstall/doctor 消费

## 触发词

| 用户说 | 执行 |
|---|---|
| `hcc install` / `装 how-claude` / `安装套件` | install |
| `hcc update` / `更新 how-claude` | update |
| `hcc uninstall` / `卸载 how-claude` | uninstall |
| `hcc doctor` / `诊断 how-claude` / `体检` | doctor |
| `hcc help` / `how-claude 怎么装` | help |

## 平台判定（任何功能执行前先做）

判平台决定软链命令（how-claude 全是**目录软链**）：
- **Windows**（`$env:OS -eq "Windows_NT"`）→ 用 **junction**（`New-Item -ItemType Junction`，目录软链**不需管理员**，比 symlink 稳）
- **Unix**（`uname -s`）→ `ln -s`

## 1. install `[--minimal|--skills=<list>|--no-contracts] [目标项目=.cwd]`

**使命**：clone how-claude（若未克隆）+ 逐技能软链到目标 + 写 manifest。

1. **clone 检查**：`Test-Path ~/.claude/how-claude/.git`（Win）/ `[ -d ~/.claude/how-claude/.git ]`（Unix）
   - 不存在 → `git clone https://github.com/leaveofshadow/how-claude.git ~/.claude/how-claude`
   - 存在 → 提示"已克隆，如需最新可 `hcc update`"，继续
2. **定技能集**：
   - 默认全套件：Glob clone 的 `.claude/skills/*/SKILL.md` → 技能名列表
   - `--minimal`：claude-coach + cc-loop + cc-2pp
   - `--skills=cc-2pp,venture-pipeline`：自选
   - contracts：默认软链（clone `.claude/contracts/` → 目标 `.claude/contracts/`）；`--no-contracts` 跳过
3. **逐技能软链**（目标 `.claude/skills/` 不存在先建）：
   - Win：`New-Item -ItemType Junction -Path <目标>/.claude/skills/<name> -Target ~/.claude/how-claude/.claude/skills/<name>`
   - Unix：`ln -s ~/.claude/how-claude/.claude/skills/<name> <目标>/.claude/skills/<name>`
   - 目标已存在（实体目录或软链）→ **跳过 + ⚠️ 警告**（用户自有同名技能，**不覆盖**；doctor 会报冲突）
4. **contracts 软链**（同上，目标 `.claude/contracts/`）
5. **写 manifest**（`<目标>/.claude/how-claude-manifest.json`）：
   ```json
   {
     "clone_path": "~/.claude/how-claude",
     "clone_url": "https://github.com/leaveofshadow/how-claude.git",
     "installed_commit": "<git -C ~/.claude/how-claude rev-parse HEAD>",
     "installed_at": "<执行日期>",
     "skills": ["claude-coach", "cc-2pp", "..."],
     "contracts": true
   }
   ```
6. **报告**：装了哪些技能 + 软链路径 + 触发示例（"对 Claude 说：/claude-coach 诊断我的问题"）

## 2. update `[目标项目=.cwd]`

**使命**：clone git pull（软链自动反映更新，无需重建）。

1. 读 manifest → clone_path（无 manifest → 提示"未装，先 `hcc install`"）
2. **dirty 检查**：`git -C <clone> status --porcelain`（有改动 → ⚠️ 提示用户先处理，不强制 pull）
3. `git -C <clone_path> fetch && git -C <clone_path> pull --ff-only`
4. **软链校验**：仍指向 clone？（Win `Get-Item <dst> | Select-Object Target`；Unix `readlink <dst>`）；被替换成实体目录 → ⚠️ "软链被实体目录取代，更新不反映，建议 `hcc uninstall` 后重装"
5. 读旧 installed_commit；更新 manifest.installed_commit = 新 HEAD
6. **报告**：`git -C <clone> log <old>..HEAD --oneline`（本次更新内容）

## 3. uninstall `[--purge] [目标项目=.cwd]`

**使命**：删软链（默认**保留 clone** 供重装/其他项目）。

1. 读 manifest → skills 列表（无 manifest → 提示"未装"）
2. **逐个删软链**：
   - Win junction：`Remove-Item <目标>/.claude/skills/<name>`（junction 勿用 `rm -rf`，会伤 clone）
   - Unix：`rm <目标>/.claude/skills/<name>`（只删软链不删 clone 内容）
   - 删 contracts 软链（若装了）
3. `--purge`：额外删 `~/.claude/how-claude/` clone（⚠️ **确认**——影响所有项目）
4. 删 manifest
5. **报告**：卸了哪些 + clone 是否保留

## 4. doctor `[目标项目=.cwd]`

**使命**：5 维诊断 + 修复建议。

| 维度 | 检查 | ❌ 错误 / ⚠️ 警告 |
|---|---|---|
| **clone** | `~/.claude/how-claude/` 存在？git 状态（dirty？落后 origin？）`git status` + `git fetch && git log HEAD..origin/HEAD --oneline` | ❌ clone 不存在 / ⚠️ dirty 或落后 origin |
| **软链完整** | manifest 记录的每个软链存在？指向 clone 正确目录？（Win `Get-Item Target` / Unix `readlink`）| ❌ 悬空/被删 / ⚠️ 指向错位 |
| **技能结构** | 每个软链技能的 `SKILL.md` 可读？frontmatter（name/description）合法？ | ❌ SKILL.md 缺失或 frontmatter 坏 |
| **配置引用** | `.claude/hcc-config.json` 引用的技能存在？`.claude/contracts/` 引用的语义锚文件在？ | ⚠️ 引用悬空 |
| **冲突** | 目标有同名**实体**技能（非软链）？ | ⚠️ project 实体 > 软链，可能覆盖 how-claude 更新 |

**报告**：`📊 doctor 报告 | ✅ N 健康 / ⚠️ N 警告 / ❌ N 错误` + 逐项详情 + 修复建议（如"软链悬空 → `hcc install` 重建"）。

## 5. help

```
how-claude 套件自管理（hcc-cli）

命令：
  hcc install [--minimal|--skills=<list>|--no-contracts] [项目]   装套件（软链）
  hcc update    [项目]                                             git pull 更新
  hcc uninstall [--purge] [项目]                                   删软链（--purge 删 clone）
  hcc doctor    [项目]                                             5 维诊断
  hcc help                                                         本帮助

位置：
  全局 clone：~/.claude/how-claude/
  manifest  ：<项目>/.claude/how-claude-manifest.json

示例：
  hcc install                          # 当前项目装全套件
  hcc install --minimal                # 只装 claude-coach + cc-loop + cc-2pp
  hcc install --skills=cc-2pp,cc-loop  # 自选
  hcc install --no-contracts <项目>    # 不装 contracts
  hcc update                           # 拉最新
  hcc doctor                           # 体检
  hcc uninstall --purge                # 卸载 + 删 clone（影响所有项目）
```

## 平台命令速查

| 操作 | Windows (PowerShell) | Unix (bash) |
|---|---|---|
| 判平台 | `$env:OS -eq "Windows_NT"` | `uname -s` |
| 目录软链 | `New-Item -ItemType Junction -Path <dst> -Target <src>` | `ln -s <src> <dst>` |
| 删软链 | `Remove-Item <dst>`（junction） | `rm <dst>` |
| clone 存在 | `Test-Path <path>/.git` | `[ -d <path>/.git ]` |
| 软链目标 | `Get-Item <dst> \| Select-Object -ExpandProperty Target` | `readlink <dst>` |

> junction（目录软链）不需管理员权限，比 symlink 稳；how-claude 全是目录软链，安全。

## 相关技能

- `cc-scanner`：扫描已装技能（hcc-cli install 后，cc-scanner 能扫到 how-claude 技能）
- `cc-config`：配置系统（hcc-cli 装的技能 + 用户配置协同）

> 深度参考（manifest schema 详解 / doctor 检查项细则 / 软链平台细节 / 故障排查）：[cli-guide.md](references/cli-guide.md)
