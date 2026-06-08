import os from "node:os";
import { loadConfig } from "../config.js";
import { systemClock } from "../scheduler.js";
import { macNotifier } from "../notify.js";
import { createPtyHost } from "./host.js";
import { createPresenceTracker } from "./presence.js";
import { createLimitDetector } from "./limit-detector.js";
import { ResumeController } from "./resume-controller.js";
import { wireSession } from "./session.js";
import { buildInteractiveArgs, postureBanner, passthroughEscalates } from "./args.js";
import type { InteractivePermission } from "../types.js";

export interface RunInteractiveOptions {
  adopt: boolean;
  posture?: InteractivePermission;
  passthrough?: string[];
}

export function runInteractive(opts: RunInteractiveOptions): void {
  const config = loadConfig();
  const posture = opts.posture ?? config.interactive.permissions;
  const args = buildInteractiveArgs({ adopt: opts.adopt, posture, passthrough: opts.passthrough });

  process.stderr.write(postureBanner(posture) + "\n");
  if (passthroughEscalates(posture, opts.passthrough)) {
    process.stderr.write("limitless: warning — a permission flag in your passthrough overrides the chosen posture.\n");
  }

  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const host = createPtyHost("claude", args, { cols, rows, cwd: process.cwd(), env: process.env as Record<string, string> });

  const controller = new ResumeController({
    detector: createLimitDetector(),
    presence: createPresenceTracker(),
    clock: systemClock,
    config,
    notifier: macNotifier,
    effects: { write: (d) => host.write(d), relaunch: (a) => host.relaunch(a) },
  });

  const sendInput = wireSession({ host, stdout: process.stdout, controller });

  const onInput = (d: string) => sendInput(d);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", onInput);

  const onResize = () => host.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24);
  process.stdout.on("resize", onResize);

  const teardown = () => {
    if (process.stdin.isTTY) { try { process.stdin.setRawMode(false); } catch {} }
    process.stdin.off("data", onInput);
    process.stdin.pause();
    process.stdout.off("resize", onResize);
  };

  process.on("SIGINT", () => { teardown(); host.kill(); process.exit(130); });

  host.onExit((code) => {
    teardown();
    process.exit(code ?? 0);
  });
}
