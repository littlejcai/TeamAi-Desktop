# ADR-0002：桌面 core 隔离与读取边界

日期：2026-10-14。状态：已实施，平台验证见 MVP 验证记录。

## 依据

当前 core 的 autoDetectInit/loadLocalConfig 可能迁移配置，getRepoStatus 会 fetch；JSON 模式是进程全局状态，init/push 可能直接退出进程。把这些接口直接放进 Electron 主进程会造成隐式写入、上下文串用或应用退出。

## 决策

- fork 只新增 desktop-read 结构化输出层及 library re-export，不重写 init/pull/push/doctor 内核。
- 读取按已存在的 anchor/config 查找，使用 schema 校验；不调用迁移、partition 创建/重命名或 fetch。Git 状态禁止 optional index locks。
- 每个请求 fork 一个新进程并直接 import library entry；user 操作使用临时、无 project 配置的 cwd，project 操作使用用户选择的目录。不在主进程 chdir。
- 主进程校验有限 IPC 能力，并将资源路径映射为不透明 ID；详情 realpath 必须在仓库/所选目录或受支持工具目录内。渲染进程无 Node 权限。
- preview 会沿用 core dry-run 的克隆更新、锁和缓存行为，不承诺文件系统零写入；执行前需要新的确认 token 与文件/配置清单指纹。
- push 检查确认时的变更清单、正文和配置；有新文件或内容变化时拒绝旧确认。环境变量变更不在 MVP 贡献能力中，检测到时阻止全量 push。
- 非零退出视为部分失败，保留日志，不将“分支推送成功但 PR 创建失败”解释为贡献成功。写入不是事务，失败后用户先诊断/检查仓库，不自动重试或回滚。

## 代价与限制

每次请求有进程启动成本。10 分钟超时后终止等待，实际写入可能已部分完成。MVP 使用 core 支持的 Git/托管平台凭据；GitHub 的初始化/PR 功能依赖 gh 登录。自动 IDE hooks 沿用 core 的 teamai CLI 环境约定，桌面按钮操作直接使用内置 library。

## 打包

pnpm workspace symlink 不能直接交给 electron-builder。先 pnpm deploy --prod --legacy 到独立临时目录，再打包；显式采用当前已安装 Electron 版本，WASM unpack，安装布局必须重复实际 Electron IPC 测试。

## GUI hook 运行时适配

core 生成的 GUI wrapper 的 argv[0] 在桌面 worker 中是 Electron，且 CLI entry 可能在 asar 内。客户端只修复带 core 生成标记、指向本包 entry 的 wrapper，为它设置 ELECTRON_RUN_AS_NODE，并生成 Windows cmd 桥接；不修改自定义 wrapper 或 core 内核。CLI 版本启动在实际 Electron/安装布局测试中验证。便携版 CodeBuddy 自动 hooks 不在本次支持范围。
