# Issue: 全栈目录结构 spec 缺位 → 前端集成里程碑缺位 → CRUD 盲区 + 偏离 pipeline

- **日期**: 2026-07-02
- **严重度**: 中-高（前端集成无依托，里程碑设计盲区）
- **状态**: 已识别（待 spec 全栈目录结构 + 前端集成走 pipeline）
- **GitHub**: https://github.com/leaveofshadow/how-claude/issues/1

## 现象

项目按 pipeline 模式开发（产品→原型→架构→开发），后端 `backend/` 结构清晰（app / cnki_rpa / orchestrator / citation_guard / literature_engine / thesis_kernel / tests），但到「前端联调」时发现：
1. 缺基础 CRUD 路由（auth / 资源 CRUD）
2. 前端只有 `prototype/`（静态原型，mock HTML/CSS/JS），**无正式前端工程目录**
3. 前端联调没走 pipeline（没前端 plan/架构）

## 最重要的问题：全栈文件目录结构不够 spec

项目是全栈（后端 + 前端），但**目录结构没有 spec**：
- `backend/` 有（清晰分层）
- `prototype/` 只是产品设计阶段原型（mock，非前端工程）
- **没有正式前端目录**（如 `frontend/` / `web/` / `client/`，含构建 / 组件 / 状态 / API 层 / 设计系统）

目录结构没 spec → 前端集成无依托（代码放哪？怎么构建？怎么部署？）→ 里程碑设计没排前端 → 前端联调无 plan → 偏离 pipeline。

## 根因层次

### 上层：全栈目录结构 spec 缺位（最重要）
全栈项目应先 spec 目录结构（后端 + 前端 + 共享 + 构建/部署），定义前端工程的位置与结构。本项目只有 `backend/` + `prototype/`，前端工程目录从没 spec。

### 中层：里程碑设计 —— 前端集成缺位
pipeline 在「原型」止步，「前端开发」里程碑（接 API + 完整 UI + 设计系统）没排进 N4（N4 全后端 M0-M6）。直接技术表现：垂直切片漏水平胶水层（auth/CRUD）+ 测试绕路由（fixture seed + 造 token 不经 HTTP）→ 路由盲区（测试绿但路由没）。

### 次因：Claude 未识别产品级工作走 pipeline
里程碑缺位时，Claude 当「补胶水」直接 agent 委派，没提议走 pipeline。

## 不是架构问题
架构设计完整（模型 + 租户隔离 + auth 工具齐全）。缺的是：(1) 目录结构 spec（前端工程）；(2) CRUD 路由薄壳；(3) 前端开发里程碑。

## 改进
1. **全栈目录结构 spec 先行**：全栈项目先定目录结构（后端 / 前端 / 共享 / 构建 / 部署），前端工程有正式位置（`frontend/` + `src/` + 构建工具）
2. **pipeline 完整闭环**：产品→原型→架构→**开发**，前端必排开发里程碑（不能在原型止步）
3. **里程碑覆盖全栈**：后端里程碑 + 前端里程碑 + 集成里程碑
4. **Claude 规则：产品级工作必走 pipeline**：前端/新功能即使无明确里程碑，也提议走 pipeline 出 plan，不当胶水直接执行
5. **HTTP 端到端集成测试** + **尽早前端联调**（路由缺口天然检测器）

## 适用场景
任何全栈项目 —— 目录结构 spec 先行（前后端 + 构建/部署），里程碑设计覆盖全栈，执行方识别产品级工作走完整流程。
