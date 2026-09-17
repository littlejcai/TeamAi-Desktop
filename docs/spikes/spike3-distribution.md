# Spike③：Windows 分发通道（M0-5）

- 日期：2026-09-17
- 结论：**✅ Electron + electron-builder + pnpm workspace 分发链路打通**（NSIS 静默安装/卸载/安装态自检全部实证）。Tauri 备选**无需启用**。两个环境坑已找到免提权解法（见下）。

## 验证环境

- electron-builder 25.1.8 / Electron 33.4.11 / Windows 10.0.26200（无管理员权限、未开开发者模式）
- 配置：`apps/desktop/package.json` 的 `build` 字段（appId、win nsis+portable x64、publish github provider）

## 验证结果

| 项 | 结果 |
|---|---|
| `--dir` 未打包目录（asar 开启） | ✅ app.asar 67MB，自检三项全过（含 WASM） |
| NSIS 安装器构建 | ✅ `TeamAI Desktop Setup 0.0.0.exe` = **86.6MB**，含 `latest` 更新所需 blockmap |
| 静默安装（`Setup.exe /S`，oneClick per-user → `%LOCALAPPDATA%\Programs`） | ✅ 安装目录含卸载器 |
| 安装态自检 | ✅ `asar: true` 三项全过、退出码 0 |
| 静默卸载（`Uninstall ...exe /S`） | ✅ 文件全部删除；注意 NSIS 卸载为**异步**（复制到 `%TEMP%\~nsu.tmp` 后台执行，约 1 分钟内完成），可能残留空目录壳，`rmdir` 即清 |
| 代码签名 | 未配置证书 → 构建器自动跳过签名（`no signing info identified, signing is skipped`） |

## 环境坑与解法（复现时照做）

1. **winCodeSign 缓存解压失败**（`Cannot create symbolic link: 客户端没有所需的特权`）：electron-builder 下载的 winCodeSign-2.6.0.7z 内含 darwin dylib 符号链接，7za 无特权创建失败导致构建中止。**免提权解法**：手动 `7za x` 到 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`（忽略 symlink 报错，darwin 文件与 Windows 构建无关），构建器检测到目录存在即跳过。替代：开启 Windows 开发者模式，或管理员运行一次预热缓存。
2. **`release/win-unpacked/resources/app.asar` 被锁**：新写入的 asar 被 Defender 短暂锁定（或残留进程），`EnsureEmptyDir` 清理失败。解法：换输出目录（`-c.directories.output=release2`）或稍后重试；已把 `apps/desktop/release*/` 加入 .gitignore。

## 自动更新（electron-updater）评估

- 已就绪：`publish: { provider: github, owner: littlejcai, repo: TeamAi-Desktop }` 配置有效；NSIS 产物自带 `.blockmap`（增量更新前提）。
- 未验证（需首个发布版本）：端到端 `latest.yml` 拉取 + 增量下载 + 换装。计划：M1-102 在主仓库发首个 **draft release**（v0.1.0-alpha），应用内 `electron-updater` 指向该 release 实测升级路径，随后转正式 channel。
- 未签名安装器的自动更新可用（electron-updater 不强制签名校验），但 SmartScreen 对首次安装会告警。

## 待确认事项（需人工拍板）

1. **签名证书路线**：企业内部代码签名证书 / Azure Trusted Signing（按月计费、免维护）/ 无签名+内网分发接受 SmartScreen——影响 M1-102 自动更新通道设计；
2. 分发范围：仅团队内网（现有方案已够）还是对外发布（必须签名 + 固定 channel）；
3. NSIS 安装目录名当前派生自 appId（`@teamai-desktopdesktop`），M1-102 改为友好名（`TeamAI Desktop`）。

## 结论

Electron 分发通道可行且已验证；包体 86.6MB 在团队内部场景可接受。若未来出现"包体必须 <20MB"的硬约束，再评估 Tauri + Node sidecar（core 依赖 Node 运行时，sidecar 方案已记录于 PROJECT_PLAN §4.2）。
