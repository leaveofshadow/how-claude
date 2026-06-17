# architecture-overview.md —— 循环工程 → 7×24 AI 公司自动化框架 · 完整架构

> 生成日期：2026-06-17
> 用途：how-claude 教练套件三层架构总览，层2 venture-pipeline 引擎的垂直栈 / 状态文件 / 数据流 / 原语语义 / 里程碑 / M5 改造全景图。
> 核心理念：**你不 prompt agent，你设计循环让循环去 prompt agent。**
> 关联：[pipeline-state-schema.md](pipeline-state-schema.md)（状态契约）· [dag-schema.md](dag-schema.md)（DAG 原语）· [.2pp/.../50-decision.md](../../../../.2pp/2026-06-16-layer2-workflow-engine/50-decision.md)（β'嫁接融合体裁决）

---

## 一、三层总览（从「方法论」到「业务」的垂直栈）

```
╔══════════════════════════════════════════════════════════════════════════════╗
║              how-claude 教练套件 → 7×24 AI 公司自动化框架                      ║
║   核心理念: 你不 prompt agent，你设计循环让循环去 prompt agent                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  layer-3  cc-venture          📋 规格延后（M5 之后）                          │
│  「业务」层    8 节点 DAG 业务规格——每个 node 绑定真实 skill 兑现业务            │
│  ─────────     N1 启动→N2 机会识别→N3 方案→HG1→N4 原型→HG2→N5 验证             │
│                →N6 产品化⇄N7 迭代(收敛)→N8 规模化                              │
│                当前: dag.placeholder.json 占位拓扑(C7:占位跑通≠业务跑通)         │
└──────────────────────────────────────────────────────────────────────────────┘
                                   ▲ 数据驱动 (dag.json)
                                   │ 依赖
┌──────────────────────────────────────────────────────────────────────────────┐
│  layer-2  venture-pipeline    ✅ 引擎（M0-M4 闭合 / M5 收尾中）                 │
│  「引擎」层    通用工作流引擎——把状态原语驱动成 DAG 流转                         │
│  ─────────     β'嫁接融合体裁决: 三原语(node/edge/loop_back)                    │
│                + dag.json 数据驱动 + pipeline-state.json 独占 HG 停等           │
│                脚本: pipeline-state / advance-node / resolve-hg / venture-resume│
└──────────────────────────────────────────────────────────────────────────────┘
                                   ▲ 复用状态原语
                                   │ 依赖
┌──────────────────────────────────────────────────────────────────────────────┐
│  layer-1  cc-runtime          ✅ 状态原语地基 (18/18 测试 ✅ tag layer1)        │
│  「地基」层    四文件状态契约 + 原子写 + 换向归档                               │
│  ─────────     脚本: init-state / shift-direction                             │
│                状态: direction.json / checkpoint.json / trace.ndjson / tasks.tree│
└──────────────────────────────────────────────────────────────────────────────┘

  ◀── 跨层基线层 (hook 层 · 方案C · 0 新 hook) ──▶
  compact-snapshot-write.js Block⑤ → auto-compact 时读 pipeline-state 注入 HG 停等面板
```

---

## 二、状态文件体系 & 嫁接1 写者隔离（C1 核心契约）

```
                    .venture/state/  (层1层2 共享目录, 职责正交)
┌─────────────────────────┬────────────────────────────────────────────┐
│  层1 四文件 (通用执行态)  │  层2 一文件 (DAG 引擎推进态 · 独占 HG 停等)    │
├─────────────────────────┼────────────────────────────────────────────┤
│ direction.json          │ pipeline-state.json                        │
│   ← 纯「业务方向指针」    │   ← 独占 HG 停等 + 节点推进                  │
│   永远 status:'active'  │   status: active | awaiting_human          │
│   永远 gate:null ★      │   gate:   null | HG1 | HG2 ★               │
│   只随 direction.set 换向 │   direction_version/current_node/frontier  │
│                         │   iteration/graph_hash/history             │
│ checkpoint.json         │                                            │
│   ← 续跑锚点              │                                            │
│   continue_from 规范格式  │                                            │
│ trace.ndjson            │                                            │
│   ← 审计 trace (含 resume)│                                            │
│ tasks.tree.json         │                                            │
│   ← 任务树               │                                            │
└─────────────────────────┴────────────────────────────────────────────┘

  ★ 嫁接1 核心基石: shift-direction.js line 126-127 硬编码 status:'active'/gate:null
    证明层1 原始设计意图 = direction.json 只表达活跃方向，HG 语义本就不该在此
    → 把 HG 状态放新文件 pipeline-state.json = 回归层1 意图，非绕过 frozen-v1

  写者隔离表 (C1 硬约束):
  ┌──────────────────────┬──────────────────────────────────────────────┐
  │ direction.json       │ 仅 shift-direction.js (层1 腿, 零改动)         │
  │ pipeline-state.json  │ pipeline-state.js + advance-node.js(M2)       │
  │                      │ + resolve-hg.js(M3)                           │
  └──────────────────────┴──────────────────────────────────────────────┘
  所有「是否 HG 停等」判断 → 读 pipeline-state.status (非 direction.status)
```

---

## 三、层2 引擎脚本矩阵 & 数据流（4 脚本各司其职）

```
                    dag.json (数据驱动 · 唯一真相源)
        ┌──────────────── node/edge/loop_back 三原语 + graph_hash 锚定 ─────────┐
        │                                                                       │
        ▼                                                                       │
┌─────────────────┐   advance 流转    ┌─────────────────┐    load-graph       │
│ pipeline-state  │ ──init/set-hg──▶  │   advance-node  │ ◀── computeGraphHash│
│      .js (M1)   │                   │      .js (M2)   │    (C6 防漂移)      │
│  init/set-hg/   │ ◀──状态读写────────│  8 action 引擎  │                    │
│  verify         │                   │  enter/advance/ │                    │
└─────────────────┘                   │  awaiting_human │                    │
        ▲                             │  ask_hg/blocked │                    │
        │                             │  converged/     │                    │
        │                             │  completed/     │                    │
        │                             │  direction_shift│                    │
        │  resolve(解除HG)             │  _reset         │                    │
        │                                      │ 复用                        │
┌───────┴──────────┐                       ┌───────▼──────────┐               │
│   resolve-hg     │ ◀──复用───────────────│  (handleLoopBack │               │
│      .js (M3)    │     findOutEdges/      │   findOutEdges) │               │
│  解除awaiting_   │     handleLoopBack     └─────────────────┘               │
│  human 并推进    │                                                           │
│  越过 HG edge    │                                                           │
└──────────────────┘                                                           │
        ▲                                                                      │
        │ resume(续传)  读双源: pipeline-state.current_node (权威)              │
┌───────┴──────────┐             + checkpoint.continue_from (iter)             │
│ venture-resume   │             + graph_hash 漂移校验 (C6)                    │
│      .js (M4)    │ ──套 /loop──▶ advance 继续 DAG 推进                        │
│  会话级断点续传   │  (B 假设: 7×24 单机 = 会话级, 脚本无状态每次从磁盘读)        │
└──────────────────┘                                                           │
        │                                                                      │
        ▼                                                                      │
   trace.ndjson ◀──append resume 事件 (R4.2)                                   │
                                                                                │
   全部脚本约束 C2: 仅 fs+path+crypto (Node 内建) + 同 skill/同项目 require     │
                   禁 vm/eval/Function/SDK 子进程/外部依赖                      │
```

---

## 四、DAG 拓扑（dag.placeholder.json · 8 节点 + loop_back）

```
   R5.1 占位拓扑 (节点 skill 全 placeholder · C7):

   N1 ─green─▶ N2 ─green─▶ N3 ─HG1(awaiting_human)─▶ N4 ─HG2(awaiting_human)─▶ N5
  启动       机会识别     方案     ▲ boss 决策         原型    ▲ boss 决策      验证
   │                              │ 停等                       │ 停等           │
   ▼ advance                     resolve-hg                  resolve-hg        ▼
                                                              green            green
   N5 ─green─▶ N6 ─green─▶ N7 ──┬─ loop_back ─▶ N6 (回环, iter++)               │
  验证       产品化    迭代优化 │  max_iter=3     ↑                            │
                          ▲     │                 │ 互锁                        │
                          └─────┘ (N6⇄N7 互锁收敛)                              │
                          │                                                    │
                          │ A 方案: 达 max_iter 收敛后取出口                     │
                          └────────green────────▶ N8 (规模化 · completed) ──────┘

   edge 声明顺序 (关键 · findOutEdges 取 outEdges[0]):
     N7 outEdges = [ N7→N6(green, loop_back) ,  N7→N8(green, 出口) ]
                    └── outEdges[0] 主流程回环      └── 收敛后 A 方案取此推进
   loop_backs = [ {from:N7, to:N6, max_iter:3, converge_field:signal} ]
```

---

## 五、三原语 & edge.condition 双路径正交（数据驱动核心）

```
   三原语 (β' 嫁接融合体):
   ┌──────────┬─────────────────────────────────────────────────────┐
   │ node     │ skill 兑现业务 (id/type:task|human_gate|merge|loop    │
   │          │   /skill:placeholder/exit_condition)                 │
   │ edge     │ 流转 + HG 折叠为「带停等的特殊 edge」                  │
   │ loop_back│ 收敛循环 (from/to/max_iter/converge_field)            │
   └──────────┴─────────────────────────────────────────────────────┘

   edge.condition 双路径正交 (gate 数据驱动 R2.0):
   ┌─────────────────────────────────┬────────────────────────────────┐
   │  signal (枚举)                   │  awaiting_human (bool)          │
   │  green ─ 流转                    │  true  ─ 触发 HG 停等            │
   │  yellow ─ 流转 + 警告            │           (必须声明 gate,缺则throw)│
   │  red    ─ blocked 不流转         │  false ─ 直接流转                │
   │  unknown ─ 触发 HG 停等          │                                 │
   └─────────────────────────────────┴────────────────────────────────┘
              ↑ 两条路径独立正交, 信号路径 × 停等路径不冲突
```

---

## 六、里程碑进度（M0-M5 + 层3）

```
   layer-1 cc-runtime  ████████████████████████ 100% ✅ tag: layer1-cc-runtime
        │ (18/18 测试绿, commit a768586)
        ▼
   layer-2 venture-pipeline
     M0 骨架+load-graph      ██████████ 100% ✅ tag layer2-M0
     M1 pipeline-state      ██████████ 100% ✅ tag layer2-M1
     M2 advance-node 引擎   ██████████ 100% ✅ tag layer2-M2
     M3 resolve-hg          ██████████ 100% ✅ tag layer2-M3
     M4 venture-resume      ██████████ 100% ✅ tag layer2-M4 (HEAD de2b539)
     M5 收尾(占位拓扑跑通)   ████░░░░░░  🔄 进行中
       ├ R5.1 dag.placeholder.json       ☐
       ├ R5.2 跑通验证 N1→N8             ☐  ← 依赖 A 方案引擎改造
       ├ R5.3 persona-signal.md          ☐
       ├ R5.4 persona-signal.test.js     ☐
       └ R5.5 约束核验+回归+commit+tag    ☐
        │
        ▼
   layer-3 cc-venture       ░░░░░░░░░░  📋 延后 (8节点 DAG 业务规格)
```

---

## 七、M5 核心：loop_back 收敛语义改造（A 方案 · boss 裁决）

```
   问题: M2 引擎 loop_back 收敛语义 = 「达 max_iter 停在循环点 = 死胡同」
         与 R5.2 业务意图「N6⇄N7 收敛后→N8」冲突
   死锁张力 (数学证明):
     · 双向互锁(N6⇄N7)才能让 iteration 累积达 max_iter 真收敛
       但 converged 停 fromNode + outEdges[0] 固定 → 死锁到不了 N8
     · 单向(N6→N7)+N7→N8 → 能到 N8, 但 iteration 只+1 永不收敛
     · 二者在 M2 旧语义下互斥 ✗

   A 方案裁决 (boss 选 A · 语义最正确 · 向后兼容):
   ┌─────────────────────────────────────────────────────────────────┐
   │  converged 分支 (advance-node.js line 377-400) 改造:             │
   │                                                                  │
   │  达 max_iter → 找 fromNode「首条非 loop_back out-edge」(出口)     │
   │     ├ 有出口 → 推进 (loop_back=有限循环, 达上限改走出口继续)       │
   │     └ 无出口 → fallback 停 fromNode (旧行为, 向后兼容)            │
   │                                                                  │
   │  向后兼容验证 (M2 测试⑤零改动):                                    │
   │    测试⑤拓扑 N6→N7→N6 互锁, N7 唯一 outEdge 是 loop_back          │
   │    → exitEdge=无 → fallback 停 N7 → 断言 iteration=3 ✓           │
   │                                                                  │
   │  R5.2 跑通: N7 outEdges=[N7→N6(loop_back), N7→N8(出口)]          │
   │    → 收敛后取 N7→N8 → 推进到 N8 ✓                                │
   └─────────────────────────────────────────────────────────────────┘

   改动范围最小化:
     advance-node.js converged 分支  ── 纯增量扩展
     advance-node.test.js 测试⑤      ── 零改动 (向后兼容) + 新增测试⑨ converged_exit
     resolve-hg.js                    ── 零改动 (handleLoopBack 结构不变)
```

---

**架构图状态**：✅ 2026-06-17 落盘。覆盖三层栈 / 状态文件 / 数据流 / 原语 / 里程碑 / M5 改造全景。
