import { nextWaitSeconds, type Clock } from "../scheduler.js";
import { notify, type Notifier } from "../notify.js";
import type { Config } from "../types.js";
import { stripAnsi, type LimitDetector } from "./limit-detector.js";
import { parseResetEpochSeconds } from "./reset-parser.js";
import type { PresenceTracker } from "./presence.js";

export type ControllerState = "pass_through" | "waiting" | "resuming";

// Paid-usage prompts limitless must NEVER auto-confirm. A bare injected Enter landing on one
// of these is exactly how a blind "continue\r" turned on extra usage during the real-limit
// test. If any of these is on screen at resume time we step back and hand control to the user.
export const PAID_PROMPT_PATTERNS: RegExp[] = [
  /usage credit/i,
  /extra usage/i,
  /usage-credits/i,
  /switch to usage credits/i,
  /continuing with usage credits/i,
];

// A benign interactive menu is focused (e.g. the native rate-limit "Stop and wait / Upgrade"
// chooser). Pressing Enter blindly would confirm whatever option is highlighted, so we send
// Esc ("· Esc to cancel") to dismiss it back to the prompt before typing `continue`.
export const MENU_FOCUS_PATTERNS: RegExp[] = [
  /enter to confirm[^\n]*esc to cancel/i,
  /stop and wait for limit to reset/i,
  /upgrade your plan/i,
];

const RECENT_OUTPUT_TAIL = 4000;

export interface ControllerEffects {
  write(data: string): void; // inject into the pty
  relaunch(args: string[]): void; // relaunch claude in the pty
}

export interface ControllerDeps {
  detector: LimitDetector;
  presence: PresenceTracker;
  clock: Clock;
  config: Config;
  notifier: Notifier;
  effects: ControllerEffects;
  idleThresholdSeconds?: number;
  maxInjectAttempts?: number;
  verifySeconds?: number;
}

export class ResumeController {
  private state: ControllerState = "pass_through";
  private progressed = false;
  private awaitingUser = false;
  private userResume?: () => void;
  private recentOutput = ""; // ANSI-stripped rolling tail, for the billing-safety guard
  private resetsAt?: number; // reset epoch parsed from the banner, when available

  constructor(private deps: ControllerDeps) {}

  getState(): ControllerState {
    return this.state;
  }

  onInput(data: string): void {
    this.deps.presence.recordInput(this.deps.clock.now());
    if (this.awaitingUser && data.includes("\r")) this.userResume?.();
  }

  onOutput(chunk: string): void {
    if (this.state === "resuming" && chunk.trim().length > 0) this.progressed = true;
    this.recentOutput = (this.recentOutput + stripAnsi(chunk)).slice(-RECENT_OUTPUT_TAIL);
    const blocked = this.deps.detector.push(chunk);
    if (blocked && this.state === "pass_through") {
      this.resetsAt = parseResetEpochSeconds(this.recentOutput, this.deps.clock.now());
      this.state = "waiting";
      void this.runResume();
    }
  }

  private async runResume(): Promise<void> {
    const { clock, config, notifier, effects, detector, presence } = this.deps;
    const idle = this.deps.idleThresholdSeconds ?? 30;
    const maxAttempts = this.deps.maxInjectAttempts ?? 3;
    const verify = this.deps.verifySeconds ?? 5;

    await notify({ type: "sleeping", message: "Hit the usage limit — waiting for the window to reopen." }, config, { notifier });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Honor the banner's reset timestamp on the first wait so we wake at the *real* reset
      // (not a 60s backoff). Once consumed, later attempts fall back to poll-retry backoff.
      await clock.sleep(nextWaitSeconds({ attempt, now: clock.now(), config, resetsAt: this.resetsAt }));
      this.resetsAt = undefined;

      this.state = "resuming";
      this.progressed = false;
      detector.reset();

      // Billing safety: never auto-confirm a paid-usage prompt. If one is on screen, step
      // back entirely and let the user decide — limitless does not spend money for you.
      if (PAID_PROMPT_PATTERNS.some((re) => re.test(this.recentOutput))) {
        await notify(
          { type: "sleeping", message: "Paused: a paid-usage prompt is on screen. limitless will not auto-confirm it — resolve it yourself." },
          config,
          { notifier },
        );
        this.state = "pass_through";
        return;
      }

      if (!presence.isIdle(idle, clock.now())) {
        await notify({ type: "sleeping", message: "Window reopened — press Enter to continue." }, config, { notifier });
        await this.waitForUser();
      }

      // A benign menu may still be focused — dismiss it with Esc rather than confirming an
      // option with a blind Enter, then type `continue` into the normal prompt.
      if (MENU_FOCUS_PATTERNS.some((re) => re.test(this.recentOutput))) {
        effects.write("\x1b");
      }
      effects.write("continue\r");

      // NOTE (spike): if the real PTY raw-echoes the injected "continue", that echo could
      // set `progressed` before Claude actually responds. Self-corrects — a still-blocked
      // session re-emits the banner and re-triggers runResume. Confirm against a real limit.
      await clock.sleep(verify);
      if (this.progressed) {
        await notify({ type: "resumed", message: "Resumed." }, config, { notifier });
        this.state = "pass_through";
        return;
      }
      this.state = "waiting";
    }

    await notify({ type: "resumed", message: "Resuming via relaunch (--continue)." }, config, { notifier });
    effects.relaunch(["--continue"]);
    this.state = "pass_through";
  }

  private waitForUser(): Promise<void> {
    this.awaitingUser = true;
    return new Promise((resolve) => {
      this.userResume = () => {
        this.awaitingUser = false;
        this.userResume = undefined;
        resolve();
      };
    });
  }
}
