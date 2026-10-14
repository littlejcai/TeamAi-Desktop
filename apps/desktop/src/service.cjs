const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { diffLines } = require("diff");
const { fork } = require("node:child_process");
const {
  request,
  snapshot,
  preferences,
} = require("@teamai-desktop/ipc-contract");
const hash = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function redact(text) {
  return String(text)
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(
      /((?:token|password|secret|authorization|api[_-]?key)\s*["']?\s*[=:]\s*["']?)(?:Bearer\s+)?[^\s"',;}]+/gi,
      "$1[redacted]",
    );
}

class DesktopService {
  constructor({
    root,
    scope = "user",
    testHome,
    emit = () => {},
    settingsFile,
    preferences: settings,
  }) {
    this.context = { scope, projectRoot: root };
    this.testHome = testHome;
    this.emit = emit;
    this.settingsFile = settingsFile;
    this.preferences = preferences.safeParse(settings).success
      ? settings
      : { proxy: "", verbose: false };
    this.paths = new Map();
    this.logs = [];
    this.busy = false;
    this.preview = null;
    this.inspection = null;
    this.review = null;
  }
  log(text) {
    const line = redact(text).slice(0, 12000);
    this.logs.push(line);
    if (this.logs.length > 500) this.logs.shift();
    this.emit(line);
  }
  async run(action, args = {}) {
    const temporary =
      this.context.scope === "user"
        ? await fs.mkdtemp(path.join(os.tmpdir(), "teamai-context-"))
        : null;
    try {
      return await new Promise((resolve, reject) => {
        const child = fork(path.join(__dirname, "core-worker.cjs"), [], {
          cwd: temporary ?? this.context.projectRoot,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            GIT_TERMINAL_PROMPT: "0",
            GIT_OPTIONAL_LOCKS: "0",
            NO_COLOR: "1",
            ...(this.preferences.proxy
              ? {
                  HTTPS_PROXY: this.preferences.proxy,
                  HTTP_PROXY: this.preferences.proxy,
                  https_proxy: this.preferences.proxy,
                  http_proxy: this.preferences.proxy,
                }
              : {}),
          },
          stdio: ["ignore", "pipe", "pipe", "ipc"],
          windowsHide: true,
        });
        let result;
        let timedOut = false;
        const capture = (stream) => {
          let pending = "";
          stream.setEncoding("utf8");
          stream.on("data", (part) => {
            pending += part;
            let n;
            while ((n = pending.indexOf("\n")) >= 0) {
              this.log(pending.slice(0, n));
              pending = pending.slice(n + 1);
            }
            if (pending.length > 16384) {
              this.log("[日志单行过长，已省略]");
              pending = "";
            }
          });
          stream.on("end", () => {
            if (pending) this.log(pending);
          });
        };
        capture(child.stdout);
        capture(child.stderr);
        child.on("message", (m) => {
          result = m;
        });
        const timer = setTimeout(
          () => {
            timedOut = true;
            child.kill();
          },
          10 * 60 * 1000,
        );
        child.once("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          if (timedOut)
            reject(Error("操作超时，可能已部分完成；请先运行诊断再重试。"));
          else if (result?.ok && code === 0) resolve(result.data);
          else
            reject(
              Error(result?.error ?? `Core exited ${code}; inspect logs.`),
            );
        });
        child.send({
          action,
          context: {
            ...this.context,
            ...(this.testHome ? { home: this.testHome } : {}),
          },
          args: { ...args, verbose: this.preferences.verbose },
        });
      });
    } finally {
      if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    }
  }
  async fingerprint(raw = this.raw) {
    const config = raw?.configPath;
    return hash({
      context: this.context,
      config: config
        ? await fs.readFile(config, "utf8").catch(() => null)
        : null,
      inventory: raw?.resources.map((r) => [r.type, r.name, r.path]),
      changes: await Promise.all(
        (raw?.changes ?? []).map(async (r) => [
          r.type,
          r.name,
          r.status,
          r.path,
          await this.readContent(r.path).catch(() => null),
        ]),
      ),
      git: raw?.git,
    });
  }
  async readContent(p) {
    const candidate = p;
    const repoOwned = this.raw?.resources.some(
      (r) => r.path === candidate && r.source === "repo",
    );
    const roots = repoOwned
      ? [this.raw.repoPath]
      : [
          this.context.projectRoot,
          ...[
            ".claude",
            ".codex",
            ".cursor",
            ".codebuddy",
            ".opencode",
            ".config/opencode",
            ".teamai/docs",
          ].map((x) => path.join(os.homedir(), x)),
        ];
    const real = await fs.realpath(p);
    let allowed = false;
    for (const root of roots.filter(Boolean)) {
      const resolved = await fs.realpath(root).catch(() => null);
      if (resolved) {
        const rel = path.relative(resolved, real);
        if (
          rel === "" ||
          (!rel.startsWith(".." + path.sep) &&
            rel !== ".." &&
            !path.isAbsolute(rel))
        )
          allowed = true;
      }
    }
    if (!allowed) throw Error("资源路径越过当前仓库或工具目录边界。");
    const s = await fs.stat(p);
    if (
      s.isDirectory() &&
      !(await fs.stat(path.join(p, "SKILL.md")).catch(() => null))
    ) {
      const names = (await fs.readdir(p, { withFileTypes: true }))
        .filter((e) => !e.name.startsWith("."))
        .map((e) => e.name + (e.isDirectory() ? "/" : ""));
      return (
        "# 资源目录\n\n" +
        names
          .slice(0, 200)
          .map((n) => "- " + n)
          .join("\n")
      );
    }
    if (s.isDirectory()) {
      p = path.join(p, "SKILL.md");
      const final = await fs.realpath(p);
      const rel = path.relative(real, final);
      if (rel.startsWith("..") || path.isAbsolute(rel))
        throw Error("详情文件链接越过资源目录边界。");
    }
    const stat = await fs.stat(p);
    if (stat.size > 1024 * 1024)
      throw Error("文件超过 1MB，无法在详情中展示。");
    return fs.readFile(p, "utf8");
  }
  async takeSnapshot() {
    const raw = await this.run("snapshot");
    this.raw = raw;
    this.paths.clear();
    const normalize = (r) => {
      const id = hash({
        context: this.context,
        path: r.path,
        name: r.name,
        type: r.type,
        source: r.source ?? "local",
      });
      this.paths.set(id, r.path);
      return {
        id,
        name: r.name,
        type: r.type,
        source: r.source ?? "local",
        ...(r.status ? { status: r.status } : {}),
      };
    };
    const data = {
      ...raw,
      resources: raw.resources.map(normalize),
      changes: raw.changes.map(normalize),
      context: { ...this.context },
      review: crypto.randomUUID(),
      preferences: { ...this.preferences },
    };
    delete data.repoPath;
    this.last = data;
    this.review = { id: data.review, hash: await this.fingerprint() };
    snapshot.parse(data);
    return data;
  }
  invalidateContext() {
    this.paths.clear();
    this.raw = null;
    this.last = null;
    this.review = null;
    this.preview = null;
    this.inspection = null;
  }
  async persist() {
    if (this.settingsFile) {
      await fs.mkdir(path.dirname(this.settingsFile), { recursive: true });
      await fs.writeFile(
        this.settingsFile,
        JSON.stringify(
          { ...this.context, preferences: this.preferences },
          null,
          2,
        ),
      );
    }
  }
  async handle(payload, platform = {}) {
    try {
      const r = request.parse(payload);
      if (this.busy) throw Error("已有操作正在执行，请等待完成。");
      this.busy = true;
      try {
        if (r.action === "selectProject") {
          const selected = await platform.chooseDirectory?.();
          if (selected) {
            this.context = { scope: "project", projectRoot: selected };
            await this.persist();
            this.invalidateContext();
          }
          return await this.takeSnapshot();
        }
        if (r.action === "setScope") {
          this.context.scope = r.scope;
          this.invalidateContext();
          await this.persist();
          return await this.takeSnapshot();
        }
        if (r.action === "preferences") {
          this.preferences = r.preferences;
          this.preview = null;
          await this.persist();
          return await this.takeSnapshot();
        }
        if (r.action === "snapshot") return await this.takeSnapshot();
        if (r.action === "detail") {
          const p = this.paths.get(r.id);
          if (!p) throw Error("资源已过期，请刷新列表。");
          const content = await this.readContent(p);
          const change = this.last?.changes.find((x) => x.id === r.id);
          if (change?.type === "env")
            throw Error("MVP 不展示或提交环境变量变更，请通过 CLI 单独处理。");
          if (change) {
            const candidates = this.raw.resources.filter(
              (x) =>
                x.source === "repo" &&
                x.type === change.type &&
                x.name === change.name,
            );
            const original = this.raw.changes.find(
              (x) => x.name === change.name && x.type === change.type,
            )?.before;
            const before =
              original !== undefined
                ? original
                : candidates.length === 1
                  ? await this.readContent(candidates[0].path)
                  : change.status === "new"
                    ? ""
                    : null;
            return {
              content,
              before,
              diff: before === null ? null : diffLines(before, content),
            };
          }
          return { content };
        }
        if (r.action === "inspect") {
          const data = await this.run("inspect", { repo: r.repo });
          this.inspection = {
            id: crypto.randomUUID(),
            repo: r.repo,
            context: hash(this.context),
            data,
          };
          return { ...data, inspection: this.inspection.id };
        }
        if (r.action === "init") {
          const i = this.inspection;
          if (!i || i.id !== r.inspection || i.context !== hash(this.context))
            throw Error("仓库检查已过期，请重新检查。");
          if (i.data.roles.length && !i.data.roles.some((x) => x.id === r.role))
            throw Error("请选择有效角色。");
          if (
            r.projects.some((id) => !i.data.projects.some((p) => p.id === id))
          )
            throw Error("项目选择无效。");
          if (this.last?.state === "ready")
            throw Error("当前上下文已初始化；请选择新的目录。");
          const current = await this.run("snapshot");
          if (current.state !== "uninitialized")
            throw Error(
              "上下文已被其他操作初始化，请刷新；客户端不会覆盖现有配置。",
            );
          await this.run("init", {
            repo: i.repo,
            role: r.role,
            projects: r.projects,
            agents: r.agents,
          });
          this.inspection = null;
          return await this.takeSnapshot();
        }
        if (r.action === "preview") {
          const data = await this.run("preview");
          await this.takeSnapshot();
          this.preview = {
            id: crypto.randomUUID(),
            hash: await this.fingerprint(),
          };
          return {
            plan: data.plan,
            preview: this.preview.id,
            snapshot: this.last,
          };
        }
        if (r.action === "pull") {
          if (
            !this.preview ||
            this.preview.id !== r.preview ||
            this.preview.hash !==
              (await this.fingerprint(await this.run("snapshot")))
          )
            throw Error("同步预检已过期或本地文件改变，请重新预检。");
          this.preview = null;
          await this.run("pull");
          return await this.takeSnapshot();
        }
        if (r.action === "push") {
          if (this.last?.changes.some((c) => c.type === "env"))
            throw Error(
              "存在环境变量变更，请先通过 CLI 单独处理，再刷新贡献列表。",
            );
          if (
            !this.review ||
            this.review.id !== r.review ||
            this.review.hash !==
              (await this.fingerprint(await this.run("snapshot")))
          )
            throw Error("贡献确认已过期或文件改变，请刷新并重新查看变更。");
          if (
            this.last.namespaces?.length &&
            !this.last.namespaces.includes(r.namespace)
          )
            throw Error("请选择团队定义的命名空间。");
          this.review = null;
          await this.run("push", { namespace: r.namespace });
          return await this.takeSnapshot();
        }
        if (r.action === "doctor") return await this.run("doctor");
        if (r.action === "exportLogs") {
          return { path: await platform.saveLogs?.(this.logs.join("\n")) };
        }
        if (r.action === "openUrl") {
          const u = new URL(r.url);
          if (u.protocol !== "https:" || u.username || u.password)
            throw Error("只允许打开无凭据的 HTTPS 地址。");
          await platform.openUrl?.(u.href);
          return {};
        }
      } finally {
        this.busy = false;
      }
    } catch (e) {
      const message = redact(
        Array.isArray(e.issues)
          ? e.issues.map((i) => i.message).join("；")
          : (e.message ?? e),
      );
      this.log(message);
      return { ok: false, error: { code: "OPERATION_FAILED", message } };
    }
  }
  async request(payload, platform) {
    const data = await this.handle(payload, platform);
    return data?.ok === false ? data : { ok: true, data };
  }
}
module.exports = { DesktopService, redact };
