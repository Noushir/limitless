import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";
import { loadConfig } from "./config.js";
import { listRunStates } from "./state.js";
import { runLoop } from "./runner.js";
import { spawnClaude } from "./claude.js";
import { systemClock } from "./scheduler.js";
import { macNotifier } from "./notify.js";
import { runInteractive } from "./interactive/run.js";
import type { InteractivePermission, PermissionPosture, RunMode } from "./types.js";

const require = createRequire(import.meta.url);
function readVersion(): string {
  try {
    return (require("../package.json") as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

const HELP_TEXT = `limitless — keep your Claude Code session going across usage-limit windows

Usage:
  limitless                          Launch Claude (interactive), wrapped by limitless
  limitless resume                   Adopt & continue the latest session in this dir
  limitless --safe | --auto | --normal   Interactive permission posture (default: safe)
  limitless -- <claude args>         Pass extra args through to claude
  limitless headless "<task>"        Unattended task runner
  limitless headless --goal "<cond>" Headless, completion-condition driven
  limitless headless --continue      Adopt last headless session
  limitless headless --safe|--yolo   Headless permission posture
  limitless status                   List runs / wrapped sessions
  limitless config                   Print resolved config
  limitless --version                Print version
  limitless --help                   Show this help

Config: ~/.limitless/config.json`;

export interface HeadlessIntent {
  mode: RunMode;
  postureOverride?: PermissionPosture;
}

export interface ParsedArgs {
  command: "interactive" | "headless" | "status" | "config" | "help" | "version";
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
  if (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") return { command: "help" };
  if (argv[0] === "--version" || argv[0] === "-v") return { command: "version" };
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

  if (parsed.command === "help") { console.log(HELP_TEXT); return; }
  if (parsed.command === "version") { console.log(readVersion()); return; }
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

export function isMainModule(metaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  try {
    const resolvedMeta = pathToFileURL(realpathSync(fileURLToPath(metaUrl))).href;
    const resolvedArgv1 = pathToFileURL(realpathSync(argv1)).href;
    return resolvedMeta === resolvedArgv1;
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  void main(process.argv.slice(2));
}
