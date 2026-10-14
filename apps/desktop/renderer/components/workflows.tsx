import React, { useState } from "react";
import type {
  Snapshot,
  Resource,
  Inspection,
  Environment,
  Preview,
  Outcome,
  Request,
} from "@teamai-desktop/ipc-contract";
import { labels } from "./ui";
export type Call = <T>(r: Request) => Promise<T | null>;
export function Setup({
  data,
  environment,
  checkEnvironment,
  busy,
  call,
  onReady,
}: {
  data: Snapshot | null;
  environment: Environment | null;
  checkEnvironment: () => void;
  busy: boolean;
  call: Call;
  onReady: (s: Snapshot) => void;
}) {
  const [repo, setRepo] = useState(""),
    [inspection, setInspection] = useState<Inspection | null>(null),
    [role, setRole] = useState(""),
    [projects, setProjects] = useState<string[]>([]),
    [agents, setAgents] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false);
  const selectedRole = inspection?.roles.find((r) => r.id === role);
  return (
    <section>
      <div className="sectionheading">
        <h2>连接团队，开始协作</h2>
        <span className="tag">
          {inspection ? "第 2 / 3 步：确认选择" : "第 1 / 3 步：连接仓库"}
        </span>
      </div>
      {data?.state === "ready" ? (
        <div className="empty compact">
          <h2>当前上下文已初始化</h2>
          <p>选择其他项目目录或范围后可连接新的团队。已有配置不会被覆盖。</p>
        </div>
      ) : (
        <>
          <details className="environment" open={!inspection}>
            <summary>使用前检查（点击查看）</summary>
            <strong>使用前检查</strong>
            <p>
              {environment
                ? `${environment.git ? "✓ Git 可用" : "✕ 未找到 Git"} · ${environment.gh ? (environment.githubAuthenticated ? "✓ GitHub 已登录" : "GitHub 尚未登录") : "未找到 GitHub CLI（GitHub 集成需要）"}`
                : "尚未检查本机环境"}
            </p>
            <button disabled={busy} onClick={checkEnvironment}>
              重新检查环境
            </button>
            {environment && !environment.githubAuthenticated && (
              <button
                className="link"
                onClick={() =>
                  call({
                    action: "openUrl",
                    url: "https://cli.github.com/manual/gh_auth_login",
                  })
                }
              >
                GitHub 登录说明 ↗
              </button>
            )}
            <p className="muted">
              其他 Git 平台使用本机现有凭据，是否有仓库权限将在下一步检查。
            </p>
          </details>
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
          <button
            disabled={busy || !repo.trim() || environment?.git === false}
            onClick={async () => {
              const result = await call<Inspection>({
                action: "inspect",
                repo,
              });
              setInspection(result);
              setRole(result?.roles[0]?.id ?? "");
              setProjects([]);
              setAgents(environment?.tools ?? []);
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
                  disabled={busy}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  {inspection.roles.length ? (
                    inspection.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} · {r.description}
                      </option>
                    ))
                  ) : (
                    <option value="">仓库未定义角色</option>
                  )}
                </select>
              </label>
              {selectedRole && (
                <p className="muted">
                  {selectedRole.description} · 技能分组：
                  {selectedRole.resources.skills.join("、") || "按团队默认"}
                </p>
              )}
              {inspection.projects.length > 0 && (
                <fieldset>
                  <legend>参与的团队项目</legend>
                  {inspection.projects.map((p) => (
                    <label className="check" key={p.id}>
                      <input
                        type="checkbox"
                        checked={projects.includes(p.id)}
                        disabled={busy}
                        onChange={(e) => {
                          setProjects(
                            e.target.checked
                              ? [...projects, p.id]
                              : projects.filter((id) => id !== p.id),
                          );
                          setConfirmed(false);
                        }}
                      />
                      {p.name || p.id}
                    </label>
                  ))}
                </fieldset>
              )}
              <fieldset>
                <legend>启用的 AI 工具</legend>
                <p className="muted">
                  已根据本机目录选择检测到的工具；请核对实际使用的工具。
                </p>
                <div className="agentlist">
                  {["claude", "codex", "cursor", "codebuddy", "opencode"].map(
                    (a) => (
                      <label className="check" key={a}>
                        <input
                          type="checkbox"
                          checked={agents.includes(a)}
                          disabled={busy}
                          onChange={(e) => {
                            setAgents(
                              e.target.checked
                                ? [...agents, a]
                                : agents.filter((x) => x !== a),
                            );
                            setConfirmed(false);
                          }}
                        />
                        {a}
                        {environment?.tools.includes(a) ? " · 已检测" : ""}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <div className="impact">
                <h3>第 3 / 3 步：确认写入目标</h3>
                <p className="target-path">
                  目标目录：
                  {data?.context.targetRoot ?? data?.context.projectRoot}
                </p>
                <p>
                  作用范围：
                  {data?.context.scope === "project"
                    ? "仅当前项目"
                    : "我的所有项目（用户级）"}
                  <br />
                  工具：{agents.join("、") || "请至少选择一个工具"}
                  <br />
                  角色：{role || "团队默认"}
                </p>
                <p className="muted">
                  会克隆仓库、保存配置、注入所选工具
                  hooks，并可能注册团队成员。完成后仍需同步资源。目标目录与作用范围见上方摘要；可在工作空间详情核对。
                </p>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                确认以上仓库、范围、角色和工具，允许初始化及相关写入。
              </label>
              <button
                className="primary"
                disabled={busy || !confirmed || !agents.length}
                onClick={async () => {
                  setConfirmed(false);
                  const s = await call<Snapshot>({
                    action: "init",
                    inspection: inspection.inspection,
                    role,
                    projects,
                    agents: agents as (
                      | "claude"
                      | "codex"
                      | "cursor"
                      | "codebuddy"
                      | "opencode"
                    )[],
                    confirmed: true,
                  });
                  if (s) onReady(s);
                }}
              >
                完成初始化
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
export function Sync({
  data,
  busy,
  call,
  accept,
  onComplete,
}: {
  data: Snapshot;
  busy: boolean;
  call: Call;
  accept: (s: Snapshot) => void;
  onComplete: (s: Snapshot) => void;
}) {
  const [preflight, setPreflight] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [confirmed, setConfirmed] = useState(false);
  return (
    <>
      <section>
        <h2>{preview ? "检查已完成" : "检查团队更新"}</h2>
        <p>
          当前工具：{data.enabledAgents?.join("、") || "按团队配置"} ·{" "}
          {data.lastPull
            ? `最近同步 ${new Date(data.lastPull).toLocaleString()}`
            : "尚未同步"}
        </p>
        <p className="muted">
          以下 Git 状态来自本地克隆；检查更新时才会连接远端。
        </p>
        <details className="advanced">
          <summary>高级信息：本地 Git 状态与目录</summary>
          <p>
            领先 {data.git?.ahead ?? 0} · 落后 {data.git?.behind ?? 0} ·
            克隆本地变更 {data.git?.modified.length ?? 0}
          </p>
          <p>{data.context.projectRoot}</p>
          {data.git?.error && <p role="alert">{data.git.error}</p>}
        </details>
        {!preview ? (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={preflight}
                disabled={busy}
                onChange={(e) => setPreflight(e.target.checked)}
              />
              我允许预检更新克隆与缓存、迁移旧配置（可能包括
              hooks）；预检不正式部署资源。
            </label>
            <button
              className="primary"
              disabled={busy || !preflight}
              onClick={async () => {
                setConfirmed(false);
                const result = await call<Preview>({
                  action: "preview",
                  confirmed: true,
                });
                if (result) {
                  accept(result.snapshot);
                  setPreview(result);
                }
              }}
            >
              检查同步计划
            </button>
          </>
        ) : (
          <>
            <p className="completed">✓ 已检查远端，下面是本次应用计划。</p>
            <button
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setPreflight(false);
                setConfirmed(false);
              }}
            >
              重新检查
            </button>
          </>
        )}
      </section>
      {preview && (
        <section>
          <h2>同步预检结果</h2>
          <p>
            将应用到：{data.enabledAgents?.join("、") || "团队配置的工具"} ·{" "}
            {data.context.scope === "project" ? "当前项目" : "用户级工具目录"}
          </p>
          {preview.plan.filter((p) => p.count > 0).length ? (
            preview.plan
              .filter((p) => p.count > 0)
              .map((p, i) => (
                <div className="planrow" key={i}>
                  <strong>{labels[p.type] ?? p.type}</strong>
                  <span>{p.scope === "project" ? "当前项目" : "用户级"}</span>
                  <span>{p.count} 项</span>
                  <span>
                    新增 {(p.added ?? []).join("、") || "—"} / 更新{" "}
                    {(p.updated ?? []).join("、") || "—"}
                  </span>
                </div>
              ))
          ) : (
            <p>
              预检未报告部署项目。可检查操作记录中的跳过或权限提示，或重新检查。
            </p>
          )}
          <div className="impact">
            <p>
              应用会修改所选 AI
              工具配置、资源文件与索引，可能更新团队报告。变更后旧计划将失效。
            </p>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            我确认同步上述更新及相关配置。
          </label>
          <button
            className="primary"
            disabled={busy || !confirmed}
            onClick={async () => {
              setConfirmed(false);
              const result = await call<Snapshot>({
                action: "pull",
                preview: preview.preview,
                confirmed: true,
              });
              setPreview(null);
              if (result) onComplete(result);
            }}
          >
            执行同步
          </button>
        </section>
      )}
    </>
  );
}
export function Contributions({
  data,
  busy,
  show,
  call,
  onOutcome,
  outcome,
  blocked,
  rescan,
}: {
  data: Snapshot;
  busy: boolean;
  show: (r: Resource) => void;
  call: Call;
  onOutcome: (s: Snapshot, o: Outcome) => void;
  outcome: Outcome | null;
  blocked: boolean;
  rescan: () => void;
}) {
  const [reviewed, setReviewed] = useState(false),
    [namespace, setNamespace] = useState(data.namespaces?.[0] ?? "");
  return (
    <>
      {outcome && (
        <section className="result" role="status">
          <h2>
            {outcome.status === "review-required"
              ? "分支已推送，待创建评审"
              : outcome.status === "review-open"
                ? "分支已推送，评审已关联"
                : "请核对贡献结果"}
          </h2>
          {outcome.records.map((record) => (
            <div className="receipt" key={record.branch}>
              <label className="field">
                远端分支
                <input readOnly value={record.branch} />
              </label>
              <div className="buttons">
                <button
                  onClick={() =>
                    call({ action: "copyText", text: record.branch } as Request)
                  }
                >
                  复制分支名
                </button>
                {record.prUrl && (
                  <button
                    className="primary"
                    onClick={() =>
                      call({ action: "openUrl", url: record.prUrl! })
                    }
                  >
                    打开评审 ↗
                  </button>
                )}
              </div>
              {!record.prUrl && (
                <p>
                  此分支已由 core 记录为推送完成，尚未记录
                  PR/MR。请在团队仓库手动创建或核对已有评审。
                </p>
              )}
            </div>
          ))}
          {data.remote?.startsWith("https://") && (
            <button
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
          <p className="muted">
            开始下一次贡献前，请重新扫描并核对资源。已有评审分支的处理沿用 core
            规则。
          </p>
          <button
            disabled={busy}
            onClick={() => {
              setReviewed(false);
              rescan();
            }}
          >
            重新扫描变更
          </button>
        </section>
      )}
      <section>
        <h2>确认本地贡献</h2>
        <p>
          本次会提交下面全部变更。请逐项查看正文与差异；暂不支持仅提交部分资源。
        </p>
        {!data.changes.length ? (
          <div className="empty compact">
            <h2>没有待贡献的资源</h2>
            <p>在 AI 工具目录中创建或修改资源，再刷新扫描。</p>
          </div>
        ) : (
          <>
            {data.changes.map((r) => (
              <button
                className="planrow change"
                key={r.id}
                disabled={busy}
                onClick={() => show(r)}
              >
                <strong>{r.name}</strong>
                <span>{labels[r.type] ?? r.type}</span>
                <span>{labels[r.status ?? ""] ?? r.status}</span>
                <span>查看变更正文 →</span>
              </button>
            ))}
            <label className="field">
              新增 skill 的命名空间（团队共享位置）
              <select
                value={namespace}
                disabled={busy}
                onChange={(e) => {
                  setNamespace(e.target.value);
                  setReviewed(false);
                }}
              >
                {(data.namespaces?.length ? data.namespaces : [""]).map(
                  (ns) => (
                    <option key={ns} value={ns}>
                      {ns || "根目录 / 团队默认"}
                    </option>
                  ),
                )}
              </select>
            </label>
            <p className="muted">
              共 {data.changes.length}{" "}
              项，将推送到当前团队仓库，并可能创建或更新评审分支。
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={reviewed}
                disabled={busy || blocked}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              已核对所有变更，允许推送到团队仓库并创建或更新 PR/MR。
            </label>
            <button
              className="primary"
              disabled={busy || blocked || !reviewed}
              onClick={async () => {
                setReviewed(false);
                const result = await call<{
                  snapshot: Snapshot;
                  outcome: Outcome;
                }>({
                  action: "push",
                  review: data.review,
                  namespace,
                  confirmed: true,
                });
                if (result) onOutcome(result.snapshot, result.outcome);
              }}
            >
              提交所有变更
            </button>
            {blocked && (
              <p className="muted">此次确认已使用；请先核对结果并重新扫描。</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
