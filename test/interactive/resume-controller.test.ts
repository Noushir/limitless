import { describe, it, expect, vi } from "vitest";
import { ResumeController } from "../../src/interactive/resume-controller.js";
import { createPresenceTracker } from "../../src/interactive/presence.js";
import { createLimitDetector } from "../../src/interactive/limit-detector.js";
import { DEFAULT_CONFIG } from "../../src/config.js";
import type { Clock } from "../../src/scheduler.js";

const fakeClock = (): Clock => ({ now: () => 1000, sleep: vi.fn(async () => {}) });
const settle = () => new Promise((r) => setTimeout(r, 0));

function makeController(overrides: Partial<{ idle: boolean }> = {}) {
  const writes: string[] = [];
  const relaunches: string[][] = [];
  const presence = createPresenceTracker();
  if (!overrides.idle) presence.recordInput(1000); // "present" unless idle requested
  const controller = new ResumeController({
    detector: createLimitDetector(),
    presence,
    clock: fakeClock(),
    config: DEFAULT_CONFIG,
    notifier: { send: vi.fn(async () => {}) },
    effects: {
      write: (d) => writes.push(d),
      relaunch: (a) => relaunches.push(a),
    },
    idleThresholdSeconds: 30,
    maxInjectAttempts: 2,
    verifySeconds: 1,
  });
  return { controller, writes, relaunches };
}

describe("ResumeController", () => {
  it("starts in pass_through", () => {
    expect(makeController().controller.getState()).toBe("pass_through");
  });

  it("when idle, injects 'continue' and returns to pass_through once output progresses", async () => {
    const { controller, writes } = makeController({ idle: true });
    controller.onOutput("You've hit your usage limit · resets 3pm");
    await settle();
    controller.onOutput("Sure, continuing the task...\n");
    await settle();
    await settle();
    expect(writes).toContain("continue\r");
    expect(controller.getState()).toBe("pass_through");
  });

  it("falls back to relaunch --continue when injection never progresses", async () => {
    const { controller, relaunches } = makeController({ idle: true });
    controller.onOutput("You've hit your usage limit · resets 3pm"); // block
    for (let i = 0; i < 6; i++) await settle();
    expect(relaunches).toEqual([["--continue"]]);
    expect(controller.getState()).toBe("pass_through");
  });
});
