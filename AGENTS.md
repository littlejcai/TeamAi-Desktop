# AGENTS.md — AI 协作规则

本文件是所有 AI 编码代理（ZCode / Claude Code / Codex 等）在本仓库工作的**主规则**，其他客户端只加薄入口指向本文件（见 [CLAUDE.md](./CLAUDE.md)）。章节结构借鉴 [littlejcai/ai-project-starter](https://github.com/littlejcai/ai-project-starter)。

- 项目定位与里程碑：[PROJECT_PLAN.md](./PROJECT_PLAN.md)
- core（teamai-cli）依赖与开发策略：[docs/CORE.md](./docs/CORE.md)
- 架构决策记录：[docs/decisions/](./docs/decisions/)

## 1. 项目与工作边界

- 本项目是 teamai-cli 的桌面客户端（Electron）。任务编号以 PROJECT_PLAN.md 为准（`M<里程碑>-<序号>`，如 M1-101）；计划外工作用 `CHORE-<YYYYMMDD>-<序号>`。
- 核心逻辑来自 git 依赖 `teamai-cli`（锁定 fork commit）。**主仓库工作树内禁止出现上游源码**；对 core 的一切改动只能在 fork 开发克隆（约定 `D:\Project\teamai-cli`，主仓库之外）内进行。
- fork 内改动边界：只新增 JSON 输出层文件 + 命令注册处最小接线；改动处用 `// [teamai-desktop]` 注释标记边界；不改内核逻辑；成熟即向上游提 PR，被合并后删除本地补丁。
- 开始工作前先核对对应任务的验收标准与现有实现；保留用户已有的未提交变更。
- 沿用已确认的需求与授权，不扩大范围；遇重大歧义先完成可推进的部分，再明确列出待决事项。
- 重要架构/依赖取舍必须写入 `docs/decisions/`（ADR，一条一文件）。
- 冲突处理：核实依据后行动，**不为通过检查而修改预期或跳过检查**。

## 2. 按需读取

- 上游文档（usage-guide 等）按需从 GitHub 获取，不在本仓库重复维护上游内容。
- 定位到具体文件/章节再读，不整仓浏览、不递归展开链接。
- 简单局部修改无需新建任务记录或完整计划；跨里程碑工作先明确范围与验收。
- 文档路由：依赖与门禁策略 → docs/CORE.md；里程碑/任务/风险 → PROJECT_PLAN.md；历史决策 → docs/decisions/；UI 组件约定（M1 起）→ packages/ui。

## 3. 常用检查

- 安装：`pnpm install`（git 依赖经 prepare 自动构建 dist）；依赖完整性 = `node_modules/teamai-cli/dist/index.js` 存在。
- 自有包：`pnpm test` / `pnpm typecheck` / `pnpm build`（均递归）。
- core 自身测试：在 fork 克隆内 `npx vitest run`。
- **Windows 基线判定**：本地跑 core 测试只做回归对比——失败集不得超出 docs/CORE.md 记录的基线（2026-09-17：87 失败/3273，超时、symlink EPERM、文件锁）；基线外新失败 = 改动引入，必须修复。
- 门禁以 CI 为准：core-test ubuntu（Node 20/22）全绿是合并门槛；windows job 仅基线跟踪。
- 密钥、token、生产数据不入库（`.env*` 已 gitignore）。

## 4. 完成与交接

- **提交姿势（本项目特有，必须遵守）**：分两步——先 `git add .`（或显式路径），再单独执行**命令文本中不含任何源码/配置文件路径**的 `git commit -m "..."`，最后 `git push`。若仍被门禁拦截，按 docs/CORE.md 的门禁行为记录排查；**不得绕过、弱化或禁用安全工具**。
- 提交信息用 conventional commits（feat / fix / docs / chore + 作用域）。
- 交付条件：对应验收标准满足 + 必需检查通过 + 受影响文档同步（PROJECT_PLAN 任务状态回写）。
- 交接说明必须引用**实际执行过的验证与结果**；未执行的检查要明示；不得将"安装成功/构建通过"虚报为"测试通过/功能验收/发布就绪"。
- 上游同步：`bash scripts/sync-upstream.sh`，常态双周一次，上游安全更新时立即。
