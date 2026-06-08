import { SAFE_ALLOWED_TOOLS } from "../mode.js";
import type { InteractivePermission } from "../types.js";

// `auto` flag confirmed by the spike (likely --dangerously-skip-permissions).
export function interactivePermissionFlags(posture: InteractivePermission): string[] {
  switch (posture) {
    case "auto":
      return ["--dangerously-skip-permissions"];
    case "safe":
      return ["--permission-mode", "acceptEdits", "--allowed-tools", SAFE_ALLOWED_TOOLS];
    case "normal":
      return [];
  }
}

export interface InteractiveArgsOptions {
  adopt: boolean; // true for `limitless resume` (continue the latest session in cwd)
  posture: InteractivePermission;
  passthrough?: string[]; // extra args after `--`
}

export function buildInteractiveArgs(opts: InteractiveArgsOptions): string[] {
  const base = opts.adopt ? ["--continue"] : [];
  return [...base, ...interactivePermissionFlags(opts.posture), ...(opts.passthrough ?? [])];
}

export function postureBanner(posture: InteractivePermission): string {
  switch (posture) {
    case "auto":
      return "limitless: posture=AUTO — all tool approvals bypassed (shell + network run unattended). Use --safe or --normal to reduce.";
    case "safe":
      return "limitless: posture=SAFE — edits auto-approved; raw shell/network gated.";
    case "normal":
      return "limitless: posture=NORMAL — Claude prompts for approvals.";
  }
}

// True when a non-auto posture is silently overridden by a permission flag in passthrough.
export function passthroughEscalates(posture: InteractivePermission, passthrough: string[] | undefined): boolean {
  if (posture === "auto" || !passthrough) return false;
  return passthrough.some((a) => a === "--dangerously-skip-permissions" || a === "--permission-mode");
}
