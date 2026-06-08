// Strip CSI/OSC ANSI escape sequences so banner matching is robust to colors/cursor moves.
export function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}

// Provisional banner patterns, anchored to the real Claude limit banner
// ("You've hit your <session|weekly|Opus> limit · resets <time>"). Kept tight so the
// detector does not false-trigger on the model's own output (which flows through here in
// interactive mode). The real-limit spike confirms/extends these.
const LIMIT_PATTERNS: RegExp[] = [
  /you['']?ve hit your\b[^.\n]*\blimit\b/i,                 // "You've hit your <x> limit"
  /\blimit\b[^.\n]{0,40}·[^.\n]{0,40}\breset/i,             // "... limit · resets ..."
  /\b(usage|rate|session|weekly)\b[^.\n]{0,40}\blimit\b[^.\n]{0,20}\b(reached|exceeded)\b/i,
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
