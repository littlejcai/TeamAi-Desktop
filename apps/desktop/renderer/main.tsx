import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Request,
  Result,
  Snapshot,
  Resource,
} from "@teamai-desktop/ipc-contract";
import Markdown from "react-markdown";
import "./style.css";
declare global {
  interface Window {
    teamai: {
      request: (r: Request) => Promise<Result>;
      onLog: (callback: (s: string) => void) => () => void;
      onRefresh: (callback: () => void) => () => void;
    };
  }
}
type Page = "resources" | "sync" | "contribute" | "setup" | "settings";
const titles: Record<Page, string> = {
  resources: "资源库",
  sync: "同步中心",
  contribute: "贡献回团队",
  setup: "初始化向导",
  settings: "设置与诊断",
};
function App() {
  const [page, setPage] = useState<Page>("resources"),
    [data, setData] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [logs, setLogs] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [source, setSource] = useState("all"),
    [detail, setDetail] = useState<{
      resource: Resource;
      content: string;
      diff?: { value: string; added?: boolean; removed?: boolean }[] | null;
    } | null>(null);
  const [repo, setRepo] = useState(""),
    [inspection, setInspection] = useState<any>(null),
    [role, setRole] = useState(""),
    [projects, setProjects] = useState<string[]>([]),
    [agents, setAgents] = useState<string[]>(["claude", "codex"]),
    [confirmed, setConfirmed] = useState(false);
  const [proxy, setProxy] = useState(""),
    [verbose, setVerbose] = useState(false);
  const [preview, setPreview] = useState<any>(null),
    [namespace, setNamespace] = useState(""),
    [reviewed, setReviewed] = useState(false);
  async function call(r: Request): Promise<any> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.teamai.request(r);
      if (!result.ok) throw Error(result.error.message);
      return result.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  function accept(s: Snapshot | null) {
    if (s) {
      setData(s);
      setProxy(s.preferences?.proxy ?? "");
      setVerbose(s.preferences?.verbose ?? false);
      setNamespace(s.namespaces?.[0] ?? "");
      setDetail(null);
      setReviewed(false);
      setConfirmed(false);
    }
  }
  async function refresh() {
    accept(await call({ action: "snapshot" }));
    setPreview(null);
  }
  useEffect(() => {
    void refresh();
    const a = window.teamai.onLog((s) =>
      setLogs((prev) => [...prev, s].slice(-150)),
    );
    const b = window.teamai.onRefresh(() => void refresh());
    return () => {
      a();
      b();
    };
  }, []);
  useEffect(() => {
    if (!detail) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    document.addEventListener("keydown", key);
    const close = document.querySelector<HTMLButtonElement>(
      '[aria-label="关闭详情"]',
    );
    close?.focus();
    return () => document.removeEventListener("keydown", key);
  }, [detail]);
  const filtered =
    data?.resources.filter(
      (r) =>
        (kind === "all" || r.type === kind) &&
        (source === "all" || r.source === source) &&
        `${r.name} ${r.type}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  async function show(r: Resource) {
    const d = await call({ action: "detail", id: r.id });
    if (d) setDetail({ resource: r, content: d.content, diff: d.diff });
  }
  function contextChanged() {
    setData(null);
    setInspection(null);
    setPreview(null);
    setConfirmed(false);
    setReviewed(false);
  }
  const urls = [
    ...new Set(logs.join("\n").match(/https:\/\/[^\s"<>]+/g) ?? []),
  ].filter((u) => /\/(pull|merge_requests|compare)\//.test(u));
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <div className="brandmark">T</div>
          <div>
            TeamAI<span>DESKTOP · 0.5.0</span>
          </div>
        </div>
        <div className="navlabel">团队工作空间</div>
        <nav>
          {(Object.keys(titles) as Page[]).map((p, i) => (
            <button
              className={page === p ? "active" : ""}
              onClick={() => {
                setPage(p);
                setConfirmed(false);
              }}
              key={p}
            >
              <span className="navicon">{["▦", "⇄", "↗", "＋", "⚙"][i]}</span>
              {titles[p]}
            </button>
          ))}
        </nav>
        <div className="sidebarbottom">
          <span className={`dot ${data?.state === "ready" ? "good" : ""}`} />
          {data?.state === "ready" ? "已连接团队资源" : "等待初始化"}
          <small>Git 驱动 · 数据保存在本机</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">TEAM WORKSPACE</span>
            <h1>{titles[page]}</h1>
          </div>
          <div className="context">
            <select
              aria-label="配置范围"
              value={data?.context.scope ?? "user"}
              disabled={busy}
              onChange={async (e) => {
                contextChanged();
                accept(
                  await call({
                    action: "setScope",
                    scope: e.target.value as "user" | "project",
                  }),
                );
              }}
            >
              <option value="user">用户级</option>
              <option value="project">项目级</option>
            </select>
            <button
              disabled={busy}
              onClick={async () => {
                contextChanged();
                accept(await call({ action: "selectProject" }));
              }}
            >
              选择项目目录
            </button>
            <button disabled={busy} onClick={refresh}>
              刷新
            </button>
          </div>
        </header>
        <div className="contextline" title={data?.context.projectRoot}>
          {data?.context.scope === "project" ? "项目目录" : "当前工作目录"}：
          {data?.context.projectRoot ?? "读取中…"}
        </div>
        {busy && (
          <div className="banner progress" role="status">
            正在处理，请稍候。运行详情见下方日志。
          </div>
        )}
        {error && (
          <div className="banner error" role="alert">
            {error}
            <button disabled={busy} onClick={refresh}>
              重试读取
            </button>
          </div>
        )}
        {notice && (
          <div className="banner" role="status">
            {notice}
          </div>
        )}
        {data?.needsMigration && (
          <div className="banner">
            当前配置需要迁移。浏览不会写入；执行同步或贡献时会沿用 core
            的迁移行为，请先备份配置。
          </div>
        )}
        {!busy && data?.state === "uninitialized" && page !== "setup" && (
          <div className="empty">
            <span>＋</span>
            <h2>连接你的团队资源</h2>
            <p>
              当前范围还未初始化。选择团队 Git 仓库、角色与 AI 工具后即可开始。
            </p>
            <button className="primary" onClick={() => setPage("setup")}>
              开始初始化
            </button>
          </div>
        )}
        {page === "resources" && data?.state === "ready" && (
          <>
            <div className="stats">
              <div>
                <span>可用资源</span>
                <strong>{data.resources.length}</strong>
              </div>
              <div>
                <span>本地待贡献</span>
                <strong>{data.changes.length}</strong>
              </div>
              <div>
                <span>当前成员</span>
                <strong className="small">{data.username ?? "—"}</strong>
              </div>
              <div>
                <span>最近同步</span>
                <strong className="small">
                  {data.lastPull
                    ? new Date(data.lastPull).toLocaleString()
                    : "尚未同步"}
                </strong>
              </div>
            </div>
            <div className="toolbar">
              <input
                aria-label="搜索资源"
                placeholder="搜索 skills、规则或 MCP…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="资源类型"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="all">所有类型</option>
                {["skills", "rules", "mcp", "docs", "agents"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                aria-label="资源来源"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="all">所有来源</option>
                <option value="repo">团队仓库</option>
                <option value="local">本地变更</option>
              </select>
              <span>{filtered.length} 个结果</span>
            </div>
            <div className="resourcegrid">
              {filtered.map((r) => (
                <button
                  className="card"
                  key={r.id}
                  disabled={busy}
                  onClick={() => show(r)}
                >
                  <div className="cardtop">
                    <span className="tag">{r.type}</span>
                    <span className="source">
                      {r.source === "repo" ? "团队" : "本地"}
                    </span>
                  </div>
                  <h3>{r.name}</h3>
                  <p>
                    {r.type === "mcp"
                      ? "查看 MCP 配置"
                      : r.type === "skills"
                        ? "查看 SKILL.md"
                        : "查看资源正文"}
                  </p>
                  <span className="cardarrow">查看详情 ↗</span>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <div className="empty compact">
                <h2>没有匹配的资源</h2>
                <p>调整搜索或筛选条件，也可前往同步中心更新团队资源。</p>
              </div>
            )}
          </>
        )}
        {page === "sync" && data?.state === "ready" && (
          <>
            <section>
              <h2>当前同步状态</h2>
              <p className="muted">
                以下为本地克隆状态。预检会连接远端并更新克隆，可能写入缓存与迁移信息。
              </p>
              <div className="stats">
                <div>
                  <span>领先远端</span>
                  <strong>{data.git?.ahead ?? 0}</strong>
                </div>
                <div>
                  <span>落后远端</span>
                  <strong>{data.git?.behind ?? 0}</strong>
                </div>
                <div>
                  <span>克隆本地变更</span>
                  <strong>{data.git?.modified.length ?? 0}</strong>
                </div>
              </div>
              {data.git?.error && <p role="alert">{data.git.error}</p>}
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setConfirmed(false);
                  const p = await call({ action: "preview" });
                  if (p) {
                    accept(p.snapshot);
                    setPreview(p);
                  }
                }}
              >
                检查同步计划
              </button>
            </section>
            {preview && (
              <section>
                <h2>同步预检结果</h2>
                {preview.plan.length ? (
                  preview.plan.map((p: any, i: number) => (
                    <div className="planrow" key={i}>
                      <strong>{p.type}</strong>
                      <span>{p.scope}</span>
                      <span>{p.count} 项</span>
                      <span>
                        新增 {(p.added ?? []).join("、") || "—"} / 更新{" "}
                        {(p.updated ?? []).join("、") || "—"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>
                    预检未报告资源部署计划。请同时查看操作日志中的跳过、权限或锁定提示。
                  </p>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  我确认同步会修改所选 AI
                  工具配置、资源文件和本地索引，并可能更新团队报告。
                </label>
                <button
                  className="primary"
                  disabled={busy || !confirmed}
                  onClick={async () => {
                    const s = await call({
                      action: "pull",
                      preview: preview.preview,
                      confirmed: true,
                    });
                    if (s) {
                      accept(s);
                      setPreview(null);
                      setNotice("同步完成，请检查资源和日志。");
                    }
                  }}
                >
                  执行同步
                </button>
              </section>
            )}
          </>
        )}
        {page === "contribute" && data?.state === "ready" && (
          <section>
            <h2>确认本地贡献</h2>
            <p className="muted">
              本轮会提交下面所有检测到的变更，并可能更新已有 PR
              分支。请先查看正文；core 的 PR/MR 结果和链接会记录在日志中。
            </p>
            {!data.changes.length ? (
              <div className="empty compact">
                <h2>没有待贡献的资源</h2>
                <p>在 AI 工具目录中创建或修改资源后，刷新此页。</p>
              </div>
            ) : (
              <>
                {data.changes.map((r) => (
                  <button
                    className="planrow change"
                    disabled={busy}
                    key={r.id}
                    onClick={() => show(r)}
                  >
                    <strong>{r.name}</strong>
                    <span>{r.type}</span>
                    <span>{r.status}</span>
                    <span>查看变更正文 →</span>
                  </button>
                ))}
                <label className="field">
                  新增 skill 的命名空间
                  <select
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                  >
                    {(data.namespaces?.length ? data.namespaces : [""]).map(
                      (ns) => (
                        <option value={ns} key={ns}>
                          {ns || "根命名空间 / core 默认"}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  已核对所有变更，允许推送到团队仓库并创建或更新 PR/MR。
                </label>
                <button
                  className="primary"
                  disabled={busy || !reviewed}
                  onClick={async () => {
                    const s = await call({
                      action: "push",
                      review: data.review,
                      namespace,
                      confirmed: true,
                    });
                    if (s) {
                      accept(s);
                      setNotice(
                        "贡献操作已结束。请在日志中确认 PR/MR 或手动创建请求的提示。",
                      );
                    }
                  }}
                >
                  提交所有变更
                </button>
              </>
            )}
            {data.remote?.startsWith("https://") && (
              <button
                className="link"
                onClick={() =>
                  call({
                    action: "openUrl",
                    url: data.remote!.replace(/\.git$/, ""),
                  })
                }
              >
                打开团队仓库 ↗
              </button>
            )}
            {urls.map((u) => (
              <button
                className="link"
                key={u}
                onClick={() => call({ action: "openUrl", url: u })}
              >
                打开评审链接 ↗
              </button>
            ))}
          </section>
        )}
        {page === "setup" && (
          <section>
            <div className="sectionheading">
              <div>
                <span className="eyebrow">GET STARTED</span>
                <h2>连接团队，开始协作</h2>
              </div>
              <span className="tag">Git 仓库 → 角色 → AI 工具</span>
            </div>
            {data?.state === "ready" ? (
              <div className="empty compact">
                <h2>当前上下文已初始化</h2>
                <p>
                  请选择另一个项目目录进行首次初始化。已有配置不会在这里覆盖。
                </p>
                <button onClick={() => setPage("resources")}>浏览资源</button>
              </div>
            ) : (
              <>
                <label className="field">
                  团队 Git 仓库
                  <input
                    placeholder="https://github.com/your-team/resources.git"
                    value={repo}
                    disabled={busy}
                    onChange={(e) => {
                      setRepo(e.target.value);
                      setInspection(null);
                      setConfirmed(false);
                    }}
                  />
                </label>
                <p className="muted">
                  使用本机 Git 凭据。GitHub 的 core 集成还需要 gh
                  登录；私有仓库请先完成对应平台登录。
                </p>
                <button
                  disabled={busy || !repo.trim()}
                  onClick={async () => {
                    const i = await call({ action: "inspect", repo });
                    setInspection(i);
                    setRole(i?.roles[0]?.id ?? "");
                    setProjects([]);
                    setConfirmed(false);
                  }}
                >
                  检查仓库与角色
                </button>
                {inspection && (
                  <div className="setupoptions">
                    <label className="field">
                      角色
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        {inspection.roles.length ? (
                          inspection.roles.map((r: any) => (
                            <option key={r.id} value={r.id}>
                              {r.id} · {r.description}
                            </option>
                          ))
                        ) : (
                          <option value="">仓库未定义角色</option>
                        )}
                      </select>
                    </label>
                    {inspection.projects.length > 0 && (
                      <fieldset>
                        <legend>参与的团队项目</legend>
                        {inspection.projects.map((p: any) => (
                          <label className="check" key={p.id}>
                            <input
                              type="checkbox"
                              checked={projects.includes(p.id)}
                              onChange={(e) =>
                                setProjects(
                                  e.target.checked
                                    ? [...projects, p.id]
                                    : projects.filter((id) => id !== p.id),
                                )
                              }
                            />
                            {p.name || p.id}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <fieldset>
                      <legend>启用的 AI 工具</legend>
                      <div className="agentlist">
                        {[
                          "claude",
                          "codex",
                          "cursor",
                          "codebuddy",
                          "opencode",
                        ].map((a) => (
                          <label className="check" key={a}>
                            <input
                              type="checkbox"
                              checked={agents.includes(a)}
                              onChange={(e) =>
                                setAgents(
                                  e.target.checked
                                    ? [...agents, a]
                                    : agents.filter((x) => x !== a),
                                )
                              }
                            />
                            {a}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="banner">
                      初始化会克隆仓库、保存配置并注入所选工具的 hooks。core
                      还可能向团队报告分支注册成员。完成后到同步中心同步团队资源。
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      确认以上仓库、范围、角色和工具，允许初始化及相关写入。
                    </label>
                    <button
                      className="primary"
                      disabled={busy || !confirmed || !agents.length}
                      onClick={async () => {
                        const s = await call({
                          action: "init",
                          inspection: inspection.inspection,
                          role,
                          projects,
                          agents,
                          confirmed: true,
                        });
                        if (s) {
                          accept(s);
                          setInspection(null);
                          setPage("resources");
                          setNotice("初始化完成。前往同步中心获取团队资源。");
                        }
                      }}
                    >
                      完成初始化
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {page === "settings" && (
          <>
            <section>
              <h2>当前配置</h2>
              <dl>
                <dt>范围</dt>
                <dd>
                  {data?.context.scope === "project" ? "项目级" : "用户级"}
                </dd>
                <dt>工作目录</dt>
                <dd>{data?.context.projectRoot ?? "—"}</dd>
                <dt>配置文件</dt>
                <dd>{data?.configPath ?? "尚未初始化"}</dd>
                <dt>成员</dt>
                <dd>{data?.username ?? "—"}</dd>
                <dt>启用工具</dt>
                <dd>{data?.enabledAgents?.join("、") || "core 默认"}</dd>
              </dl>
              <p className="muted">
                范围和项目目录会在本机保存。私有仓库认证沿用
                Git/托管平台凭据；客户端不保存 token。MVP 未配置自动更新。
              </p>
            </section>
            <section>
              <h2>网络与日志</h2>
              <label className="field">
                代理地址
                <input
                  placeholder="留空以沿用系统环境代理"
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={verbose}
                  onChange={(e) => setVerbose(e.target.checked)}
                />
                详细日志
              </label>
              <p className="muted">
                界面语言：中文。代理不保存账号或密码，仅在后续操作中生效。
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  const s = await call({
                    action: "preferences",
                    preferences: { proxy, verbose },
                  });
                  if (s) {
                    accept(s);
                    setNotice("网络和日志设置已保存。");
                  }
                }}
              >
                保存设置
              </button>
            </section>
            <section>
              <h2>健康检查与反馈</h2>
              <p>
                运行 core doctor 检查工具、hooks
                和配置。日志导出后请确认没有需要删除的私人内容再分享。
              </p>
              <div className="buttons">
                <button
                  disabled={busy || data?.state !== "ready"}
                  onClick={async () => {
                    const d = await call({ action: "doctor" });
                    if (d)
                      setNotice(
                        d.healthy
                          ? "诊断通过。详细结果见日志。"
                          : "诊断发现问题，请查看日志。",
                      );
                  }}
                >
                  运行诊断
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    const d = await call({ action: "exportLogs" });
                    if (d?.path) setNotice(`日志已保存：${d.path}`);
                  }}
                >
                  导出日志
                </button>
              </div>
            </section>
          </>
        )}
        <details className="logs" open={Boolean(error) || busy}>
          <summary>
            操作日志 <span>{logs.length} 条</span>
          </summary>
          <pre>{logs.join("\n") || "暂无操作记录"}</pre>
        </details>
        <footer>
          TeamAI Desktop · MVP 0.5.0
          <span>资源与配置保留在本机及团队 Git 仓库</span>
        </footer>
      </main>
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="资源详情"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sectionheading">
              <div>
                <span className="tag">{detail.resource.type}</span>
                <h2>{detail.resource.name}</h2>
              </div>
              <button aria-label="关闭详情" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>
            <p className="muted">
              {detail.resource.source === "repo" ? "团队仓库内容" : "本地内容"}{" "}
              · 只读
            </p>
            {detail.diff ? (
              <pre className="content diff">
                {detail.diff.map((line, i) => (
                  <span
                    className={
                      line.added ? "added" : line.removed ? "removed" : ""
                    }
                    key={i}
                  >
                    {line.added ? "+ " : line.removed ? "- " : "  "}
                    {line.value}
                  </span>
                ))}
              </pre>
            ) : (
              <div className="content markdown">
                <Markdown
                  components={{
                    img: () => null,
                    a: ({ href, children }) => (
                      <button
                        className="link"
                        onClick={() =>
                          href && call({ action: "openUrl", url: href })
                        }
                      >
                        {children}
                      </button>
                    ),
                  }}
                >
                  {detail.content}
                </Markdown>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
