# limitless

Run a Claude Code task headless and automatically survive usage-limit windows.

`limitless` wraps the `claude` CLI: it launches your task, detects when Claude hits
a usage limit, waits out the reset window, and relaunches `claude --continue` — looping
across as many limit windows as needed until the task is done.

> **Early version.** The exact headless rate-limit signal and the final safe-mode
> permission flags are pending an empirical spike (Task 12). Behaviour may change in a
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

Or link from source:

```bash
git clone <repo>
cd limitless
npm install && npm run build && npm link
```

---

## Usage

### Primary mode — goal-driven

```bash
limitless --goal "all tests pass and the PR is merged"
```

Delegates completion-detection to Claude Code's `/goal` evaluator. The loop ends when
`/goal` reports the condition is satisfied.

### Plain task

```bash
limitless "Refactor the auth module and add unit tests"
```

Launches the task as a one-shot prompt. The loop continues across limit windows until
Claude returns a clean exit.

### Adopt the last session in this directory

```bash
limitless --continue
```

Picks up where the previous session left off (equivalent to `claude --continue`).

---

## Posture flags

| Flag | Behaviour |
|------|-----------|
| _(none)_ | Uses the default posture from config (`safe` by default) |
| `--safe` | Edits auto-accepted; no raw shell or network. Allowed tools: `Read,Edit,Write,Glob,Grep` |
| `--yolo` | Passes `--dangerously-skip-permissions` to Claude — **maximum blast radius, use with care** |

---

## Utility commands

```bash
limitless status        # List active/recent runs
limitless config        # Print the resolved config as JSON
```

`limitless status` output format per run:

```
<id>  <status>  <mode>  cycle=<n>    (resumes HH:MM:SS)
```

---

## Configuration

File: `~/.limitless/config.json` (deep-merged over defaults; missing keys use defaults).

Run state files are stored in `~/.limitless/runs/<id>.json`.

### Full config with defaults

```jsonc
{
  "permissions": {
    "default": "safe"          // "safe" | "yolo"
  },
  "notify": {
    "local": true,             // macOS notification + Glass sound
    "webhook": {
      "url": null,             // POST endpoint, or null to disable
      "format": "ntfy"         // "ntfy" | "pushover" | "telegram" | "slack" | "generic"
    }
  },
  "guards": {
    "maxCycles": 50,           // hard stop after this many resume cycles
    "maxWallClockHours": 48,   // hard stop after this many wall-clock hours
    "weeklyLimitBehavior": "stop"  // "stop" | "wait" — what to do on a 7-day window
  },
  "pollRetry": {
    "initialSeconds": 60,      // first poll interval when reset time is unknown
    "maxSeconds": 900,         // cap on exponential backoff
    "factor": 2                // backoff multiplier
  }
}
```

### Notifications

When `notify.local` is `true`, `limitless` fires a macOS notification (via `osascript`)
with a Glass sound on key events: `started`, `sleeping`, `resumed`, `finished`, `failed`,
`weekly_stopped`.

When `notify.webhook.url` is set, the same events are POSTed to that URL in the chosen
format. Supported formats and their payloads:

| Format | Content-Type | Body |
|--------|-------------|------|
| `ntfy` (default) | `text/plain` | `[limitless] <message>` |
| `slack` | `application/json` | `{"text": "[limitless] <message>"}` |
| `telegram` / `pushover` / `generic` | `application/json` | `{"message": "...", "event": "<type>"}` |

---

## How it works

`limitless` launches `claude -p <prompt> --output-format json` with the appropriate
permission flags, then inspects the result. When it detects a usage-limit signal it reads
the reset timestamp from Claude's output (if available) and sleeps until then; when no
timestamp is available it falls back to a poll-retry loop with exponential backoff
(`initialSeconds` → `maxSeconds` at `factor`× per attempt). On wake it calls
`claude --resume <sessionId>` (or `--continue` if the session ID is unavailable) and
repeats. Because the poll-retry core does not parse prose, it is robust to Claude
output-format changes. The `/goal` primary mode delegates completion-detection to Claude's
own evaluator, removing the need for `limitless` to decide when "done" means done.

---

## Safety note

`--safe` (the default) passes `--permission-mode acceptEdits` and restricts Claude to the
tools `Read,Edit,Write,Glob,Grep`. It does **not** allow raw shell execution or network
requests from within the task.

`--yolo` passes `--dangerously-skip-permissions`, giving Claude unrestricted tool access.
Only use `--yolo` in disposable environments (containers, VMs) where you are comfortable
with arbitrary code execution.

---

## Limitations / known gaps

- Rate-limit detection is heuristic. The precise headless signal is still being confirmed
  experimentally (Task 12 spike pending).
- `--safe` allowed-tool list (`Read,Edit,Write,Glob,Grep`) is provisional; it will be
  tightened or expanded after the Task 12 spike.
- `weeklyLimitBehavior: "wait"` is defined in config but behaviour under a 7-day window
  is not yet fully validated.
- macOS notifications only (`osascript`). Linux/Windows: set a webhook instead.
