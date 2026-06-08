# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Pending

- Real-limit verification spike: confirm the exact usage-limit banner text and
  whether in-place injection resumes the TUI vs. needing the relaunch fallback.
- Windows support (spawn resolution for `claude.cmd`, Windows CI).

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

[Unreleased]: https://github.com/Noushir/limitless/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Noushir/limitless/releases/tag/v0.1.0
