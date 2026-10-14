export interface Preferences {
  proxy: string;
  verbose: boolean;
  authorName?: string;
  authorEmail?: string;
}
export interface Resource {
  id: string;
  name: string;
  type: string;
  source: "repo" | "local";
  status?: string;
  description?: string;
  deployment?: "current" | "pending" | "local" | "unknown";
  tools?: string[];
  readError?: string;
}
export interface Snapshot {
  state: "ready" | "uninitialized";
  resources: Resource[];
  changes: Resource[];
  context: {
    scope: "user" | "project";
    projectRoot: string;
    targetRoot?: string;
  };
  review: string;
  preferences?: Preferences;
  remote?: string;
  username?: string;
  role?: string;
  configPath?: string;
  needsMigration?: boolean;
  enabledAgents?: string[];
  namespaces?: string[];
  lastPull?: string | null;
  lastPush?: string | null;
  git?: { ahead: number; behind: number; modified: string[]; error?: string };
}
export interface Inspection {
  inspection: string;
  provider?: string;
  roles: { id: string; description: string; resources: { skills: string[] } }[];
  projects: { id: string; name?: string }[];
}
export interface Environment {
  git: boolean;
  gh: boolean;
  githubAuthenticated: boolean;
  tools: string[];
}
export interface PlanEntry {
  type: string;
  scope: string;
  count: number;
  added?: string[];
  updated?: string[];
}
export interface Preview {
  preview: string;
  plan: PlanEntry[];
  snapshot: Snapshot;
}
export interface Outcome {
  status: "review-required" | "review-open" | "unknown";
  records: { branch: string; prUrl: string | null }[];
}
export interface Detail {
  content: string;
  body?: string;
  description?: string;
  warning?: string;
  before?: string | null;
  diff?: { value: string; added?: boolean; removed?: boolean }[] | null;
}
export interface Doctor {
  healthy: boolean;
  report: string;
}
export type Request =
  | { action: "copyText"; text: string }
  | {
      action:
        | "environment"
        | "snapshot"
        | "selectProject"
        | "doctor"
        | "exportLogs";
    }
  | { action: "preferences"; preferences: Preferences }
  | { action: "setScope"; scope: "user" | "project" }
  | { action: "detail"; id: string }
  | { action: "inspect"; repo: string }
  | {
      action: "init";
      inspection: string;
      role: string;
      projects: string[];
      agents: ("claude" | "codex" | "cursor" | "codebuddy" | "opencode")[];
      confirmed: true;
    }
  | { action: "preview"; confirmed: true }
  | { action: "pull"; preview: string; confirmed: true }
  | { action: "push"; review: string; namespace: string; confirmed: true }
  | { action: "openUrl"; url: string };
export type Result<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        action?: string;
        outcome?: Outcome;
      };
    };
export const request: unknown;
export const snapshot: unknown;
export const resource: unknown;
