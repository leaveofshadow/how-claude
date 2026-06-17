---
description: 断点续传——从 pipeline-state.current_node + checkpoint.continue_from 恢复中断的 venture 流水线，并套 /loop 继续 advance 推进
---

# /venture-resume — 层2 断点续传（M4 R4.3）

> 会话中断后恢复 venture-pipeline 流水线到中断前节点。
> 衔接 cc-loop：resume 恢复续传点 → /loop 继续 advance 推进。

## 执行步骤

### 1. 续传恢复（读双源 + C6 漂移校验）

```bash
node .claude/skills/venture-pipeline/scripts/venture-resume.js resume --root .venture/state --dag .claude/skills/venture-pipeline/dag.json
```

- exit 0 + `resumed at <node> iter:<n>` → 续传成功，进入步骤 2
- exit 1 + `graph_hash 不匹配，拒绝续传` → dag.json 被改，需先 `pipeline-state.js init` 重锚定，停止
- exit 1 + `current_node 为 null` → 尚未 advance 进入起点，先跑 advance 定位起点

### 2. 套 /loop 继续推进（cc-loop Stage3 SOP）

从恢复节点用 advance-node.js 继续 DAG 推进，每拍：

```bash
node .claude/skills/venture-pipeline/scripts/advance-node.js advance --root .venture/state --dag .claude/skills/venture-pipeline/dag.json
```

- action=advance → 流转成功，/loop 下一拍
- action=awaiting_human / ask_hg → HG 停等，停 loop，报告 boss 决策（boss 决策后调 resolve-hg.js resolve 解除）
- action=blocked → signal=red 停等不流转，记录后继续 /loop
- action=completed → 流水线完成，/loop 退出

## 续传双源（pipeline-state-schema §4.2）

- `pipeline-state.current_node`（层2 权威源：恢复到哪个节点）
- `checkpoint.continue_from`（层1 锚点，规范格式 `node:<n>,task:<t>,iter:<i>`，提供 iter）
- `pipeline-state.graph_hash`（C6：dag.json 漂移则拒绝续传）

## 约束

- C1：续传绝不碰 direction.json（direction_version 从 pipeline-state 读）
- B 假设：7×24 单机会话级断点续传，脚本无状态，每次从磁盘读
