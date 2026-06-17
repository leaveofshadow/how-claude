# pipeline-guide.md —— venture-pipeline 层2 工作流引擎深度参考

> 来源：50-decision §2（三原语 + 嫁接1）+ §7（C1-C7 约束）。
> 引擎代码：`scripts/advance-node.js`（推进核心）/ `scripts/pipeline-state.js`（状态文件）。
> 度量：会话·token（C4，禁人天）。
> 衔接：cc-loop 循环合同（第8节）/ cc-runtime 层1（第3节双文件协同）。

本文档是 venture-pipeline SKILL.md 的深度参考，覆盖引擎的数据驱动哲学、推进模型、嫁接1 双文件协同、HG 生命周期、断点续传假设、以及与 cc-loop 循环合同的实例化衔接。

---

## 一、dag.json 数据驱动哲学

**核心理念一句话**：引擎代码零分支硬编码，所有业务条件都在 `dag.json.condition` 里。

### 1.1 三原语

```
node      → 业务单元（绑定 skill 兑现语义，exit_condition 可证伪）
edge      → 流转（condition.signal 管走不走 + condition.awaiting_human 管停不停）
loop_back → 收敛回环（from/to/max_iter，达 max_iter 强制收敛）
```

HG（human gate）**不单列原语**，折叠为「带 awaiting_human:true 的特殊 edge」（50 §2.1 关键取舍）。这是对「human_gate 作为第四原语」的驳斥——它增加引擎复杂度却不增加表达力。

证据：`dag.json` line 33-41 的 N2→N3 edge 就是 HG 折叠形态——`signal:"green"`（流转意愿）+ `awaiting_human:true`（停等 boss）+ `gate:"HG1"`（闸门编号），三字段正交叠加。

### 1.2 为什么数据驱动（C7）

> 引擎交付 = 转移拓扑跑通 ≠ 业务跑通。

引擎的职责是**拓扑执行**：读 dag.json → 按节点/边推进 → HG 停等 → 收敛。引擎**不解释** `exit_condition` 文本含义（那是各节点 skill 的事，C7）。所以：

- 换 DAG 拓扑（加节点/改边/加回环）= 改 dag.json，**不改 advance-node.js 一行**。
- 引擎代码里没有 `if (node.id === 'N1')` 这样的硬编码分支——见 `advance-node.js` cmdAdvance（line 195-437），全程基于 `nodes`/`edges`/`loop_backs` 数组字面操作。

数据驱动的代价：DAG 作者必须正确填写 condition 字段（awaiting_human:true 的 edge 必须声明 gate，见第4节）。引擎用「缺 gate 抛错」兜底（advance-node.js line 296-299）。

---

## 二、推进模型（advance 一拍）

「推进一拍」是 advance-node.js 的核心动作。一拍 = 从 current_node 取 outEdges[0] → 评估 → 决定流转/停等/收敛/到达终点。

### 2.1 一拍流程图

```
                  node advance-node.js advance
                           │
                           ▼
              ┌─────────────────────────────┐
   R2.5       │ watchDirectionShift         │ direction.json.current_version
   换向监测    │ version 变了？              │ ≠ state.direction_version ?
              └──────────────┬──────────────┘
                   是 │            │ 否
                      ▼            ▼
            reset 推进态         current_node == null ?
            (return              │
             direction_shift_    ├─ 是 → 定位 nodes[0].id → return enter
             reset)              │     （隐式推进，line 224-254）
                                 │
                                 ▼
                         findOutEdges(current_node)
                                 │
                    outEdges 为空? ├─ 是 → return completed（到达终点，line 258-279）
                                 │
                                 ▼
                       edge = outEdges[0]（C5 单线，line 282）
                                 │
              ┌──────────────────┴──────────────────┐
   R2.2       │ evaluateEdge(edge.condition.signal)  │ 四态评估（line 137-155）
              └──────────────────┬──────────────────┘
                                 ▼
              ┌──────────────────────────────────────┐
   R2.4       │ awaiting_human === true ?            │ 停等检查（line 294，先于 signal）
   优先级最高 │                                       │
              └────────┬──────────────────┬──────────┘
                  是   │                  │ 否
                       ▼                  ▼
            gate 缺? ├ 抛错          signal 分支：
                    │ (line 297)     ├ askHG(unknown) → triggerHG → return ask_hg
                    ▼                ├ blocked(red)   → return blocked
            triggerHG(gate)          └ flow(green/yellow) →
            return awaiting_human        │
            (line 314-321)               ▼
                                  ┌──────────────────────┐
                          R2.3    │ handleLoopBack(edge) │ line 161-182
                                  └────────┬─────────────┘
                                           │
                              converged? ├─ 是 → return converged（达 max_iter 不回环）
                                           │
                                           ▼
                                  流转 current_node → edge.to
                                  return advance（line 426-436）
```

### 2.2 关键顺序约束

**awaiting_human 检查先于 signal 评估**（advance-node.js line 290-294，注释明确「signal 评估先于 awaiting_human，正交但顺序固定」——此处顺序指 evaluateEdge 调用在 if 之前，但 awaiting_human 的 return 优先级最高，一旦 true 直接 triggerHG 不看 signal 分支）。

为什么这个顺序：awaiting_human 是「无条件停等」（boss 必须决策），signal 是「流转意愿」。HG 停等是硬约束，signal 只是建议——硬约束优先。

---

## 三、嫁接1 双文件协同（核心契约）

> 嫁接1 是整个层2 设计的基石（50 §2.2）。违反即返工。

### 3.1 双文件职责正交

```
direction.json      ← 层1 业务方向指针（frozen-v1，零改动）
                      永远 status:'active', gate:null
                      ↑ shift-direction.js line 126-127 硬编码证据
                      只随 direction.set（boss 换向）变 current_version

pipeline-state.json ← 层2 引擎推进态（新文件）
                      status: active | awaiting_human  ← 独占 HG 停等语义
                      gate:   null | HG1 | HG2         ← 独占闸门编号
                      current_node / frontier / iteration ← 独占节点推进
```

**为什么这么分**：shift-direction.js line 126-127 硬编码 `status:'active', gate:null`（已 Read 确认）证明层1 原始设计意图就是「direction.json 只表达活跃方向，HG 语义本就不该在此」。嫁接1 把 HG 状态职责放到新文件 pipeline-state.json，是**回归层1 意图，而非绕过 frozen-v1**（schema §4.4）。

### 3.2 C1 写者隔离表

| 文件 | 允许的写者 | 允许的读者 |
|------|-----------|-----------|
| `direction.json` | **仅** shift-direction.js（层1 腿） | 任意（pipeline-state.js init / advance-node.js R2.5 纯读 current_version） |
| `pipeline-state.json` | pipeline-state.js（init/set-hg/verify）+ advance-node.js（advance）+ resolve-hg.js（resolve，M3） | 任意（H6 面板 / advance / 续传） |

**C1 硬约束**：pipeline-state.js 的 set-hg 命令**绝对禁止** require/read/write direction.json（pipeline-state.js line 13-16 注释 + line 144-183 cmdSetHg 实现全程不碰 direction.json）。advance-node.js 读 direction.json.current_version 是纯读（advance-node.js line 64-74 readDirectionVersion，try-catch fallback 不阻塞）。

### 3.3 双文件时间线（一次完整推进）

```
t0  boss: node pipeline-state.js init
    └─ pipeline-state.json 创建（status:active, gate:null, graph_hash 锚定 dag.json）
    └─ 读 direction.json.current_version=1 写入 pipeline-state.direction_version=1（纯读）
    direction.json: 不变

t1  engine: node advance-node.js advance（多次）
    └─ current_node: null → N1 (enter) → N2 (advance, signal=green)
    └─ 落到 N2→N3 edge（awaiting_human:true, gate:HG1）
    └─ pipeline-state.json: status=awaiting_human, gate=HG1, current_node=N2（不推进）
    direction.json: 不变（C1）

t2  boss: 看 H6 面板（读 pipeline-state.status=awaiting_human）
    └─ 决策：通过 HG1
    └─ node resolve-hg.js resolve --gate HG1
    └─ pipeline-state.json: status=active, gate=null, current_node 推进越过 edge → N3
    direction.json: 不变（HG 决策 ≠ 换向）

t3  boss: node shift-direction.js（换向，如需改业务方向）
    └─ direction.json: current_version 1 → 2（层1 腿）
    └─ pipeline-state.json: 不变（换向 ≠ HG 决策）

t4  engine: node advance-node.js advance
    └─ watchDirectionShift 监测 direction_version 变化（1→2）
    └─ pipeline-state.json 重置：current_node=null, frontier=[], iteration=0, graph_hash 重算
    └─ return direction_shift_reset（本次不推进，下次从新拓扑 nodes[0] 开始）
    direction.json: 已是 v2
```

**关键**：t2（HG 决策）和 t3（换向）是两个独立动作，改不同的文件，引擎从不混淆（schema §六）。

---

## 四、gate 字段来源（R2.0 数据驱动）

gate 编号（HG1|HG2）从 **edge.condition.gate 字段**读，引擎零硬编码（dag-schema.md §一「gate 编号来源」）。

### 4.1 来源规则决策树

```
edge 形态判断
│
├─ awaiting_human === true ?
│  ├─ 是 → condition.gate 必须存在
│  │       ├─ 有 gate（HG1/HG2）→ triggerHG(gate)（advance-node.js line 296, 300）
│  │       └─ 缺 gate → 抛错「awaiting_human edge 缺 gate」+ exit 1（line 297-299）
│  │           （R2.0 裁决：DAG 作者必须显式声明，引擎不猜）
│  │
│  └─ 否 → 看 signal
│     ├─ unknown → gate = condition.gate || 'HG1'（fallback，line 140）
│     │           triggerHG(gate) → return ask_hg（line 325-348）
│     │           （unknown 询问缺 gate 编号时，HG1 是合理默认）
│     │
│     ├─ red → 不流转，return blocked（line 350-371），gate 不读
│     ├─ green → 流转，gate 不读（line 402-436）
│     └─ yellow → 流转 + 记警告，gate 不读
```

### 4.2 为什么 awaiting_human 必须声明 gate 而 unknown 有 fallback

- awaiting_human 是**显式停等**（DAG 作者明确要 boss 介入），必须告诉引擎停在哪号闸门——缺了就是 DAG 数据不全，报错逼作者补全。
- unknown 是**隐式询问**（skill 不确定 signal，降级走 HG），引擎此时没有明确的闸门编号信息，fallback HG1 是保守默认（dag-schema.md §一 β' 数据驱动裁决）。

---

## 五、loop_back 收敛

适用 N6⇄N7 互锁场景（两个节点互相 out-edge，需 max_iter 强制收敛防止死循环）。

### 5.1 收敛判定树

```
advance 流转前检查 edge 是否在 dag.loop_backs 中（handleLoopBack, line 161）
│
├─ 不在 loop_backs → 普通流转，iteration 不变（line 163-165）
│
└─ 在 loop_backs → iteration++
   │
   ├─ iteration >= max_iter ?
   │  ├─ 是 → converged=true，不回环，current_node 停在当前节点（line 168-175）
   │  │       return converged（advance-node.js line 391-400）
   │  │       reason: "converged:max_iter reached（iteration=N>=max_iter=M）"
   │  │
   │  └─ 否 → 回环推进（current_node → edge.to），iteration 计数（line 176-181）
   │          继续走正常流转分支（line 402-436）
```

### 5.2 为什么需要 loop_back

互锁拓扑（A→B→A→B...）若没有收敛机制，advance 会无限回环烧 token。loop_back + max_iter 是护栏——达上限强制停在当前节点，交给后续处理（人工或换向）。这是 cc-loop「最大迭代数」护栏在 DAG 层的实例化（见第8节）。

---

## 六、HG 生命周期

HG（human gate）停等是嫁接1 的核心交付。一次 HG 完整生命周期 = advance 触发 → boss 决策 → resolve-hg 解除。

### 6.1 advance 与 resolve-hg 分工

```
advance（推进）                resolve-hg（解除停等）
─────────────                  ─────────────────────
读 out-edge 评估                读 pipeline-state.status
若 awaiting_human:true          必须 status=awaiting_human
  → triggerHG(gate)             → 解除：status=active, gate=null
  → status=awaiting_human        → 推进越过当前 edge
  → current_node 不动             → current_node → edge.to
  → return awaiting_human         → return resolved
  （停下等 boss）                 （boss 决策后继续）
```

**为什么分开两个命令**：advance 是引擎自驱（读 dag.json 推进），resolve-hg 是 boss 显式决策（人主导）。混在一个命令里会让「自动推进」和「人工解除」的边界模糊——advance 永远不会自己解除 awaiting_human（line 294-321 触发后直接 return，不继续推进），必须 resolve-hg 显式解除。

### 6.2 生命周期时序图

```
engine                pipeline-state.json         boss
  │                          │                      │
  │ advance (到 N2→N3 HG edge)│                      │
  │─────────────────────────>│                      │
  │                          │ status=awaiting_human│
  │                          │ gate=HG1             │
  │                          │ current_node=N2      │
  │ return awaiting_human    │                      │
  │<─────────────────────────│                      │
  │                          │                      │
  │                          │   （H6 面板显示停等） │
  │                          │<─────────────────────│
  │                          │   读 status=awaiting │
  │                          │────────────────────->│ 面板：N2 / HG1 / 推荐resolve
  │                          │                      │
  │                          │              boss 决策通过 HG1
  │                          │              resolve-hg resolve --gate HG1
  │                          │<─────────────────────│
  │                          │ status=active        │
  │                          │ gate=null            │
  │                          │ current_node=N3      │
  │                          │────────────────────->│ return resolved
  │                          │                      │
  │ advance（从 N3 继续）     │                      │
  │─────────────────────────>│                      │
  │                          │ ...                  │
```

---

## 七、断点续传 B 假设（7×24 单机）

> charter 硬约束：单机 / 单人 / 单 Claude。B 假设 = 断点续传是会话级，非跨机器持久队列。

### 7.1 pipeline-state.json 落盘 = 会话级断点续传

每次 advance/set-hg/resolve-hg 都 `atomicWriteJSON` 落盘（advance-node.js line 244/271/313/362/390/425；pipeline-state.js line 126/181）。会话中断（compact / 进程退出 / 笔记本休眠）后：

- 新会话 `node pipeline-state.js read` 读 current_node/frontier/status 续跑。
- 若 status=awaiting_human，直接显示 HG 面板等 boss 决策（无需重放历史）。
- history 数组是审计链（append-only），不用于恢复执行态——恢复只读 current_node 等标量字段。

### 7.2 B 假设的边界（不是什么）

- **不是**跨机器持久队列（没有 Redis/外部 broker，charter 禁外部依赖）。
- **不是**分布式锁（单 Claude 串行推进，无并发竞争）。
- **是**单机单会话的「断点记忆」——本机 .venture/state/pipeline-state.json 就是断点。

### 7.3 ScheduleWakeup 与休眠约束

charter 约束：ScheduleWakeup 自调度 + 笔记本休眠不触发是硬约束。这意味着：

- 引擎不假设「定时自动推进」——advance 由 boss 或上层循环（cc-loop /loop）显式调用。
- 休眠后醒来，引擎状态在 pipeline-state.json 里，read 即可恢复，不依赖进程常驻。

M4 venture-resume.js 将提供 `/venture-resume` slash 封装这个恢复流程（见 70-requirements R4.1-R4.4，本文档不展开）。

---

## 八、与 cc-loop 循环合同衔接

> venture-pipeline 的 DAG 推进循环 = cc-loop 循环合同的一个实例化。

### 8.1 循环合同六要素映射

cc-loop 定义循环合同六要素（TRIGGER/SCOPE/ACTION/BUDGET/STOP/REPORT，见 cc-loop/references/loop-guide.md §二）。venture-pipeline 的 DAG 推进循环实例化为：

```
┌──────────────────────────────────────────────────────────┐
│            venture-pipeline DAG 推进循环                  │
│            （cc-loop 循环合同的实例化）                    │
│                                                          │
│  TRIGGER → /loop 调度 或 boss 显式 advance               │
│            （不假设定时自动，charter 休眠约束）            │
│  SCOPE   → dag.json 定义的节点拓扑                       │
│            （current_node 所在节点的 out-edge 范围）       │
│  ACTION  → node advance-node.js advance（推进一拍）       │
│  BUDGET  → 护栏三件套（见下）                             │
│  STOP    → action=completed（无 out-edge 到达终点）       │
│            或 action=converged（loop_back 达 max_iter）   │
│            或 boss 干预（awaiting_human 不解除）          │
│  REPORT  → advance 返回 JSON + H6 面板（≤200 字符）       │
│                                                          │
│  ┌────────────────────────────────────┐                  │
│  │  护栏三件套（cc-loop §三）          │                  │
│  │  1. 最大迭代数 → loop_back.max_iter │                  │
│  │  2. 无进展检测 → action=blocked 连续│                  │
│  │     K 次（上层循环检测，非引擎内置）│                  │
│  │  3. 预算上限  → 上层 /loop BUDGET   │                  │
│  │     （token/$，引擎不感知）         │                  │
│  └────────────────────────────────────┘                  │
│                                                          │
│  ┌────────────────────────────────────┐                  │
│  │  锚文件体系（cc-loop §四）          │                  │
│  │  VISION.md → dag.json.description  │                  │
│  │  CLAUDE.md → 技能使用规则           │                  │
│  │  PROMPT.md → 各节点 skill 的 prompt │                  │
│  │  Tests    → 节点 exit_condition 可证│                  │
│  │             伪验证（cc-goal 第3层） │                  │
│  └────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

### 8.2 advance 一拍 = 循环一拍

cc-loop 的循环本质是「while not STOP: ACTION」。venture-pipeline 里：

- **循环一拍** = 一次 `node advance-node.js advance`。
- **STOP 判定** = advance 返回 `action:completed` 或 `action:converged`（advance-node.js line 272-278 / 391-400）。
- **HG 停等 = 循环里的人工 gate**：返回 `action:awaiting_human` 时循环暂停，等 resolve-hg 后才继续下一拍。这对应 cc-loop 的「循环里有人说不」——boss 是 HG 这个 gate 上说「不/通过」的人。

### 8.3 衔接图

```
cc-loop（方法论）                    venture-pipeline（实例化）
──────────────                      ──────────────────────
循环合同六要素        ──实例化──>    DAG 推进循环（§8.1）
护栏三件套            ──映射──->     loop_back.max_iter / 上层 /loop
锚文件体系            ──落地──->     dag.json + 各节点 skill + tests
闭环反馈              ──体现──->     exit_condition 可证伪 + HG boss 决策
/loop 调度            ──驱动──->     /loop 5m node advance-node.js advance
                                     （charter 休眠约束下，boss 显式或 /loop）

cc-goal（终态条件）                  venture-pipeline（消费）
──────────────                      ──────────────────
五层模型第3层         ──填入──->     node.exit_condition 文本
可证伪性              ──要求──->     各节点 skill 必须可判定 exit_condition
```

---

## 九、反模式（不要这样做）

| 反模式 | 为什么错 | 正确做法 |
|--------|---------|---------|
| 300s 轮询间隔 | 缓存冷了但没省频率（Anthropic cache TTL=300s，270-300s 是最差区间） | 要么 60-270s（热缓存），要么 1200s+（冷但低频）。cc-loop §六明确标注 |
| 直接改 advance-node.js 硬编码业务（如 `if node==='N1' do X`） | 违反数据驱动（C7），引擎代码沦为业务逻辑垃圾桶 | 业务逻辑进 node.skill + exit_condition，引擎只管拓扑执行 |
| resolve-hg 写 direction.json | 违反 C1 写者隔离（direction.json 仅 shift-direction.js 可写） | resolve-hg 只写 pipeline-state.json（解除 awaiting_human + 推进） |
| 用 signal 第五枚举值表达停等 | 混淆「流转语义」与「停等语义」（dag-schema §一驳灰度6） | signal 管四态流转，awaiting_human 布尔独立管停等，两字段正交 |
| dag.json 静默改拓扑不重新 init | graph_hash 漂移，verify exit 1（C6） | 改 dag.json 后必须 `pipeline-state.js init` 重新锚定 graph_hash |
| 引擎内置无进展检测 | 增加引擎复杂度，且无进展定义因场景而异 | 无进展检测放上层循环（/loop 的护栏），引擎只返回 action=blocked 供上层判断 |

---

## 参考来源

- 50-decision.md §2（三原语 + 嫁接1）/ §7（C1-C7 约束）
- 70-requirements.md M2（R2.1-R2.5）/ M3（R3.1-R3.3）
- 60-impl-plan.md §6.1（验证闸 M3-面板 ≤200 字符）
- cc-loop/references/loop-guide.md（循环合同六要素 + 护栏三件套 + 锚文件）
- 引擎代码：advance-node.js（推进）/ pipeline-state.js（状态）/ dag.json（拓扑数据）
