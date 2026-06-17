---
run: 2026-06-16-venture-automation-architecture
phase: 2
artifact: attack
target: A
target_title: 层1 cc-runtime 融合设计（方案2 Hook 主导 + 方案1 schema 嫁接）
attacker: critic (opus, 对抗思维)
mode: ADVERSARIAl
created: 2026-06-16
verdict: REVISE（2 个致命点必须回炉）
---

# 对抗攻击 A：层1 cc-runtime 融合设计

> 攻击者证据：官方 hooks-guide（block cap）、GitHub Issue #34600（UI 误显示）、HN 实测（偶发无视）、auto-compact-design.md §9（范式真实覆盖面 + 网关失效真实形态）。

## 提交前预测 vs 实际

| 预测 | 实际 |
|------|------|
| Stop exit 2 阻塞不是真确定性 | ✅ 命中（致命1），官方 block cap + HN + GitHub 三重反证 |
| "复用已验证范式"有夸大 | ✅ 命中（致命2），范式只跑通 PreCompact/SessionStart，6/8 Hook 无背书 |
| 双 state 让 subagent 读错家 | 部分命中（严重3），ralph 写 `.omc/ralph/`，三套 state 并存 |
| PreToolUse matcher 漏配 MCP | ✅ 命中（严重2） |
| 身份张力解法成立 | 未命中——此解法是这层最稳的部分 |

---

## CRITICAL（致命，阻塞 Phase3）

### C1：Stop hook exit 2 不是确定性闸——block cap + UI 误显示 + 偶发无视三重退化，痛点3 兜底打穿

**攻击假设**：方案2 §3.1 H4 + §7.2 + synthesis §2.2 都把 `Stop hook exit 2` 当「痛点3 兜底闸 / defense in depth / human gate 阻塞」的确定性兜底。

**三重退化**：
1. **block cap**（最致命）：官方 hooks-guide——连续阻塞超 cap 次，Claude **带 warning 直接结束本轮**（不再继续工作）。human gate 场景尤其致命：用户没来确认，H4 每轮 exit 2，撞 cap 后 Claude 自动结束本轮放弃等待 → gate 形同虚设。
2. **UI 误显示致用户禁用**：GitHub Issue #34600——intentional exit-2 显示成 "Stop hook error" 而非 stderr 反馈。用户看到红字报错 → 嫌烦设 `OMC_SKIP_HOOKS=Stop`。**这正是方案2 §7.2 自己担心的路径，且缓解无效**（UI 根本不显示设计的提示）。
3. **偶发无视**：HN 报告 Claude 4.7 偶发无视 stop hooks，社区实测，非理论风险。

**致命性**：致命。Stop 是方案2 自己的「痛点3 defense in depth 兜底闸」+「human gate 阻塞机制」（D2 唯一人工节点）。三条任一成立都让 synthesis §2.2「方案2 痛点4 解法更彻底」的判决失去兜底支撑。

**缓解**：
- **放弃「Stop 是确定性兜底闸」定位**，降级为「尽力而为提示闸」。痛点3 兜底改到 **PreCompact（H5，exit 0 永远放行，无 block cap）**：checkpoint 记 `stagnation_count`，SessionStart 注入提示。
- **human gate 不靠 Stop exit 2 阻塞**。改用显式 awaiting 状态文件 + SessionStart 注入「等待用户 continue」，agent 自然停在等输入。
- H4 stagnation 阈值改为「1 轮提示但不阻塞，连续 N 轮才在 PreCompact checkpoint 标 BLOCKED」，避免撞 cap。

### C2：「复用 compact-snapshot 已验证范式」是跨事件迁移，6/8 Hook 无范式背书

**攻击假设**：方案2 §3.1 设计原则 + §7.1 强点3 反复声称「所有 Hook 复用 compact-snapshot 范式...实施者有已跑通的参考样板，大幅降低实现风险」。synthesis §2.2 列为方案2 胜出维度。

**事实**：
1. **范式只验证 2 个事件**：auto-compact-design.md §7/§9——compact-snapshot-write.js（仅 PreCompact）+ restore.js（仅 SessionStart）。方案2 的 8 Hook 里 **H1 PreToolUse / H2-H3 PostToolUse / H4 Stop / H7 SubagentStop / H8 UserPromptSubmit 这 6 个从未在该范式跑过**。stdin 结构各不相同（PreCompact 给 transcript_path，PreToolUse 给 tool_input.file_path，UserPromptSubmit 给 prompt），把「读 transcript 提取」套到「读 tool_input 拦截」是结构错配。
2. **脚本本仓库不存在**：Glob `**/compact-snapshot*` 零命中（装在 `~/.claude/hooks/` 全局）。方案2 引用的行号 L10/L34/L47/L107-113 **在本仓库不可核验**，实施者只能凭描述重写。
3. **网关失效真实形态与缓解错配**：auto-compact-design.md §1.1——BigModel 网关下 worker 子进程 `Not logged in` exit 1（启动即死）。方案2 §7.2 担心的「hook 不触发」缓解是「Stop 兜底」——但 Stop 也是 hook，同样跑在会死的子进程里，**兜不住自己**。

**致命性**：致命。方案2「低实现风险」叙事根基动摇。若 6 Hook 需从零设计+调试，§6.1「16 轮」成本估算失效，接近方案1 改源码成本——synthesis §2.2「范式复用 / 侵入性低」两维度同时打折。

**缓解**：
- 范式定位收窄为「PreCompact(H5)+SessionStart(H6) 样板」，明确 H1/H2/H3/H4/H7/H8 需独立设计+独立验证。
- 成本重估：2 复用（各1轮）+ 6 新建（各3-4轮含调试）≈ 26 轮。
- plan 附 `~/.claude/hooks/compact-snapshot-write.js` 关键片段（exit0守卫/stdin读取/session_id防护）。
- 约束 H1-H8 全部禁用 SDK 子进程调用（纯 Node fs，compact-snapshot 范式本身成立，但 plan 没说）。

---

## MAJOR（严重，需缓解）

### M1：纯推理节点（judge）progressHash 误判无进展，护栏二误触发
judge 节点中间 N 轮纯推理不写文件 → trace 空 → H4 误判漂移。叠加 C1 的 block cap，judge 中途被反复阻塞直至撞 cap。
**严重非致命**：mitigated by venture-judge 步骤卡可落盘 + 影响限单节点。
**缓解**：progressHash 基于 `(node, iter, step_index)` 三元组而非文件 hash；trace 增 `reasoning_step` 类型，venture-judge 内部主动 `trace.append`。

### M2：PreToolUse matcher `Read|Glob|Grep` 漏配 MCP 文件读取工具
`mcp__filesystem__read_file` 等不被命中；matcher `.*` 会拖慢所有工具（每次 50-200ms Node 启动）。且 **Bash 路径绕过**（agent 用 `Bash: grep -r .2pp/` 读旧文件，H3 PostToolUse(Bash) 只写 trace 不拦截）→ 痛点4 经 Bash 漏拦（gap G5）。
**严重非致命**：mitigated by 原生 Read 覆盖主路径 + H1「宁可漏拦不可误杀」。
**缓解**：matcher 加已知 MCP 文件工具名；Bash 旧文件读取单独处理（或 SessionStart 注入方向提示补）。

### M3：三套 state（.venture/ + .omc/state/ + .omc/ralph/）并存，subagent 读错家
ralph subagent 写 `.omc/ralph/progress.txt`，venture H7 要从 `.omc/ralph/` 读回收 → 依赖 H7 正确识别 ralph trace 位置。ralph 升级改路径则 H7 静默 exit 0，trace 丢失。
**严重非致命**：主会话走 skill 引导读死路径，风险集中 subagent。
**缓解**：venture 委派 subagent 时用环境变量 `VENTURE_TRACE_FILE` 指定 trace 落点，subagent 直接写 venture trace，省跨目录回收。

### M4：Windows 原子 rename 在 SessionStart 读 direction 正逢 human gate 写时竞态
NTFS rename 原子针对「写完成」可见性，不解决「目标文件被占用」的 ERROR_SHARING_VIOLATION。human gate 写 direction 时 SessionStart 正读 → rename 失败 → direction 切换静默失败 → 痛点4 重现。
**严重非致命**：mitigated by 单 session 约束 + rename 失败可重试。
**缓解**：direction 写用符号链接指向 `direction-v2.md`（切换只改链接）；或 SessionStart 读时 `FILE_SHARE_READ` 共享读。

---

## MINOR

- **m1**：PreCompact 不支持 additionalContext（官方），H5 只写不注入——正确，仅提示。
- **m2（嫁接接缝）**：方案1/2 用 `.venture/products/{node}/`，方案3 用 `.venture/run-{ver}/`——**路径前缀不一致**，synthesis §2.3「嫁接零成本」需补统一路径前缀。
- **m3**：H8 关键词「换方向/重做」误命中正常对话（如「我们是不是该换个思路」）。改为只在 human gate 窗口内触发。
- **m4**：§6.1 token 估算「8×3000=24k」偏低，生产级 Hook 脚本实测 5000-8000 token/Hook。

---

## What's Missing

- **G1 block cap 阈值未实测**：当前版本具体几次？C1 核心未知数，应作 Phase3 前置实验。
- **G2 无 Hook 失效降级路径**：静默 exit 0 = Hook 失效无痛感，痛点3 静默重现。缺「连续 N 次异常告警」机制。
- **G3 身份张力缺装配协议**：synthesis §5 预案说「技能教配方+原生循环跑」，但没定义「技能何时加载、配方怎么落到 settings.json、落地后技能是否卸载」。
- **G4 subagent 方向注入缺失**：subagent 独立上下文看不到 venture trace，怎么知道自己在哪个 node/direction？
- **G5 Bash 读旧文件绕过 PreToolUse**：痛点4 经 Bash 路径漏拦（见 M2）。

---

## 多视角笔记

- **Executor 视角**：C2 是最大障碍——plan 反复说「复用范式」但脚本不在仓库、行号不可核验，「低实现风险」是空话；C1 不知道 block cap 几次，盲调 H4。
- **Stakeholder 视角**：synthesis §2.2 判「方案2 痛点4 更彻底」是核心 ROI，但 C1（Stop 退化）+ G5（Bash 绕过）合起来，痛点4 的「机制级拦截」并不比方案1「agent 读指针」彻底多少。
- **Skeptic 视角**：方案2 全部优势建立在「Hook 是确定性闸」。C1 证 Stop 不是（block cap），C2 证 6/8 Hook 无范式验证，M2 证 PreToolUse 漏配 MCP。「Hook 确定性」从高降到中，与方案1 的「agent 读指针」（中）差距缩小，synthesis §2.2 判决需重新权衡。

---

## 整体裁决建议

**REVISE，非 REJECT**。方向正确（痛点4 用拦截、痛点3 用 Hook 强制写、schema 嫁接合理），synthesis §2.3「状态层趋同嫁接零成本」成立（方案3 state 立场确与方案1/2 趋同，仅 m2 路径前缀需统一）。但 **2 个致命点必须回炉**：

1. **C1（Stop 退化）**：Stop exit 2 因三重退化不能当确定性闸。必须改：痛点3 兜底迁 PreCompact，human gate 改 awaiting 文件。
2. **C2（范式跨事件迁移）**：必须改：收窄范式定位，重估成本，附真实脚本片段。

**升级到 ACCEPT 的条件**：C1 改 PreCompact 兜底 + human gate 改 awaiting 文件；C2 收窄范式 + 重估成本 + 附脚本。两项改完可进 Phase3。M1-M4 可在 Phase3 附缓解条件，不阻塞。

---

## 编排者裁决影响（judge 收尾注释）

C1 + C2 直接动摇 synthesis §2.2 判决矩阵的两根支柱（「defense in depth」= C1 击穿；「已验证范式复用」= C2 击穿）。但**未推翻「方案2 Hook 主导 + 方案1 schema 嫁接」的整体方向**——痛点4 的 PreToolUse 机制级拦截（M2/G5 的漏拦是边界，不是否定）仍是方案2 相对方案1 的实质优势。回炉是「修订设计细节」而非「推翻层1 架构」。

→ 进 Phase3 裁决时，层1 判决保留「Hook 主导」，但须附 C1/C2 的修订条款作为 ACCEPT 前置条件。
