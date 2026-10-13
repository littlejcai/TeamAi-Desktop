import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const manifestUrl = new URL('apps/desktop/package.json', root);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const pin = manifest.dependencies?.['teamai-cli'];
const match = /^github:littlejcai\/teamai-cli#([0-9a-f]{40})$/.exec(pin ?? '');
assert(match, 'teamai-cli must be pinned to a full fork commit');
const lock = await readFile(new URL('pnpm-lock.yaml', root), 'utf8');
assert(lock.includes(`specifier: ${pin}`), 'application pin differs from lockfile');
if (process.argv.includes('--commit')) {
  process.stdout.write(match[1] + '\n');
} else {
  const require = createRequire(manifestUrl);
  const entry = require.resolve('teamai-cli/dist/desktop-api.js');
  const api = await import(pathToFileURL(entry).href);
  for (const name of ['ensureAstReady', 'getParser', 'getLanguage', 'buildListPayload']) {
    assert.equal(typeof api[name], 'function', `missing core API: ${name}`);
  }
  await api.ensureAstReady();
  const parser = api.getParser();
  for (const [language, source] of [
    ['typescript', 'export const answer: number = 42;'],
    ['python', 'def answer():\n    return 42\n'],
  ]) {
    parser.setLanguage(api.getLanguage(language));
    const tree = parser.parse(source);
    assert(tree && !tree.rootNode.hasError, `${language} WASM parse failed`);
    tree.delete();
  }
  console.log(`Core ${match[1]}: lockfile, library exports and TS/Python WASM passed`);
}
