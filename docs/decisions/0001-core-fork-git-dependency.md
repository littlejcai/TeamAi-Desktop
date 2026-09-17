# ADR-0001：teamai-cli 以 fork + git 依赖方式集成

- 状态：已接受
- 日期：2026-09-17
- 关联：[docs/CORE.md](../CORE.md)、PROJECT_PLAN.md §4.2、commit 4d8ae1a

## 背景

项目核心逻辑来自上游 Tencent/teamai-cli（MIT，v0.22.0 基线 commit c674ffe）。第一方安全门禁（Mimosa git gate）对主项目做**文件系统级全量扫描**（与 git diff 无关），上游代码自带的模式——测试 fixture 假密钥、字符串拼接 spawn——触发 163+ 高危硬拦截。这些 finding 不可"修复"（改上游内核 = 无法维护的分叉），门禁无项目级豁免配置，环境变量方案需重启 ZCode 且会放弃第一方代码的扫描覆盖。

## 决策

1. fork 上游到 [littlejcai/teamai-cli](https://github.com/littlejcai/teamai-cli)，加 `prepare` 构建脚本（使 git 依赖安装时自动产出 dist）；
2. 主仓库以 git 依赖锁定 commit 引用：`dependencies.teamai-cli = github:littlejcai/teamai-cli#<commit>`，并在 `pnpm.onlyBuiltDependencies` 放行其构建脚本；
3. **上游源码不进入主仓库工作树**；JSON 输出层在 fork 的 `desktop-json` 分支开发（待 M0-2 创建），成熟后向上游提 PR；
4. core 自身测试由 CI 在锁定的 fork commit 上执行（ubuntu 门禁 + windows 基线跟踪）。

## 备选方案与否决理由

| 方案 | 结果 |
|---|---|
| vendor 源码进 `packages/core` | ❌ L3 扫描硬拦（2026-09-17 实测 163 高危） |
| git submodule（`packages/core` → fork） | ❌ 同样拦截——扫描不看 diff，盘上有文件即扫 |
| 官方 `security_scan` 密封报告 | ❌ 报告已生成（151 findings，seal 存档）但门禁不解锁 |
| 为项目关闭 git 门禁（环境变量 / 禁用 hook） | ❌ 需重启 ZCode 且放弃自有代码的门禁覆盖，未采纳 |
| `pnpm link` 常态化引用本地克隆 | ❌ 不作为依赖方式；仅保留为联调手段（见 CORE.md） |
| core 移出主仓库 + npm 包发布 | ❌ 需要 fork 走完整发布流程，迭代链路更长；git 依赖已满足 |

## 后果

**正面**：门禁只覆盖自有代码；fork 仓库内提交不受门禁影响（已实测）；JSON 层回馈上游路径最短；依赖升级 = 显式 commit 指纹变更，天然进入 diff 评审。

**代价**：JSON 层改动需 fork 提交后更新主仓库依赖指纹才能以依赖方式生效（联调期用 `pnpm link D:\Project\teamai-cli`，恢复用 `pnpm install --force`）；CI 需要独立 job 在锁定 commit 上跑 core 测试；贡献者需额外克隆 fork 仓库。

**修订条件**：上游合并 JSON 输出层 PR 后，可将依赖指纹切回上游仓库；门禁若提供项目级路径豁免配置，重新评估 vendor 方案。
