const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { startServer } = require("./fixture-server.cjs");
const { DesktopService } = require("../src/service.cjs");
const { fixture } = require("./fixture.cjs");
// Real Git smart HTTP over a locally trusted TLS certificate. No platform account,
// production repository, HOME override, disabled certificate checks or mock core.
test(
  "actual core: inspect → init → preview/pull → local contribution → pushed branch",
  { timeout: 240000 },
  async () => {
    const f = await fixture();
    let server;
    const gitConfigIndex = Number.parseInt(
      process.env.GIT_CONFIG_COUNT ?? "0",
      10,
    );
    const envKeys = [
      "GIT_CONFIG_COUNT",
      `GIT_CONFIG_KEY_${gitConfigIndex}`,
      `GIT_CONFIG_VALUE_${gitConfigIndex}`,
      "GIT_SSL_CAINFO",
      "NODE_EXTRA_CA_CERTS",
      "NO_PROXY",
      "no_proxy",
    ];
    const previous = Object.fromEntries(
      envKeys.map((k) => [k, process.env[k]]),
    );
    try {
      const fixtureServer = await startServer(f);
      server = fixtureServer.server;
      const { repo, bare } = fixtureServer;
      Object.assign(process.env, fixtureServer.env);
      const project = path.join(f.root, "new-project");
      await fs.mkdir(project);
      await fs.mkdir(path.join(project, ".claude"));
      await fs.writeFile(path.join(project, ".claude/settings.json"), "{}");
      const service = new DesktopService({ root: project, scope: "project" });
      const invoke = async (r) => {
        const out = await service.request(r);
        assert.equal(
          out.ok,
          true,
          `${JSON.stringify(r)}\n${out.error?.message}\n${service.logs.join("\n")}`,
        );
        return out.data;
      };
      assert.equal(
        (await invoke({ action: "snapshot" })).state,
        "uninitialized",
      );
      const inspect = await invoke({ action: "inspect", repo });
      assert.ok(inspect.roles.some((r) => r.id === "developer"));
      const initialized = await invoke({
        action: "init",
        inspection: inspect.inspection,
        role: "developer",
        projects: [],
        agents: ["claude"],
        confirmed: true,
      });
      assert.equal(initialized.state, "ready");
      assert.equal(initialized.role, "developer");
      const preview = await invoke({ action: "preview" });
      assert.ok(Array.isArray(preview.plan));
      const pulled = await invoke({
        action: "pull",
        preview: preview.preview,
        confirmed: true,
      });
      assert.equal(pulled.state, "ready");
      const skills = path.join(project, ".claude", "skills");
      const installed = await fs.readdir(skills).catch((e) => {
        throw Error(e.message + "\n" + service.logs.join("\n"));
      });
      assert.ok(installed.some((name) => name.includes("example")));
      const local = path.join(skills, "desktop-new");
      await fs.mkdir(local);
      await fs.writeFile(
        path.join(local, "SKILL.md"),
        "---\nname: desktop-new\ndescription: Desktop contribution\n---\n# Created via desktop fixture\n",
      );
      const contribution = await invoke({ action: "snapshot" });
      assert.ok(contribution.changes.some((c) => c.name === "desktop-new"));
      const pushed = await service.request({
        action: "push",
        review: contribution.review,
        namespace: "shared",
        confirmed: true,
      });
      assert.equal(
        pushed.ok,
        false,
        "Generic Git cannot create a platform PR; partial completion must be reported as failure.",
      );
      assert.ok(service.logs.join("\n").includes("has been pushed"));
      assert.ok(service.logs.join("\n").includes("create a PR manually"));
      const branches = execFileSync(
        "git",
        [
          "--git-dir",
          bare,
          "for-each-ref",
          "--format=%(refname)",
          "refs/heads",
        ],
        { encoding: "utf8" },
      );
      assert.match(branches, /teamai\//);
    } finally {
      for (const k of envKeys) {
        if (previous[k] === undefined) delete process.env[k];
        else process.env[k] = previous[k];
      }
      if (server) await new Promise((resolve) => server.close(resolve));
      await f.cleanup();
    }
  },
);
