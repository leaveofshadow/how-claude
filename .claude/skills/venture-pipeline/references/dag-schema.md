# dag-schema.md —— venture-pipeline DAG 拓扑定义

> 来源：50-decision §2.1 三原语 + §7 C5 字位预留。
> 解析器：scripts/load-graph.js（R0.4）。
> 度量：会话·token（C4，禁人天）。

---

## 一、三原语

### node:

DAG 节点，绑定一个 skill 兑现业务语义。

```json
{
  "id": "N1",
  "type": "task",
  "skill": "<skill-name>",
  "exit_condition": "<可证伪的退出条件>"
}
```

字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点唯一标识（N1/N2/HG1...） |
| type | enum | `task` / `human_gate` / `merge` / `loop` |
| skill | string | 兑现该节点的 skill 名（占位 DAG 用 `placeholder`，C7） |
| exit_condition | string | 可证伪退出条件（cc-goal 五层模型第3层） |

### edge:

节点间流转。**HG（human gate）折叠为带停等的特殊 edge**（50 §2.1 关键取舍，不单列 human_gate 原语）。

```json
{
  "from": "N1",
  "to": "N2",
  "condition": {
    "signal": "green",
    "awaiting_human": false,
    "gate": "HG1"
  }
}
```

字段说明（`condition` 对象）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `signal` | enum | 是 | 流转控制枚举 `green\|yellow\|red\|unknown` |
| `awaiting_human` | bool | 是 | HG 停等触发（独立于 signal） |
| `gate` | enum | **条件必填** | HG 闸门编号 `HG1\|HG2`；详见下方「gate 编号来源」 |

#### MINOR 双路径（edge.condition 的两个正交字段）

**关键设计**：`signal` 管流转，`awaiting_human` 管停等，两者**正交不冲突**。这是 50 §2.1「HG 折叠为带停等的特殊 edge」的落地，也是对 00-explore 灰度6「signal 第四态」的驳斥——signal 不需要第四态，停等由独立布尔承担。

| 路径 | 字段 | 取值 | 触发动作 | 落地状态 |
|------|------|------|---------|---------|
| **路径A 询问态** | `condition.signal` | 枚举 `green\|yellow\|red\|unknown` | signal=unknown → 节点 skill 不确定 → 走 HG 询问 | pipeline-state.status 视询问结果定 |
| **路径B 停等态** | `condition.awaiting_human` | 布尔 `true\|false`（独立于 signal） | true → pipeline-state.status=`awaiting_human` + gate=HG{n} | pipeline-state.status=`awaiting_human` |

#### gate 编号来源（R2.0 数据驱动裁决，β'）

`gate`（HG1|HG2）来源 = **edge.condition.gate 字段**（数据驱动，不硬编码）。advance-node.js 引擎按下列规则读取：

| edge 形态 | gate 取值 | 引擎动作 |
|----------|----------|---------|
| `awaiting_human:true` 的 edge | **必须**声明 `condition.gate` | 缺 gate → advance 报错「awaiting_human edge 缺 gate」+ exit 1 |
| `signal:unknown` 触发的询问 | `condition.gate \|\| 'HG1'` | fallback 到 HG1（unknown 询问缺 gate 编号时的合理默认） |
| 纯流转 edge（green/yellow/red + awaiting_human:false） | gate 字段无意义（可省略） | 引擎不读 |

> **β' 数据驱动**：gate 编号从 edge 数据读，而非引擎硬编码。DAG 作者通过 edge.condition.gate 声明该停等走哪个闸门，引擎照做。

**正交性说明**：
- `signal` 枚举管流转控制（green=自动流转 / yellow=记录警告但流转 / red=停等不流转 / unknown=走 HG 询问）。
- `awaiting_human` 布尔管 HG 停等触发（与 signal 取值无关，可叠加在任何 signal 上）。
- 典型组合：HG edge = `signal:"green", awaiting_human:true`（流转到下一节点前先停等 boss 决策）。
- 纯流转 edge = `signal:"green", awaiting_human:false`（自动流转，不停等）。
- 阻塞 edge = `signal:"red", awaiting_human:false`（条件未满足，停等但不触发 HG）。

> **驳灰度6**：signal 不引入 `awaiting_human` 作为第五枚举值——那会混淆「流转语义」与「停等语义」。两职责分离到两个字段，引擎代码更简单（C2 纯 fs 字面比较），DAG 作者心智更清晰。

### loop_back:

收敛循环（N6⇄N7 互锁，MAX_ITER=3，驳 B-β-5）。

```json
{
  "from": "N6",
  "to": "N7",
  "max_iter": 3,
  "converge_field": "signal"
}
```

字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| from | string | 回环起点 |
| to | string | 回环终点 |
| max_iter | int | 最大迭代数（达此值强制收敛，不再回环） |
| converge_field | string | 收敛判据字段（M5 persona-signal.md 定义结构化阈值） |

---

## 二、字位预留（C5 —— 遇即报未实现）

> 来源：50 §4 γ 残值嫁接 —— subgraph/fan_out schema 字位预留，**纯数据预留**，引擎首发零运行时代码/零测试/零 frozen INV。

```json
{
  "subgraph": { "reserved": true, "implemented": false },
  "fan_out":  { "reserved": true, "implemented": false }
}
```

**合规约束（C5）**：
- dag.json 允许包含 `subgraph` / `fan_out` 字段（schema 接受）。
- load-graph.js 解析时遇 `implemented:false` 的字位，**必须** stderr 报「未实现：{字段}」并 exit≠0。
- **严禁**在 M0-M2 引擎首发中为字位写任何运行时逻辑（违反则降级回 β'，50 §7.4）。
- 字位预留的目的是为未来 γ 路线的 subgraph 嵌套 / fan_out 并行分支保留 schema 兼容性，不承诺实现。

---

## 三、graph_hash（C6 防静默漂移）

load-graph.js 对 dag.json 计算确定性哈希：

1. 递归排序 JSON 所有键（`Object.keys().sort()` 重建对象）。
2. `JSON.stringify(sortedObj)`（无空格，确定性序列化）。
3. `crypto.createHash('sha256').update(str).digest('hex')` → 64 位十六进制。

特性：同一 dag.json 连跑两次 hash 必相等（确定性）。dag.json 任意字段变动 hash 必变（防漂移）。
用途：pipeline-state.graph_hash 存储哈希，M1 verify 子命令比对防静默漂移。

---

## 四、最小合法 DAG 示例（R0.3 dag.json）

3 节点（N1→N2→HG1→N3），含 1 个 awaiting_human edge：

```
N1 ──green──> N2 ──green+awaiting_human──> HG1 ──green──> N3
                                                    ↑
                                        （boss 决策后流转）
```

详见 `../dag.json`。
