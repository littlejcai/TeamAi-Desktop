import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const appDir = path.join(root, "apps", "desktop");
const platform = process.argv[2];
if (!["linux", "win"].includes(platform))
  throw Error("Use package.mjs linux|win");
const pnpm = process.env.npm_execpath;
if (!pnpm) throw Error("Run through pnpm package:linux or pnpm package:win");
const stage = await fs.mkdtemp(path.join(os.tmpdir(), "teamai-package-"));
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`Packaging step exited ${code}`)),
    );
  });
try {
  await run([
    pnpm,
    "--filter",
    "@teamai-desktop/desktop",
    "deploy",
    "--prod",
    "--legacy",
    stage,
  ]);
  const require = createRequire(path.join(appDir, "package.json"));
  await run([
    require.resolve("electron-builder/cli.js"),
    "--projectDir",
    stage,
    `--${platform}`,
    ...(platform === "win"
      ? ["nsis", "portable", "-c.win.signAndEditExecutable=false"]
      : ["tar.gz"]),
    "--publish",
    "never",
    `-c.directories.output=${path.join(appDir, "release")}`,
    `-c.electronVersion=${require("electron/package.json").version}`,
  ]);
} finally {
  await fs.rm(stage, { recursive: true, force: true });
}
