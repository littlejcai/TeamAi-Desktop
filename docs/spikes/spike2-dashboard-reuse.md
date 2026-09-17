# Spike②：dashboard 复用度评估（M0-4）

- 日期：2026-09-17
- 结论：**✅ 数据与聚合层高度可复用**——GUI 不应复用其 HTTP 服务与 HTML，而应直接 import 其聚合函数（已可经 `desktop-api.ts` 暴露），或消费其已带 CORS 的本地 JSON API。

## 三件套结构（上游 dashboard.ts / dashboard-collector.ts / dashboard-html.ts，共 2619 行）

```
events.jsonl (~/.teamai/dashboard/events.jsonl，单一数据源)
   │ fs.watch（200ms 防抖）+ PID 存活轮询（DASHBOARD_PID_CHECK_INTERVAL_MS）
   ▼
readEvents() ──▶ rebuildSessions() ──▶ DashboardSession[]
   │
   ├── GET /               HTML UI（getDashboardHtml，888 行内联前端）
   ├── GET /api/sessions   会话 JSON
   ├── GET /api/trends     日粒度趋势对比 JSON
   ├── GET /events         SSE 实时推送
   ├── GET /kb-report      知识库健康 HTML（viz.js generateReportHtml）
   └── GET /api/kb-summary 知识库摘要 JSON（30s TTL 缓存）
```

实测（隔离 HOME 启动 `dashboard --port 3799`）：服务器无需 init 即可启动；`/api/sessions` 空态返回 `[]`；`/api/trends` 返回结构化对比数据（sessionsEnded / successRate / avgPrompts / avgDurationMs / avgRequestCostMicros / cacheReadShare / correctionRate）；`/` 返回 200。响应带 `Access-Control-Allow-Origin: *`。

## 复用清单

### 直接复用（import，M2 知识与洞察页）

| 内核导出 | 用途 | GUI 页面 |
|---|---|---|
| `readEvents` / `rebuildSessions` | 事件 → 会话视图模型的全部逻辑（状态机、干预计数、工具归因） | 会话时间线 |
| `aggregateSessionMetrics` / `aggregateSessionInterventions` | 指标聚合 | 洞察面板 |
| `countInterventions` | 人工干预统计 | 干预指标 |
| `aggregateDailySessions` + `computeDailyStatsDelta` + `summarizeTrendWindow`（session-trends.ts） | 7 日趋势 / 环比 | 趋势图、digest |
| `scanTranscriptStop` / `readLastAssistantOutput` | 会话转写解析（脱敏管线） | 会话详情 |
| `getVizSummary` / `buildVizData` / `generateReportHtml`（viz.js） | 知识库健康度聚合 | 知识面板 |

### 复用数据、替换实现

| 上游实现 | GUI 方案 |
|---|---|
| `dashboard-html.ts`（888 行内联 HTML/CSS/JS） | 不复用——React 原生重写，仅对齐其信息架构：连接状态 / 统计卡 / 会话列表 / 趋势栅格 |
| HTTP 服务器 + SSE（dashboard.ts） | 不需要独立端口服务——主进程直接 import 聚合函数 + `fs.watch` 同款防抖推 Renderer；SSE 仅在"GUI 不启动、浏览器看 dashboard"并存场景保留原命令 |

### 数据源事实（GUI 依赖）

- 唯一事件文件：`~/.teamai/dashboard/events.jsonl`（hooks 追加，`compactEvents` 压缩）
- 会话/趋势数据也存在于团队仓库 `teamai-reports` 孤儿分支（成员状态跨机可见，M3 门户可读）
- PID 存活检测依赖 `pid-monitor.ts`（Windows 有平台分支，GUI 常驻进程可复用同机制标记会话结束）

## 行动项

1. M2-403/404 前把 `readEvents/rebuildSessions/aggregate*` 经 `desktop-api.ts` 导出（预计 10 行 re-export）；
2. GUI 主进程注册 `fs.watch(eventsPath)` 同款 200ms 防抖，向 Renderer 推增量；
3. digest 页复用 `summarizeTrendWindow` 输出结构，避免自定义指标口径。
