// Each request owns a fresh process: cwd, JSON mode, exitCode and prompts cannot leak.
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const exec = promisify(execFile);
process.once("message", async ({ action, context, args }) => {
  try {
    const api = await import("teamai-cli/dist/desktop-api.js");
    api.setVerbose(Boolean(args.verbose));
    let data;
    if (action === "snapshot") data = await api.desktopSnapshot(context);
    else if (action === "inspect") {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "teamai-inspect-"));
      try {
        await exec("git", ["clone", "--depth", "1", "--", args.repo, dir], {
          timeout: 180000,
          maxBuffer: 2 * 1024 * 1024,
        });
        data = await api.desktopManifest(dir);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    } else if (action === "init") {
      await api.init({
        verbose: args.verbose,
        repo: args.repo,
        scope: context.scope,
        role: args.role || undefined,
        project: args.projects.join(",") || undefined,
        agent: args.agents,
      });
      data = await api.desktopSnapshot(context);
      if (data.state !== "ready")
        throw Error("初始化未完成，请检查日志和 Git 登录状态。");
    } else if (action === "preview" || action === "pull") {
      api.setJsonMode();
      await api.pull({ dryRun: action === "preview", verbose: args.verbose });
      data = {
        plan: api.takeDryRunPlan(),
        snapshot: await api.desktopSnapshot(context),
      };
    } else if (action === "push") {
      await api.push({
        all: true,
        verbose: args.verbose,
        role: args.namespace || undefined,
      });
      data = await api.desktopSnapshot(context);
    } else if (action === "doctor") {
      data = { healthy: await api.doctor({ verbose: args.verbose }) };
    } else throw Error("Unsupported core action");
    if (process.exitCode)
      throw Error(
        `操作未全部完成（core exit ${process.exitCode}）。可能已经写入配置或推送分支，请先检查日志和仓库状态再重试。`,
      );
    process.send({ ok: true, data }, () => process.exit(0));
  } catch (e) {
    process.send({ ok: false, error: String(e.message ?? e) }, () =>
      process.exit(1),
    );
  }
});
