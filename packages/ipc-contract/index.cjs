const { z } = require("zod");
const id = z.string().min(1).max(256);
const repo = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (v) =>
      /^https:\/\/[^\s]+$/.test(v) ||
      /^ssh:\/\/[^\s]+$/.test(v) ||
      /^[\w.-]+@[^\s:]+:[^\s]+$/.test(v),
    "使用 HTTPS 或 SSH Git 仓库地址",
  )
  .refine((v) => {
    if (v.includes("://")) {
      try {
        const u = new URL(v);
        return (
          !u.password &&
          !u.search &&
          !u.hash &&
          (u.protocol === "ssh:" || !u.username)
        );
      } catch {
        return false;
      }
    }
    return !v.split("@")[0].includes(":");
  }, "不要在仓库地址中嵌入凭据、查询参数或片段");
const preferences = z
  .object({
    proxy: z
      .string()
      .max(2048)
      .refine((v) => {
        if (!v) return true;
        try {
          const u = new URL(v);
          return (
            ["http:", "https:"].includes(u.protocol) &&
            !u.username &&
            !u.password &&
            !u.search &&
            !u.hash
          );
        } catch {
          return false;
        }
      }, "代理必须为不含凭据的 HTTP/HTTPS 地址"),
    verbose: z.boolean(),
    authorName: z
      .string()
      .max(100)
      .refine(
        (v) =>
          !Array.from(v).some((c) => [0, 10, 13].includes(c.charCodeAt(0))),
        "提交名不能包含控制字符",
      )
      .default(""),
    authorEmail: z
      .union([z.literal(""), z.string().email().max(254)])
      .default(""),
  })
  .strict()
  .refine(
    (v) => Boolean(v.authorName) === Boolean(v.authorEmail),
    "提交名和邮箱需要同时填写或同时留空",
  );
const segment = z
  .string()
  .max(100)
  .refine(
    (v) => !v || (/^[A-Za-z0-9._-]+$/.test(v) && ![".", ".."].includes(v)),
    "角色或命名空间必须为单一路径段",
  );
const request = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preferences"), preferences }).strict(),
  z.object({ action: z.literal("snapshot") }).strict(),
  z.object({ action: z.literal("selectProject") }).strict(),
  z
    .object({
      action: z.literal("setScope"),
      scope: z.enum(["user", "project"]),
    })
    .strict(),
  z.object({ action: z.literal("detail"), id }).strict(),
  z.object({ action: z.literal("inspect"), repo }).strict(),
  z
    .object({
      action: z.literal("init"),
      inspection: id,
      role: segment,
      projects: z.array(id).max(100),
      agents: z
        .array(z.enum(["claude", "codex", "cursor", "codebuddy", "opencode"]))
        .min(1),
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({ action: z.literal("preview"), confirmed: z.literal(true) })
    .strict(),
  z
    .object({
      action: z.literal("pull"),
      preview: id,
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("push"),
      review: id,
      namespace: segment,
      confirmed: z.literal(true),
    })
    .strict(),
  z.object({ action: z.literal("doctor") }).strict(),
  z.object({ action: z.literal("exportLogs") }).strict(),
  z
    .object({ action: z.literal("openUrl"), url: z.string().url().max(4096) })
    .strict(),
]);
const resource = z
  .object({
    id,
    name: z.string(),
    type: z.string(),
    source: z.enum(["repo", "local"]),
  })
  .strict();
const snapshot = z
  .object({
    state: z.enum(["ready", "uninitialized"]),
    resources: z.array(resource),
    changes: z.array(resource.extend({ status: z.string() })),
    context: z.object({
      scope: z.enum(["user", "project"]),
      projectRoot: z.string(),
    }),
    review: id,
  })
  .passthrough();
module.exports = { request, snapshot, resource, preferences };
