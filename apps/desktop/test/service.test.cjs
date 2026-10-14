const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { DesktopService, redact } = require("../src/service.cjs");
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-contract-"));
  await fs.writeFile(path.join(root, "resource.md"), "old content");
  await fs.writeFile(path.join(root, "config.yaml"), "scope: project");
  const service = new DesktopService({ root, scope: "project" });
  const raw = {
    state: "ready",
    repoPath: root,
    configPath: path.join(root, "config.yaml"),
    resources: [
      {
        name: "sample",
        type: "rules",
        source: "repo",
        path: path.join(root, "resource.md"),
      },
    ],
    changes: [
      {
        name: "sample",
        type: "rules",
        path: path.join(root, "resource.md"),
        status: "modified",
      },
    ],
    namespaces: ["team"],
    roles: [],
  };
  const calls = [];
  service.run = async (action) => {
    calls.push(action);
    return action === "preview" ? { plan: [] } : raw;
  };
  return {
    root,
    service,
    raw,
    calls,
    close: () => fs.rm(root, { recursive: true, force: true }),
  };
}
test("rejects malformed and unconfirmed write requests before calling core", async () => {
  const f = await fixture();
  try {
    for (const payload of [
      { action: "pull", preview: "x", confirmed: false },
      { action: "init", repo: "https://example.com" },
      { action: "detail", id: "../../secret" },
      { action: "snapshot", unexpected: true },
      {
        action: "inspect",
        repo: "https://user:password@example.com/team/repo",
      },
    ]) {
      const r = await f.service.request(payload);
      assert.equal(r.ok, false);
    }
    assert.deepEqual(f.calls, []);
  } finally {
    await f.close();
  }
});
test("details require a current resource ID and cannot read a symlink outside the repo", async () => {
  const f = await fixture();
  try {
    const s = (await f.service.request({ action: "snapshot" })).data;
    assert.equal(
      (await f.service.request({ action: "detail", id: s.resources[0].id }))
        .data.content,
      "old content",
    );
    await fs.rm(path.join(f.root, "resource.md"));
    await fs.symlink(
      path.dirname(__filename),
      path.join(f.root, "resource.md"),
      "junction",
    );
    assert.equal(
      (await f.service.request({ action: "detail", id: s.resources[0].id })).ok,
      false,
    );
  } finally {
    await f.close();
  }
});
test("contribution confirmation becomes stale when content changes or a new item appears", async () => {
  const f = await fixture();
  try {
    const s = (await f.service.request({ action: "snapshot" })).data;
    await fs.writeFile(path.join(f.root, "resource.md"), "new content");
    assert.equal(
      (
        await f.service.request({
          action: "push",
          review: s.review,
          namespace: "team",
          confirmed: true,
        })
      ).ok,
      false,
    );
    assert.ok(!f.calls.includes("push"));
    const s2 = (await f.service.request({ action: "snapshot" })).data;
    f.raw.changes.push({ ...f.raw.changes[0], name: "new" });
    assert.equal(
      (
        await f.service.request({
          action: "push",
          review: s2.review,
          namespace: "team",
          confirmed: true,
        })
      ).ok,
      false,
    );
    assert.ok(!f.calls.includes("push"));
  } finally {
    await f.close();
  }
});
test("pull is bound to current preview and cannot run twice", async () => {
  const f = await fixture();
  try {
    await f.service.request({ action: "snapshot" });
    const p = (await f.service.request({ action: "preview", confirmed: true }))
      .data;
    assert.equal(
      (
        await f.service.request({
          action: "pull",
          preview: p.preview,
          confirmed: true,
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await f.service.request({
          action: "pull",
          preview: p.preview,
          confirmed: true,
        })
      ).ok,
      false,
    );
    assert.equal(f.calls.filter((x) => x === "pull").length, 1);
  } finally {
    await f.close();
  }
});
test("context changes invalidate initialization inspection and active operations reject overlap", async () => {
  const f = await fixture();
  try {
    f.service.inspection = { id: "i", context: "old" };
    assert.equal(
      (
        await f.service.request({
          action: "init",
          inspection: "i",
          role: "",
          projects: [],
          agents: ["claude"],
          confirmed: true,
        })
      ).ok,
      false,
    );
    f.service.busy = true;
    assert.equal((await f.service.request({ action: "snapshot" })).ok, false);
  } finally {
    await f.close();
  }
});
test("only HTTPS links without credentials open and common log credentials are redacted", async () => {
  const f = await fixture();
  try {
    let url;
    assert.equal(
      (
        await f.service.request(
          { action: "openUrl", url: "file:///etc/passwd" },
          { openUrl: (x) => (url = x) },
        )
      ).ok,
      false,
    );
    assert.equal(url, undefined);
    await f.service.request(
      { action: "openUrl", url: "https://github.com/team/repo/pull/1" },
      { openUrl: (x) => (url = x) },
    );
    assert.match(url, /github.com/);
    assert.ok(
      !redact("https://user:secret@host token=abc password=def").includes(
        "secret",
      ),
    );
    assert.ok(!redact("token=abc").includes("abc"));
  } finally {
    await f.close();
  }
});

test("JSON and bearer credentials are removed from exported log lines", () => {
  assert.ok(!redact('{"token":"sensitive-value"}').includes("sensitive-value"));
  assert.ok(
    !redact("Authorization: Bearer sensitive-value").includes(
      "sensitive-value",
    ),
  );
});

test("init rechecks disk state and refuses a context initialized since inspection", async () => {
  const f = await fixture();
  try {
    const inspection = (
      await f.service.request({
        action: "inspect",
        repo: "https://example.test/team/repo.git",
      })
    ).data;
    const result = await f.service.request({
      action: "init",
      inspection: inspection.inspection,
      role: "",
      projects: [],
      agents: ["claude"],
      confirmed: true,
    });
    assert.equal(result.ok, false);
    assert.ok(!f.calls.includes("init"));
  } finally {
    await f.close();
  }
});

test("client Git identity is validated and does not silently accept partial or multiline input", async () => {
  const f = await fixture();
  try {
    for (const preferences of [
      { proxy: "", verbose: false, authorName: "Fixture", authorEmail: "" },
      {
        proxy: "",
        verbose: false,
        authorName: "bad" + String.fromCharCode(10) + "name",
        authorEmail: "fixture@example.test",
      },
    ])
      assert.equal(
        (await f.service.request({ action: "preferences", preferences })).ok,
        false,
      );
    assert.equal(
      (
        await f.service.request({
          action: "preferences",
          preferences: {
            proxy: "",
            verbose: false,
            authorName: "Fixture",
            authorEmail: "fixture@example.test",
          },
        })
      ).ok,
      true,
    );
    assert.equal(f.service.preferences.authorName, "Fixture");
  } finally {
    await f.close();
  }
});

test("core-generated GUI wrapper runs the real CLI and custom wrappers remain untouched", async () => {
  const f = await fixture();
  try {
    const { repairWrapper, marker } = require("../src/hook-runtime.cjs");
    const { promisify } = require("node:util");
    const exec = promisify(require("node:child_process").execFile);
    const wrapper = path.join(f.root, "teamai");
    const entry = require.resolve("teamai-cli/dist/index.js");
    await fs.writeFile(wrapper, marker + "\n" + entry);
    assert.equal(
      await repairWrapper({ wrapper, entry, executable: process.execPath }),
      true,
    );
    const result =
      process.platform === "win32"
        ? await exec(
            "cmd.exe",
            ["/d", "/s", "/c", '""' + wrapper + '.cmd" --version"'],
            { windowsVerbatimArguments: true },
          )
        : await exec("/bin/sh", [wrapper, "--version"]);
    assert.match(result.stdout, /0\.22\.0/);
    await fs.writeFile(wrapper, "user-owned wrapper");
    assert.equal(
      await repairWrapper({ wrapper, entry, executable: process.execPath }),
      false,
    );
    assert.equal(await fs.readFile(wrapper, "utf8"), "user-owned wrapper");
  } finally {
    await f.close();
  }
});
