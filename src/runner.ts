import { classify } from "./classifier.js";
import { nextWaitSeconds, type Clock } from "./scheduler.js";
import { buildStartArgs, buildResumeArgs } from "./mode.js";
import { notify, type Notifier } from "./notify.js";
import { saveRunState } from "./state.js";
import type { Config, PermissionPosture, RunMode, RunState } from "./types.js";
import type { ClaudeRunner } from "./claude.js";

export interface RunnerDeps {
  claude: ClaudeRunner;
  clock: Clock;
  config: Config;
  home: string;
  notifier: Notifier;
  posture: PermissionPosture;
  genId(): string;
}

const ERROR_RETRY_LIMIT = 3;

export async function runLoop(mode: RunMode, deps: RunnerDeps): Promise<RunState> {
  const { claude, clock, config, home, notifier, posture } = deps;
  const startedAt = clock.now();
  const state: RunState = {
    id: deps.genId(),
    mode,
    cwd: process.cwd(),
    sessionId: null,
    status: "running",
    nextWakeAt: null,
    cycle: 0,
    startedAt,
    lastVerdict: null,
    lastReason: null,
  };

  const emit = (type: Parameters<typeof notify>[0]["type"], message: string) =>
    notify({ type, message }, config, { notifier });
  const persist = () => saveRunState(state, home);
  const maxWallSeconds = config.guards.maxWallClockHours * 3600;

  persist();
  await emit("started", `Started: ${describeMode(mode)}`);

  let args = buildStartArgs(mode, posture);
  let errorRetries = 0;

  while (true) {
    const result = await claude.run(args, state.cwd);
    const verdict = classify(result);
    state.lastVerdict = verdict.verdict;
    state.lastReason = verdict.reason;
    if (verdict.sessionId) state.sessionId = verdict.sessionId;

    if (verdict.verdict === "done") {
      state.status = "done";
      persist();
      await emit("finished", "✅ Task finished.");
      return state;
    }

    if (verdict.verdict === "rate_limited") {
      if (verdict.limitWindow === "seven_day" && config.guards.weeklyLimitBehavior === "stop") {
        state.status = "stopped";
        persist();
        await emit("weekly_stopped", "⏳ Weekly limit reached — stopping (set weeklyLimitBehavior=wait to wait it out).");
        return state;
      }
      state.cycle += 1;
      if (state.cycle >= config.guards.maxCycles || clock.now() - startedAt > maxWallSeconds) {
        state.status = "failed";
        persist();
        await emit("failed", `❌ Hit guard limit after ${state.cycle} cycles.`);
        return state;
      }
      const waitS = nextWaitSeconds({
        resetsAt: verdict.resetsAt,
        attempt: state.cycle,
        now: clock.now(),
        config,
      });
      state.status = "sleeping";
      state.nextWakeAt = clock.now() + waitS;
      persist();
      await emit("sleeping", `Hit limit — waiting ~${Math.round(waitS / 60)} min (cycle ${state.cycle}).`);
      await clock.sleep(waitS);
      state.status = "running";
      persist();
      await emit("resumed", "Resuming…");
      args = buildResumeArgs(state.sessionId, posture);
      errorRetries = 0;
      continue;
    }

    // error / unknown
    errorRetries += 1;
    if (errorRetries > ERROR_RETRY_LIMIT) {
      state.status = "failed";
      persist();
      await emit("failed", `❌ Failed: ${verdict.reason}`);
      return state;
    }
    await clock.sleep(nextWaitSeconds({ attempt: errorRetries, now: clock.now(), config }));
    args = buildResumeArgs(state.sessionId, posture);
  }
}

function describeMode(mode: RunMode): string {
  if (mode.kind === "goal") return `goal "${mode.condition}"`;
  if (mode.kind === "task") return `task "${mode.task}"`;
  return "continue previous session";
}
