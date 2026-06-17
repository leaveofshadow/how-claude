---
run: 2026-06-16-venture-automation-architecture
phase: 2
artifact: attack
target: B
target_title: 层3 cc-venture 业务流水线（方案3）
attacker: critic (opus, 对抗思维)
mode: ADVERSARIAI（发现系统性证据偏差后升级）
created: 2026-06-16
verdict: REVISE（C1 必须先回炉，否则 Phase4 撞墙）
---

# 对抗攻击 B：层3 cc-venture 业务流水线

> 攻击者证据：实地读取 `C:\Users\newuser\.claude\skills\venture-judge\` 下 judgment-card.md / SKILL.md / gold-cases.jsonl / source-map.jsonl，以及 cc-orchestration 全文。

## 提交前预测 vs 实际

| 预测 | 实际 |
|------|------|
| judge 案例库偏差是最大靶 | ✅ 命中，且更严重（gold 仅 30 条且 100% 一人公司向） |
| jsonld 契约是新发明、上游没这字段 | ✅ **致命命中**——judgment-card.md 零 jsonld/signal/go_score |
| Loop Planner 互锁无收敛保证 | ✅ 命中（cc-orch 零收敛/互锁机制） |
| "150+案例"是营销话术 | ✅ 命中（gold 30，normalized 仅 1 文件） |
| 三轴 merge 是方案3 新发明、上游不支持 | ✅ 命中（模板只有创始人轴加权表） |

**比预测更糟**：方案3 反复引用 venture-judge "L91-98/L160-164/L106-126" 作能力背书，但这些是 SKILL.md 内容，**不含方案3 声称的 jsonld_header/signal/go_score 字段**。方案3 在用真实文件伪造能力背书。

---

## CRITICAL（致命，阻断执行）

### C1：judgment-card.jsonld_header 是方案3 凭空捏造的契约，上游 venture-judge 根本不产出该字段

**攻击假设**：方案3 §2.2/§2.4/§6.1 反复称评判卡 `jsonld_header: {signal, go_score, stop_loss_line}` 是「venture-judge references/judgment-card.md 已定义」的契约，N5 据此 `if judgment.signal == green` 路由。

**事实**：
- 实读 `venture-judge/references/judgment-card.md` —— **零命中 jsonld / signal / go_score / direction_version**。
- 评判卡模板是纯 markdown emoji 文本：`信号灯：🟢 可以做 / 🟡 谨慎 / 🔴 别做`。信号灯由 venture-judge 工作流阶段四人工判定 if/else 生成（SKILL.md L160-164：`付费路径清晰 + 案例支撑 + 无致命Red Flags → 🟢`），**不是结构化字段**。
- 方案3 §2.4 的 N5 路由伪代码 `if judgment.signal == green` **物理上无法执行**——没有任何机器可读 signal 字段。N4→N5 边界层2 的「jsonld_header 校验闸」会立即触发断链（N4 产出无 jsonld_header）。
- 更糟：方案3 §6.1 把这列为「强点1（judge 评判卡作路由控制信号——精确机制）」，§6.2 假设1 又承认 judge 会误判。**方案3 把不存在的字段同时当核心资产和已知风险**——不是诚实，是没验证自己引用的上游。

**致命性**：致命。这是方案3「系统之魂」（标题原话「业务产物契约是系统之魂」）。魂本身是虚构的。N4→N5、N4→HG2、N4→层1（red 触发换方向）三条边全依赖这个不存在字段。**流水线在第一个有分支的节点 N4 就断**。

**可反证路径**：若 venture-judge v0.2+ 新增 jsonld 输出，或有「judgment-card → jsonld 提取器」中间件则失效。**已 grep 整个 venture-judge/references/ 与 cc-2pp/，零命中**。

**缓解三选一（都改变方案形态）**：
- **(A) 改 N4 产出契约**：新建 `venture-judge-extractor` skill 把 markdown 评判卡 parse 成 jsonld。代价：方案3 §5.3 skill 清单漏了它，工作量 +1，且 parse emoji 信号灯是脆弱正则。
- **(B) 改 venture-judge 上游**：给 venture-judge PR 加 jsonld_header 输出。代价：跨仓库、依赖第三方作者接受，不可控。
- **(C) 降级 N5 路由为人工读卡**：放弃「judge 即路由器」核心创新，N4 后强制 HG2 人工读全卡决策。代价：§6.1 强点2 蒸发，退化为方案1/2 普通节点。

**无论选哪个，方案3「judge 即路由器」卖点都要重写。**

---

## MAJOR（严重）

### M1：案例库 100% indie 偏向，对 B2B/硬科技方向产生假🟢，且 N4 judge 无对抗兜底
- `gold-cases.jsonl` 实测 **30 条**（方案3/00-explore/SKILL.md 都称「150+」——是 gold+normalized+raw 三层合计营销数字，gold 金标仅 30）。
- `source-map.jsonl` 前 6 来源：qiit（一人公司）、microsaas.zone、opcbase（一人公司）、indiehackers、solostory、singlefoundercompany。**100% indie/solo 向**。
- 后果：B2B 企业级/硬科技/资本密集型方向 → 案例匹配反复命中 indie → 七维评分「需求/问题 40%+商业模式 15%」因大量 indie 付费案例给**假🟢**。
- 方案3 §2.4 把「三轴都跑」当创新，但投资人轴要 Traction 数据，案例库根本没有 → 投资人轴被 indie 正向偏差拖高。
- **无对抗兜底**：grep cc-2pp 全目录零命中 judge/signal。cc-2pp 对抗只用在 N3 计划。**N4 judge 误判全流水线无第二意见**。venture-judge 三轴是同一 skill 的三个权重表，不是独立草案，不构成对抗。
**严重非致命**：mitigated by HG2 人工兜底——但用户为省事才用自动化，拿到🟢不会细读，HG2 形同虚设。
**缓解**：N4 前置「方向类型探测」，非 indie 方向强制输出⚠️「案例库覆盖不足」；给 judge 加真对抗（venture-judge + 红队 reviewer，分歧>阈值强制🟡）；文档改「30 金标 + ~120 参考，均偏 indie/solo」。

### M2：N6⇄N7 互锁无收敛保证——cc-orchestration Loop Planner 不提供死循环检测
- grep cc-orch `{SKILL.md, orchestration-guide.md}` 全文 —— **零命中 收敛/converg/MAX_ITER/互锁**。
- Loop Planner 原型是 OMC ralph（PRD 驱动 story-by-story）。ralph 收敛靠 **PRD 是固定外部输入**。N6⇄N7 没有 PRD，persona 和 requirements **互相生成**——两个自由变量耦合迭代，无外部不动点。
- 具体死循环：persona 推 requirements → 某 must_have 超界 → 回 N6 修 persona → 新 persona 产生新 JTBD → 新 must_have → 再超界……§4.4「画像优先」只解决单步冲突，不保证全局收敛。
- cc-loop 护栏三件套（MAX=10/无进展/预算）理论可兜底，但方案3 没把 Loop Planner 绑定护栏。预算 token_cap=200k 是全流水线，互锁若吃一半 N8 就没预算。
**严重非致命**：mitigated by 预算闸硬停（不会无限烧）+ cc-loop 护栏存在。
**缓解**：显式绑定 `MAX_ITER=3`（第 4 轮强制以当前 persona 为准）；互锁改单向 + 一次性回溯（N6 仅允许收窄 segment 不允许新增，单调收缩保证收敛）。

### M3：三轴 merge 仲裁规则与上游 venture-judge 信号灯定义冲突，产生无解态
- venture-judge SKILL.md L160-164 信号灯是**单一轴人工判定规则**，**不是三轴聚合函数**。方案3 把单轴规则套到三轴 merge 是张冠李戴。
- **无解态1（都🟡）**：方案3 规则未定义。三轴都🟡 = 三组不同 Red Flag 叠加，实际🔴级，但输出未定义/默认🟡。
- **无解态2（轴间矛盾）**：投资人轴🔴（Traction 不足「别融资」）+ 一人公司轴🟢（「能收钱」）→ merge 成🟡 丢失「这项目只能走 indie 不能融资」的关键路由。N5 拿🟡 走 yellow 分支回 N3 补验证——但问题在三轴方向冲突，回 N3 解决不了。
- **权重不可加**：创始人轴和=100%，投资人轴按融资阶段变（天使列和=135%，上游表格本身有错），一人公司轴和=100%。三套不同基数无法数学 merge。
**严重非致命**：mitigated by HG2 人工兜底能处理无解态，但丢失路由信息。
**缓解**：放弃自动 merge，三轴🟢/🟡/🔴 + 各轴 top-2 RedFlag 原样送 HG2 人工裁决；或穷举 27 种三轴组合→输出动作的新设计。

---

## MINOR

- **m1**：human gate CronCreate 7 天上限——但 CronCreate 默认 in-memory（durable:false），session 退出即失效。关 session 后 HG 提醒丢失，pipeline 永久 PAUSED。需 `durable:true`。
- **m2**：度量预算 ~103k 未计入 N6⇄N7 互锁迭代 + retry。互锁跑满 3 轮，N6+N7 实际 6-9 轮 token 翻倍，budget_cap=200k 后半段 N8 可能 PAUSED_BUDGET。
- **m3**：venture-pipeline 编排 skill 工作量 ~15k token / 2-3 会话被严重低估（autopilot PipelineConfig 是 TS，泛化成 yaml 契约 + DAG 调度 + Hook 接入是层2 核心工程，~15k 只是骨架）。

---

## What's Missing

1. **judgment-card → jsonld 提取器完全缺失**（见 C1）。N4→N5 物理断点。
2. **三轴并行 agent 实例化未定义**：§4.4 写 `N4: [venture-judge × 3轴]`，但 venture-judge 是单 skill，「×3 轴」靠 axis-switching（SKILL.md L31-33）不是 3 个独立 agent。parallel 需 3 次独立 skill 调用 + 不同 axis prompt 模板——方案3 没给。
3. **direction_version 初始值与跨 run 继承未定义**：新 run（新日期目录）version 从几开始？`.venture/` 全局还是 per-run？全局则多方向并行探索冲突。
4. **venture-persona/requirements 的「互锁收敛判定函数」未定义**：「需求不超画像边界」的数学定义？jtbd 集合 vs must_have 集合的包含关系？没有判定函数，Loop Planner `passes:true` 无从计算。
5. **HG1/HG2 pause 产物完整性自检缺失**：pause 时若 N3 plan.md 写了一半（PostToolUse 写 checkpoint 前），resume 消费残缺产物。需事务性写入。
6. **trace.jsonl 在 compact 后的恢复**：方案3 §3.1 只复制 pipeline-state.json，没复制 trace.jsonl → 「业务记忆回放」卖点失效。
7. **「失败跳过继续」（§4.4 RECOVERY）与产物契约矛盾**：N4 失败跳过 → N5 无 judgment-card → jsonld 校验拦 → 要么 DAG 真断，要么「跳过」=「空产物骗过校验」。方案3 没调和。

---

## 多视角笔记

- **Executor 视角**：我会卡在 N4。跑 /judge 拿 markdown 卡，找 signal 字段做 N5 路由——找不到。回去读方案3 §2.2 说有 jsonld_header，读 venture-judge 模板——没有。必须停下来问编排者。**方案3 不可执行 as-written**。
- **Stakeholder 视角**：非 indie 方向用户拿到🟢，信了，烧 N5-N8 token 出产品 spec，HG2 细看才发现案例全 microsaas。对自动化信任永久归零。
- **Skeptic 视角**：方案3 最强卖点「judge 即路由器」+「产物契约是系统之魂」**都建立在 venture-judge 产出 jsonld 这个未经验证前提上**。两者同时是最高风险点，且这个风险点 10 分钟 grep 可证伪——说明方案3 作者**没读 venture-judge 实际产出格式就写了 200 行契约**。研究纪律缺失。

---

## 整体裁决建议

**层3 cc-venture 不应直接进 Phase3 裁决。C1 必须先回炉。**

C1 不是「细节待补」，是「核心契约建立在虚构上游字段上」。Phase3 若基于现状，会在「judge 即路由器」这个虚假创新上做实施决策，Phase4 实施计划全盘错。**正确流程**：先回 Phase2 修订，三选一（加提取器/改上游/降级 N5），重新定义 N4 产物契约真实来源，再进 Phase3。

M1-M3 可在修订 C1 时一并处理（共同根因：方案3 高估 venture-judge 结构化程度）。修订后若能：(a) 给出 judgment-card→jsonld 真实机制，(b) 案例库偏差加显式降级，(c) N6⇄N7 绑定收敛护栏，(d) 放弃伪三轴 merge——则层3 架构思路（产物契约+DAG+human gate）本身成立，值得进 Phase3。

**不回炉代价**：Phase3 裁决者很可能没发现 C1（方案3 用真实行号 L160-164 伪造背书，看起来可信）→ ACCEPT → Phase4 撞墙 → 返工成本 = 重写层3 全契约 + 追溯修订 Phase3。

---

## 编排者裁决影响（judge 收尾注释）

B 的 C1 比 A 的两个致命点**更严重**——A 是工程确定性可修补（换兜底机制即可），B 是**架构核心契约虚构**（修订涉及三选一的形态决策）。C1 的三选一直接决定 cc-venture 是否保留「judge 即路由器」这个方案3 的灵魂卖点：

- 选 A（建 extractor）：保留「judge 即路由器」，但 +1 skill + emoji 解析脆弱性。
- 选 B（改上游）：保留卖点，但依赖第三方、不可控。
- 选 C（人工读卡）：**放弃卖点**，cc-venture 从「自动路由」退化为「人工路由」，与「7×24 自动化」愿景背离。

这是**改变方案形态的架构决策**，超出裁决者单方可定范围，须交用户（PM）拍板。→ 见正文 AskUserQuestion。

M1（案例库偏差）是独立的、可叠加的严重问题——即便 C1 选 A 建 extractor，extractor 解析出的 signal 仍是基于偏 indie 案例库的假🟢。所以 M1 与 C1 必须同步处理。
