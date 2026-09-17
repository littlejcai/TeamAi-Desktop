// TeamAI Desktop — Spike 自检应用（M0-3 / M0-5）。
// 验证两件事：
//   1. Electron 主进程可以 import teamai-cli 的 library entry（dist/desktop-api.js）
//   2. core 的 WASM tree-sitter 在 Electron（dev 与 asar 打包）下正常加载并解析
// 用法：
//   pnpm --filter @teamai-desktop/desktop selftest   # 无窗口，stdout 输出 JSON，退出码 0/1
//   pnpm --filter @teamai-desktop/desktop start     # 打开窗口展示自检报告
const { app, BrowserWindow } = require('electron');

const SELFTEST = process.argv.includes('--selftest');

async function runChecks() {
  const results = {
    startedAt: new Date().toISOString(),
    runtime: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      packaged: app.isPackaged,
      asar: app.isPackaged && __filename.includes('app.asar'),
    },
    checks: [],
  };
  const add = (name, status, detail) => results.checks.push({ name, status, detail });

  // 1) library 导入：teamai-cli/dist/desktop-api.js（不触发 CLI）
  let api;
  try {
    api = await import('teamai-cli/dist/desktop-api.js');
    add('import-desktop-api', 'pass', `exports=${Object.keys(api).length}`);
  } catch (e) {
    add('import-desktop-api', 'fail', String(e.message).slice(0, 200));
    results.allPassed = false;
    return results;
  }

  // 2) WASM tree-sitter：ensureAstReady 定位 .wasm（require.resolve）+ 真实解析
  //    （上游约定：调用方自行 parser.setLanguage，见 wiki-engine walk.ts）
  try {
    await api.ensureAstReady();
    const parser = api.getParser();
    parser.setLanguage(api.getLanguage('typescript'));
    const ts = parser.parse('export function add(a: number, b: number): number { return a + b; }');
    parser.setLanguage(api.getLanguage('python'));
    const py = parser.parse('def add(a, b):\n    return a + b\n');
    const ok = ts.rootNode.type === 'program' && !ts.rootNode.hasError && !py.rootNode.hasError;
    add(
      'wasm-tree-sitter',
      ok ? 'pass' : 'fail',
      `ts.root=${ts.rootNode.type} tsError=${ts.rootNode.hasError} pyError=${py.rootNode.hasError}`,
    );
  } catch (e) {
    add('wasm-tree-sitter', 'fail', String(e.message).slice(0, 200));
  }

  // 3) JSON payload builder：未初始化机器上应干净拒绝（GUI 侧捕获该拒绝）
  try {
    await api.buildListPayload(undefined, {});
    add('payload-builder', 'fail', 'expected rejection (not initialized) but resolved');
  } catch (e) {
    add('payload-builder', 'pass', `rejected as expected: ${String(e.message).slice(0, 120)}`);
  }

  results.allPassed = results.checks.every((c) => c.status === 'pass');
  return results;
}

app.whenReady().then(async () => {
  const results = await runChecks();

  if (SELFTEST) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    app.exit(results.allPassed ? 0 : 1);
    return;
  }

  const win = new BrowserWindow({ width: 940, height: 680, title: 'TeamAI Desktop — Spike 自检' });
  const html =
    '<!doctype html><meta charset="utf-8"><body style="font-family:Consolas,monospace;' +
    'background:#0b1020;color:#dfe7ff;padding:24px"><h2>TeamAI Desktop — Spike 自检报告</h2>' +
    `<pre style="white-space:pre-wrap">${JSON.stringify(results, null, 2)}</pre></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
});

app.on('window-all-closed', () => app.quit());
