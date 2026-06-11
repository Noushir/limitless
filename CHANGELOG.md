# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Pending

- Live re-verification of the *seamless* chooser path (limit hits while you're
  away; limitless auto-dismisses the native menu and continues unattended). The
  core reset-and-continue path is confirmed working against a real limit.
- Windows support (spawn resolution for `claude.cmd`, Windows CI).

## [0.1.2] - 2026-06-11

Makes carrying a session across a limit genuinely hands-free, and gives
limitless its own visual identity inside the wrapped terminal.

### Added

- **limitless branding in the terminal.** A bold-green `∞ limitless` wordmark at
  startup (over the dim posture line), and branded status lines whenever
  limitless acts — so it is always clear when limitless, not Claude, is in
  control, and what it is doing. Previously a limit only fired a macOS
  notification, leaving it ambiguous whether an on-screen "waiting" was Claude's
  or limitless's.
- **Reset time in the status line.** On a limit, limitless now prints
  `usage limit reached — waiting for <reset time>, then continuing` (parsed from
  the banner), and `the limit reset — continuing your session` when the window
  reopens.

### Changed

- **Seamless limit handling.** The instant the limit is detected, limitless
  dismisses Claude's native "Stop and wait / Upgrade" chooser (`Esc`) rather than
  leaving it on screen for the whole wait — anyone running their session through
  limitless has already chosen to continue across the limit, not upgrade. It
  still parses the real reset time, waits for it, then continues. It never
  selects a menu option and never touches the paid path. (If a paid-usage prompt
  is also showing, it touches nothing and hands control back to you, as before.)
- The startup posture line is now the branded `∞ limitless` logo.

### Fixed

- **Reset-time parsing works in any time zone.** The reset time and zone are read
  verbatim from Claude's banner (never hardcoded) — confirmed across IANA zones
  with awkward offsets (half-hour, southern-hemisphere DST, UTC+14) and multi-slash
  names (`America/Argentina/Buenos_Aires`). A bare `(UTC)`/`(GMT)` zone is now
  honored instead of being mistaken for host-local time; an unrecognized
  abbreviation falls back to the machine's local zone (which is what Claude renders
  the time in).

## [0.1.1] - 2026-06-10

Adds specific-session resume, and resolves the real-limit spike using captured
evidence of Claude Code v2.1.x's native limit UX (two billing-safety fixes plus
a cosmetic cleanup).

### Added

- `limitless resume <session-id>` — resume a specific Claude session by id (passes
  `claude --resume <id>`). `limitless resume` with no id still adopts the latest
  session in the current directory.

### Fixed

- **Wait for the actual reset window.** Interactive resume now parses the reset
  time out of the limit banner (`resets 1:10am (Europe/London)`, `resets in 3h`,
  24h/AM-PM, IANA zones) and sleeps until then, instead of poking the session
  after a 60-second backoff — which previously woke it hours before reset while
  still limited.
- **Never auto-confirm paid usage.** If a "usage credits" / "extra usage" prompt
  is on screen at resume time, limitless refuses to inject and hands control back
  to you. A blind injected Enter landing on such a prompt was how a continue could
  silently turn on extra usage.
- **No blind Enter into menus.** When the native "Stop and wait / Upgrade" chooser
  is focused, limitless sends `Esc` to dismiss it before typing `continue`, rather
  than confirming whatever option is highlighted.

### Changed

- The posture banner is now dimmed with a separating blank line so it no longer
  crowds Claude's startup splash.

## [0.1.0] - 2026-06-08

First public release. Command: `limitless`.

### Added

- **Interactive mode (default):** `limitless` wraps the real Claude TUI in a
  `node-pty` pseudo-terminal. On a usage limit it waits out the reset window and
  continues the same live session — presence-aware (auto-continues when you're
  away, holds for Enter when you're at the keyboard) — with a relaunch
  (`claude --continue`) fallback for reliability.
- **`limitless resume`:** adopt the latest session in the current directory and
  continue it at the next reset.
- **Headless mode:** `limitless headless "<task>" | --goal "<condition>" |
  --continue` runs Claude non-interactively and powers through limit windows
  using a reset timestamp when available, else poll-retry backoff.
- **Configurable permission posture** (`interactive.permissions`, default
  `safe`; `--safe` / `--auto` / `--normal`); a passthrough flag that contradicts
  a non-`auto` posture causes a fail-closed refusal.
- **Notifications:** macOS local notification + optional webhook
  (ntfy / Pushover / Telegram / Slack / generic).
- `status` and `config` commands; `--version` / `--help`.
- Config at `~/.limitless/config.json`; run state at `~/.limitless/runs/`.

[Unreleased]: https://github.com/Noushir/limitless/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/Noushir/limitless/releases/tag/v0.1.2
[0.1.1]: https://github.com/Noushir/limitless/releases/tag/v0.1.1
[0.1.0]: https://github.com/Noushir/limitless/releases/tag/v0.1.0
