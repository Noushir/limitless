import { randomUUID } from "node:crypto";
import os from "node:os";
import { loadConfig } from "./config.js";
import { listRunStates } from "./state.js";
import { runLoop } from "./runner.js";
import { spawnClaude } from "./claude.js";
import { systemClock } from "./scheduler.js";
import { macNotifier } from "./notify.js";
import { runInteractive } from "./interactive/run.js";
import type { InteractivePermission, PermissionPosture, RunMode } from "./types.js";

export interface HeadlessIntent {
  mode: RunMode;
  postureOverride?: PermissionPosture;
}

export interface ParsedArgs {
  command: "interactive" | "headless" | "status" | "config";
  adopt?: boolean;
  posture?: InteractivePermission;
  passthrough?: string[];
  headless?: HeadlessIntent;
}

function parseHeadless(argv: string[]): HeadlessIntent {
  const postureOverride = argv.includes("--yolo") ? "yolo" : argv.includes("--safe") ? "safe" : undefined;
  const goalIdx = argv.indexOf("--goal");
  let mode: RunMode;
  if (goalIdx !== -1) mode = { kind: "goal", condition: argv[goalIdx + 1] ?? "" };
  else if (argv.includes("--continue")) mode = { kind: "continue" };
  else mode = { kind: "task", task: argv.find((a) => !a.startsWith("--")) ?? "" };
  return { mode, postureOverride };
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv[0] === "status") return { command: "status" };
  if (argv[0] === "config") return { command: "config" };
  if (argv[0] === "headless") return { command: "headless", headless: parseHeadless(argv.slice(1)) };

  const adopt = argv[0] === "resume";
  const rest = adopt ? argv.slice(1) : argv;
  const dashDash = rest.indexOf("--");
  const passthrough = dashDash !== -1 ? rest.slice(dashDash + 1) : undefined;
  const flags = dashDash !== -1 ? rest.slice(0, dashDash) : rest;
  const posture: InteractivePermission | undefined = flags.includes("--safe")
    ? "safe"
    : flags.includes("--normal")
      ? "normal"
      : flags.includes("--auto")
        ? "auto"
        : undefined;
  return { command: "interactive", adopt, posture, passthrough };
}

export async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);

  if (parsed.command === "status") {
    const runs = listRunStates();
    if (runs.length === 0) { console.log("No runs yet."); return; }
    for (const r of runs) {
      const when = r.nextWakeAt ? ` (resumes ${new Date(r.nextWakeAt * 1000).toLocaleTimeString()})` : "";
      console.log(`${r.id}  ${r.status}${when}  ${r.mode.kind}  cycle=${r.cycle}`);
    }
    return;
  }
  if (parsed.command === "config") {
    console.log(JSON.stringify(loadConfig(), null, 2));
    return;
  }
  if (parsed.command === "headless") {
    const config = loadConfig();
    const h = parsed.headless!;
    const posture = h.postureOverride ?? config.permissions.default;
    const state = await runLoop(h.mode, {
      claude: spawnClaude,
      clock: systemClock,
      config,
      home: os.homedir(),
      notifier: macNotifier,
      posture,
      genId: () => randomUUID().slice(0, 8),
    });
    process.exitCode = state.status === "done" ? 0 : 1;
    return;
  }
  runInteractive({ adopt: parsed.adopt ?? false, posture: parsed.posture, passthrough: parsed.passthrough });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main(process.argv.slice(2));
}
