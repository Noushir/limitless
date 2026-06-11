import { describe, it, expect } from "vitest";
import { parseResetEpochSeconds, parseResetLabel } from "../../src/interactive/reset-parser.js";

// A fixed "now": 2026-06-10 20:53:00 UTC.
const NOW = Math.floor(Date.UTC(2026, 5, 10, 20, 53, 0) / 1000);

describe("parseResetEpochSeconds", () => {
  it("returns undefined when no reset time is present", () => {
    expect(parseResetEpochSeconds("You've hit your session limit", NOW)).toBeUndefined();
    expect(parseResetEpochSeconds("resets 3pm", NOW)).toBeUndefined(); // no h:mm form
  });

  it("parses the real banner (absolute time + IANA zone) to the next occurrence", () => {
    // 1:10am Europe/London. In June, London is BST (+1) → 00:10 UTC. Since 20:53 UTC is
    // before midnight, the next 1:10am London is the following calendar day.
    const epoch = parseResetEpochSeconds(
      "You've hit your session limit · resets 1:10am (Europe/London)",
      NOW,
    );
    expect(epoch).toBe(Math.floor(Date.UTC(2026, 5, 11, 0, 10, 0) / 1000));
    expect(epoch! - NOW).toBeGreaterThan(0);
  });

  it("handles 24h time and an explicit zone", () => {
    const epoch = parseResetEpochSeconds("resets 13:10 (Europe/London)", NOW);
    // 13:10 BST = 12:10 UTC, today (still ahead of 20:53? no — 12:10 < 20:53, so tomorrow).
    expect(epoch).toBe(Math.floor(Date.UTC(2026, 5, 11, 12, 10, 0) / 1000));
  });

  it("handles pm conversion", () => {
    const epoch = parseResetEpochSeconds("resets 9:30pm (Europe/London)", NOW);
    // 21:30 BST = 20:30 UTC, today (20:30 < 20:53 → tomorrow).
    expect(epoch).toBe(Math.floor(Date.UTC(2026, 5, 11, 20, 30, 0) / 1000));
  });

  it("parses a relative 'resets in Xh Ym' form", () => {
    expect(parseResetEpochSeconds("resets in 3h 21m", NOW)).toBe(NOW + 3 * 3600 + 21 * 60);
    expect(parseResetEpochSeconds("resets in 45m", NOW)).toBe(NOW + 45 * 60);
    expect(parseResetEpochSeconds("resets in 2h", NOW)).toBe(NOW + 2 * 3600);
  });

  it("falls back to host-local time when the zone is unknown", () => {
    // Unknown zone label → host-local interpretation; just assert it yields a future epoch.
    const epoch = parseResetEpochSeconds("resets 11:59pm (Mars/Olympus)", NOW);
    expect(epoch).toBeGreaterThan(NOW);
  });

  it("ignores malformed times", () => {
    expect(parseResetEpochSeconds("resets 25:99 (Europe/London)", NOW)).toBeUndefined();
  });
});

describe("parseResetLabel", () => {
  it("returns the human reset phrase from the real banner", () => {
    expect(parseResetLabel("You've hit your session limit · resets 1:10am (Europe/London)")).toBe(
      "1:10am (Europe/London)",
    );
  });

  it("returns the relative phrase", () => {
    expect(parseResetLabel("resets in 3h 21m")).toBe("in 3h 21m");
  });

  it("takes only the reset line, not trailing output", () => {
    expect(parseResetLabel("limit · resets 13:10 (Europe/London)\nStop and wait for limit to reset")).toBe(
      "13:10 (Europe/London)",
    );
  });

  it("returns undefined when no reset phrase is present", () => {
    expect(parseResetLabel("You've hit your session limit")).toBeUndefined();
  });
});
