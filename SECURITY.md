# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report privately via GitHub's
[private security advisories](https://github.com/Noushir/limitless/security/advisories/new)
(repo → **Security** → **Report a vulnerability**). You'll get an acknowledgement within a
few days, and we'll coordinate a fix and disclosure.

## Supported versions

The latest `0.x` release on `main` is supported.

## Security notes

- `limitless` wraps and drives the official `claude` CLI on your own machine. It adds no API
  access of its own and transmits nothing off-machine **except** an optional, user-configured
  notification webhook (`notify.webhook.url`, off by default).
- The interactive `--auto` posture maps to `--dangerously-skip-permissions` (auto-approves
  all tool calls, including shell/network). It is **opt-in** — the default posture is `safe`,
  and a passthrough flag that contradicts a non-`auto` posture causes limitless to refuse to
  launch. Use `--auto` only in directories/repos you trust.
- Tool input injected into the wrapped session is limited to a fixed `continue` keystroke;
  all other input is your own passthrough.
