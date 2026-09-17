# teamai-cli 依赖与开发策略（docs/CORE.md）

TeamAI Desktop 的核心逻辑来自 [Tencent/teamai-cli](https://github.com/Tencent/teamai-cli)（MIT，版权归上游），以 **fork + git 依赖** 方式引入。

| 项 | 值 |
|---|---|
| fork（开发仓库） | https://github.com/littlejcai/teamai-cli |
| 上游 | https://github.com/Tencent/teamai-cli |
| 上游基线版本 | 0.22.0（commit `c674ffe`，2026-09-16） |
| 当前锁定 commit | `0ce5af152746ce7183c4645a96b8e8ce18d1f398`（fork `desktop-json` 分支，2026-09-17；含 JSON 输出层） |
| 引入方式 | 根 package.json `dependencies.teamai-cli = github:littlejcai/teamai-cli#<commit>` |
| 本地开发克隆（主仓库之外） | `D:\Project\teamai-cli` |

## 为什么是 fork + git 依赖

一句话：第一方安全门禁对主项目做**文件系统级全量扫描**（与 git diff 无关），上游源码只要在盘上就会触发不可修复的高危拦截——vendor、submodule、官方密封扫描报告均已实测无效。

完整决策过程、备选方案与否决理由见 [ADR-0001](./decisions/0001-core-fork-git-dependency.md)；门禁提交姿势见 [AGENTS.md](../AGENTS.md) §4。

## fork 分支策略

| 分支 | 用途 | 同步规则 |
|---|---|---|
| `main` | 上游 + 少量基础设施提交（prepare 构建脚本、pnpm-lock 忽略） | `git pull --rebase upstream main`（基础设施提交冲突面≈0） |
| `desktop-json`（已创建，M0-2 已上线） | `--json` 输出层开发分支 | 定期 rebase 到 main；主仓库依赖指纹指向此分支的 commit |

**JSON 输出层规则**：只新增文件 + 命令注册处最小接线；改动处用 `// [teamai-desktop]` 注释标记；不改内核逻辑；成熟即向上游提 PR，被合并后从分支删除对应补丁。

## 日常操作

```bash
# 主仓库安装（git 依赖会执行 fork 的 prepare 自动构建 dist）
pnpm install

# core 自身开发/测试（在主仓库之外的开发克隆里）
cd D:\Project\teamai-cli
pnpm install
npx vitest run            # 或 pnpm test

# JSON 层联调（主仓库临时指向本地 fork 克隆）
cd D:\Project\TeamAi-Desktop
pnpm link D:\Project\teamai-cli
# 恢复 git 依赖：pnpm install --force

# 升级 core：fork 内提交推送 → 主仓库更新 package.json 依赖指纹 → pnpm install
# 或：bash scripts/sync-upstream.sh（同步上游并提示指纹更新）
```

## 测试基线

- 上游 CI 仅在 **ubuntu / macOS（Node 20/22）** 跑单测，Windows 不在上游支持矩阵；本仓库 CI 的 core-test job 以 **ubuntu 全绿为门禁**，windows 仅跟踪不阻断（锁定同一 commit）。
- **Windows 本地基线**（win32 / Node 24 / 2026-09-17 / commit c674ffe）：3273 测试，3186 通过 / 87 失败（233 文件中 32 个失败）；typecheck、tsup build 通过。
- 失败归类：① 测试超时为主（Windows 临时目录 git 操作慢）；② `EPERM symlink`（符号链接权限）；③ `EBUSY/ENOTEMPTY` 临时目录清理（文件锁）；④ 连锁 AssertionError。
- **判定规则**：Windows 本地测试只做回归对比，失败集不得超出上述基线；基线外新失败 = 本地改动引入，必须修复。
