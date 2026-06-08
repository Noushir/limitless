# Contributing to limitless

Thanks for your interest! This is a small, test-driven TypeScript project — contributions are welcome.

## Setup

```bash
git clone https://github.com/Noushir/limitless
cd limitless
npm install        # also builds (prepare) and chmods node-pty's spawn-helper (postinstall)
npm test           # run the full suite
npm run typecheck  # tsc --noEmit
npm run build      # bundle to dist/cli.js
npm run dev -- --help   # run the CLI from source
```

Requires Node >= 20 and the `claude` CLI installed.

## Project layout

- `src/cli.ts` — argument parsing + command dispatch (`limitless`, `resume`, `headless`, `status`, `config`).
- `src/interactive/` — interactive mode: `host.ts` (node-pty wrap), `presence.ts`, `limit-detector.ts`, `resume-controller.ts` (the wait/resume state machine), `session.ts`, `run.ts` (entry), `args.ts`.
- `src/` (top level) — headless mode + shared: `runner.ts`, `classifier.ts`, `scheduler.ts`, `notify.ts`, `config.ts`, `state.ts`, `mode.ts`, `claude.ts`, `types.ts`, `paths.ts`.
- `test/` — vitest tests mirroring `src/`. Process/PTY/notify side effects are behind injectable interfaces; integration tests use stub binaries in `test/fixtures/`, so the suite needs no real Claude quota.
- `docs/superpowers/` — design specs and implementation plans.

## How we work

- **TDD:** write a failing test first, make it pass, then refactor. Keep modules small and single-purpose.
- **No real quota in tests:** drive `claude` via the stub fixtures (`test/fixtures/*.mjs`), never the real CLI.
- **Conventional commits** (`feat:`, `fix:`, `docs:`, `build:`, `test:`).
- Run `npm test && npm run typecheck && npm run build` before opening a PR. CI runs the same on Linux + macOS (Node 20/22).

## Known follow-ups

The exact usage-limit banner text, the in-place-vs-relaunch resume behavior, and the `--auto` permission flag are pending a real-limit verification spike (see `docs/superpowers/specs/`). The poll-retry + relaunch-fallback design keeps the tool correct in the meantime; PRs that pin these against real behavior are especially welcome.
