export type RunMode =
  | { kind: "goal"; condition: string }
  | { kind: "task"; task: string }
  | { kind: "continue" };

export type PermissionPosture = "safe" | "yolo";

export type InteractivePermission = "auto" | "safe" | "normal";

export type Verdict = "done" | "rate_limited" | "error" | "unknown";

export type LimitWindow = "five_hour" | "seven_day" | "unknown";

export type WebhookFormat = "ntfy" | "pushover" | "telegram" | "slack" | "generic";

export type RunStatus = "running" | "sleeping" | "done" | "failed" | "stopped";

export interface ClaudeResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  json?: unknown; // parsed --output-format json object, when present
}

export interface ClassifyResult {
  verdict: Verdict;
  reason: string;
  resetsAt?: number; // unix epoch seconds, only when a structured value was available
  limitWindow?: LimitWindow;
  sessionId?: string;
}

export interface Config {
  permissions: { default: PermissionPosture };
  interactive: { permissions: InteractivePermission };
  notify: {
    local: boolean;
    webhook: { url: string | null; format: WebhookFormat };
  };
  guards: {
    maxCycles: number;
    maxWallClockHours: number;
    weeklyLimitBehavior: "stop" | "wait";
  };
  pollRetry: { initialSeconds: number; maxSeconds: number; factor: number };
}

export interface RunState {
  id: string;
  mode: RunMode;
  cwd: string;
  sessionId: string | null;
  status: RunStatus;
  nextWakeAt: number | null; // unix epoch seconds
  cycle: number;
  startedAt: number; // unix epoch seconds
  lastVerdict: Verdict | null;
  lastReason: string | null;
}
