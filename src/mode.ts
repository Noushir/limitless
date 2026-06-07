import type { PermissionPosture, RunMode } from "./types.js";

export const DEFAULT_CONTINUE_DIRECTIVE = "Continue where you left off.";

// Confirmed/adjusted by the Task 12 spike. Conservative default: edits yes, no raw shell/network.
export const SAFE_ALLOWED_TOOLS = "Read,Edit,Write,Glob,Grep";

export function permissionFlags(posture: PermissionPosture): string[] {
  if (posture === "yolo") return ["--dangerously-skip-permissions"];
  return ["--permission-mode", "acceptEdits", "--allowed-tools", SAFE_ALLOWED_TOOLS];
}

const OUTPUT_FLAGS = ["--output-format", "json"];

function startPrompt(mode: RunMode): string {
  if (mode.kind === "goal") return `/goal ${mode.condition}`;
  if (mode.kind === "task") return mode.task;
  return DEFAULT_CONTINUE_DIRECTIVE; // kind === "continue"
}

export function buildStartArgs(mode: RunMode, posture: PermissionPosture): string[] {
  return ["-p", startPrompt(mode), ...OUTPUT_FLAGS, ...permissionFlags(posture)];
}

export function buildResumeArgs(
  sessionId: string | null,
  posture: PermissionPosture,
  directive: string = DEFAULT_CONTINUE_DIRECTIVE,
): string[] {
  const resume = sessionId ? ["--resume", sessionId] : ["--continue"];
  return ["-p", ...resume, directive, ...OUTPUT_FLAGS, ...permissionFlags(posture)];
}
