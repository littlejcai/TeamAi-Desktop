# Spike①：Electron 主进程直接 import core（M0-3）

- 日期：2026-09-17
- 结论：**✅ 通过**（dev 与 asar 打包双验证，零备选方案需要启用）
- 执行记录：commit 4d5f306 / d2c3f36 / a6cfdc6（fork desktop-json），apps/desktop 自检应用

## 验证目标

Electron 主进程能否以库方式使用 teamai-cli：导入不触发 CLI、WASM tree-sitter 正常加载，并在 asar 打包后保持可用。

## 发现与实现

### 发现 1：CLI 入口不可直接 import

`src/index.ts` 在模块顶层调用 `program.parse()`——`import('teamai-cli/dist/index.js')` 会直接执行 CLI（错误参数下甚至挂起交互菜单）。

**处置**：fork 新增第二 tsup 入口 `src/desktop-api.ts` → `dist/desktop-api.js`（ESM + .d.ts，无 shebang）。纯加性 re-export：payload 构建器、json 层、核心操作（pull/status/list/members/mcp/hooks）、AST parser（`ensureAstReady`/`getParser`/`getLanguage`/`getQuery`/`grammarForExtension`）。上游 PR（M0-7）可原样提交。

### 发现 2：WASM 定位机制 asar 兼容

`parser-registry.ts` 用 `createRequire(import.meta.url).resolve('web-tree-sitter/tree-sitter.wasm')` 与 `Language.load(require.resolve('tree-sitter-wasms/out/*.wasm'))` 定位 WASM——解析发生在依赖安装后的 node_modules 内。Electron 对 asar 内的 `require.resolve` 与 `fs` 读取有补丁支持，**实测成立**（未做任何 unpack 配置）。

### 发现 3：上游约定的 parser 用法

`initAst()` 不给 parser 实例设置语言；调用方必须 `parser.setLanguage(getLanguage(variant))`（见 `wiki-engine/code-knowledge/ast/walk.ts`）。已在 desktop-api 导出面中补 `getLanguage`/`getQuery`。

## 自检结果（apps/desktop/src/main.cjs，`--selftest` 输出 JSON、退出码 0/1）

| 检查 | dev 模式 | asar 打包后（win-unpacked，app.asar 67MB） |
|---|---|---|
| import desktop-api（21 exports） | ✅ | ✅ |
| WASM 加载 + TS/Python 真实解析 | ✅ | ✅ |
| 未初始化时 payload 构建器干净拒绝 | ✅ | ✅ |

环境：Electron 33.4.11（内嵌 Node 20.18.3）/ win32。

## 对后续里程碑的影响

- **M1-101** 可直接开工：主进程 `import('teamai-cli/dist/desktop-api.js')`，TS 类型来自 `dist/desktop-api.d.ts`；
- `desktop-api.ts` 是 GUI 的唯一导入面——新增 GUI 需要的 core 能力时在此文件追加 re-export；
- 错误处理约定：未初始化等业务拒绝以异常抛出（已实测），GUI 侧统一捕获后渲染引导页；
- 备选方案（主进程 shell 调用 CLI 单文件）**无需启用**。
