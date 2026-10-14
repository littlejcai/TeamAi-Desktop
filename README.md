# TeamAI Desktop

基于 Tencent/teamai-cli 的桌面客户端，MVP 版本 0.5.1。

## 下载

0.5.1 产品体验打磨的交付证据与截图见 [落实记录](docs/PRODUCT_REVIEW_FOLLOWUP.md)。

[Windows 安装版/便携版](https://github.com/littlejcai/TeamAi-Desktop/actions/runs/38532390248/artifacts/11878289514) · [Linux 压缩包](https://github.com/littlejcai/TeamAi-Desktop/actions/runs/38532390248/artifacts/11877764867)。需登录 GitHub，artifact 保留至 2026-10-28；Windows 优先使用 Setup。当前为未配置正式签名的内部试用包。[当前验证证据](docs/PRODUCT_REVIEW_FOLLOWUP.md)。

## 能力

资源搜索/筛选与 Markdown 详情、当前状态、同步预检与确认执行、仓库/角色/工具初始化向导、本地变更对比与贡献确认、诊断、日志导出、范围/目录/Git 身份/代理设置、系统托盘。

core 以锁定 fork commit 的 git 依赖引入，动作在隔离进程中直接 import library；架构与限制见 [ADR-0002](docs/decisions/0002-desktop-core-isolation.md)。

## 使用条件

Git 需在 PATH 中，仓库认证使用现有 Git/托管平台凭据。提交身份可在设置填写，仅作用于客户端 Git 操作。GitHub 的 core 集成需要 gh 已登录；自动 IDE hooks 沿用 teamai CLI 环境，需要可用的 teamai CLI 与相应工具运行时。桌面按钮的读取、初始化、同步和贡献使用内置 core，不通过 shell 调用 CLI。

便携版暂不支持 CodeBuddy 自动 hooks，优先使用 Windows 安装版。

普通 Git 主机没有统一 PR API：分支推送后可能需要在仓库手动创建 PR，客户端会如实显示部分失败。MVP 不在界面展示/提交环境变量变更，不含自动更新、签名证书、知识洞察或 Web 门户。人类用户走查和 10 人灰度指标尚需团队执行，不能以自动测试代替。

## 开发与验证

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @teamai-desktop/desktop start
pnpm test:e2e
pnpm package:win
pnpm package:linux
```

开发需要 Node >= 20、pnpm 10.12.4。Linux Electron E2E 需要显示服务（CI 使用 xvfb-run）；Windows 测试使用真实桌面 runner。打包先 deploy 到独立目录，产物位于 apps/desktop/release。

## 文档

- [MVP 验证与交付记录](docs/MVP_VALIDATION.md)
- [当前执行计划](docs/M1_EXECUTION_PLAN.md)
- [完整项目范围](PROJECT_PLAN.md)
- [core 开发策略](docs/CORE.md)
- [Windows 问题分类](docs/verification/WINDOWS_TRIAGE.md)

代码遵循 MIT；teamai-cli 的上游版权与许可证保留在依赖中。
