// limitless brand chrome. The terminal ends up with two tools layered in it — Claude's
// content (its own warm/orange palette) and limitless wrapping it. We render limitless's
// own output with a bold-green ∞ ("infinite / still alive") mark so the two layers read as
// visibly distinct, and so it's always obvious when limitless — not Claude — is speaking.
// We deliberately do NOT borrow Claude's brand color: limitless is an unaffiliated tool.
const GREEN = "\x1b[1;32m"; // bold green
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export const MARK = "∞";
const WORDMARK = `${GREEN}${MARK} limitless${RESET}`;

// Startup logo: the ∞ limitless wordmark over a dim posture description. We reuse the
// posture wording verbatim (it carries the AUTO safety warning) and just strip its
// redundant "limitless:" prefix, since the wordmark above now carries the brand.
export function brandLogo(postureBannerText: string): string {
  const tagline = postureBannerText.replace(/^limitless:\s*/, "");
  return `${WORDMARK}\n${DIM}${tagline}${RESET}\n\n`;
}

// A single branded status line written to the user's terminal whenever limitless acts
// (limit reached, window reopened). Newline-terminated so it sits cleanly in scrollback.
export function brandStatus(message: string): string {
  return `${WORDMARK} ${DIM}·${RESET} ${message}\n`;
}
