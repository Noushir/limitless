# limitless

`limitless` wraps the real Claude TUI and keeps your session going across usage-limit
windows. Run it instead of `claude` and when you hit the limit it waits out the reset
window and continues your same live session in place — presence-aware (auto-continues if
you're away, holds for Enter if you're at the keyboard), with a relaunch fallback for
reliability. A headless mode handles unattended task runs.

> **Early version.** The exact limit-banner detection and the in-place-vs-relaunch
> behavior depend on a real-limit spike that is still pending. Behavior may change in a
> patch release.

---

## Requirements

- Node >= 20
- The `claude` CLI installed and authenticated (`claude --version` should work)

---

## Install

```bash
npm install -g limitless
```

A postinstall script makes `node-pty`'s `spawn-helper` executable (fixes `posix_spawnp
failed` on macOS). If you install from source:

```bash
git clone <repo>
cd limitless
npm install && npm run build && npm link
```

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

### `limitless resume` — adopt the latest session and continue it at reset

```bash
limitless resume
```

For when you started with bare `claude` and got stuck: limitless adopts the latest session
in the current directory (`claude --continue`) and will continue it at the next reset,
wrapping it going forward.

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
and fires when the usage-limit banner appears. A presence-tracker records your last
keystroke time. The resume-controller state machine then waits out the reset window and
either injects `continue` in-place (when you're idle) or holds for your keypress (when
you're present); if in-place injection doesn't resume the session, it relaunches
`claude --continue` in the same pty. Resume cycles are bounded by `guards.maxCycles` /
`guards.maxWallClockHours`.

**Headless mode:** limitless launches `claude -p <prompt> --output-format json` with the
appropriate permission flags, inspects the result, and on a usage-limit signal reads the
reset timestamp (when available) or falls back to poll-retry backoff
(`initialSeconds` → `maxSeconds` at `factor`×). On wake it calls `claude --continue` (or
`--resume <sessionId>`) and repeats until the task is done.

---

## Status / limitations

- **Limit-banner detection** is heuristic. The exact text + ANSI as rendered in the
  interactive TUI is still being confirmed experimentally (real-limit spike pending). The
  inject-poll-retry + relaunch-fallback approach is correct either way, just less precise
  on timing until the banner is confirmed.
- **In-place vs relaunch:** whether injecting `continue` into the blocked TUI actually
  resumes it is also pending a real-limit event. The relaunch fallback guarantees forward
  progress regardless.
- **`--auto` flag mapping** (`--dangerously-skip-permissions`) is provisional — confirmed
  by the PTY spike but subject to change if the Claude CLI surface changes.
- **`weeklyLimitBehavior: "wait"`** is defined in config but behavior under a full 7-day
  window is not yet validated.
- **macOS notifications only** (`osascript`). On Linux/Windows: set a webhook instead.
