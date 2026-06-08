import { describe, it, expect } from "vitest";
import { createPresenceTracker } from "../../src/interactive/presence.js";

describe("presence tracker", () => {
  it("is idle before any input", () => {
    const p = createPresenceTracker();
    expect(p.isIdle(30, 1000)).toBe(true);
  });

  it("is not idle right after input", () => {
    const p = createPresenceTracker();
    p.recordInput(1000);
    expect(p.isIdle(30, 1010)).toBe(false); // 10s elapsed < 30s threshold
  });

  it("becomes idle once the threshold passes", () => {
    const p = createPresenceTracker();
    p.recordInput(1000);
    expect(p.isIdle(30, 1031)).toBe(true); // 31s elapsed > 30s threshold
  });
});
