# TeamAI Desktop

[Tencent/teamai-cli](https://github.com/Tencent/teamai-cli) 的桌面客户端：把团队 AI 资源管理（skills / rules / MCP / 知识库）从终端升级为可视化操作。

## 仓库结构

```
apps/desktop        Electron 应用（主进程 / preload / renderer）
packages/ipc-contract  主/渲染进程 IPC 类型契约（M1）
packages/ui         共享 UI 组件（M1）
scripts             上游同步等脚本
```

核心逻辑 `teamai-cli` 以 **git 依赖**（锁定 fork commit）引入，源码不落本仓库；JSON 输出层在 fork 内开发。详见 [docs/CORE.md](./docs/CORE.md)。

## 开发

```bash
pnpm install     # 安装依赖（自动构建 teamai-cli 依赖）
pnpm test        # 运行所有包的测试
```

core 的开发与单测在 fork 开发克隆中进行（约定 `D:\Project\teamai-cli`，主仓库之外）。

## 文档

- [项目启动文档](./PROJECT_PLAN.md) — 里程碑、任务分解、风险登记
- [上游使用指南](https://github.com/Tencent/teamai-cli/blob/main/docs/usage-guide.md)

## License

本仓库代码 MIT；依赖的 teamai-cli 来自 [Tencent/teamai-cli](https://github.com/Tencent/teamai-cli) 的 fork（MIT），版权声明见 fork 仓库 LICENSE。
