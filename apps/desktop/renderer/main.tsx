import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import type {
  Request,
  Result,
  Snapshot,
  Resource,
  Preferences,
  Detail,
  Environment,
  Outcome,
  Doctor,
} from "@teamai-desktop/ipc-contract";
import { Dialog, Icon, labels } from "./components/ui";
import { Resources } from "./components/resources";
import { Settings } from "./components/settings";
import { Setup, Sync, Contributions, Call } from "./components/workflows";
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
  setup: "连接团队",
  settings: "设置与诊断",
};
const defaults: Preferences = {
  proxy: "",
  verbose: false,
  authorName: "",
  authorEmail: "",
};
function App() {
  const [page, setPage] = useState<Page>("resources"),
    [data, setData] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<{ page: Page; message: string } | null>(null),
    [notice, setNotice] = useState(""),
    [logs, setLogs] = useState<string[]>([]),
    [logAction, setLogAction] = useState("");
  const [detail, setDetail] = useState<{
      resource: Resource;
      data: Detail;
    } | null>(null),
    [environment, setEnvironment] = useState<Environment | null>(null),
    [outcome, setOutcome] = useState<Outcome | null>(null),
    [pushBlocked, setPushBlocked] = useState(false),
    [diagnosis, setDiagnosis] = useState<Doctor | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [draft, setDraft] = useState<Preferences>(defaults),
    [saved, setSaved] = useState<Preferences>(defaults),
    [leave, setLeave] = useState<Page | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const dirtyRef = useRef(false),
    logRef = useRef<HTMLPreElement>(null),
    refreshRef = useRef<() => void>(() => {});
  dirtyRef.current = dirty;
  const call: Call = async <T,>(r: Request): Promise<T | null> => {
    setBusy(true);
    setError(null);
    setNotice("");
    if (!["snapshot", "copyText", "openUrl", "detail"].includes(r.action)) {
      setLogs([]);
      setLogAction(r.action);
    }
    if (r.action === "push") {
      setPushBlocked(true);
      setOutcome(null);
    }
    try {
      const result = await window.teamai.request(r);
      if (!result.ok) {
        if (result.error.outcome) setOutcome(result.error.outcome);
        setError({ page, message: result.error.message });
        return null;
      }
      if (r.action === "copyText") setNotice("已复制分支名。");
      return result.data as T;
    } catch (e) {
      setError({ page, message: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      setBusy(false);
    }
  };
  function accept(s: Snapshot, forceDraft = false) {
    setData(s);
    const prefs = { ...defaults, ...s.preferences };
    setSaved(prefs);
    if (forceDraft || !dirtyRef.current) setDraft(prefs);
    setDetail(null);
  }
  async function refresh() {
    const s = await call<Snapshot>({ action: "snapshot" });
    if (s) {
      accept(s);
      setEpoch((n) => n + 1);
      setPushBlocked(false);
    }
  }
  async function checkEnvironment() {
    const value = await call<Environment>({ action: "environment" });
    if (value) setEnvironment(value);
  }
  refreshRef.current = () => void refresh();
  useEffect(() => {
    void refresh();
    const a = window.teamai.onLog((s) =>
      setLogs((prev) => [...prev, s].slice(-200)),
    );
    const b = window.teamai.onRefresh(() => refreshRef.current());
    return () => {
      a();
      b();
    };
  }, []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);
  function navigate(next: Page) {
    if (page === "settings" && dirty && next !== "settings") {
      setLeave(next);
      return;
    }
    setPage(next);
    setNotice("");
    if (next === "setup" && !environment) void checkEnvironment();
  }
  async function save() {
    const s = await call<Snapshot>({
      action: "preferences",
      preferences: draft,
    });
    if (s) {
      accept(s, true);
      setNotice("提交身份、网络和日志设置已保存。");
      return true;
    }
    return false;
  }
  async function context(action: Request) {
    if (dirty) {
      setPage("settings");
      setNotice("请先保存或恢复设置，再切换工作空间。");
      return;
    }
    const s = await call<Snapshot>(action);
    if (s) {
      accept(s, true);
      setEnvironment(null);
      setOutcome(null);
      setPushBlocked(false);
      setDiagnosis(null);
      setPage(s.state === "ready" ? "resources" : "setup");
    }
  }
  async function show(r: Resource) {
    const d = await call<Detail>({ action: "detail", id: r.id });
    if (d) setDetail({ resource: r, data: d });
  }
  const contextKey = `${data?.context.scope}:${data?.context.projectRoot}`;
  return (
    <>
      <div className="app">
        <aside>
          <div className="brand">
            <div className="brandmark">T</div>
            <div>
              TeamAI<span>DESKTOP · 0.5.1</span>
            </div>
          </div>
          <div className="navlabel">团队工作空间</div>
          <nav>
            {(["resources", "sync", "contribute"] as Page[]).map((p) => (
              <button
                key={p}
                className={page === p ? "active" : ""}
                aria-current={page === p ? "page" : undefined}
                onClick={() => navigate(p)}
              >
                <Icon name={p} />
                {titles[p]}
              </button>
            ))}
          </nav>
          <div className="sidebarbottom">
            <button
              className={page === "settings" ? "active" : ""}
              onClick={() => navigate("settings")}
            >
              <Icon name="settings" />
              设置与诊断
            </button>
            <span className={`dot ${data?.state === "ready" ? "good" : ""}`} />
            {data?.state === "ready" ? "已连接团队资源" : "等待连接团队"}
            <small>资源保留在本机和 Git 仓库</small>
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
                onChange={(e) =>
                  void context({
                    action: "setScope",
                    scope: e.target.value as "user" | "project",
                  })
                }
              >
                <option value="user">我的所有项目（用户级）</option>
                <option value="project">仅当前项目</option>
              </select>
              <button
                disabled={busy}
                onClick={() => void context({ action: "selectProject" })}
              >
                选择项目目录
              </button>
              <button disabled={busy} onClick={() => void refresh()}>
                刷新
              </button>
            </div>
          </header>
          <div className="workspace-bar">
            <span title={data?.remote}>
              {data?.remote
                ?.split("/")
                .pop()
                ?.replace(/\.git$/, "") || "尚未连接团队"}
              {data?.context.scope === "project" ? " · 当前项目" : " · 用户级"}
            </span>
            <details>
              <summary>工作空间详情</summary>
              <p title={data?.context.projectRoot}>
                目标目录：
                {data?.context.targetRoot ??
                  data?.context.projectRoot ??
                  "读取中…"}
              </p>
              <p>用户级资源作用于本机用户；项目级资源只作用于所选目录。</p>
              <button disabled={busy} onClick={() => navigate("setup")}>
                连接团队 / 管理初始化
              </button>
            </details>
          </div>
          {busy && (
            <div className="banner progress" role="status">
              正在处理，请稍候。操作记录会显示当前步骤；写入途中请等待完成。
            </div>
          )}
          {error?.page === page && (
            <div className="banner error" role="alert">
              {error.message}
              <button disabled={busy} onClick={() => void refresh()}>
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
              旧配置需要迁移。浏览不会写入；检查更新或贡献可能迁移，请先备份配置。
            </div>
          )}
          {data?.state === "uninitialized" &&
            page !== "setup" &&
            page !== "settings" && (
              <div className="empty">
                <span>＋</span>
                <h2>连接你的团队资源</h2>
                <p>连接团队仓库并选择角色和 AI 工具，获取可用的团队资源。</p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => navigate("setup")}
                >
                  开始初始化
                </button>
              </div>
            )}
          {page === "resources" && data?.state === "ready" && (
            <Resources
              data={data}
              busy={busy}
              show={(r) => void show(r)}
              onSync={() => navigate("sync")}
            />
          )}{" "}
          {page === "sync" && data?.state === "ready" && (
            <Sync
              key={contextKey + epoch}
              data={data}
              busy={busy}
              call={call}
              accept={(s) => {
                setData(s);
              }}
              onComplete={(s) => {
                accept(s);
                setNotice("同步完成。可前往资源库核对部署状态。");
              }}
            />
          )}
          {page === "contribute" && data?.state === "ready" && (
            <Contributions
              key={contextKey + epoch}
              data={data}
              busy={busy}
              call={call}
              show={(r) => void show(r)}
              outcome={outcome}
              blocked={pushBlocked}
              onOutcome={(s, o) => {
                accept(s);
                setOutcome(o);
              }}
              rescan={() =>
                void (async () => {
                  const s = await call<Snapshot>({ action: "snapshot" });
                  if (s) {
                    accept(s);
                    setPushBlocked(false);
                  }
                })()
              }
            />
          )}{" "}
          {page === "setup" && (
            <Setup
              key={contextKey}
              data={data}
              environment={environment}
              checkEnvironment={() => void checkEnvironment()}
              busy={busy}
              call={call}
              onReady={(s) => {
                accept(s);
                setPage("sync");
                setNotice("初始化完成。前往同步中心获取团队资源。");
              }}
            />
          )}
          {page === "settings" && (
            <Settings
              data={data}
              draft={draft}
              setDraft={setDraft}
              dirty={dirty}
              busy={busy}
              save={() => void save()}
              diagnosis={diagnosis}
              diagnose={() =>
                void (async () => {
                  const d = await call<Doctor>({ action: "doctor" });
                  if (d) setDiagnosis(d);
                })()
              }
              exportLogs={() =>
                void (async () => {
                  const d = await call<{ path?: string }>({
                    action: "exportLogs",
                  });
                  if (d?.path) setNotice(`日志已保存：${d.path}`);
                })()
              }
            />
          )}{" "}
          {page === "settings" && dirty && (
            <button disabled={busy} onClick={() => setDraft(saved)}>
              恢复已保存设置
            </button>
          )}
          <details
            className="logs"
            open={Boolean(error?.page === page) || busy}
          >
            <summary>
              操作日志{" "}
              <span>
                {logAction || "本次会话"} · {logs.length} 条
              </span>
            </summary>
            <pre ref={logRef}>{logs.join("\n") || "暂无操作记录"}</pre>
          </details>
          <footer>
            TeamAI Desktop · 0.5.1
            <span>资源与配置保留在本机及团队 Git 仓库</span>
          </footer>
        </main>
      </div>
      {detail && (
        <Dialog title="资源详情" onClose={() => setDetail(null)}>
          <span className="tag">
            {labels[detail.resource.type] ?? detail.resource.type}
          </span>
          <h2>{detail.resource.name}</h2>
          <p className="muted">
            {detail.resource.source === "repo" ? "团队仓库内容" : "本地内容"} ·
            只读
          </p>
          {detail.data.description && <p>{detail.data.description}</p>}
          {detail.data.warning && (
            <div className="banner">{detail.data.warning}</div>
          )}
          {detail.data.diff ? (
            <pre className="content diff">
              {detail.data.diff.map((line, i) => (
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
                {detail.data.body ?? detail.data.content}
              </Markdown>
            </div>
          )}
        </Dialog>
      )}
      {leave && (
        <Dialog
          title="设置尚未保存"
          onClose={() => {
            if (!busy) setLeave(null);
          }}
        >
          <p>保存修改后继续，或放弃本次修改。</p>
          {error?.page === "settings" && <p role="alert">{error.message}</p>}
          <div className="buttons">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  if (await save()) {
                    setPage(leave);
                    setLeave(null);
                  }
                })()
              }
            >
              保存并继续
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setDraft(saved);
                setPage(leave);
                setLeave(null);
              }}
            >
              放弃修改并继续
            </button>
            <button disabled={busy} onClick={() => setLeave(null)}>
              留在设置
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
