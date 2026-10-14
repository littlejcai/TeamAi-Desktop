// Each request owns a fresh process: cwd, JSON mode, exitCode and prompts cannot leak.
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const exec = promisify(execFile);
const { repairGeneratedWrapper } = require("./hook-runtime.cjs");
function finish(result, code) {
  process.stdout.write("", () =>
    process.stderr.write("", () =>
      process.send(result, () => process.exit(code)),
    ),
  );
}
process.once("message", async ({ action, context, args }) => {
  try {
    const api = await import("teamai-cli/dist/desktop-api.js");
    api.setVerbose(Boolean(args.verbose));
    let data;
    const before =
      action === "push" ? await api.desktopSnapshot(context) : null;
    async function contributionOutcome() {
      const after = await api.desktopSnapshot(context);
      const prior = new Map(
        (before?.pendingPushes ?? []).map((p) => [p.branch, JSON.stringify(p)]),
      );
      const changed = (after.pendingPushes ?? []).filter(
        (p) =>
          prior.get(p.branch) !== JSON.stringify(p) ||
          (after.lastPush !== before?.lastPush &&
            p.items?.some((i) =>
              before?.changes.some(
                (c) => c.name === i.name && c.type === i.type,
              ),
            )),
      );
      const records = changed
        .filter(
          (p) =>
            typeof p.branch === "string" &&
            /^teamai\/[^\s\x00-\x1f]+$/.test(p.branch),
        )
        .slice(0, 100)
        .map((p) => {
          let prUrl = null;
          try {
            const u = new URL(p.prUrl);
            if (u.protocol === "https:" && !u.username && !u.password)
              prUrl = u.href;
          } catch {}
          return { branch: p.branch, prUrl };
        });
      return {
        status: records.length
          ? records.some((p) => !p.prUrl)
            ? "review-required"
            : "review-open"
          : "unknown",
        records,
      };
    }
    if (action === "snapshot") data = await api.desktopSnapshot(context);
    else if (action === "environment") {
      const command = async (bin, argv) => {
        try {
          await exec(bin, argv, { timeout: 10000, maxBuffer: 65536 });
          return true;
        } catch {
          return false;
        }
      };
      const toolDirectories = {
        claude: ".claude",
        codex: ".codex",
        cursor: ".cursor",
        codebuddy: ".codebuddy",
        opencode: ".config/opencode",
      };
      const tools = [];
      for (const [agent, folder] of Object.entries(toolDirectories)) {
        const found = await Promise.all(
          [context.projectRoot, context.home ?? os.homedir()].map((root) =>
            fs
              .stat(path.join(root, folder))
              .then((s) => s.isDirectory())
              .catch(() => false),
          ),
        );
        if (found.some(Boolean)) tools.push(agent);
      }
      const git = await command("git", ["--version"]);
      const gh = await command("gh", ["--version"]);
      data = {
        git,
        gh,
        githubAuthenticated:
          gh &&
          (await command("gh", ["auth", "status", "--hostname", "github.com"])),
        tools,
      };
    } else if (action === "inspect") {
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
      if (
        process.env.PORTABLE_EXECUTABLE_FILE &&
        args.agents.includes("codebuddy")
      )
        throw Error("便携版暂不支持 CodeBuddy 自动 hooks，请使用安装版。");
      await api.init({
        verbose: args.verbose,
        repo: args.repo,
        scope: context.scope,
        role: args.role || undefined,
        project: args.projects.join(",") || undefined,
        agent: args.agents,
      });
      await repairGeneratedWrapper();
      data = await api.desktopSnapshot(context);
      if (data.state !== "ready")
        throw Error("初始化未完成，请检查日志和 Git 登录状态。");
    } else if (action === "preview" || action === "pull") {
      if (process.env.PORTABLE_EXECUTABLE_FILE) {
        const config = await api.desktopConfig(context);
        if (
          config &&
          (config.config.enabledAgents?.includes("codebuddy") ||
            (!config.config.enabledAgents &&
              config.team.toolPaths.codebuddy &&
              !config.config.disabledAgents?.includes("codebuddy")))
        )
          throw Error("便携版暂不支持 CodeBuddy 自动 hooks，请使用安装版。");
      }
      api.setJsonMode();
      await api.pull({ dryRun: action === "preview", verbose: args.verbose });
      await repairGeneratedWrapper();
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
      data = await contributionOutcome();
    } else if (action === "doctor") {
      data = { healthy: await api.doctor({ verbose: args.verbose }) };
    } else throw Error("Unsupported core action");
    if (process.exitCode && action === "push") {
      const outcome = await contributionOutcome();
      finish(
        {
          ok: false,
          outcome,
          error: outcome.records.length
            ? "分支已推送，评审步骤尚未全部完成。请处理下方评审结果。"
            : "贡献未全部完成，请核对本次日志和仓库状态。",
        },
        1,
      );
      return;
    }
    if (process.exitCode)
      throw Error(
        `操作未全部完成（core exit ${process.exitCode}）。可能已经写入配置或推送分支，请先检查日志和仓库状态再重试。`,
      );
    finish({ ok: true, data }, 0);
  } catch (e) {
    finish({ ok: false, error: String(e.message ?? e) }, 1);
  }
});
