import type { InteractivePermission } from "../types.js";

// limitless brand chrome. The terminal ends up with two tools layered in it — Claude's
// content and limitless wrapping it — so we render limitless's own output with a bold-green
// ∞ ("infinite / still alive") mark to keep the two layers visibly distinct, and so it's
// always obvious when limitless, not Claude, is speaking. We deliberately do NOT borrow
// Claude's brand color: limitless is an unaffiliated tool.
const GREEN = "\x1b[1;32m"; // bold green
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const TAGLINE = "keeps your session alive across usage limits";

export const MARK = "∞";
const WORDMARK = `${GREEN}${MARK} limitless${RESET}`;

const AUTO_WARNING =
  "auto posture: all tool approvals bypassed — shell + network run unattended. Use --safe or --normal to reduce.";

// Visible width of a styled string: drop SGR codes so color sequences don't skew padding.
const visibleLen = (s: string) => [...s.replace(/\x1b\[[0-9;]*m/g, "")].length;

// Draw a green rounded box around the given (possibly styled) lines, padded to the widest
// visible line so the right border lands flush regardless of embedded color codes.
function box(lines: string[]): string {
  const inner = Math.max(...lines.map(visibleLen));
  const PAD = 2;
  const bar = "─".repeat(inner + PAD * 2);
  const rows = lines.map((l) => {
    const fill = " ".repeat(inner - visibleLen(l));
    return `${GREEN}│${RESET}${" ".repeat(PAD)}${l}${fill}${" ".repeat(PAD)}${GREEN}│${RESET}`;
  });
  return [`${GREEN}╭${bar}╮${RESET}`, ...rows, `${GREEN}╰${bar}╯${RESET}`].join("\n");
}

// Startup banner: a boxed ∞ limitless wordmark + tagline + posture. The AUTO safety warning
// is called out beneath the box (not inside it) so the box stays a tidy, consistent width.
export function brandLogo(posture: InteractivePermission): string {
  const banner = box([WORDMARK, `${DIM}${TAGLINE}${RESET}`, `${DIM}posture: ${posture}${RESET}`]);
  const warning = posture === "auto" ? `\n${GREEN}⚠${RESET} ${AUTO_WARNING}` : "";
  return `${banner}${warning}\n\n`;
}

// OSC sequence to set the terminal window/tab title — persistent branding that survives
// Claude repainting the screen, since the title isn't part of the scrollback.
export function terminalTitle(text: string): string {
  return `\x1b]0;${text}\x07`;
}

// A single branded status line written to the user's terminal whenever limitless acts
// (limit reached, window reopened). Newline-terminated so it sits cleanly in scrollback.
export function brandStatus(message: string): string {
  return `${WORDMARK} ${DIM}·${RESET} ${message}\n`;
}
