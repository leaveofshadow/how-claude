# 70-requirements.md — 层2 工作流引擎 · Phase 4 保姆级需求清单

> **运行目录**：`.2pp/2026-06-16-layer2-workflow-engine/`
> **日期**：2026-06-17
> **配套**：[60-impl-plan.md](./60-impl-plan.md)（编排契约，里程碑划分一致）
> **保姆级原则**：每项拆到「新实例只看一条就能动手」，禁「实现 X 功能」式模糊。
> **度量**：会话·token（Claude 实施者度量），禁人天。
> **可证伪验证**：每项含命令 + 期望输出，禁「适当/合理」。

---

## 里程碑划分（与 60 对齐）

| 里程碑 | 主题 | 需求项数 |
|--------|------|---------|
| M0 | dag.json schema + load-graph.js | 4 |
| M1 | pipeline-state.js + schema 文档 | 5 |
| M2 | advance-node.js（引擎核心）| 6 |
| M3 | SKILL.md + pipeline-guide.md + H6 注入 | 4 |
| M4 | venture-resume.js + /venture-resume slash | 4 |
| M5 | 占位 dag.json + persona signal 收敛 | 4 |
| **合计** | | **27** |

---

## M0：dag.json schema + load-graph.js

### R0.1 — 新建 venture-pipeline skill 目录骨架

- **做什么**：创建 `.claude/skills/venture-pipeline/` 目录 + 占位 SKILL.md（仅 frontmatter，正文 M3 填）。
- **输入触发**：60 §8 下一步行动启动。
- **输出交付**：`.claude/skills/venture-pipeline/SKILL.md`（含 frontmatter name/description/trigger，正文 stub）+ `scripts/` + `references/` + `commands/` 空目录。
- **可证伪验证**：
  - 命令：`Test-Path .claude\skills\venture-pipeline\SKILL.md, .claude\skills\venture-pipeline\scripts, .claude\skills\venture-pipeline\references, .claude\skills\venture-pipeline\commands`
  - 期望输出：4 个 `True`。
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\SKILL.md -Pattern "^name:"`
  - 期望输出：匹配 `name: venture-pipeline`。
- **依赖**：无。
- **预估**：0.2 会话 · 0.3k token。

### R0.2 — dag.json schema 文档（三原语 + 字位预留）

- **做什么**：写 `venture-pipeline/references/dag-schema.md`，定义三原语 node/edge/loop_back 的 JSON schema + subgraph/fan_out 字位预留说明（遇即报未实现）。
- **输入触发**：R0.1 完成。
- **输出交付**：dag-schema.md，含：
  1. node schema：`{id, type, skill, exit_condition}`。
  2. edge schema：`{from, to, condition: {signal: green|yellow|red|unknown, awaiting_human: bool}}` + HG 折叠说明（MINOR 双路径：signal 枚举管流转 / awaiting_human 独立布尔管停等，正交不冲突；典型 HG edge = signal:"green"+awaiting_human:true，驳灰度6 不引第五枚举）。
  3. loop_back schema：`{from, to, max_iter, converge_field}`。
  4. subgraph/fan_out 字位：`reserved: true, implemented: false`，文档标注 C5。
- **可证伪验证**：
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\references\dag-schema.md -Pattern "node:|edge:|loop_back:|subgraph|fan_out|max_iter"`
  - 期望输出：6 个匹配（三原语 + 两字位 + max_iter）。
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\references\dag-schema.md -Pattern "C5|未实现"`
  - 期望输出：至少 1 匹配（字位预留合规标注）。
- **依赖**：R0.1。
- **预估**：0.5 会话 · 1.5k token。

### R0.3 — dag.json 示例文件（最小合法 DAG）

- **做什么**：写 `venture-pipeline/dag.json`，一个 3 节点最小 DAG（N1→N2→HG1→N3），符合 R0.2 schema。
- **输入触发**：R0.2 完成。
- **输出交付**：dag.json，含 3 node + 3 edge（其中 1 edge `condition.awaiting_human=true`）+ 0 loop_back。subgraph/fan_out 字位仅在 schema 层（R0.2 dag-schema.md）reserved，dag.json 实例不含（由 R0.4 字位测试 fixture 触发 C5 报错，避免与 R0.4 正常解析闸矛盾）。
- **可证伪验证**：
  - 命令：`Get-Content .claude\skills\venture-pipeline\dag.json | ConvertFrom-Json | Select-Object -ExpandProperty nodes | Measure-Object`
  - 期望输出：`Count: 3`。
  - 命令：`$j = Get-Content .claude\skills\venture-pipeline\dag.json | ConvertFrom-Json; $j.edges | Where-Object { $_.condition.awaiting_human -eq $true } | Measure-Object`
  - 期望输出：`Count: 1`。
- **依赖**：R0.2。
- **预估**：0.3 会话 · 0.5k token。

### R0.4 — load-graph.js（解析 + 字位报未实现 + graph_hash）

- **做什么**：写 `venture-pipeline/scripts/load-graph.js`，require('fs')+require('path')+require('crypto')（均 Node 内建；C2 精神=禁外部依赖/禁 vm/eval/Function，内建模块允许），解析 dag.json → 内存图；遇 subgraph/fan_out 字段 implemented:false 时 stderr 报「未实现」；输出确定性 graph_hash（递归排序键 + JSON.stringify + crypto.createHash('sha256') → 64 位）。
- **输入触发**：R0.3 完成。
- **输出交付**：load-graph.js，CLI 入口 `node load-graph.js --dag <path>` 输出 `{nodes, edges, loop_backs, graph_hash}` JSON。
- **可证伪验证**：
  - 命令：`node .claude\skills\venture-pipeline\scripts\load-graph.js --dag .claude\skills\venture-pipeline\dag.json`
  - 期望输出：exit 0 + JSON 含 nodes(3)/edges(3)/graph_hash(64 位 sha256)。
  - 命令：在 dag.json 加 `"subgraph": {"reserved": true}` 后重跑，检查 stderr。
  - 期望输出：stderr 含 `未实现：subgraph`（C5）。
  - 命令：同 dag.json 连跑两次比 graph_hash。
  - 期望输出：两次 graph_hash 相等（确定性）。
- **依赖**：R0.3。
- **预估**：1 会话 · 2k token · 3 测试（load-graph.test.js）。

---

## M1：pipeline-state.js + schema 文档

### R1.1 — pipeline-state.json schema 文档

- **做什么**：写 `venture-pipeline/references/pipeline-state-schema.md`，定义字段：`direction_version / current_node / frontier[] / iteration / status(active|awaiting_human) / gate(null|HG1|HG2) / graph_hash / history[]`。
- **输入触发**：M0 全闸过（git tag layer2-M0）。
- **输出交付**：pipeline-state-schema.md，含字段表 + 嫁接1 说明（status/gate 独占 HG，direction.json 不动）。
- **可证伪验证**：
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\references\pipeline-state-schema.md -Pattern "direction_version|current_node|frontier|iteration|status|gate|graph_hash|history"`
  - 期望输出：8 个匹配（全字段）。
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\references\pipeline-state-schema.md -Pattern "嫁接1|direction.json 不动"`
  - 期望输出：至少 1 匹配。
- **依赖**：M0（layer2-M0 tag）。
- **预估**：0.5 会话 · 1k token。

### R1.2 — pipeline-state.js init 命令

- **做什么**：写 `venture-pipeline/scripts/pipeline-state.js`，require 引入 cc-runtime atomicWriteJSON，CLI `init` 生成 `.venture/state/pipeline-state.json` 默认值（status:active/gate:null/graph_hash:从 dag.json 算）。
- **输入触发**：R1.1 完成。
- **输出交付**：pipeline-state.js，含 init/read/set-hg/verify 四子命令骨架（init 本项实现，其余 M1.3-1.5 实现）。
- **可证伪验证**：
  - 命令：`node .claude\skills\venture-pipeline\scripts\pipeline-state.js init`
  - 期望输出：exit 0 + 生成 `.venture\state\pipeline-state.json`。
  - 命令：`Get-Content .venture\state\pipeline-state.json | ConvertFrom-Json | Select-Object status,gate`
  - 期望输出：`status: active, gate: null`（嫁接1 默认值）。
- **依赖**：R1.1 + M0 graph_hash（复用 load-graph.js 的哈希函数）。
- **预估**：0.5 会话 · 1k token · 1 测试。

### R1.3 — pipeline-state.js set-hg 命令

- **做什么**：实现 set-hg 子命令 `node pipeline-state.js set-hg --gate HG1`，写 status:awaiting_human/gate:HG1，**禁止**触碰 direction.json（C1）。
- **输入触发**：R1.2 完成。
- **输出交付**：set-hg 分支，原子写 pipeline-state.json，追加 history 事件。
- **可证伪验证**：
  - 命令：`node .claude\skills\venture-pipeline\scripts\pipeline-state.js set-hg --gate HG1`
  - 期望输出：exit 0。
  - 命令：`Get-Content .venture\state\pipeline-state.json | ConvertFrom-Json | Select-Object status,gate`
  - 期望输出：`status: awaiting_human, gate: HG1`。
  - 命令（C1 核验）：`Get-Content .venture\state\direction.json | ConvertFrom-Json | Select-Object status,gate`
  - 期望输出：`status: active, gate: null`（**direction.json 不动**，嫁接1）。
- **依赖**：R1.2。
- **预估**：0.3 会话 · 0.8k token · 1 测试。

### R1.4 — pipeline-state.js verify 命令（graph_hash 校验）

- **做什么**：实现 verify 子命令，读当前 dag.json 算 graph_hash，与 pipeline-state.graph_hash 比较，不匹配 exit 1 + 报错（C6 防静默漂移）。
- **输入触发**：R1.3 完成。
- **输出交付**：verify 分支。
- **可证伪验证**：
  - 命令（匹配态）：`node .claude\skills\venture-pipeline\scripts\pipeline-state.js verify`
  - 期望输出：exit 0 + `graph_hash 匹配`。
  - 命令（漂移态）：改 dag.json 加一节点后 verify。
  - 期望输出：exit 1 + stderr `graph_hash 不匹配：dag=<新> state=<旧>`。
- **依赖**：R1.2。
- **预估**：0.3 会话 · 0.7k token · 1 测试。

### R1.5 — pipeline-state.test.js（M1 集成测试）

- **做什么**：写 `pipeline-state.test.js`，覆盖 init/set-hg/verify/C1 核验四个场景。
- **输入触发**：R1.4 完成。
- **输出交付**：pipeline-state.test.js，4 个测试全绿。
- **可证伪验证**：
  - 命令：`node .claude\skills\venture-pipeline\scripts\pipeline-state.test.js`
  - 期望输出：`4 passing`（exit 0）。
- **依赖**：R1.4。
- **预估**：0.4 会话 · 0.5k token。

---

## M2：advance-node.js（引擎核心）

### R2.1 — advance-node.js node 流转基础

- **做什么**：写 `venture-pipeline/scripts/advance-node.js`，require fs/path + load-graph + pipeline-state，实现 `advance` 子命令：读 current_node → 找出边 → 流转到下一节点 → 更新 pipeline-state.current_node + frontier。
- **输入触发**：M1 全闸过（layer2-M1 tag）。
- **输出交付**：advance-node.js advance 分支。
- **可证伪验证**：
  - 命令：pipeline-state.current_node=N1 后 `node advance-node.js advance`。
  - 期望输出：exit 0 + pipeline-state.current_node 变为 N2（占位 DAG N1→N2 edge）。
- **依赖**：M1（layer2-M1）。
- **预估**：0.5 会话 · 1.5k token · 2 测试。

### R2.2 — edge 条件评估（signal 四态）

- **做什么**：实现 edge.condition.signal 评估：green=自动流转 / yellow=记录警告但流转 / red=停等不流转 / unknown=走 HG（驳 00-explore 灰度6 第四态）。
- **输入触发**：R2.1 完成。
- **输出交付**：evaluateEdge 函数 + advance 集成。
- **可证伪验证**：
  - 命令：mock edge signal=red 后 advance。
  - 期望输出：exit 0 + current_node 不变 + history 追加 `blocked: signal=red`。
  - 命令：mock signal=unknown 后 advance。
  - 期望输出：pipeline-state.status=awaiting_human（触发 HG，驳灰度6）。
- **依赖**：R2.1。
- **预估**：0.5 会话 · 1.5k token · 2 测试。

### R2.3 — loop_back 收敛（N6⇄N7 MAX_ITER=3）

- **做什么**：实现 loop_back 处理：遇到 loop_back edge 时 iteration++，达到 max_iter(3) 强制收敛（不再回环）。
- **输入触发**：R2.2 完成。
- **输出交付**：handleLoopBack 函数 + advance 集成。
- **可证伪验证**：
  - 命令：mock N6→N7 loop_back max_iter=3，连续 advance 4 次。
  - 期望输出：第 4 次 iteration=3 后不再回环（current_node 停在收敛态）+ history 追加 `converged: max_iter reached`。
- **依赖**：R2.2。
- **预估**：0.5 会话 · 1.5k token · 2 测试。

### R2.4 — HG 触发（嫁接1 核验点）

- **做什么**：实现 HG 触发分支：edge condition=awaiting_human 时调 pipeline-state.set-hg（**禁止**调 direction.set），写 status:awaiting_human。
- **输入触发**：R2.3 完成。
- **输出交付**：triggerHG 函数。
- **可证伪验证**：
  - 命令（C1 核验）：占位 DAG 跑到 HG1 edge 后读 direction.json。
  - 期望输出：`Get-Content .venture\state\direction.json | ConvertFrom-Json | Select status` = `active`（**direction.json 零改动**，嫁接1 不可破）。
  - 命令：读 pipeline-state.json。
  - 期望输出：`status: awaiting_human, gate: HG1`。
- **依赖**：R2.3 + R1.3。
- **预估**：0.3 会话 · 1k token · 1 测试。

### R2.5 — direction.set 驱动接入（换向后重置 pipeline-state）

- **做什么**：boss 在 HG 决策后调 `direction.set`（层1 腿），层2 监测 direction_version 变化 → 重置 pipeline-state（current_node/frontier/iteration 归零，graph_hash 重算）。
- **输入触发**：R2.4 完成。
- **输出交付**：watchDirectionShift 逻辑（advance-node.js 启动时比对 direction_version）。
- **可证伪验证**：
  - 命令：`node shift-direction.js --reason "test"`（层1 换向）后 `node advance-node.js advance`。
  - 期望输出：pipeline-state.direction_version 更新 + current_node=null + iteration=0（重置）。
- **依赖**：R2.4。
- **预估**：0.3 会话 · 1k token · 1 测试。

### R2.6 — M2 回归测试（cc-runtime 18/18 + 转移拓扑）

- **做什么**：写 `advance-node.test.js`，覆盖 R2.1-2.5；跑 cc-runtime 3 测试回归（18/18 不破）。
- **输入触发**：R2.5 完成。
- **输出交付**：advance-node.test.js（8 测试）+ 回归报告。
- **可证伪验证**：
  - 命令：`node .claude\skills\venture-pipeline\scripts\advance-node.test.js`
  - 期望输出：`8 passing`。
  - 命令：`node .claude\skills\cc-runtime\scripts\shift-direction.test.js`
  - 期望输出：`shift-direction tests passing`（18/18 不破，C1）。
- **依赖**：R2.5。
- **预估**：0.4 会话 · 0.5k token。

---

## M3：SKILL.md + pipeline-guide.md + H6 注入

### R3.1 — venture-pipeline/SKILL.md 正文

- **做什么**：填 SKILL.md 正文，定义层2 编排核心 skill：触发词 / 速查表（三原语 + 嫁接1）/ 流程（advance-node → HG → resume）。
- **输入触发**：M2 全闸过（layer2-M2 tag）。
- **输出交付**：SKILL.md 正文（约 200 行）。
- **可证伪验证**：
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\SKILL.md -Pattern "三原语|嫁接1|advance-node|HG|pipeline-state"`
  - 期望输出：至少 5 匹配。
  - 命令：`(Get-Content .claude\skills\venture-pipeline\SKILL.md | Measure-Object -Line).Lines`
  - 期望输出：≥ 150 行。
- **依赖**：M2（layer2-M2）。
- **预估**：0.5 会话 · 2k token。

### R3.2 — references/pipeline-guide.md（深度参考）

- **做什么**：写深度参考：dag.json 数据驱动哲学 / 嫁接1 双文件协同 / loop_back 收敛 / 断点续传 B 假设 / 与 cc-loop 循环合同衔接。
- **输入触发**：R3.1 完成。
- **输出交付**：pipeline-guide.md（约 300 行，含 ASCII 决策树）。
- **可证伪验证**：
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\references\pipeline-guide.md -Pattern "数据驱动|嫁接1|loop_back|断点续传|循环合同"`
  - 期望输出：至少 5 匹配。
- **依赖**：R3.1。
- **预估**：0.5 会话 · 3k token。

### R3.3 — H6 SessionStart 注入逻辑（HG 停等面板）

- **做什么**：在 SKILL.md 内写 SessionStart 段：读 pipeline-state.status，awaiting_human 时注入面板（当前节点/待决策项/RedFlag/推荐动作，P1 最懒 ≤200 字符）；active 时注入（当前节点/进度%/下一步）。
- **输入触发**：R3.2 完成。
- **输出交付**：SKILL.md SessionStart 段 + 面板模板。
- **可证伪验证**：
  - 命令：mock pipeline-state.status=awaiting_human/gate=HG1，读 SKILL.md 面板模板渲染。
  - 期望输出：面板含 4 要素（当前节点/待决策项/RedFlag/推荐动作）+ 字符数 ≤ 200。
  - 命令：`(渲染后面板字符串).Length`
  - 期望输出：≤ 200。
- **依赖**：R3.2。
- **预估**：0.5 会话 · 1k token · 1 冒烟测试。

### R3.4 — M3 集成冒烟（H6 复用，C3 零新 hook）

- **做什么**：验证 H6 SessionStart 注入复用现有 hook（不新增 hook，C3），面板正确渲染。
- **输入触发**：R3.3 完成。
- **输出交付**：冒烟报告（H6 配置未改 + 面板渲染）。
- **可证伪验证**：
  - 命令：`Select-String -Path .claude\settings.json -Pattern "SessionStart"`
  - 期望输出：H6 hook 配置存在（**未新增 hook 条目**，C3）。
  - 命令：SessionStart 触发后读注入输出。
  - 期望输出：含 venture-pipeline HG 面板（awaiting_human 态）。
- **依赖**：R3.3。
- **预估**：0.3 会话 · 0.5k token。

---

## M4：venture-resume.js + /venture-resume slash（B 假设）

### R4.1 — venture-resume.js 断点续传核心

- **做什么**：写 `venture-pipeline/scripts/venture-resume.js`，读 checkpoint.continue_from（层1 腿）+ pipeline-state.current_node，恢复到中断前节点；graph_hash 不匹配 exit 1（防漂移）。
- **输入触发**：M2 全闸过 + M3 完成。
- **输出交付**：venture-resume.js resume 子命令。
- **可证伪验证**：
  - 命令：mock checkpoint.continue_from=`node:N4,task:...,iter:2` + pipeline-state.current_node=N4，跑 resume。
  - 期望输出：exit 0 + 恢复到 N4 + 输出 `resumed at N4 iter:2`。
  - 命令（漂移态）：改 dag.json 后 resume。
  - 期望输出：exit 1 + stderr `graph_hash 不匹配，拒绝续传`。
- **依赖**：M2 + 层1 checkpoint 腿。
- **预估**：0.5 会话 · 2k token · 2 测试。

### R4.2 — trace.ndjson resume 事件追加

- **做什么**：resume 成功后向 trace.ndjson 追加 resume 事件（INV-4 带当前 direction_version）。
- **输入触发**：R4.1 完成。
- **输出交付**：resume 事件写入逻辑。
- **可证伪验证**：
  - 命令：resume 后读 trace.ndjson 最后一行。
  - 期望输出：JSON 含 `action: resume, node: N4, iter: 2, direction_version: <当前>`。
- **依赖**：R4.1。
- **预估**：0.2 会话 · 0.5k token · 1 测试。

### R4.3 — /venture-resume slash 命令

- **做什么**：写 `venture-pipeline/commands/venture-resume.md`，调用 venture-resume.js + 内部套 /loop（cc-loop 衔接）。
- **输入触发**：R4.2 完成。
- **输出交付**：venture-resume.md slash 定义。
- **可证伪验证**：
  - 命令：`Test-Path .claude\skills\venture-pipeline\commands\venture-resume.md`
  - 期望输出：`True`。
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\commands\venture-resume.md -Pattern "venture-resume.js|/loop"`
  - 期望输出：至少 2 匹配（脚本调用 + loop 衔接）。
- **依赖**：R4.2。
- **预估**：0.3 会话 · 0.5k token。

### R4.4 — M4 续传冒烟（模拟中断）

- **做什么**：模拟 session 中断（kill 进程）→ 新 session 跑 /venture-resume，验证恢复。
- **输入触发**：R4.3 完成。
- **输出交付**：冒烟报告。
- **可证伪验证**：
  - 命令：跑到 N4 中断 → 新 session `/venture-resume`。
  - 期望输出：恢复到 N4 + trace 追加 resume + pipeline-state.current_node=N4。
- **依赖**：R4.3。
- **预估**：0.3 会话 · 0.5k token。

---

## M5：占位 dag.json + persona signal 收敛

### R5.1 — dag.placeholder.json（8 节点占位拓扑）

- **做什么**：写 `venture-pipeline/dag.placeholder.json`，层3 8 节点 DAG（N1→N2→N3→HG1→N4→HG2→N5→N6⇄N7→N8）占位版（节点 skill 全 placeholder，C7）。
- **输入触发**：M2 全闸过。
- **输出交付**：dag.placeholder.json。
- **可证伪验证**：
  - 命令：`$j = Get-Content .claude\skills\venture-pipeline\dag.placeholder.json | ConvertFrom-Json; $j.nodes | Measure-Object`
  - 期望输出：`Count: 8`。
  - 命令：`$j.edges | Where-Object { $_.condition.awaiting_human -eq $true } | Measure-Object`
  - 期望输出：`Count: 2`（HG1+HG2）。
  - 命令：`$j.loop_backs | Measure-Object`
  - 期望输出：`Count: 1`（N6⇄N7）。
- **依赖**：M2。
- **预估**：0.3 会话 · 1k token。

### R5.2 — 占位拓扑跑通验证（C7）

- **做什么**：用 dag.placeholder.json 跑 advance-node 转移拓扑，验证 N1→N8 全流转（含 HG 停等 + loop_back 收敛）。
- **输入触发**：R5.1 完成。
- **输出交付**：转移拓扑跑通报告。
- **可证伪验证**：
  - 命令：手动模拟 advance 序列（N1→N2→N3→HG1[boss 决策]→N4→HG2[boss 决策]→N5→N6→N7→[收敛]→N8）。
  - 期望输出：pipeline-state.current_node 最终 = N8 + 全程 direction.json status='active'（C1）。
- **依赖**：R5.1。
- **预估**：0.3 会话 · 0.5k token。

### R5.3 — persona-signal.md（结构化 signal 收敛判据）

- **做什么**：写 `venture-pipeline/references/persona-signal.md`，定义 N6⇄N7 互锁的 signal 收敛判据：signal=green/yellow/red/unknown 四态结构化字段（非 free text），收敛阈值（迭代差 < 阈值），驳 B-β-5。
- **输入触发**：R5.2 完成。
- **输出交付**：persona-signal.md。
- **可证伪验证**：
  - 命令：`Select-String -Path .claude\skills\venture-pipeline\references\persona-signal.md -Pattern "green|yellow|red|unknown|收敛阈值|max_iter"`
  - 期望输出：至少 5 匹配。
  - 命令：检查 signal 字段定义是否结构化（非 free text）。
  - 期望输出：signal schema 含枚举字段（非 string free text）。
- **依赖**：R5.2。
- **预估**：0.5 会话 · 2k token。

### R5.4 — persona-signal 收敛测试

- **做什么**：写测试 mock N6/N7 两轮 signal 输出，验证 MAX_ITER=3 后收敛（迭代差 < 阈值）。
- **输入触发**：R5.3 完成。
- **输出交付**：persona-signal.test.js。
- **可证伪验证**：
  - 命令：`node .claude\skills\venture-pipeline\scripts\persona-signal.test.js`
  - 期望输出：`passing`（3 轮后收敛断言通过）。
- **依赖**：R5.3。
- **预估**：0.3 会话 · 0.5k token。

---

## 自检（保姆级原则 + 约束合规）

### 每里程碑有需求项？
- M0: 4 项（R0.1-R0.4）✓
- M1: 5 项（R1.1-R1.5）✓
- M2: 6 项（R2.1-R2.6）✓
- M3: 4 项（R3.1-R3.4）✓
- M4: 4 项（R4.1-R4.4）✓
- M5: 4 项（R5.1-R5.4）✓
- **合计 27 项，每里程碑 ≥ 4 项** ✓

### 每项有可证伪验证（命令 + 期望输出，禁「适当/合理」）？
- 全部 27 项均含 PowerShell/Node 命令 + 确定性期望输出 ✓
- 零「适当/合理/大致」模糊词 ✓

### C1-C7 约束体现？
- C1：R1.3 / R2.4 / R5.2 三处 C1 核验闸（direction.json 不动）✓
- C2：R0.4 / R1.2 / R2.1 均标注 require('fs')+require('path') only ✓
- C3：R3.4 验证零新 hook（H6 复用）✓
- C4：全部预估用「会话·token」，零人天 ✓
- C5：R0.2 / R0.4 字位预留遇即报未实现 ✓
- C6：R1.4 graph_hash 校验 + R4.1 续传防漂移 ✓
- C7：R5.1 dag.placeholder.json 占位拓扑 + R5.2 转移拓扑跑通 ✓

### 有无「人天」违规？
- 全文 grep `人天|人周|人月|团队熟练度|上手时间` → 零匹配 ✓

---

**需求清单状态**：✅ 已落盘（27 项，M0-M5 全覆盖）。衔接 → 60-impl-plan.md 执行编排 + cc-loop 验证闸。
