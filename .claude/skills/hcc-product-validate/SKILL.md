---
name: hcc-product-validate
description: 产品部·N5 验证。设计验证（产品部 R，跑 AC{n} 可执行验证命令判定 N4 实施走偏，R3.2）+ 市场验证移交（销售部 R，A 归属隔离）。产物 N5_验证_decision.md 落 .hcc/product/hcc-product-validate/。
---

> **部门协议引用**（hcc 阶段5 协议降级）：执行前 Read `.claude/contracts/contract-product.md`（§4.1 N5 验证 review 机制：R3.2 走偏判定 + AC{n} 可执行验证命令绑定）。

# hcc-product-validate —— N5 验证（设计验证 + 市场验证双轨）

> 触发词：`N5 验证` / `设计验证` / `走偏判定` / `AC 验证`
> 层级：cc-venture 层3 venture pipeline 节点 N5 实装。
> 部门归属：产品部 R（设计验证）；市场验证 A 归销售部（本 skill 触发移交不执行）；跨域升级 A 归决策部兜底。

## 0. 概述：双轨验证，非单一 git diff

本节点职责 = **设计验证 + 市场验证双轨**（charter §2.1）。设计验证 = 跑 N3.5 PRD §5 AC{n} 绑定的可执行验证命令判定 N4 实施走偏（R3.2，contract-product.md §4.1）。市场验证 = 移交销售部（A 归属隔离）。

**反模式（contract-product.md §4.1 明确）**：N5 验证 ≠ git diff 文本语义对照。AC 已工程化为可执行判据。

## 1. 执行流程

### 1.1 设计验证（产品部 R，强制）
```
Step 1: 读取基线 — Read N3.5_需求规格_prd.md（§5 AC{n} + §3 R{n}）→ 解析 AC{n}↔R{n} 映射
Step 2: 走偏判定（C2 纯 Node 脚本）— node scripts/validate-n5.js --prd <N3.5_prd.md> --impl <N4 实施产物> → pass/fail 矩阵 + deviant_R 清单
Step 3: 产出 decision — Write N5_验证_decision.md（§2 逐条 AC 表 + §3 走偏判定 + §4 结论）
Step 4: 走偏时触发变更回流（deviant_R 非空 → 开发部 N3.5_需求变更_request.md + 产品部 changelog）；通过 → 移交决策部 review（A 批准 N5→N6）
```

### 1.2 市场验证移交（销售部 R，A 归属隔离）
- **判定触发**：项目类型 ∈ {生产级} 或 N1 市场假设待验证 → 触发；PoC/MVP 通常跳过（探索阶段无市场假设需验证）
- **如触发**：移交 sales-research skill（销售部 R 执行，A 归销售部），**本 skill 不执行市场验证逻辑**（A 归属隔离，防越权）
- 产物路径：`.hcc/sales/venture-sales-research/N5_市场验证_report.md`（销售部 R 产出）

### 1.3 跨域升级（决策部兜底 A）
- **触发**：设计验证结论 ↔ 市场验证结论冲突（如设计通过但市场证伪）
- **升级**：移交决策部协议层（不在本 skill 内裁决），仲裁决议 `.hcc/decision/<...>/N5_仲裁_decision.md`

## 2. 走偏判定脚本契约（C2 纯 Node）
> 落盘 `scripts/validate-n5.js`（fs+path+crypto+child_process spawnSync，禁外部依赖）

| 维度 | 契约 |
|------|------|
| **输入** | `--prd <N3.5_需求规格_prd.md>` + `--impl <N4 实施产物路径>`（AC 命令工作目录）|
| **输出** | stdout JSON `{ac_results:[{ac_id,r_id,cmd,exit_code,result}], deviant_r:[R{n}], decision:"通过"\|"走偏"}` |
| **退出码** | 0 = 验证完成（pass/fail 均可，exit 0 = 流程跑通）；1 = 脚本错误（AC 解析失败/命令不存在）|
| **AC 命令提取** | 反引号包裹可执行部分（`node`/`curl`/`npm`/`bash`/`pytest`），exit 0 主判据；ENOENT → AC 标 UNVERIFIABLE（决策部 review）|

**三层护栏**（同 N3.5 模式）：
1. 引擎层（dag N5 exit_condition）：existsSync 校验 N5_验证_decision.md 存在
2. 自动化语义层（validate-n5.js）：跑 AC 命令 + 校验 decision 含 deviant_r 字段 + 走偏可定位性
3. agent 自检 + M2 人工闸：AC 命令恰当性 / 走偏等级 MAJOR/MINOR（agent + 决策部 review）

## 3. 产物落盘契约

`.hcc/product/hcc-product-validate/N5_验证_decision.md`（按模板骨架）：
- frontmatter: phase=N5 / feature=验证 / type=decision / skill=hcc-product-validate / baseline_prd / validator_dept=product
- §1 验证范围（1.1 设计验证强制 + 1.2 市场验证可选判定）
- §2 设计验证结果（逐条 AC 表：AC ID / 对应 R{n} / 验证命令 / exit code / 结果 / 证据）
- §3 走偏判定 R3.2（deviant_R 清单 + 走偏描述 + 等级）
- §4 验证结论（设计 + 市场验证结论）
- §5 跨域升级（决策部兜底，如双轨冲突）
- §6 下游接口（N6 产品化 / N3.5 变更 / 决策部 review）

**路径铁律**：`.hcc/product/hcc-product-validate/`（by-design hcc-{部门}-{维度}），勿改回 `.venture/artifacts/`。

## 4. 度量口径（Claude 实施者度量）
会话 / token / 轮次 / skill 配置 / 验证。**禁**人天/团队/学习成本/排期（定义见 `.claude/contracts/org-claude.md`[#measure]）。

## 5. 三项好估维度（设计决策主轴）
1. **功能需求**：双轨验证完整覆盖 charter §2.1 N5 职责（设计 + 市场 + 跨域升级），市场验证不省略只标 A 归属隔离
2. **技术选项**：AC 命令机器可执行（validate-n5.js）+ decision 字段 frontmatter 化（下游可机器读取）
3. **运维成本**：复用 N3.5 已建立的 AC{n}↔R{n} 映射（不重建）+ 走偏定位到 R{n} 条目级（变更回流精准）

## 6. 下游接口契约

| 下游节点 | 消费内容 | 接口契约 |
|---------|---------|---------|
| **N6 产品化** | §4.1 验证结论（通过时）| 验证通过 → N6 消费做产品设计 spec |
| **N3.5 变更流程** | §3 走偏 R{n} 清单（走偏时）| 走偏 → N3.5_需求变更_request.md（开发部写）|
| **决策部 review** | §4 结论 + §5 跨域升级 | 决策部 A 批准 N5→N6 或判定变更/回退 |

## 7. 护栏（guards）
- max_iteration: 3（走偏→变更→重验最多 3 轮，同 N3.5）
- no_progress_detect: 连续 2 次走偏同一 R{n} → 升级决策部
- budget_cap: AC 命令执行总时长 < 300s（防慢测试拖垮 pipeline）

## 8. 风险
- **R1 AC 命令不可执行**：N3.5 AC 绑命令但 N4 实施失效 → UNVERIFIABLE 标记 + 决策部 review
- **R2 市场验证 A 越权**：agent 在本 skill 内执行市场验证 → SKILL.md §1.2 明确"只移交不执行" + dag activate_external=null
- **R3 exit code 为主判据**（stdout 校验 M5/M6 扩展）：M2 接受，覆盖 80% case
- **R4 跨域升级依赖决策部协议**：本 skill 只触发移交，仲裁实装是决策部职责（gap① 外）
- **R5 budget 300s 误杀长测试**：总时长非单条，长 AC 应在 N3.5 拆分
