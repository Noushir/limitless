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
  const statuses: string[] = [];
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
      status: (t) => statuses.push(t),
    },
    idleThresholdSeconds: 30,
    maxInjectAttempts: 2,
    verifySeconds: 1,
  });
  return { controller, writes, relaunches, statuses };
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

  it("never injects when a paid-usage prompt is on screen — steps back to the user", async () => {
    const { controller, writes, relaunches } = makeController({ idle: true });
    controller.onOutput("You've hit your usage limit · resets 3pm\nContinuing with usage credits");
    for (let i = 0; i < 6; i++) await settle();
    expect(writes).not.toContain("continue\r");
    expect(writes).not.toContain("\x1b");
    expect(relaunches).toEqual([]); // must not relaunch into a paid prompt either
    expect(controller.getState()).toBe("pass_through");
  });

  it("dismisses a benign menu with Esc before typing continue (no blind Enter)", async () => {
    const { controller, writes } = makeController({ idle: true });
    controller.onOutput(
      "You've hit your usage limit · resets 3pm\nStop and wait for limit to reset\nEnter to confirm · Esc to cancel",
    );
    await settle();
    controller.onOutput("continuing the task...\n"); // progress after inject
    await settle();
    await settle();
    expect(writes).toContain("\x1b");
    expect(writes).toContain("continue\r");
    expect(writes.indexOf("\x1b")).toBeLessThan(writes.indexOf("continue\r"));
    expect(controller.getState()).toBe("pass_through");
  });

  it("dismisses the limit chooser immediately on detection (not hours later at reset)", () => {
    const { controller, writes } = makeController({ idle: true });
    controller.onOutput(
      "You've hit your usage limit · resets 1:10am (Europe/London)\nStop and wait for limit to reset\nEnter to confirm · Esc to cancel",
    );
    // Esc is sent synchronously in onOutput — the chooser is gone *during* the wait, not at
    // reset — and nothing is confirmed yet (continue comes only after the window reopens).
    expect(writes).toContain("\x1b");
    expect(writes).not.toContain("continue\r");
  });

  it("does not touch the chooser if a paid-usage prompt is also on screen", () => {
    const { controller, writes } = makeController({ idle: true });
    controller.onOutput(
      "You've hit your usage limit · resets 3pm\nStop and wait for limit to reset\nContinuing with usage credits",
    );
    expect(writes).not.toContain("\x1b"); // hands off entirely when money is in play
  });

  it("announces the wait with a branded status naming the reset time (no upgrade wording)", () => {
    const { controller, statuses } = makeController({ idle: true });
    controller.onOutput("You've hit your usage limit · resets 1:10am (Europe/London)");
    const all = statuses.join("");
    expect(all).toContain("limitless");
    expect(all).toContain("1:10am (Europe/London)");
    expect(all).not.toMatch(/upgrade/i);
  });

  it("announces continuing with a branded status when the window reopens", async () => {
    const { controller, statuses } = makeController({ idle: true });
    controller.onOutput("You've hit your usage limit · resets 3pm");
    await settle();
    controller.onOutput("continuing the task...\n"); // progress after inject
    await settle();
    await settle();
    expect(statuses.join("")).toMatch(/continuing your session/i);
  });

  it("when present, holds for the user's Enter before injecting", async () => {
    const { controller, writes } = makeController({ idle: false });
    controller.onOutput("You've hit your usage limit · resets 3pm"); // block
    await settle();
    await settle();
    // It is holding for the user — nothing injected yet.
    expect(writes).not.toContain("continue\r");
    expect(controller.getState()).toBe("resuming");

    controller.onInput("\r"); // user presses Enter
    controller.onOutput("continuing the task...\n"); // progress after inject
    await settle();
    await settle();
    await settle(); // allow verify-sleep and state transition to complete

    expect(writes).toContain("continue\r");
    expect(controller.getState()).toBe("pass_through");
  });
});
