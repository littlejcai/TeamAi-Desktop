# M0 收尾记录

任务：CHORE-20261013-001。复核日期：2026-10-13。
范围：整理已有实现和证据、修正依赖验证与文档、交接下一阶段；不新增 M1 功能，不升级 core，不同步上游。

## 当前基线

- 主干原始基线：`7f551df421575b8db19f61c58b9476896ba416fd`，2026-09-17。
- core 应用实际依赖：`a6cfdc67190cdf3f6e7b241d4e927aa8679b2db9`，应用 manifest 与 pnpm lockfile 一致。
- 桌面包版本：0.0.0。仅有 `src/main.cjs` 自检应用，显示 JSON 报告；没有 React renderer、preload、IPC 契约或业务页面。
- 复核时 GitHub 只有 main 分支，未查询到 Issues/PR，没有 Release。不能据此推断本地是否另有未推送开发。

## 已有证据与边界

| 项目 | 已确认的证据 | 限制/承接 |
|---|---|---|
| M0-1 建仓 | pnpm workspace、应用依赖与 lockfile、CI 配置已有实现 | 原始 CI core pin 滞后，本次改为从应用 manifest 解析 |
| M0-2 JSON 层 | fork 已有 JSON 输出补丁及测试，desktop-api entry 已存在 | 全量测试须针对实际 pin；原 CI 使用 6e23f6b，不能证明 a6cfdc6 全绿 |
| M0-3 Electron/WASM | 9 月 17 日 Spike 记录了 dev 与 asar 自检通过 | 本次 Node smoke 不代替 Electron/asar 复验 |
| M0-4 dashboard | 有复用清单与历史采集验证记录 | 尚未实现业务页面 |
| M0-5 分发 | 历史记录：86.6MB NSIS、安装/卸载/安装态自检 | 未签名；无 Release；自动更新仅有 publish 配置，运行时 updater 尚未接入 |
| M0-6 原型/走查 | 无独立用户走查验收材料；原计划将其延期 | 改回未完成，由 M1 首个可用界面承接 |
| M0-7 上游回馈 | 本次没有验证上游 PR 已提交或合并 | 作为待跟踪项；不阻止本地 M1 范围评估 |

## 本次收尾改动

1. CI 的 core-ref 从应用依赖解析 commit，同时校验 lockfile；Ubuntu Node 20/22、Windows 跟踪使用同一 pin。
2. 新增 `pnpm verify:core`：安装依赖的 library 导出与 TS/Python WASM smoke。主仓库 CI 执行它，替换只检查文件存在和空跑 typecheck；移除根目录无对应任务的 test/build/typecheck 占位入口。
3. 固定 pnpm 10.12.4；保留已有锁文件与 core pin。
4. 修正 README、CORE、协作说明与同步脚本中的旧依赖路径/指纹；修正原型完成状态与日期排期含义。
5. 建立本记录和 M1 评估入口。历史 Spike 文档不重写为当前验收结果。

## 验证记录

- 本地 Linux / Node 24.19.0 / pnpm 10.12.4：`ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile` 通过；lockfile 无改动。
- `pnpm verify:core` 通过：实际 a6cfdc6 library 关键导出与 TS/Python WASM 解析。
- CI YAML 解析、core-ref job 依赖关系、Node/Bash 语法、文档本地链接、`git diff --check` 通过。
- 实际 pin 的 core 类型检查与全量单测正在复核；收尾 PR 保持 draft，结果补齐后再评估是否可合入。
- 未执行：Electron 窗口/asar、Windows 安装卸载、签名与自动更新端到端、用户走查、UI E2E。初次普通安装因 Electron 下载直连 ECONNREFUSED 失败；改用已有 CI 的跳过二进制下载方式完成 Node/core 验证，不视为桌面启动通过。

## 下一阶段必须显式承接的事项

- Windows 失败没有可机器比较的固定失败清单；目前仅非阻断跟踪，M1 需评估是否建立 Windows 桌面 smoke 门禁。
- 用户走查、上游 PR、签名路线、发布范围、自动更新实测均保留为开放事项，有完成证据后才关闭。
- M0 技术验证可作为 M1 评估输入；不等于 M0 所有任务完成、MVP 验收或发布就绪。
