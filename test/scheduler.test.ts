import { describe, it, expect } from "vitest";
import { nextWaitSeconds } from "../src/scheduler.js";
import { DEFAULT_CONFIG } from "../src/config.js";

const cfg = DEFAULT_CONFIG;

describe("nextWaitSeconds", () => {
  it("waits until resetsAt plus margin when known", () => {
    const now = 1000;
    const resetsAt = 1000 + 300;
    expect(nextWaitSeconds({ resetsAt, attempt: 1, now, config: cfg, marginSeconds: 30 }))
      .toBe(330);
  });

  it("never returns negative when resetsAt is in the past", () => {
    const w = nextWaitSeconds({ resetsAt: 500, attempt: 1, now: 1000, config: cfg, marginSeconds: 30 });
    expect(w).toBe(30);
  });

  it("backs off exponentially without resetsAt", () => {
    expect(nextWaitSeconds({ attempt: 1, now: 0, config: cfg })).toBe(60);
    expect(nextWaitSeconds({ attempt: 2, now: 0, config: cfg })).toBe(120);
    expect(nextWaitSeconds({ attempt: 3, now: 0, config: cfg })).toBe(240);
  });

  it("caps backoff at maxSeconds", () => {
    expect(nextWaitSeconds({ attempt: 20, now: 0, config: cfg })).toBe(cfg.pollRetry.maxSeconds);
  });
});
