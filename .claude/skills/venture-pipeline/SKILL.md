---
name: venture-pipeline
description: 层2 工作流引擎 —— DAG 数据驱动编排（三原语 node/edge/loop_back + 嫁接1 HG 独占 pipeline-state）。50-decision β' 裁决落地。
trigger:
  - venture-pipeline
  - 层2 编排
  - pipeline-state
  - advance-node
---

# venture-pipeline（层2 工作流引擎）

> M0 阶段：仅骨架 + dag.json schema + load-graph.js。
> 正文（触发词速查表 / 流程 / 面板模板）由 M3 填充。

## 当前状态

- M0：dag.json schema + load-graph.js（解析 / 字位报未实现 / graph_hash）
- M1-M5：见 .2pp/2026-06-16-layer2-workflow-engine/70-requirements.md

## 核心架构（β' 裁决）

```
direction.json     ← 层1 业务方向指针（C1 零改动，永远 active/gate:null）
pipeline-state.json ← 层2 新增：独占 HG 停等 + 节点推进（嫁接1）
dag.json            ← 数据驱动拓扑（三原语，换 DAG 不改引擎代码）
```

三原语：node / edge（HG 折叠为带停等的特殊 edge）/ loop_back。
字位预留：subgraph / fan_out（reserved:true, implemented:false，遇即报未实现，C5）。

## 参考文档

- references/dag-schema.md —— DAG schema 定义（R0.2）
- references/pipeline-state-schema.md —— pipeline-state schema（M1 待填）
- references/pipeline-guide.md —— 深度参考（M3 待填）
