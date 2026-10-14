const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
if (process.platform !== "win32") throw Error("Windows runner required");
const root = path.resolve(__dirname, "..");
const app = path.join(root, "apps", "desktop");
const version = require(path.join(app, "package.json")).version;
const run = (file, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const p = spawn(file, args, { env, stdio: "inherit", windowsHide: true });
    p.once("error", reject);
    p.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(`${path.basename(file)} exited ${code}`)),
    );
  });
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "teamai-install-"));
  const installer = path.join(
    app,
    "release",
    `TeamAI-Desktop-${version}-Setup-x64.exe`,
  );
  try {
    await run(installer, ["/S", `/D=${dir}`]);
    const executable = path.join(dir, "TeamAI Desktop.exe");
    await fs.access(executable);
    await run(process.execPath, [process.env.npm_execpath, "test:e2e"], {
      ...process.env,
      TEAMAI_PACKAGED_EXECUTABLE: executable,
    });
    const uninstall = (await fs.readdir(dir)).find((n) =>
      /^Uninstall .*\.exe$/i.test(n),
    );
    if (!uninstall) throw Error("Installed uninstaller missing");
    await run(path.join(dir, uninstall), ["/S"]);
    const deadline = Date.now() + 60000;
    while (
      Date.now() < deadline &&
      (await fs.access(executable).then(
        () => true,
        () => false,
      ))
    )
      await new Promise((resolve) => setTimeout(resolve, 250));
    if (
      await fs.access(executable).then(
        () => true,
        () => false,
      )
    )
      throw Error("Uninstall did not remove installed executable");
    console.log(
      "Actual NSIS installation, installed Electron flows and uninstall passed",
    );
  } finally {
    await fs.rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 500,
    });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
