import { nextWaitSeconds, type Clock } from "../scheduler.js";
import { notify, type Notifier } from "../notify.js";
import type { Config } from "../types.js";
import type { LimitDetector } from "./limit-detector.js";
import type { PresenceTracker } from "./presence.js";

export type ControllerState = "pass_through" | "waiting" | "resuming";

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
    const blocked = this.deps.detector.push(chunk);
    if (blocked && this.state === "pass_through") {
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
      await clock.sleep(nextWaitSeconds({ attempt, now: clock.now(), config }));

      this.state = "resuming";
      this.progressed = false;
      detector.reset();

      if (!presence.isIdle(idle, clock.now())) {
        await notify({ type: "sleeping", message: "Window reopened — press Enter to continue." }, config, { notifier });
        await this.waitForUser();
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
