import React from "react";
import type {
  Snapshot,
  Preferences,
  Doctor,
} from "@teamai-desktop/ipc-contract";
export function Settings({
  data,
  draft,
  setDraft,
  dirty,
  busy,
  save,
  diagnose,
  diagnosis,
  exportLogs,
}: {
  data: Snapshot | null;
  draft: Preferences;
  setDraft: (v: Preferences) => void;
  dirty: boolean;
  busy: boolean;
  save: () => void;
  diagnose: () => void;
  diagnosis: Doctor | null;
  exportLogs: () => void;
}) {
  const update = (key: string, value: string | boolean) =>
    setDraft({ ...draft, [key]: value });
  return (
    <>
      <section>
        <h2>工作空间</h2>
        <dl>
          <dt>作用范围</dt>
          <dd>
            {data?.context.scope === "project"
              ? "仅当前项目"
              : "我的所有项目（用户级）"}
          </dd>
          <dt>资源目标目录</dt>
          <dd>
            {data?.context.targetRoot ?? data?.context.projectRoot ?? "—"}
          </dd>
          <dt>配置文件</dt>
          <dd>{data?.configPath ?? "尚未初始化"}</dd>
          <dt>成员</dt>
          <dd>{data?.username ?? "—"}</dd>
          <dt>启用工具</dt>
          <dd>{data?.enabledAgents?.join("、") || "按团队配置"}</dd>
        </dl>
      </section>
      <section>
        <div className="sectionheading">
          <h2>提交身份</h2>
          {dirty && <span className="tag">有未保存修改</span>}
        </div>
        <p className="muted">
          姓名和邮箱同时填写，仅用于客户端的 Git 操作。留空沿用已有配置。
        </p>
        <label className="field">
          Git 提交名
          <input
            value={draft.authorName ?? ""}
            disabled={busy}
            placeholder="留空以沿用现有 Git 配置"
            onChange={(e) => update("authorName", e.target.value)}
          />
        </label>
        <label className="field">
          Git 提交邮箱
          <input
            type="email"
            value={draft.authorEmail ?? ""}
            disabled={busy}
            placeholder="name@example.com"
            onChange={(e) => update("authorEmail", e.target.value)}
          />
        </label>
        <details className="advanced">
          <summary>高级设置：网络与日志</summary>
          <label className="field">
            代理地址
            <input
              value={draft.proxy}
              disabled={busy}
              placeholder="留空以沿用系统环境代理"
              onChange={(e) => update("proxy", e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.verbose}
              disabled={busy}
              onChange={(e) => update("verbose", e.target.checked)}
            />
            详细日志
          </label>
          <p className="muted">
            代理不保存凭据，仅在后续操作中生效。界面语言：中文。
          </p>
        </details>
        <button className="primary" disabled={busy || !dirty} onClick={save}>
          保存设置
        </button>
      </section>
      <section>
        <h2>健康检查与反馈</h2>
        <p>检查工具、自动 hooks 和配置。导出后请审阅私人内容再分享。</p>
        <div className="buttons">
          <button disabled={busy || data?.state !== "ready"} onClick={diagnose}>
            运行诊断
          </button>
          <button disabled={busy} onClick={exportLogs}>
            导出日志
          </button>
        </div>
        {diagnosis && (
          <div className="diagnosis" role="status">
            <h3>{diagnosis.healthy ? "检查通过" : "发现需处理的问题"}</h3>
            <p>
              {diagnosis.healthy
                ? "当前检查未报告问题。"
                : "根据下面的检查项处理；修复后再次运行诊断。"}
            </p>
            <pre>{diagnosis.report || "未收到详细报告，请检查操作记录。"}</pre>
          </div>
        )}
      </section>
    </>
  );
}
