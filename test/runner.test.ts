import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runLoop } from "../src/runner.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { ClaudeResult, Config, RunMode } from "../src/types.js";
import type { ClaudeRunner } from "../src/claude.js";
import type { Clock } from "../src/scheduler.js";

let home: string;
beforeEach(() => (home = fs.mkdtempSync(path.join(os.tmpdir(), "limitless-run-"))));
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

function fakeClaude(queue: ClaudeResult[]): ClaudeRunner {
  return { run: async () => queue.shift() ?? { exitCode: 0, stdout: "", stderr: "" } };
}
const fakeClock = (): Clock => ({ now: () => 1000, sleep: vi.fn(async () => {}) });
const deps = (claude: ClaudeRunner, clock: Clock, config: Config = DEFAULT_CONFIG) => ({
  claude, clock, config, home,
  notifier: { send: vi.fn(async () => {}) },
  genId: () => "run-1",
  posture: "safe" as const,
});
const goal: RunMode = { kind: "goal", condition: "tests pass" };

describe("runLoop", () => {
  it("finishes immediately on a clean exit", async () => {
    const clock = fakeClock();
    const state = await runLoop(goal, deps(fakeClaude([{ exitCode: 0, stdout: "{}", stderr: "" }]), clock));
    expect(state.status).toBe("done");
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("waits then resumes after a rate limit, then finishes", async () => {
    const clock = fakeClock();
    const claude = fakeClaude([
      { exitCode: 1, stdout: "", stderr: "You've hit your session limit · resets 3:45pm" },
      { exitCode: 0, stdout: '{"session_id":"s-1"}', stderr: "" },
    ]);
    const state = await runLoop(goal, deps(claude, clock));
    expect(clock.sleep).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("done");
    expect(state.cycle).toBe(1);
  });

  it("stops on a weekly limit when behavior is stop", async () => {
    const clock = fakeClock();
    const cfg: Config = { ...DEFAULT_CONFIG, guards: { ...DEFAULT_CONFIG.guards, weeklyLimitBehavior: "stop" } };
    const claude = fakeClaude([
      { exitCode: 1, stdout: "", stderr: "You've hit your weekly limit · resets Mon" },
    ]);
    const state = await runLoop(goal, deps(claude, clock, cfg));
    expect(state.status).toBe("stopped");
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("gives up after maxCycles consecutive limits", async () => {
    const clock = fakeClock();
    const cfg: Config = { ...DEFAULT_CONFIG, guards: { ...DEFAULT_CONFIG.guards, maxCycles: 2 } };
    const limit: ClaudeResult = { exitCode: 1, stdout: "", stderr: "usage limit reached, resets at 3pm" };
    const state = await runLoop(goal, deps(fakeClaude([limit, limit, limit, limit]), clock, cfg));
    expect(state.status).toBe("failed");
    expect(state.cycle).toBe(2);
  });

  it("persists the final state to disk", async () => {
    const state = await runLoop(goal, deps(fakeClaude([{ exitCode: 0, stdout: "{}", stderr: "" }]), fakeClock()));
    const saved = JSON.parse(fs.readFileSync(path.join(home, ".limitless", "runs", "run-1.json"), "utf8"));
    expect(saved.status).toBe("done");
    expect(state.id).toBe("run-1");
  });
});
