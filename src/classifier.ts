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

function readBool(json: unknown, key: string): boolean | undefined {
  const o = asRecord(json);
  const v = o?.[key];
  return typeof v === "boolean" ? v : undefined;
}

function readString(json: unknown, key: string): string | undefined {
  const o = asRecord(json);
  const v = o?.[key];
  return typeof v === "string" ? v : undefined;
}

export function classify(result: ClaudeResult): ClassifyResult {
  const sessionId = readSessionId(result.json);
  const isError = readBool(result.json, "is_error");
  const subtype = readString(result.json, "subtype");

  // A clean JSON result (is_error false / subtype "success") is DONE regardless of
  // limit-related words in the model's answer text. --output-format json puts that
  // answer in `result` on stdout, so we must NOT text-scan stdout — only stderr.
  const jsonSuccess = isError === false || subtype === "success";

  const rateLimited =
    !jsonSuccess &&
    (looksRateLimitedJson(result.json) ||
      GENERIC_LIMIT_RE.test(result.stderr) ||
      WEEKLY_RE.test(result.stderr) ||
      FIVE_HOUR_RE.test(result.stderr));

  if (rateLimited) {
    return {
      verdict: "rate_limited",
      reason: "usage limit detected",
      resetsAt: readResetsAt(result.json),
      limitWindow: detectWindow(result.stderr),
      sessionId,
    };
  }
  if (jsonSuccess) {
    return { verdict: "done", reason: "clean exit", sessionId };
  }
  if (isError === true) {
    return { verdict: "error", reason: subtype ?? "claude reported is_error", sessionId };
  }
  if (result.exitCode === 0) {
    return { verdict: "done", reason: "clean exit", sessionId };
  }
  return { verdict: "error", reason: `non-zero exit (${result.exitCode})`, sessionId };
}
