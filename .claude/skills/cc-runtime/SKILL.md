---
name: cc-runtime
description: 运维部核心工具 · 层1 cc-runtime 状态运行时教练。诊断"长会话丢状态（痛点3）/读错旧方向（痛点4）"，给四文件 state schema + 基线层装配配方（扩展 compact-snapshot + 换向归档，0 新 hook）。hcc 工具箱模型下的跨部门运行时工具。
---

# cc-runtime —— 层1 状态运行时教练（运维部核心工具）

> **定位**：hcc 工具箱模型中，cc-runtime 是「运维部核心工具」——解决 Claude 7×24 自动运行的两个通用痛点（与具体业务无关）：
> - **痛点3**：按计划执行但**不更新任务记录**，无 checkpoint/trace，compact 后失忆
> - **痛点4**：Human 换向后 agent **仍读旧的探索/计划文件**
>
> **层归属**：层1（地基）。层3 cc-venture 流水线的 pause/resume/方向切换/trace 全依赖本层基础设施。无层1 则层3 是痛点3/4 重现。

---

## ✅ 当前状态：基线层已落地（2026-06-16）

本技能的**基线层**已闭合——用最轻形态（扩展已有 compact-snapshot 双 hook + 换向归档，**0 新 hook、不碰 settings.json**）兑现痛点3/4，遵循 charter P1（最懒）。

> **转向背景**（50-decision §1.7）：原 §1「8 Hook 主导」对 P1 过度（8 hook = 8 失效点 + 8 轮装配 + 8 处 Windows 风险）。重审后层1 默认路径改为基线层；M2-M6 五 hook 降为 H2 备选清单（需要时再装配）。

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| M0 | G1 前置实验（exit2 on Stop 不可靠） | ✅ 闭合 |
| M1 | schema 冻结（四文件 frozen-v1）+ init-state 脚手架 | ✅ 闭合 |
| **基线层** | **扩展 compact-snapshot（痛点3）+ 换向归档（痛点4），0 新 hook** | **✅ 闭合（18/18 测试）** |
| M2-M6 | 七 Hook 增强（H2/H1/H4/H7/H8） | ⏳ 备选（H2 清单，非默认） |
| M7 | G2 Hook 失效降级告警 | ⏳（仅装 hook 时需要） |
| M8 | G3 装配协议（技能→settings.json 落地） | ⏳（仅装 hook 时需要） |

---

## 核心产物（已就绪）

### 四文件 state schema（frozen-v1，M1）
- **`references/state-schema.md`** —— 层1 状态契约 + 层3 接口冻结点
  - `checkpoint.json` 断点快照 · `trace.ndjson` 执行轨迹
  - `direction.json` 方向指针（单一真相源）· `tasks.tree.json` 任务树
  - §5 接口契约 V1 · §6 跨文件不变量 INV-1..6 · §8 初始化默认值

### 基线层三脚本（纯 Node fs，M4 原子写）
- **`scripts/init-state.js`** —— 初始化 `.venture/state/` 四文件（幂等 + `--force`）
- **`scripts/shift-direction.js`** —— 方向换向 + 旧方向归档（痛点4 机制腿）
  - 实现 schema §5 `direction.set`：升版本 + 原子更新三文件（INV-1）+ 归档旧目录（ENOENT 拦截）+ trace 审计（INV-4）
  - 安全：`--reason` 必填 / `--to` 必须 > 当前版本 / `--dry-run` / 归档目标已存在软失败（不破坏一致性）
- **`scripts/init-state.test.js` + `shift-direction.test.js`** —— node:test 零依赖验证（18 测试，含 INV-1..4 + 归档语义 + 回归）

### 痛点3 续跑锚点（基线层 · 扩展全局 hook）
- **`~/.claude/hooks/compact-snapshot-write.js` Block⑤** —— PreCompact hook 扩展，读 `.venture/state/`（direction + checkpoint）写进 compact 快照
  - **向后兼容**：非 venture 项目 venture=null，Block⑤ 不输出，现有 4 块行为零影响
  - SessionStart `compact-snapshot-restore.js` 零改动（注入整个 snapshot 正文，天然恢复方向状态）

---

## 装配骨架

> **三态**：诊断 → 装配 → 运行 → 卸载。
> **身份张力定论**（50-decision §3）：cc-runtime 教「怎么搭 + 配方」，7×24 运行由 autopilot/ralph/Hook（原生能力）驱动，**技能不常驻**。

### 基线层装配（已可用，0 新 hook）
1. `node scripts/init-state.js` —— 初始化 `.venture/state/` 四文件
2. （全局已装）compact-snapshot-write.js 自动在 compact 时带方向状态 → 续跑不丢锚点
3. 方向变更时 `node scripts/shift-direction.js --reason "<理由>"`（破坏性，先 `--dry-run` 预演）

### 增强选项（H2 备选清单，按需装配，待 M8）
- [ ] 七 Hook 脚本模板（`references/hook-templates/`，含 C1/C2 修订）—— 仅需自动 trace / 拦 Bash 读旧文件时才装
- [ ] compact-snapshot 范式参考（`references/compact-snapshot-ref.md`，C2 真实覆盖面）
- [ ] G3 装配协议（技能加载 / 配方落 settings.json / #10412 双路径 / 卸载）

---

## 设计根基（裁决锚点）

详见 `.2pp/2026-06-16-venture-automation-architecture/`：
- `50-decision.md` §1 层1 裁决（方案2 Hook 主导）**+ §1.7 基线层转向**（hook 过度收敛，0 新 hook 默认路径）
- `60-impl-plan.md` §2 schema · §10 里程碑
- `70-requirements.md` §1 schema 验收 · §13 产出物
- `docs/superpowers/specs/2026-06-16-block-cap-probe-result.md` G1 闭合（零 exit2 必然性）
