export interface Resource {
  id: string;
  name: string;
  type: string;
  source: "repo" | "local";
  status?: string;
}
export interface Snapshot {
  state: "ready" | "uninitialized";
  preferences?: { proxy: string; verbose: boolean };
  resources: Resource[];
  changes: Resource[];
  review: string;
  context: { scope: "user" | "project"; projectRoot: string };
  remote?: string;
  username?: string;
  role?: string;
  configPath?: string;
  needsMigration?: boolean;
  enabledAgents?: string[];
  roles?: {
    id: string;
    description: string;
    resources: { skills: string[] };
  }[];
  namespaces?: string[];
  git?: { ahead: number; behind: number; modified: string[]; error?: string };
  lastPull?: string | null;
  lastPush?: string | null;
}
export type Request =
  | { action: "preferences"; preferences: { proxy: string; verbose: boolean } }
  | {
      action:
        | "snapshot"
        | "selectProject"
        | "preview"
        | "doctor"
        | "exportLogs";
    }
  | { action: "setScope"; scope: "user" | "project" }
  | { action: "detail"; id: string }
  | { action: "inspect"; repo: string }
  | {
      action: "init";
      inspection: string;
      role: string;
      projects: string[];
      agents: string[];
      confirmed: true;
    }
  | { action: "pull"; preview: string; confirmed: true }
  | { action: "push"; review: string; namespace: string; confirmed: true }
  | { action: "openUrl"; url: string };
export type Result =
  | { ok: true; data: any }
  | { ok: false; error: { code: string; message: string } };
export const request: any;
export const snapshot: any;
export const resource: any;
