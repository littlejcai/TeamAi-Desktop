# M1 下一阶段执行计划

版本：v2，2026-10-14。状态：MVP 工程实现已完成，平台验收进行中。

用户随后授权继续完成 MVP，因此范围已扩展到初始化、同步和贡献；当前实现及验收入口为 [MVP 验证记录](./MVP_VALIDATION.md)。下文只读首轮内容保留为原先的实施顺序依据，不能作为当前能力限制。

新增任务：M1-104 #9、M1-201 #10、M1-202 #11、M1-203 #12、M1-301 #13、M1-302 #14、M1-305 #15。用户走查 #7 仍需真实参与者，不由自动测试替代。
当前基线：M0 收尾 [PR #1](https://github.com/littlejcai/TeamAi-Desktop/pull/1) 已合并 main，提交 `682a13b`；core 锁定 `7c6357a`。
任务状态以 GitHub Issues 为准；旧 PROJECT_PLAN 的日期不再作为承诺。

## 本轮交付目标

交付一个可在 Windows 上安装和演示的只读桌面版本：选择上下文 → 识别初始化状态 → 浏览真实资源、查看详情和当前状态。未初始化、坏配置、资源缺失有明确反馈。

这轮首先服务已通过 CLI 初始化的用户；非终端用户的完整初始化向导进入下一轮。首版不执行 pull/push、配置迁移、hooks/MCP 注入或远端写入。若 core 的读取会隐式迁移，先通过 M1-100 制定无副作用读取或明确拒绝旧配置的方案。

沿用 Electron、React/TypeScript/Vite 和 fork git 依赖；不重新选桌面框架、不同步上游、不建设后端。本轮不要求为了规划提前引入 Turborepo、共享 UI 库或自动更新组件；新增依赖由实施任务说明必要性。

## 已核实的接口约束

静态依据来自当前 core 的 `src/desktop-api.ts`、`src/json-status.ts`、`src/json-output.ts`、`src/config.ts`、`src/push.ts`。这是接口复核，尚非完整 GUI 集成验收。

| 能力 | 当前可复用项 | 首版需处理的约束 |
|---|---|---|
| 资源列表 | buildListPayload(type, options) | 返回 Record<string, unknown>；主进程需归一化 DTO。local/source/agent 仅对 skills 生效 |
| 当前状态 | buildStatusPayload(options) | 依赖当前上下文；扫描错误与 repo.error 需明确映射，不全部包装成成功 |
| 上下文/初始化判断 | autoDetectInit() | 自动选择 cwd/project 或 user；配置读取可能迁移写文件。不能在主进程全局 chdir 切上下文 |
| 多项目状态 | buildStatusAllPayload() | partition/anchor 异常状态已有区分；首次只读切片不必一次覆盖所有管理操作 |
| MCP 信息 | buildListPayload('mcp', ...) | 首版可用已有元数据；mcpList 另走全局 JSON 模式/stdout，不直接充当 IPC 返回值 |
| 同步预览 | pull + dry-run 输出层 | 全局 dryRunPlan/jsonMode；先核实写入、网络和并发行为，留给 M1-104 |
| 初始化/贡献 | 现有 CLI 操作 | desktop-api 未导出 init/push，push 有终端选择和进程退出行为；需要单独方案 |

首版 main/preload/renderer 使用有限能力接口；renderer 不导入 core。core 上下文隔离的具体 Worker/utilityProcess 等实现，由 M1-100 验证后写 ADR，不先凭猜测定实现。

## 任务与执行顺序

| 顺序 | 任务 | 依赖与产出 | 初始估算 |
|---|---|---|---|
| 1 | [M1-100 / #2](https://github.com/littlejcai/TeamAi-Desktop/issues/2)：接口与副作用边界 | DTO/API 对照、错误分类、隔离方案、fixture、最小 fork 缺口 | 1–2 人日 |
| 1 | [M1-106 / #3](https://github.com/littlejcai/TeamAi-Desktop/issues/3)：Windows 分类与门槛 | 107 个失败分类、首版阻断项、Windows smoke 方案；可与接口复核同时进行 | 1–2 人日 |
| 2 | [M1-101 / #4](https://github.com/littlejcai/TeamAi-Desktop/issues/4)：应用骨架与 IPC | 依赖 #2；真实只读闭环，恢复真实类型检查/构建/测试入口 | 2–3 人日 |
| 3 | [M1-103 / #5](https://github.com/littlejcai/TeamAi-Desktop/issues/5)：资源库与状态页 | 依赖 #4；搜索/筛选/受控详情/状态、空态和错误态 | 2–3 人日 |
| 3 | [M1-102 / #6](https://github.com/littlejcai/TeamAi-Desktop/issues/6)：打包与分发决策 | 依赖 #3/#4；最终业务 smoke 依赖 #5；CI 安装包 artifact | 1–2 人日 |
| 4 | [M1-105 / #7](https://github.com/littlejcai/TeamAi-Desktop/issues/7)：走查与验收 | 依赖 #5/#6；承接 M0-6，用户记录与修复清单 | 0.5–1 人日 |

总基础工作量约 **7.5–13 工程人日**，不含接口新增实现、Windows 缺陷修复、用户排期等待、签名采购或正式发布。属于任务估算，不代表某个开发人数下已确认的交付日期。#2/#3 完成后重估，再按实际开发和验收人力排日历；不复用旧“2 开发 + 1 设计”的未确认前提。

实际下一步先执行 #2，随后推进 #3；这两个任务没有彼此依赖。有多名开发者时可并行，但不因此假定已有人员到位。任务尚未指派，不将计划制定写成开工或完成。

## 验收与停点

1. **接口停点（#2/#3）**：明确上下文、副作用、错误和首版 Windows 阻断项；产出可执行 fixture。缺少无副作用读取能力时，先处理最小接口缺口再完成首版闭环。
2. **应用停点（#4/#5）**：真实数据，明确未初始化/坏配置/空态，IPC 校验，主渲染进程边界成立；必要类型检查和契约/集成测试通过；读操作的文件差异验证成立。
3. **交付停点（#6）**：Windows 安装态能启动/读取/关闭/卸载，WASM 路径正常；有固定 commit/core pin 的 artifact。不以 Linux 通过代替 Windows 桌面验收。
4. **需求停点（#7）**：3–5 位目标用户、至少 1 位非终端用户完成资源定位、来源理解、详情和状态任务；有任务结果、问题优先级和是否进入下一轮的结论。

Windows 全量 core 单测仍按既有策略跟踪，107 失败不是新允许基线。桌面针对性 smoke 为首版交付门槛；影响首版的失败必须修复或明确缩减受支持能力，不以跳过测试完成验收。

## Windows 与验证基线

[收尾 CI](https://github.com/littlejcai/TeamAi-Desktop/actions/runs/38409810254)：Ubuntu Node 20/22 每个矩阵 235 文件、3286 测试全通过；主仓库 library/WASM smoke 通过。Windows 类型检查通过，3179 测试通过、107 失败，具体见[观测清单](./verification/windows-20261013.json)。

旧 Windows 本地结果的 Node/commit/运行环境不同，不能作“无新增失败”的依据。#3 分类的是当前清单，不重定义原回归标准。M1-101 才恢复自有包的真实 typecheck/build/test，并加入桌面 smoke；当前 verify:core 不代替 UI 或安装态验收。

## 下一轮顺序（本轮验收后细化）

- **M1-104 同步中心**：核实 dry-run 的副作用、预览与实际执行契约、取消/并发/失败恢复，再提供 pull。
- **M1-201 初始化向导**：仓库/角色/工具选择，配置写入与失败恢复；为非终端用户完成首次初始化。
- **M1-202 贡献流程**：变更确认、命名空间、PR/MR 与恢复；先解决终端交互和进程退出等 library 缺口。
- **M1-203、301、302、303、305**：托盘、设置、诊断、反馈与完整 E2E 按实际流程成熟度接入。
- **自动更新与正式灰度**：待发布范围、签名/渠道和灰度人选明确后排期；本轮安装包 artifact 不视为正式发布。

以上保留原任务号；未确定实施范围的后续项暂不批量创建可开工任务。知识/洞察 M2 与 Web 门户 M3 继续保留为后续方向。

## 需要在相应任务开始前补齐的输入

- #7：3–5 名走查参与者与可使用的已初始化团队上下文；真实私有内容不入测试 fixture。
- #6 的正式分发决策：内部试用/公开分发、签名路线、更新渠道；不阻止本轮 CI artifact 与内部 smoke。
- 日历排期：可投入的开发和验收人力、优先交付平台。当前继续按原 Windows 优先推进验证方案，macOS 后续单列。

这些输入由对应任务跟踪，接口复核和 Windows 分类可先开始。
