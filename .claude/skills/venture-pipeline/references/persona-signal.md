# persona-signal.md —— N6⇄N7 互锁 signal 收敛判据（M5 R5.3）

> 生成：2026-06-17 · 层2 venture-pipeline 引擎配套
> 使命：定义 N6（产品化）⇄ N7（迭代优化）互锁循环的 **signal 收敛判据**——结构化字段级比对，可零依赖测试证伪。
> 关联：[pipeline-state-schema.md](pipeline-state-schema.md)（pipeline-state 状态契约）· [dag-schema.md](dag-schema.md)（loop_back 原语）· [architecture-overview.md](architecture-overview.md) §七 A 方案

---

## 一、为什么需要这份判据 —— 驳 B-β-5

**B-β-5 攻击点**（来源：[20-attack-B.md](../../../../.2pp/2026-06-16-layer2-workflow-engine/20-attack-B.md) §B-β-5，严重度 MAJOR）：

> 原 β 方案的收敛判据 `persona_segment_unchanged` 依赖 **markdown 自由文本**解析——`grep -q 'segment: XXX' 06-persona.md` 然后逐轮比对。但 segment 值是 skill 生成的自由文本，不是固定枚举；markdown 解析的鲁棒性无法用零依赖测试覆盖 → **收敛判据本身不可证伪**（违反 cc-goal 可证伪性）。

附带 off-by-one：β §9.3 "on_max_iter: force_converge ... 第 4 轮强制" 的"第 4 轮"是 bug——max_iter=3 意味着**最多 3 轮**，第 3 轮未收敛则强制以第 3 轮为准，**不存在第 4 轮**。

**β' 嫁接融合体裁决**（[40-synthesis.md](../../../../.2pp/2026-06-16-layer2-workflow-engine/40-synthesis.md) M-β-⑥）：

| β 缺陷 | β' 修正 |
|--------|---------|
| 收敛判据 = markdown 自由文本比对 | **收敛判据 = 结构化 signal 字段级比对**（venture-persona 产 jsonld，与 extractor 同 schema） |
| force_converge "第 4 轮强制"（off-by-one） | **`iter >= MAX_ITER`（MAX_ITER=3）显式声明**，第 3 轮强制收敛 |

> 本文档即该裁决的落地：signal 必须是**固定枚举**（非 string free text），收敛=字段级一致，全部可零依赖测试证伪。

---

## 二、signal 四态结构化 schema

signal 是**固定枚举字段**（不是自由文本 string），venture-persona skill 每轮产出如下结构化 jsonld：

```jsonld
{
  "@type": "persona_signal",
  "iteration": 2,
  "signal": "green",
  "segment": "SMB_retail",
  "narrowed_from": "SMB",
  "confidence": 0.85,
  "delta_from_prev": 0.02
}
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `signal` | **enum** | `green \| yellow \| red \| unknown` | 四态收敛信号（**非 free text**） |
| `segment` | 受控词表 | 非自由文本 | persona 收窄目标（受控词表枚举值） |
| `narrowed_from` | 受控词表 | 非自由文本 | 上一轮 segment（收窄轨迹） |
| `confidence` | number [0,1] | 浮点 | persona 置信度 |
| `delta_from_prev` | number [0,1] | 浮点 | 与上一轮的迭代差（**收敛判据输入**） |
| `iteration` | int | ≥1 | 当前 N6⇄N7 互锁轮次 |

### 四态语义（与 edge.condition.signal 同源 · 数据驱动 R2.0）

| signal | 含义 | 引擎行为（advance-node.evaluateEdge） |
|--------|------|---------------------------------------|
| **green** | persona 已稳定收敛，可推进 | flow=true（流转） |
| **yellow** | 接近收敛但有未决项 | flow=true + warn=true（流转 + 警告） |
| **red** | 收窄方向冲突/回退 | blocked=true（不流转，停等修正） |
| **unknown** | 产出不可判定 | askHG=true（触发 HG 停等，boss 介入） |

> signal 字段直接写入 `edge.condition.signal`——venture-persona 产 signal → 数据驱动 advance-node 判定。signal 路径与 awaiting_human 路径正交（见 [architecture-overview.md](architecture-overview.md) §五）。

---

## 三、收敛判据（字段级比对 · 可证伪）

**收敛 = 两轮 signal 的关键字段级一致**（非 markdown 文本比对）：

```
收敛条件（全部满足才判定 converged）:
  ① signal 枚举值相同              （green === green）
  ② segment 受控词表值相同          （SMB_retail === SMB_retail）
  ③ delta_from_prev < 收敛阈值      （迭代差 < DELTA_THRESHOLD）
```

### 收敛阈值

```
DELTA_THRESHOLD = 0.1
```

`delta_from_prev < 0.1` 视为 persona 已稳定（confidence/segment 变化小于阈值）。阈值是**显式数值常量**，测试可断言，非"适当/合理"模糊表述。

### force_converge 边界（驳 off-by-one · 显式声明）

```
MAX_ITER = 3
收敛触发: iter >= MAX_ITER   （第 3 轮强制收敛，不存在第 4 轮）
```

- 第 1、2 轮：若满足收敛条件③字段级一致 → 提前收敛（信号驱动）
- 第 3 轮：无论是否字段级一致，`iter >= MAX_ITER` → **强制收敛**（以第 3 轮 signal 为准）
- 与 advance-node A 方案完全一致：`handleLoopBack` 中 `newIter >= max_iter` → `converged=true` → 收敛后取 N7→N8 出口推进

> off-by-one 修正：max_iter=3 = **最多 3 轮**。不存在"第 4 轮强制"——那是 β 的措辞 bug。引擎实测（R5.2 推进轨迹）：N7→N6(loop_back iter=1) → N6→N7 → N7→N6(iter=2) → N6→N7 → N7→N6(iter=3=converged) → 取 N7→N8 出口。

---

## 四、与引擎衔接（loop_back 声明）

[dag.placeholder.json](../dag.placeholder.json) 的 loop_back 声明：

```json
{
  "from": "N7",
  "to": "N6",
  "max_iter": 3,
  "converge_field": "signal"
}
```

- `converge_field: "signal"` → 收敛比对 **signal 字段**（结构化枚举，非自由文本）
- `max_iter: 3` → 与本文档 MAX_ITER 一致
- 收敛后 A 方案：advance-node 取 N7 首条非 loop_back 出口（N7→N8）推进 → persona 阶段闭合，进入规模化 N8

---

## 五、可证伪验证

[persona-signal.test.js](../scripts/persona-signal.test.js) mock N6/N7 两轮 signal 输出，验证：

1. `MAX_ITER=3` 后收敛（iter >= MAX_ITER 强制收敛）
2. 收敛判据 = signal 字段级比对（delta < DELTA_THRESHOLD）
3. 四态枚举值合法（green/yellow/red/unknown，拒绝 free text）

> 全部断言可零依赖运行（纯 Node，无 markdown 解析依赖）——这正是驳 B-β-5 的核心：收敛判据脱离自由文本，回归可证伪。
