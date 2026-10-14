# MVP 0.5.0 验证与交付记录

日期：2026-10-14。状态：实现与本地验证完成，Windows/CI 安装包验收进行中。不是 10 人灰度已完成的声明。

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
- 初次 packaged-layout 读取测试通过；最终包与写流程将在 CI 再验证。

集成测试使用生成的本地 TLS CA，保持证书校验；没有生产仓库、平台账号写入、HOME 覆盖或假 core。Generic Git 的 PR 创建失败被断言为失败，远端确有推送分支，不能虚报自动创建 PR 通过。

- Windows fixture 明确提供合成 Git 身份与 Schannel CA 配置，不依赖 runner 的全局身份，不关闭 TLS 校验。
- GUI 工具的 core 生成 wrapper 仅在拥有固定生成标记并指向本包 entry 时修复为 Electron Node runtime；自定义 wrapper 不改写。便携版 CodeBuddy 自动 hooks 暂不支持，使用安装版。
- core 预检可能迁移旧 hooks，已增加独立的预检写入确认；正式部署仍需第二次确认。

## 平台与发布限制

Windows 完整 core 原有失败仍独立跟踪，见 WINDOWS_TRIAGE；桌面 job 为新增硬门槛。Windows NSIS/portable 与 Linux tar.gz 由 CI 构建 artifact，绑定 commit/core pin。

待补齐：最终 CI 链接、Windows desktop 与 packaged-layout 结果、实际产物位置。未执行的人工项：目标用户走查、灰度成功率/崩溃率/性能基线、签名与自动更新端到端。
