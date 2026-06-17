---
run: 2026-06-17-hcc-org-departmentalization
artifact: decision
created: 2026-06-17
status: decided
decided_by: 编排者（主对话，基于 40-synthesis 综合裁决 + 攻击证据核验）
---

# 50-decision.md —— Phase 3 裁决记录

> 本裁决基于完整 cc-2pp 模式 C 流程：Phase 0 探索（00-explore）→ Phase 2 判官 3 方案（10-plan-α/β/γ）→ 评分（30-score）→ 对 Top 2 对抗（20-attack-A/B/C）→ 综合（40-synthesis）→ **本裁决**。
> **核心结果：裁决反转。** 30-score 评分 β(119) > α(110)，但 3 攻击者跨视角一致推翻（α > β），β 有 2 个互锁 CRITICAL 经证据核验无解。

---

## 一、裁决：α' 胜出

**采纳方案 = α' = 基座 α + 嫁接 β 优点 + 修复 α MAJOR + 修复共同缺陷。**

α' 不是单纯的 α，是综合裁决后的融合方案（详见 40-synthesis §五）。物理结构：

```
.claude/skills/
├── hcc-org/                         # 组织层·协议宪法（charter L69 物理指定）
│   ├── SKILL.md                     # 协作总则5条 + RACI总表(5部门×节点) + 冲突仲裁§2必读 + 交接协议 + §4纯RACI引用
│   ├── references/                  # 深度参考（按需加载）
│   └── scripts/
│       └── hcc-org-consistency.test.js  # [修复 A-4/B-3] 一致性测试（纯 Node，grep 5部门引用锚点）
├── hcc-decision/                    # 决策部·trigger:hcc-decision
├── hcc-product/                     # 产品部·trigger:hcc-product
├── hcc-dev/                         # 开发部·trigger:hcc-dev
├── hcc-ops/                         # 运维部·trigger:hcc-ops
└── hcc-sales/                       # 销售部·trigger:hcc-sales
```

---

## 二、裁决支柱（反转的两个 CRITICAL，经证据核验）

| 攻击 | 论断 | 核验证据 | 结论 |
|------|------|---------|------|
| **A-1** | Skill 框架不自动解析 SKILL.md 跨技能目录引用；@import 仅 CLAUDE.md 机制，SKILL.md references 是 agent 主动按需 Read（prompt 脆弱，非架构保证） | cc-config/references/config-systems-guide.md L67 `检查 import — @path/to/file 拆分大段参考` + L69-71 `### import 语法`（**CLAUDE.md 诊断清单语境**） | ✅ A-1 有效，β"协议下沉层1"假设不成立 |
| **B-1** | "skill 配置成本=0"是伪命题；hcc-protocol.md 无脚本感知（对照 state-schema §7.3 有 init-state.js + 70-requirements 闭环） | cc-runtime/references/state-schema.md L4 `status: frozen-v1` + L299-301 §7.3 变更门"minor：init-state.js 补默认值 + 重跑 70-requirements" | ✅ B-1 有效，β 类比错位，"成本=0"是营销话术 |

**互锁致命**：补机制（Hook/脚本）→ 摧毁 B-1"成本=0"卖点；不补 → A-1"协议被读"不可证伪。β 被锁死在两条 CRITICAL 之间，无解。

---

## 三、否决方案及原因

### β — 否决（机制级致命，不可救）

- **A-1 × B-1 互锁 CRITICAL 无解**（见上节，已核验）
- **C-2 CRITICAL**：β §10.2 用"新人理解"作致命弱点论证，本身违反 Claude 度量铁律——连"自证弱点"都用违规度量写
- **A-2 MAJOR**：把 charter L69/L75 物理指定的 `hcc-org/`（反引号+ASCII 树）重新诠释为"概念层"——判官小组越权重写已定稿宪法
- **A-3 MAJOR**：组织治理协议塞进运行时地基 cc-runtime，错置抽象层，污染 state-schema frozen-v1 变更门语义

> β 的设计美学（DRY + 成本=0 + 5独立字面）有吸引力，但建立在两个未验证的机制假设上。对抗验证戳破了这两个假设，β as-is 不可存活。

### γ — 否决（成本最高，未进 Top 2）

- 30-score 88 分最低（成本 187k token + DRY 最差 + 动 init-state.js）
- α' 已吸收 γ 的有价值思想：运维部 `canonical_source` 由 state-schema owns（γ 的核心诉求在 α' 内以更轻方式满足）

---

## 四、评分反转说明（对抗验证的价值）

| 维度 | 30-score 评分 | 40-synthesis 综合后 |
|------|-------------|-------------------|
| β | **119/126**（可行14/成本14/价值13/可编排13/ROI14 — 多项满分） | **否决**（A-1×B-1 互锁 CRITICAL） |
| α | 110/126（可行12/成本11/价值12 — 成本/可行性偏低） | **胜出 → α'** |
| γ | 88/126（成本7/ROI8 — 最低） | 否决（成本最高） |

**为何反转可信**：
1. 30-score 高估 β"成本=0"（实际 B-1 伪命题）+ 高估"协议下沉层1"可行性（实际 A-1 未验证）
2. 30-score 低估 β 的 charter 偏离（C-5 运维部职责扩张破坏 P2 信息源单一）
3. 3 攻击者跨视角（架构/实现测试/ROI可编排）**独立一致**判 α > β，非单一视角偏好
4. β 的致命伤有**具体技术证据**（A-1 @import 行为 + B-1 state-schema §7.3），非主观

> **教训**：评分阶段的"可行性/可证伪"维度必须深挖机制级假设，不能停留在文档表面承诺。"成本=0""按需加载"这类卖点要先问"运行时如何强制"，而非采信方案自述。

---

## 五、层边界声明（解决 A-7/C-7 层3 空壳风险）

```
D10（本层）交付边界:
  ✅ 交付: 协议层骨架
     · hcc-org/（组织宪法 + RACI 总表 + 交接协议 + 一致性测试）
     · 5 部门 SKILL.md（职责 + plan/review 流程 + trigger + §交接引用总则）
     · pipeline-state 扩展 protocol_version_read 字段（层2 schema minor 变更）
  ❌ 不交付: 业务 skill 装配
     · placeholder → 真实 skill（venture-judge/venture-persona 等）= 层3 cc-venture 职责
     · "节点路由→部门加载"完整链路验证 = 层3

层衔接契约:
  · 本层 5 部门 SKILL.md 的 §业务能力 段标注 [层3 待装配]，列该部门需哪些 venture-* skill
  · 层3 cc-venture 装配业务 skill 时，验证部门 SKILL.md 的 protocol_version_read 闭环
```

---

## 六、6 目录论证（解决 A-6，回应"偏离 BOSS #19 五独立"）

**BOSS #19 决策**："5 个独立部门技能目录"。

**α' 6 目录 = 5 独立部门 + 1 协议容器，符合 BOSS 决策**：

- BOSS 的"5 独立部门"指 **5 个业务部门**（决策/产品/开发/运维/销售），各自独立 SKILL.md + 独立 trigger——α' 完全满足
- `hcc-org/` **不是第6个部门**，是 5 部门共同站立的组织宪法容器（charter L69 物理指定，反引号+ASCII 树）
- 类比：公司有 5 个业务部门 + 1 份公司章程。章程不是第6部门，是 5 部门的协作地基。hcc-org/ = 公司章程

**为何 hcc-org/ 必须独立成目录（而非塞进某部门或 cc-runtime）**：
- 塞进某部门 → 破坏部门平权（谁是"宿主部门"？）
- 塞进 cc-runtime → 错置抽象层（A-3：地基不该背组织治理）
- 独立 hcc-org/ → charter L69 物理指定成立 + DRY（5 部门引用单一总则）+ 可一致性测试守护（hcc-org-consistency.test.js）

---

## 七、认知锚定修正声明（解决 C-2，编排者自纠）

C-2 有效攻击命中编排者自身：
- **30-score.md L74**（我写的）："用户理解部门时需跨目录读协议"——"用户理解"是**团队学习成本隐喻词**，违反 Claude 度量铁律
- β §10.2 L638："新人理解需跨层关联"——同类违规

**修正**：
1. 该措辞应改为 Claude 度量："部门激活时需额外 Read 跨目录协议文件，+N token/激活"
2. **所有最终文档（50/60/70）强制清除**"新人/团队/用户理解/学习成本/理解负担"隐喻词
3. 统一度量：token / 上下文轮次 / skill 配置成本 / 验证复杂度 / 依赖风险

> 这个攻击印证 cc-2pp 假设2——LLM 实施者有"认知锚定失败"系统性缺陷，连编排者都会无意识用"新人/用户"隐喻。对抗验证跨实例揪出了单实例的盲点。

---

## 八、α' 综合方案最终形态（摘要，详见 40-synthesis §五）

### 8.1 嫁接 β 的优点到 α

| β 优点 | 嫁接位置 | 收益 |
|--------|---------|------|
| β §2.2 RACI 横切总表强制可读 | hcc-org/SKILL.md §2 必读层 + 部门 §交接段强制引用 | 闭合"部门可能不读 RACI" |
| β "5 部门 trigger 独立清晰" | 5 部门各自 trigger（hcc-{dept}） | 弱化 A-6（hcc-org 是协议路由器） |
| β §9.3 度量对比方法论 | α' §九按 Claude 度量对比 α/β/γ | 透明化选 α 的 ROI 理由 |

### 8.2 修复 α 的 MAJOR（裁决必须落地）

- **[A-4/B-3] 总则单点** → 新增 `hcc-org/scripts/hcc-org-consistency.test.js`（纯 Node fs+path，C2 合规）—— grep 5 部门 SKILL.md 引用总则 RACI 锚点 + 总则自检。**可证伪**：`node hcc-org-consistency.test.js` 跑绿
- **[A-5/B-4] state 重叠** → 重构 α §4 为**纯 RACI 引用**（state 字段读写规则**完全由 cc-runtime/state-schema.md owns**，α 只列"哪个部门对哪个字段负 R/A/C/I"，不复制读写规则）。消除双源真理
- **[C-3] 回归测串行** → 60 worktree 分配：hcc-org/ 总则先于 5 部门（串行 1 步），5 部门并行（≤2 槽位排队），改总则触发一致性测试回归

### 8.3 修复共同缺陷（裁决必须包含，喂给 60/70）

| 缺陷 | 修复 | 验证闸（可证伪） |
|------|------|----------------|
| [B-2/C-4] 验证闸"协议被读了"不可证伪 | 补 `protocol_version_read` 字段到 pipeline-state | 激活部门后断言 `pipeline-state.protocol_version_read === hcc-org.protocol_version` |
| [A-7/C-7] 层3 空壳 | §五层边界声明（本层交付协议层骨架） | 5 部门 §业务能力 段标 [层3 待装配] |
| [B-7] max_iteration 无明确写者 | 明确由层2 `advance-node.js` owns iteration 计数（已有 handleLoopBack iter 累加），部门 SKILL.md 只读不写 | advance-node.test.js 断言 iter 累加 |
| [B-6] 断点续传未测部门中间态 | 60/70 加测试：compact 前后部门工作中间态从 trace/tasks.tree 恢复 | venture-resume.test.js 扩展（层2 已有断点续传测试，复用框架） |
| [A-8] RACI 冲突仲裁无基准 | 冲突仲裁规则上提到 hcc-org/SKILL.md §2 必读层 | 一致性测试覆盖冲突仲裁段存在性 |

---

## 九、工作量预估（α' · Claude 实施者度量）

| 维度 | α' 预估 | 说明 |
|------|---------|------|
| token | ~70-80k | α 基座 70k + β 嫁接 5k + 缺陷修复测试 5k |
| 文件 | 14-16 个 | α 14 + consistency.test + protocol_version 字段扩展 |
| 上下文轮次 | 20-28 轮 | 含 4 项缺陷修复测试 + 一致性回归 |
| skill 配置成本 | 新增 6 skill 目录 | hcc-org + 5 部门；纯新增不动层1/层2 脚本逻辑（仅 pipeline-state 加 1 字段，需回归 37+29 测试） |
| 验证复杂度 | 5 个可证伪闸 | consistency.test / protocol_version 断言 / max_iteration / 断点续传 / RACI 仲裁 |

---

## 十、Phase 4 衔接（60/70 必含项）

### 60-impl-plan.md（编排契约）
- 模块拆分（α' 物理结构 + 4 项缺陷修复测试，工作量按 Claude 度量）
- 智能体配置：hcc-org 总则串行先于 5 部门并行
- 执行模式：hcc-org/ 一致性测试→/goal；5 部门 SKILL.md→/loop 多步
- worktree 分配：hcc-org 先串行；5 部门 ≤2 槽位并行排队
- 验证闸（每项可证伪）：consistency.test.js / protocol_version_read 断言 / 断点续传中间态恢复 / max_iteration 写者验证
- 技术选型确认：protocol_version_read 字段 vs H7 hook（二选一，本裁决倾向字段——与层2 schema 一致，零新钩子符合方案 C 基线层）

### 70-requirements.md（保姆级需求）
- R{M}.{n} 每项：做什么/输入触发/输出交付/可证伪验证（命令+期望）/依赖/预估（会话·token）
- 保姆级：禁"实现 X 功能"模糊；验证可证伪（node xxx.test.js 跑绿）
- 清除所有人天隐喻词（C-2 修正约束）

---

> **50-decision 完。** 裁决 α' 胜出（裁决反转：β 119→否决，α 110→胜出，两个 CRITICAL 经证据核验）。β 因 A-1×B-1 互锁 CRITICAL 否决，γ 成本最高否决。α' = α 基座 + β 嫁接（RACI 强制可读/5 trigger 独立）+ α MAJOR 修复（一致性测试/state §4 纯引用）+ 共同缺陷修复（protocol_version_read/层3 边界/max_iteration 写者/断点续传测试）。下一步 Phase 4 写 60-impl-plan.md + 70-requirements.md。
