# pipeline-state-schema.md —— venture-pipeline 引擎状态文件契约

> 来源：50-decision §2.2（嫁接1 状态职责分配）+ §7 C1/C6。
> 解析器：scripts/pipeline-state.js（M1 R1.2-R1.4）。
> 度量：会话·token（C4，禁人天）。

---

## 一、文件位置

```
<projectRoot>/.venture/state/pipeline-state.json
```

与层1 的 `direction.json` / `checkpoint.json` / `tasks.tree.json` / `trace.ndjson` 同目录（`.venture/state/`），但**职责正交**：
- 层1 四文件 = 通用执行态（方向指针 / 续跑锚点 / 任务树 / 审计 trace）。
- pipeline-state.json = **层2 DAG 引擎推进态**（当前节点 / 前沿集合 / HG 停等）。

---

## 二、字段定义（9 字段）

| 字段 | 类型 | 取值 | 说明 |
|------|------|------|------|
| `direction_version` | int | ≥1 | 当前绑定方向版本（与 direction.json.current_version 同步；R2.5 换向监测源） |
| `current_node` | string\|null | 节点 id（N1/N2/...）或 null | 引擎当前所处节点；init=null，advance 流转后更新 |
| `frontier` | string[] | 节点 id 数组 | 前沿集合（从 current_node 出发的可达下一节点），init=空数组 |
| `iteration` | int | ≥0 | loop_back 收敛迭代计数（N6⇄N7 互锁用），init=0 |
| `status` | enum | `active` \| `awaiting_human` | **独占 HG 停等语义**（嫁接1）；active=引擎可推进 / awaiting_human=HG 停等 boss 决策 |
| `gate` | enum\|null | `null` \| `HG1` \| `HG2` | 当前停等的 HG 闸门编号；与 status 联动（status=awaiting_human 时 gate≠null） |
| `graph_hash` | string | 64 位 sha256 hex | dag.json 的确定性哈希（复用 load-graph.computeGraphHash）；verify 子命令比对源（C6 防静默漂移） |
| `protocol_version_read` | string\|null | hcc-org 协议版本号或 null | [B-2/C-4] 部门激活时记录读到的 hcc-org.protocol_version（cmdInit 读 charter.md frontmatter）；hcc-org 未装 / frontmatter 无此字段 / 读失败 → null（fallback，不阻塞引擎） |
| `history` | array | 事件对象数组 | 审计链（每次 init/set-hg/流转追加一条），结构见下 |

### history 事件结构

```json
{
  "ts": "<ISO8601>",
  "action": "init" | "set_hg" | "advance" | "resolve_hg",
  "from": { "status": "...", "gate": ..., "current_node": "..." },
  "to":   { "status": "...", "gate": ..., "current_node": "..." },
  "reason": "<string>"
}
```

---

## 三、init 默认值（R1.2）

```json
{
  "direction_version": 1,
  "current_node": null,
  "frontier": [],
  "iteration": 0,
  "status": "active",
  "gate": null,
  "graph_hash": "<dag.json 的 sha256>",
  "protocol_version_read": null,
  "history": [
    {
      "ts": "<ISO8601>",
      "action": "init",
      "from": null,
      "to": { "status": "active", "gate": null, "current_node": null },
      "reason": "pipeline-state init"
    }
  ]
}
```

**direction_version=1 假设**：init 时读 direction.json.current_version 写入（若 direction.json 不存在则 fallback=1）。R2.5 换向监测会比对此字段。

**protocol_version_read=null 假设**：init 默认 null；cmdInit 实际写入时读 charter.md frontmatter 的 `protocol_version` 覆盖为版本号（[B-2/C-4] R2.1）。hcc-org 未装则保持 null（fallback，不阻塞层2 引擎）。R2.3 测试断言此字段。

---

## 四、嫁接1 状态职责（核心契约，C1）

> 来源：50-decision §2.2。**裁决的核心基石，违反即返工。**

### 4.1 双文件职责正交

```
direction.json     ← 回归纯"业务方向指针"（层1 frozen-v1 零改动）
                     永远 status:'active', gate:null（shift-direction.js line 126-127 硬编码）
                     只随 direction.set 换向

pipeline-state.json ← 独占 HG 停等 + 节点推进（层2 新文件）
                     status: active | awaiting_human
                     gate:   null | HG1 | HG2
```

### 4.2 读源切换（H6 / 层3 / 引擎自身）

**所有"是否 HG 停等"的判断，读 pipeline-state.status（非 direction.status）。**

- H6 SessionStart 注入面板 → 读 pipeline-state.status
- advance-node.js 决定能否推进 → 读 pipeline-state.status
- venture-resume.js 续传恢复 → 读 pipeline-state.current_node

### 4.3 写者隔离（C1 硬约束）

| 文件 | 允许的写者 |
|------|-----------|
| `direction.json` | **仅** shift-direction.js（层1 腿，零改动） |
| `pipeline-state.json` | pipeline-state.js（init/set-hg/verify；`protocol_version_read` 字段由 cmdInit 写入，[B-2/C-4] R2.1）+ advance-node.js（advance 流转，M2）+ resolve-hg.js（解除 awaiting_human 并推进越过 edge，M3） |

**pipeline-state.js 绝不写 direction.json**（C1 核心约束）。区分两种命令：
- **init 命令**：只读 `direction.json.current_version`（填充 `pipeline-state.direction_version` 字段，绑定当前方向版本，为 R2.5 换向监测源）——纯读非写，不改变 direction.json 的语义职责（`current_version` 本就是层1 业务方向指针的合法字段）。
- **set-hg 命令**：**绝对禁止** require 或读写 direction.json（R1.3 核心约束）。

direction.json 的 status/gate 永远是 `active/null`，HG 语义从不污染它。

### 4.4 为什么嫁接1 是回归而非绕过

shift-direction.js line 126-127 硬编码 `status:'active', gate:null` 证明层1 原始设计意图就是「direction.json 只表达活跃方向，HG 语义本就不该在此」。嫁接1 把 HG 状态职责放到新文件 pipeline-state.json，是回归层1 意图，而非绕过 frozen-v1。

---

## 五、graph_hash 校验（C6 防静默漂移）

> 来源：50-decision §7 C6 + dag-schema.md §三。

### 5.1 存储时机

init 命令计算 dag.json 的 graph_hash（复用 load-graph.computeGraphHash）写入 `pipeline-state.graph_hash`。

### 5.2 校验时机

verify 子命令重算当前 dag.json 的 graph_hash，与 pipeline-state.graph_hash 比对：
- 匹配 → exit 0 + stdout「graph_hash 匹配」。
- 不匹配 → exit 1 + stderr「graph_hash 不匹配：dag=<新> state=<旧>」（C6：拒绝静默漂移，dag.json 被改必须显式重 init）。

### 5.3 用途

防止 dag.json 被静默修改（如手工编辑加节点）后引擎继续按旧拓扑推进——dag.json 是数据驱动引擎的唯一真相源，其变动必须经 init 重新锚定 graph_hash。

---

## 六、与层1 的协同边界

| 场景 | pipeline-state 动作 | direction.json 动作 |
|------|--------------------|--------------------|
| init | 创建，graph_hash 锚定 dag.json | 无（可能尚未 init-state） |
| advance 流转 | 更新 current_node/frontier | 无 |
| HG 触发（set-hg） | status=awaiting_human, gate=HG{n} | **无（C1 核心约束）** |
| boss HG 决策后换向 | resolve-hg.js 解除 awaiting_human 并推进越过 edge（current_node 前进、status 回 active、gate 清 null） | direction.set 升版本（层1 腿） |
| 换向后 | R2.5 监测 direction_version 变化 → 重置 current_node/frontier/iteration | current_version++ |

**关键**：换向（direction.set）与 HG 决策是两个独立动作。换向改 direction.json；HG 决策改 pipeline-state.json。引擎不混淆两者。

---

**Schema 状态**：✅ M1 R1.1 落盘。下游 → R1.2 init / R1.3 set-hg / R1.4 verify / R1.5 测试。
