import { randomUUID } from "node:crypto";
import os from "node:os";
import { loadConfig } from "./config.js";
import { listRunStates } from "./state.js";
import { runLoop } from "./runner.js";
import { spawnClaude } from "./claude.js";
import { systemClock } from "./scheduler.js";
import { macNotifier } from "./notify.js";
import type { PermissionPosture, RunMode } from "./types.js";

export interface ParsedArgs {
  command: "run" | "status" | "config";
  mode?: RunMode;
  postureOverride?: PermissionPosture;
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv[0] === "status") return { command: "status" };
  if (argv[0] === "config") return { command: "config" };

  const postureOverride = argv.includes("--yolo")
    ? "yolo"
    : argv.includes("--safe")
      ? "safe"
      : undefined;

  const goalIdx = argv.indexOf("--goal");
  let mode: RunMode;
  if (goalIdx !== -1) {
    mode = { kind: "goal", condition: argv[goalIdx + 1] ?? "" };
  } else if (argv.includes("--continue")) {
    mode = { kind: "continue" };
  } else {
    const positional = argv.find((a) => !a.startsWith("--"));
    mode = { kind: "task", task: positional ?? "" };
  }
  return { command: "run", mode, postureOverride };
}

export async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);
  const config = loadConfig();

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
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const posture = parsed.postureOverride ?? config.permissions.default;
  const state = await runLoop(parsed.mode!, {
    claude: spawnClaude,
    clock: systemClock,
    config,
    home: os.homedir(),
    notifier: macNotifier,
    posture,
    genId: () => randomUUID().slice(0, 8),
  });
  process.exitCode = state.status === "done" ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main(process.argv.slice(2));
}
