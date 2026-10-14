# Windows 基线与 MVP 门槛

2026-10-14；M1-106。输入为 windows-20261013.json 的 107 个失败（32 个文件），不能作为获准的回归基线。以下为按测试职责与静态代码进行的初步分类，不能冒充每个失败都已复现/修复。

| 类别 | 主要测试文件 | MVP 影响与验证 |
|---|---|---|
| Unix 进程/运行时与 shell 假设 | pid-monitor、plugin-command、env-handler、api-key、gitlab-clone-realspawn | doctor/环境诊断仍可能报告平台限制；真实 Windows desktop job 不采用这些假设 |
| anchor、scope 与路径表示 | anchors、detect-subdir、scope、self-worktree-rebind、types、p3-functionize、codebase-reconcile、roles-cmd | 影响 project 选择与配置发现；新增只读入口不用写入式 partition helper，Windows fixture 验证实际读取 |
| hooks 与后台 agent/模型配置 | hooks、hooks-wrapper、hooks-cmd、hooks-reconcile-scope、local-agent、local-agent-model-config | core 自动 hooks/后台行为不能由“窗口能启动”推断。MVP 支持手动 GUI 同步，自动 hooks 仍需 CLI/工具环境与 doctor 确认 |
| Git 报告、初始化、贡献与资源落盘 | git-kind-reports、init、init-scope-default、migrate、push-skill-flag、mcp-reconcile、source、pending-learnings | 属于实际写流程风险；阻断 Windows 桌面交付的是实际 HTTPS Git fixture 的 init→pull→push 与明确部分失败报告，不跳过断言 |
| 文件清理、索引和维护 | transcript-parser、search-index-multi、maintenance-paths、maintenance-promote、usage-tracking | 保留全量失败观测，维护/索引操作不纳入首版独立 UI；基础读取与写入 fixture 验证不会引入新损坏 |

所有测试名及所属分类见 windows-triage-20261014.json。它保留原失败条目，不删除或跳过原测试。

## 首版硬门槛

- Ubuntu Node 20/22 core 全量通过；Windows 全量继续独立、非阻断跟踪，不宣称无回归。
- Windows desktop job 必须通过 IPC/文件边界/确认过期测试及真实本地 HTTPS Git 写流程。
- Electron dev 与 packaged-layout UI 测试必须真实加载 core：资源、详情、配置损坏恢复、未初始化、向导、确认后 pull、PR 失败恢复。
- 不启用仅为通过测试而放宽路径、证书校验或输入确认的例外。
- 任一 desktop job 失败，不关闭平台交付任务；记录失败后修复，再跑受影响验证。
