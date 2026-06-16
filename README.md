# limitless

[![CI](https://github.com/Noushir/limitless/actions/workflows/ci.yml/badge.svg)](https://github.com/Noushir/limitless/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-limitless)](https://www.npmjs.com/package/claude-limitless)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> Package: **`claude-limitless`** · command: **`limitless`** · License: MIT

`limitless` wraps the real Claude TUI and keeps your session going across usage-limit
windows. Run it instead of `claude` and when you hit the limit it waits out the reset
window and continues your same live session in place — presence-aware (auto-continues if
you're away, holds for Enter if you're at the keyboard), with a relaunch fallback for
reliability. A headless mode handles unattended task runs.

> **Early version.** Confirmed against Claude Code v2.1.x's native limit UX (the
> `You've hit your … limit · resets <time>` banner and the "Stop and wait / Upgrade" chooser),
> including a real-limit run that waited out the reset and continued the task. On a limit,
> limitless dismisses the chooser, waits for the banner's **actual reset time**, continues the
> session, and **never auto-confirms a paid-usage prompt** — see
> [Respects your usage limits](#respects-your-usage-limits). Behavior may still change in a patch release.

---

## Requirements

- Node 20–24 (prebuilt `node-pty` binaries ship for these; **no compiler needed**)
- The `claude` CLI installed and authenticated (`claude --version` should work)

limitless depends on `node-pty` (a native pseudo-terminal addon) via
[`@homebridge/node-pty-prebuilt-multiarch`](https://www.npmjs.com/package/@homebridge/node-pty-prebuilt-multiarch),
which ships **prebuilt binaries** for Linux/macOS/Windows (incl. arm64 and musl), so a typical
install needs no C++ toolchain. A compiler is only used as a fallback when no prebuilt matches
your platform/Node — e.g. Node 25+ or an uncommon architecture — see [Troubleshooting](#troubleshooting).

---

## Install

```bash
npm install -g claude-limitless
```

The package is `claude-limitless`; the installed command is **`limitless`**. A postinstall
script makes `node-pty`'s `spawn-helper` executable (fixes `posix_spawnp failed` on macOS).
If you install from source:

```bash
git clone https://github.com/Noushir/limitless
cd limitless
npm install && npm run build && npm link
```

### Troubleshooting

**`unrecognized command line option '-std=gnu++20'` / `node-pty` build fails.**
You only hit this if no prebuilt binary matched your platform/Node and npm fell back to
compiling from source (e.g. Node 25+, or an uncommon arch) — that path needs a C++20 compiler.
The error means your `g++` is too old (it only knows `-std=gnu++2a`); `-std=gnu++20` requires
**GCC ≥ 10**. Either use a Node version with a prebuilt (20–24), or install a newer compiler and
reinstall:

```bash
sudo apt-get update && sudo apt-get install -y build-essential g++-10
CXX=g++-10 CC=gcc-10 npm install -g claude-limitless
```

If the old compiler is still picked, make 10 the default first:

```bash
sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-10 100
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-10 100
```

(Or upgrade the distro — Ubuntu 22.04+ ships GCC 11 by default.)

**`posix_spawnp failed` on macOS.** Handled automatically: the postinstall script marks
`node-pty`'s `spawn-helper` executable. If you ran with `--ignore-scripts`, re-run
`npm rebuild node-pty` or reinstall without that flag.

---

## Interactive usage (the default)

### `limitless` — launch Claude through limitless

```bash
limitless
```

Use `limitless` instead of `claude`. It wraps the full interactive TUI via a pseudo-terminal
so everything looks and feels identical. When you hit a usage limit:

1. limitless detects the limit banner in Claude's output.
2. It waits out the reset window (precise timing when a statusline timestamp is available;
   poll-retry backoff otherwise).
3. **Presence-aware resume:** if you haven't typed recently it auto-injects `continue` to
   resume in place; if you're at the keyboard it holds and shows "ready — press Enter".
4. **Relaunch fallback:** if in-place injection doesn't resume the session, limitless
   kills the child and relaunches `claude --continue` in the same terminal — conversation
   restored, wrapping continues.

Terminal content is never erased (Claude renders inline, not in the alternate screen).

### `limitless resume` — adopt the latest session (or a specific one) and continue it at reset

```bash
limitless resume                   # adopt the latest session in the cwd (claude --continue)
limitless resume <session-id>      # resume a specific session by id (claude --resume <id>)
limitless --continue               # flag alias for `resume`
limitless --resume [session-id]    # flag alias for `resume` (optionally a specific id)
```

The dashed forms (`--resume` / `--continue`) are accepted as aliases because that's what
`claude` itself uses. An unrecognized flag before `--` (e.g. `limitless --model opus`) exits
with an error pointing you at `-- <claude args>` — it is never silently ignored.

For when you started with bare `claude` and got stuck: limitless adopts the latest session
in the current directory (`claude --continue`) and will continue it at the next reset,
wrapping it going forward.

If you know the session id you want to resume, pass it as the first argument —
limitless will call `claude --resume <session-id>` instead of `--continue`. You can
combine this with posture flags and passthrough args as usual:

```bash
limitless resume fee6a4d1 --normal -- --model claude-opus-4-5
```

### Permission posture flags

| Flag | Behavior |
|------|----------|
| _(none)_ | Uses `interactive.permissions` from config (default: **`safe`**) |
| `--safe` | Edits auto-approved; raw shell/network gated. Allowed tools: `Read,Edit,Write,Glob,Grep` |
| `--auto` | Approve everything (`--dangerously-skip-permissions`) — **unattended shell/network** |
| `--normal` | Claude's normal interactive prompts — can stall unattended |

**Default is `safe`** — edits are auto-approved, raw shell execution and network requests are gated. To opt into full-auto (all tool calls bypassed, including shell/network), pass `--auto` or set `interactive.permissions: "auto"` in config. If you want to approve each action yourself, use `--normal` (but note: an unattended resume may pause waiting for your input).

**Passthrough permission flags are rejected under non-auto postures.** If you pass a permission flag (e.g. `--dangerously-skip-permissions`) via `-- …` while using `--safe` or `--normal`, limitless will refuse to launch with exit code 2. Use `--auto` explicitly instead:

```bash
limitless --auto -- --dangerously-skip-permissions   # wrong: redundant; just use --auto
limitless --auto                                      # right: opt in to full-auto explicitly
```

### Passing extra args to claude

```bash
limitless -- --model claude-opus-4-5
limitless -- --model claude-opus-4-5 --add-dir /some/path
```

Anything after `--` is passed through to `claude` verbatim.

These flags compose:

```bash
limitless --safe -- --model claude-opus-4-5
limitless resume --normal -- --model claude-opus-4-5
```

---

## Headless mode (unattended task runs)

The former top-level behavior is now under the `headless` subcommand. Use it for
fire-and-forget tasks where you don't need a live TUI.

```bash
# Run a task; loop across limit windows until claude exits cleanly
limitless headless "Refactor the auth module and add unit tests"

# Delegate completion-detection to Claude's /goal evaluator
limitless headless --goal "all tests pass and the PR is merged"

# Adopt the last headless session in this directory
limitless headless --continue

# Permission posture (headless only)
limitless headless --safe "..."    # edits only; no raw shell or network
limitless headless --yolo "..."    # --dangerously-skip-permissions (maximum blast radius)
```

Headless uses the `permissions.default` config key (default: `safe`). Posture flags
`--safe` / `--yolo` override it per-run.

---

## Utility commands

```bash
limitless status        # List active and recent runs / wrapped sessions
limitless config        # Print the resolved config as JSON
```

`limitless status` output format per entry:

```
<id>  <status> (resumes HH:MM:SS)  <mode>  cycle=<n>
```

---

## Configuration

File: `~/.limitless/config.json` (deep-merged over defaults; missing keys fall back to
defaults). Run-state files are stored in `~/.limitless/runs/<id>.json`.

### Full config with defaults

```jsonc
{
  "permissions": {
    "default": "safe"           // headless default posture: "safe" | "yolo"
  },
  "interactive": {
    "permissions": "safe"       // interactive default posture: "safe" | "auto" | "normal"
  },
  "notify": {
    "local": true,              // macOS notification + Glass sound
    "webhook": {
      "url": null,              // POST endpoint, or null to disable
      "format": "ntfy"          // "ntfy" | "pushover" | "telegram" | "slack" | "generic"
    }
  },
  "guards": {
    "maxCycles": 50,            // hard stop after this many resume cycles
    "maxWallClockHours": 48,    // hard stop after this many wall-clock hours
    "weeklyLimitBehavior": "stop"  // "stop" | "wait" — what to do on a 7-day window
  },
  "pollRetry": {
    "initialSeconds": 60,       // first poll interval when reset time is unknown
    "maxSeconds": 900,          // cap on exponential backoff
    "factor": 2                 // backoff multiplier
  }
}
```

### Notifications

When `notify.local` is `true`, limitless fires a macOS notification (via `osascript`)
with a Glass sound on key events: `started`, `sleeping`, `resumed`, `finished`, `failed`,
`weekly_stopped`.

When `notify.webhook.url` is set, the same events are POSTed to that URL in the chosen
format:

| Format | Content-Type | Body |
|--------|-------------|------|
| `ntfy` (default) | `text/plain` | `[limitless] <message>` |
| `slack` | `application/json` | `{"text": "[limitless] <message>"}` |
| `telegram` / `pushover` / `generic` | `application/json` | `{"message": "...", "event": "<type>"}` |

---

## How it works

**Interactive mode:** limitless spawns `claude` inside a `node-pty` pseudo-terminal at
your terminal's current dimensions. All input and output pass through transparently —
resize events are forwarded too. A limit-detector reads the (ANSI-stripped) output stream
and fires when the usage-limit banner appears, and a reset-parser reads the banner's
`resets <time>` so limitless waits for the **real** reset window rather than a blind
backoff. A presence-tracker records your last keystroke time. The resume-controller state
machine then either injects `continue` in-place (when you're idle) or holds for your
keypress (when you're present); if in-place injection doesn't resume the session, it
relaunches `claude --continue` in the same pty.

**Seamless + billing-safe:** the moment a limit is detected, limitless dismisses Claude's
native "Stop and wait / Upgrade" chooser with `Esc` — running your session through limitless
already means "continue across the limit, not upgrade", so the menu doesn't sit on screen for
the whole wait. It then prints a branded `∞ limitless` status line naming the real reset time,
waits for it, and continues — with a second status line when the window reopens. It **never**
selects a menu option, and if a paid-usage prompt ("usage credits", "extra usage") is showing
it **touches nothing and hands control back to you** — it will not spend money on your behalf.
Resume cycles are bounded by `guards.maxCycles` / `guards.maxWallClockHours`.

**Headless mode:** limitless launches `claude -p <prompt> --output-format json` with the
appropriate permission flags, inspects the result, and on a usage-limit signal reads the
reset timestamp (when available) or falls back to poll-retry backoff
(`initialSeconds` → `maxSeconds` at `factor`×). On wake it calls `claude --continue` (or
`--resume <sessionId>`) and repeats until the task is done.

---

## Status / limitations

- **Limit-banner detection** is heuristic but confirmed against Claude Code v2.1.x: it
  matches the `You've hit your <session|weekly|…> limit · resets <time>` banner. When the
  banner carries a reset time, limitless waits until that time (+ a small margin); when it
  doesn't, it falls back to poll-retry backoff.
- **In-place vs relaunch:** limitless injects `continue` once the window reopens; the
  relaunch fallback (`claude --continue`) guarantees forward progress if injection doesn't
  take. It will **not** auto-confirm a paid-usage ("usage credits" / "extra usage") prompt —
  if one is on screen it pauses and returns control to you.
- **`--auto` flag mapping** (`--dangerously-skip-permissions`) is provisional — confirmed
  by the PTY spike but subject to change if the Claude CLI surface changes.
- **`weeklyLimitBehavior: "wait"`** is defined in config but behavior under a full 7-day
  window is not yet validated.
- **macOS notifications only** (`osascript`). On Linux/Windows: set a webhook instead.

---

## Respects your usage limits

limitless does **not** bypass, circumvent, or evade Claude's usage limits. It waits for the
*official* reset window and then continues — it simply automates the "come back after the
limit resets" step you'd otherwise do by hand. It drives the official `claude` CLI as you,
with your own account and entitlements, and adds no API access of its own.

## Disclaimer

This is an **unofficial, community project**. It is **not affiliated with, endorsed by, or
sponsored by Anthropic**. "Claude" and "Claude Code" are trademarks of Anthropic, used here
only nominatively to describe compatibility. Your use of the Claude CLI through this tool
remains subject to Anthropic's own terms of service and usage policies. The software is
provided "as is" under the MIT License, without warranty — see [LICENSE](LICENSE).
