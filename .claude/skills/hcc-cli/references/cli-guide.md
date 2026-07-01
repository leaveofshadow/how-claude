# cli-guide — hcc-cli 深度参考

> hcc-cli 技能的深度参考。manifest schema 详解 / doctor 5 维检查细则 / 软链平台细节 / 故障排查。SKILL.md 是速查版，这里展开落地细节。

## 1. manifest schema

`<目标>/.claude/how-claude-manifest.json` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `clone_path` | string | 全局 clone 路径（`~/.claude/how-claude`）|
| `clone_url` | string | clone 来源 URL |
| `installed_commit` | string | 装时的 commit sha（`git rev-parse HEAD`）|
| `installed_at` | string | 装日期（ISO `YYYY-MM-DD`）|
| `skills` | string[] | 软链了哪些技能名 |
| `contracts` | bool | 是否软链了 contracts |

示例：
```json
{
  "clone_path": "~/.claude/how-claude",
  "clone_url": "https://github.com/leaveofshadow/how-claude.git",
  "installed_commit": "c85cd72",
  "installed_at": "2026-07-02",
  "skills": ["claude-coach", "cc-2pp", "cc-loop", "venture-pipeline"],
  "contracts": true
}
```

**manifest 是 update/uninstall/doctor 的唯一真相源**——无 manifest = 未装。install 必写，uninstall 必删，update 必更新 installed_commit。

## 2. doctor 5 维检查细则

### 维度 1 · clone
- 存在：`Test-Path ~/.claude/how-claude/.git`（Win）/ `[ -d ~/.claude/how-claude/.git ]`（Unix）
- dirty：`git -C <clone> status --porcelain` 非空 → ⚠️（用户改了 clone，pull 可能冲突）
- 落后 origin：`git -C <clone> fetch && git -C <clone> log HEAD..origin/HEAD --oneline` 非空 → ⚠️（有更新未拉）
- 修复：dirty → "处理 clone 改动或重新 clone"；落后 → "`hcc update`"

### 维度 2 · 软链完整
- 存在：manifest.skills 每个软链 `Test-Path <目标>/.claude/skills/<name>`
- 指向正确：软链 target = clone 对应目录（Win `(Get-Item <dst>).Target` / Unix `readlink <dst>`）
- ❌ 悬空（软链在但 target 不存在）/ ⚠️ 指向错位（target 不是 clone）
- 修复："`hcc uninstall` + `hcc install` 重建"

### 维度 3 · 技能结构
- SKILL.md 可读：`Test-Path <软链>/SKILL.md`
- frontmatter 合法：Read SKILL.md 头部，必有 `^name: ` + `^description: `
- ❌ SKILL.md 缺失 / frontmatter 坏（Claude Code 不识别该技能）
- 修复："clone 损坏？`hcc update` 或重新 clone"

### 维度 4 · 配置引用
- hcc-config.json：Read，引用的技能名在 manifest.skills 或目标 `.claude/skills/`？
- contracts：引用的语义锚（如 `org-claude.md#measure`）对应文件在 `.claude/contracts/`？
- ⚠️ 引用悬空（配置提了不存在的技能/契约）
- 修复："清理 hcc-config.json 引用 或 `hcc install` 补装"

### 维度 5 · 冲突
- 同名实体技能：manifest.skills 中某技能在目标 `.claude/skills/<name>` 是**实体目录**（非软链）？
- Win 判实体 vs 软链：`(Get-Item <path>).LinkType`（junction 有值，实体为空）；Unix `readlink` 非空 = 软链
- ⚠️ project 实体 > 软链（cc-scanner 优先级 `project > ...`），用户实体技能会覆盖 how-claude 同名更新
- 修复："改名用户技能 或 `--skills=` 排除该 how-claude 技能"

## 3. 软链平台细节

### Windows · junction（目录软链，推荐）
- 命令：`New-Item -ItemType Junction -Path <dst> -Target <src>`
- **不需管理员**（junction 是 NTFS 重解析点；symlink 才需管理员/开发者模式）
- 可跨卷；仅本地目录
- **删**：`cmd /c rmdir "<dst>"`——最可靠（`Remove-Item` 在 NonInteractive 模式会确认失败；`rm -rf` 会穿越 junction 删 target 内容！）；替代 `[System.IO.Directory]::Delete("<dst>")`
- 替代：`cmd /c mklink /J <dst> <src>`（同样不需管理员）

### Windows · symlink（避免）
- `New-Item -ItemType SymbolicLink` **需管理员**或开发者模式
- 文件级才需 symlink；how-claude 全是目录软链 → 一律用 junction

### Unix · symlink
- 命令：`ln -s <src> <dst>`
- 不需特殊权限
- 删：`rm <dst>`（只删链接，不删 target）

### 跨平台注意
- `~` 展开：Win PowerShell **不自动展开** `~` → 用 `$HOME`（或 `$env:USERPROFILE`）；bash 自动展开
- 路径分隔符：Win `\` / Unix `/`——PowerShell 两者都接受，bash 只 `/`
- 空格路径：全程引号包裹

## 4. 故障排查

| 症状 | 原因 | 解决 |
|---|---|---|
| install "目标已存在" | 用户有同名技能 | `--skills=` 排除，或改名用户技能 |
| update 报 "dirty" | clone 被改 | `git -C <clone> stash` 或重新 clone |
| update 后技能没变 | 软链被实体目录取代 | `hcc uninstall` + `hcc install` 重建 |
| doctor "软链悬空" | clone 被删/移 | 重新 clone + `hcc install` |
| Claude Code 不识别技能 | SKILL.md frontmatter 坏 | doctor 维度 3，修 frontmatter |
| Windows 软链失败 | 权限/路径 | 用 junction（非 symlink）；路径用 `$HOME` |
| `~` 不展开（Win）| PowerShell 限制 | 用 `$HOME` |
| `--purge` 误删 | 影响所有项目 | uninstall 默认保留 clone；`--purge` 前确认 |

## 5. install 路径解析（跨平台）

PowerShell（Win）：
```powershell
$clone = "$HOME\.claude\how-claude"
$dstSkills = "$pwd\.claude\skills"
if (-not (Test-Path $dstSkills)) { New-Item -ItemType Directory $dstSkills | Out-Null }
New-Item -ItemType Junction -Path "$dstSkills\cc-2pp" -Target "$clone\.claude\skills\cc-2pp"
```

Bash（Unix）：
```bash
clone="$HOME/.claude/how-claude"
dst_skills="$PWD/.claude/skills"
mkdir -p "$dst_skills"
ln -s "$clone/.claude/skills/cc-2pp" "$dst_skills/cc-2pp"
```

## 6. 与其他技能的关系

- **cc-scanner**：install 后跑 cc-scanner 能扫到 how-claude 技能（软链在 `.claude/skills/` 下，Glob 得到）
- **cc-config**：hcc-config.json 配置 + how-claude 技能协同；doctor 维度 4 查引用一致
- **被装技能**（claude-coach / cc-* / venture-pipeline）：正常使用，无特殊依赖
