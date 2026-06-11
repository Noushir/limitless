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
  limitless resume [id]              Adopt & continue the latest (or a specific) session
  limitless --resume [id] | --continue   Same as 'resume' (flag aliases)
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
  command: "interactive" | "headless" | "status" | "config" | "help" | "version" | "error";
  adopt?: boolean;
  resumeId?: string;
  posture?: InteractivePermission;
  passthrough?: string[];
  headless?: HeadlessIntent;
  error?: string; // set when command === "error"
}

// limitless's own interactive flags. Anything else before `--` is rejected rather than
// silently dropped (and is never auto-forwarded to claude — that would sneak past the
// posture-escalation guard, which only inspects args after `--`).
const INTERACTIVE_FLAGS = new Set(["--safe", "--normal", "--auto", "--resume", "--continue", "--help", "-h", "--version", "-v"]);

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

  // Interactive (default). `resume` (subcommand) and the `--resume` / `--continue` flag
  // aliases all mean "adopt & continue an existing session" — people reach for the dashed
  // forms because `claude` itself uses them, so treating those as a fresh launch is a trap.
  const dashDash = argv.indexOf("--");
  const passthrough = dashDash !== -1 ? argv.slice(dashDash + 1) : undefined;
  const pre = dashDash !== -1 ? argv.slice(0, dashDash) : argv;
  const flags = pre[0] === "resume" ? pre.slice(1) : pre;

  const unknown = flags.find((a) => a.startsWith("-") && !INTERACTIVE_FLAGS.has(a));
  if (unknown) {
    return {
      command: "error",
      error: `unknown option '${unknown}'. limitless flags are --safe|--auto|--normal and --resume [id] / --continue. To pass options to claude, put them after --, e.g.  limitless -- ${unknown} ...`,
    };
  }

  const adopt = pre[0] === "resume" || flags.includes("--resume") || flags.includes("--continue");
  const resumeId = adopt ? flags.find((a) => !a.startsWith("-")) : undefined;
  const posture: InteractivePermission | undefined = flags.includes("--safe")
    ? "safe"
    : flags.includes("--normal")
      ? "normal"
      : flags.includes("--auto")
        ? "auto"
        : undefined;
  return { command: "interactive", adopt, resumeId, posture, passthrough };
}

export async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);

  if (parsed.command === "error") { process.stderr.write(`limitless: ${parsed.error}\n`); process.exit(2); }
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
  runInteractive({ adopt: parsed.adopt ?? false, resumeId: parsed.resumeId, posture: parsed.posture, passthrough: parsed.passthrough });
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
