import React, { useState } from "react";
import type { Resource, Snapshot } from "@teamai-desktop/ipc-contract";
import { labels } from "./ui";
export function Resources({
  data,
  busy,
  show,
  onSync,
}: {
  data: Snapshot;
  busy: boolean;
  show: (r: Resource) => void;
  onSync: () => void;
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [source, setSource] = useState("all");
  const filtered = data.resources.filter(
    (r) =>
      (kind === "all" || r.type === kind) &&
      (source === "all" || r.source === source) &&
      `${r.name} ${r.type} ${labels[r.type] ?? ""} ${r.description ?? ""} ${(r.tools ?? []).join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const pending = data.resources.filter(
    (r) => r.deployment === "pending",
  ).length;
  return (
    <>
      <div className="workspace-summary">
        <strong>{data.resources.length} 个可用资源</strong>
        <span>{data.changes.length} 项本地变更</span>
        <span>
          {data.lastPull
            ? `最近同步 ${new Date(data.lastPull).toLocaleString()}`
            : "尚未同步到工具"}
        </span>
        {pending > 0 && (
          <button className="link" onClick={onSync}>
            {pending} 项待同步或核对 →
          </button>
        )}
      </div>
      <div className="toolbar">
        <input
          aria-label="搜索资源"
          placeholder="按名称、用途或工具搜索…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="资源类型"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">所有类型</option>
          {[...new Set(data.resources.map((r) => r.type))].map((t) => (
            <option key={t} value={t}>
              {labels[t] ?? t}
            </option>
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
              <span className="tag">{labels[r.type] ?? r.type}</span>
              <span className="source">
                {r.source === "repo" ? "团队" : "本地"}
              </span>
            </div>
            <h3>{r.name}</h3>
            <p>
              {r.description ||
                (r.type === "mcp"
                  ? "查看服务配置"
                  : "暂无用途说明，打开详情查看正文")}
            </p>
            <div className="resource-status">
              {r.readError
                ? "详情读取有问题"
                : labels[r.deployment ?? "unknown"]}
              {r.tools?.length ? ` · ${r.tools.join("、")}` : ""}
            </div>
            <span className="cardarrow">查看详情 →</span>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty compact">
          <h2>没有匹配的资源</h2>
          <p>调整搜索或筛选条件，也可前往同步中心更新团队资源。</p>
          <button
            onClick={() => {
              setQuery("");
              setKind("all");
              setSource("all");
            }}
          >
            清除筛选
          </button>
        </div>
      )}
      <p className="muted resource-note">
        部署标记仅核对技能正文与当前配置目标；其他类型及附件状态请通过同步预检核对。
      </p>
    </>
  );
}
