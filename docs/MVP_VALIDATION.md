# MVP 0.5.0 验证与交付记录

当前主干版本已升级至 0.5.1，最新下载与验证见 [产品体验落实记录](PRODUCT_REVIEW_FOLLOWUP.md)。下文为 0.5.0 固定历史证据。

日期：2026-10-14。状态：工程 MVP 交付完成，Linux/Windows 桌面与 Windows 实际安装验收通过。不是 10 人灰度已完成的声明。

## 实现

- main/preload/React renderer、有限 IPC 与路径边界；fresh worker 直接 import core。
- 真实资源、搜索/类型/来源筛选、Markdown 详情与贡献正文差异。
- 不 fetch/不迁移的浏览；坏配置明确报错，未初始化为正常状态。
- HTTPS/SSH 仓库检查、角色/项目/AI 工具选择、写入确认后 init。
- 预检与 token/文件指纹绑定的 pull；新增文件或内容变化会使旧贡献确认失效。
- push 所有确认的本地变化；非零退出保留部分失败，不自动重试；环境变量变更阻止全量贡献。
- doctor、客户端 Git 提交身份、代理与详细日志、日志导出、上下文持久化、托盘显示/刷新/退出。
- 独立 deploy 打包，WASM unpack，dev 与 packaged-layout Electron 测试。

## 已执行的本地验证

Linux / Node 24 / Electron 33.4.11：

- fork 类型检查与构建通过；新增读取用实际文件比较验证无迁移/无缓存修改。
- fork 全量 236 个文件、3289 个测试全部通过（日志开关 re-export 后由 CI 重新验证）。
- 桌面类型检查/构建通过；11 个服务测试通过，包括本地受信 HTTPS Git 的真实 inspect→init→preview→pull→push。
- 2 个真实 Electron UI 测试通过：读取/详情/坏配置恢复/未初始化与完整向导/确认同步/贡献部分失败。
- 最终 Linux packaged-layout 的两个真实 UI 流程通过；Windows 安装态与写流程由下述 CI 验证。

集成测试使用生成的本地 TLS CA，保持证书校验；没有生产仓库、平台账号写入、HOME 覆盖或假 core。Generic Git 的 PR 创建失败被断言为失败，远端确有推送分支，不能虚报自动创建 PR 通过。

- Windows fixture 明确提供合成 Git 身份与 Schannel CA 配置，不依赖 runner 的全局身份，不关闭 TLS 校验。
- GUI 工具的 core 生成 wrapper 仅在拥有固定生成标记并指向本包 entry 时修复为 Electron Node runtime；自定义 wrapper 不改写。便携版 CodeBuddy 自动 hooks 暂不支持，使用安装版。
- core 预检可能迁移旧 hooks，已增加独立的预检写入确认；正式部署仍需第二次确认。

## 平台与发布限制

Windows 完整 core 原有失败仍独立跟踪，见 WINDOWS_TRIAGE；桌面 job 为新增硬门槛。Windows NSIS/portable 与 Linux tar.gz 由 CI 构建 artifact，绑定 commit/core pin。

## 固定版本 CI 与下载

[验证运行 38516279716](https://github.com/littlejcai/TeamAi-Desktop/actions/runs/38516279716)，应用代码 `fd6939842fc14afa6e75fe18a53ca17a19330e27`，core `ca44df36ff71e23cc8e6009549a24a5d8f342529`。后续交付提交仅更新文档，不修改该已验证代码。

| 检查 | 结果 |
|---|---|
| 锁定依赖、library/WASM | 通过 |
| Ubuntu Node 20/22 core | 两个矩阵均通过，236 文件 / 3289 测试 |
| Linux 与 Windows 桌面 | 类型检查、11 服务测试、构建均通过 |
| Linux 与 Windows Electron | 每个平台 dev 与 packaged-layout 各 2 个真实 UI 流程通过 |
| Windows NSIS 实际安装 | 安装后的 2 个 UI 流程通过，实际卸载通过 |
| Windows 全量 core 历史问题 | 仍失败，独立非阻断跟踪；未宣布已修复或无回归 |

- [Windows 下载 artifact](https://github.com/littlejcai/TeamAi-Desktop/actions/runs/38516279716/artifacts/11871674123)：内含 `TeamAI-Desktop-0.5.0-Setup-x64.exe`、`TeamAI-Desktop-0.5.0-Portable-x64.exe` 及报告。建议使用 Setup。
- [Linux 下载 artifact](https://github.com/littlejcai/TeamAi-Desktop/actions/runs/38516279716/artifacts/11872277827)：内含 `TeamAI-Desktop-0.5.0-linux-x64.tar.gz` 及报告。

下载需登录 GitHub；本次 artifact 到期日 2026-10-28，之后需要从主干重新构建。安装包未配置正式代码签名，此次为内部试用交付，不是公开发行或自动更新验收。

未执行的人工项：目标用户走查、灰度成功率/崩溃率/性能基线、签名与自动更新端到端。
