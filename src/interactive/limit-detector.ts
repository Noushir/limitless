// Strip CSI/OSC ANSI escape sequences so banner matching is robust to colors/cursor moves.
export function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}

// Provisional banner patterns; confirmed/extended by the real-limit spike.
const LIMIT_PATTERNS: RegExp[] = [
  /\b(usage|rate|session|weekly|5[- ]?hour|seven[- ]?day)\b[^.\n]*\blimit\b/i,
  /limit (reached|exceeded)/i,
  /\bresets? (at|in)\b/i,
];

const MAX_BUFFER = 4000; // keep a rolling tail so a split banner still matches

export interface LimitDetector {
  push(chunk: string): boolean; // true the first time a banner is seen since the last reset
  reset(): void;
}

export function createLimitDetector(patterns: RegExp[] = LIMIT_PATTERNS): LimitDetector {
  let buffer = "";
  let latched = false;
  return {
    push(chunk) {
      buffer = (buffer + stripAnsi(chunk)).slice(-MAX_BUFFER);
      if (latched) return false;
      if (patterns.some((re) => re.test(buffer))) {
        latched = true;
        return true;
      }
      return false;
    },
    reset() {
      buffer = "";
      latched = false;
    },
  };
}
