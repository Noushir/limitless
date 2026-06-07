import type { ClaudeResult, ClassifyResult, LimitWindow } from "./types.js";

// Markers refined by the Task 12 spike. Order matters: weekly before generic.
const WEEKLY_RE = /\b(weekly|seven[- ]?day|7[- ]?day)\b.*\blimit\b/i;
const FIVE_HOUR_RE = /\b(session|5[- ]?hour|five[- ]?hour|usage)\b.*\blimit\b/i;
const GENERIC_LIMIT_RE = /\b(usage|rate)\b.*\blimit\b|limit (reached|exceeded)|resets? (at|in)/i;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function readSessionId(json: unknown): string | undefined {
  const o = asRecord(json);
  const v = o?.["session_id"];
  return typeof v === "string" ? v : undefined;
}

function readResetsAt(json: unknown): number | undefined {
  const o = asRecord(json);
  const v = o?.["resets_at"];
  return typeof v === "number" ? v : undefined;
}

function looksRateLimitedJson(json: unknown): boolean {
  const o = asRecord(json);
  const subtype = o?.["subtype"];
  const err = o?.["error"];
  return (
    (typeof subtype === "string" && /rate.?limit|usage.?limit/i.test(subtype)) ||
    (typeof err === "string" && GENERIC_LIMIT_RE.test(err)) ||
    typeof readResetsAt(json) === "number"
  );
}

function detectWindow(text: string): LimitWindow {
  if (WEEKLY_RE.test(text)) return "seven_day";
  if (FIVE_HOUR_RE.test(text)) return "five_hour";
  return "unknown";
}

export function classify(result: ClaudeResult): ClassifyResult {
  const text = `${result.stdout}\n${result.stderr}`;
  const sessionId = readSessionId(result.json);
  const rateLimited =
    looksRateLimitedJson(result.json) ||
    GENERIC_LIMIT_RE.test(text) ||
    WEEKLY_RE.test(text) ||
    FIVE_HOUR_RE.test(text);

  if (rateLimited) {
    return {
      verdict: "rate_limited",
      reason: "usage limit detected",
      resetsAt: readResetsAt(result.json),
      limitWindow: detectWindow(text),
      sessionId,
    };
  }
  if (result.exitCode === 0) {
    return { verdict: "done", reason: "clean exit", sessionId };
  }
  return {
    verdict: "error",
    reason: `non-zero exit (${result.exitCode})`,
    sessionId,
  };
}
