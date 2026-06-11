import { stripAnsi } from "./limit-detector.js";

// Parse the reset time out of Claude's limit banner so interactive resume waits for the
// *real* reset window instead of a blind poll-retry backoff. Examples seen in the wild:
//   "You've hit your session limit · resets 1:10am (Europe/London)"
//   "... resets 13:10 (Europe/London)"
//   "... resets in 3h 21m"
// Returns the next occurrence as unix epoch seconds, or undefined if no time is found
// (caller then falls back to poll-retry backoff — same as before this parser existed).
export function parseResetEpochSeconds(text: string, nowSeconds: number): number | undefined {
  const s = stripAnsi(text);

  // Relative form: "resets in 3h 21m" / "resets in 45m" / "resets in 2h".
  const rel = /resets?\s+in\s+(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i.exec(s);
  if (rel && (rel[1] || rel[2])) {
    const h = rel[1] ? parseInt(rel[1], 10) : 0;
    const m = rel[2] ? parseInt(rel[2], 10) : 0;
    if (h || m) return nowSeconds + h * 3600 + m * 60;
  }

  // Absolute form: "resets 1:10am (Europe/London)" / "resets at 13:10".
  const abs = /resets?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*([ap]m)?/i.exec(s);
  if (!abs) return undefined;
  let hour = parseInt(abs[1], 10);
  const minute = parseInt(abs[2], 10);
  const ampm = abs[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return undefined;

  const tz = /\(([A-Za-z]+\/[A-Za-z_]+)\)/.exec(s)?.[1];
  return nextOccurrenceEpoch(hour, minute, tz, nowSeconds);
}

// Human-readable reset phrase for the branded status line, e.g. "1:10am (Europe/London)"
// or "in 3h 21m". Takes just the reset clause from its own line, so trailing menu/output
// on later lines is not swept in. Returns undefined when the banner carries no reset phrase.
export function parseResetLabel(text: string): string | undefined {
  const m = /resets?\s+(.+)/i.exec(stripAnsi(text));
  if (!m) return undefined;
  const label = m[1].split("\n")[0].trim().replace(/[.\s]+$/, "");
  return label || undefined;
}

// Epoch (seconds) of the next time the wall clock reads hour:minute in `tz` (IANA name),
// strictly after nowSeconds. Falls back to the host's local timezone when `tz` is missing
// or not a zone Intl recognizes.
function nextOccurrenceEpoch(hour: number, minute: number, tz: string | undefined, nowSeconds: number): number | undefined {
  if (tz) {
    try {
      const ymd = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(nowSeconds * 1000));
      const [y, mo, d] = ymd.split("-").map(Number);
      for (const addDays of [0, 1]) {
        const wallAsUTC = Date.UTC(y, mo - 1, d + addDays, hour, minute, 0);
        const epoch = Math.floor((wallAsUTC - tzOffsetMs(wallAsUTC, tz)) / 1000);
        if (epoch > nowSeconds) return epoch;
      }
      return undefined;
    } catch {
      // Unknown zone — fall through to host-local handling below.
    }
  }
  return hostLocalNextOccurrence(hour, minute, nowSeconds);
}

// Offset (ms) to add to a "wall time interpreted as UTC" to recover the true UTC instant,
// for the given IANA zone at that approximate instant. Standard Intl offset trick.
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const asIfUTC = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  return asIfUTC - utcMs;
}

function hostLocalNextOccurrence(hour: number, minute: number, nowSeconds: number): number {
  const cand = new Date(nowSeconds * 1000);
  cand.setHours(hour, minute, 0, 0);
  let epoch = Math.floor(cand.getTime() / 1000);
  if (epoch <= nowSeconds) epoch += 86400;
  return epoch;
}
