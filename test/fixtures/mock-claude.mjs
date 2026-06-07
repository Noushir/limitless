#!/usr/bin/env node
import fs from "node:fs";

// Scenario: array of { stdout?, stderr?, exit } steps, base64-encoded JSON in env.
const scenario = JSON.parse(
  Buffer.from(process.env.MOCK_CLAUDE_SCENARIO ?? "W10=", "base64").toString("utf8"),
);
const counterFile = process.env.MOCK_CLAUDE_COUNTER ?? "/tmp/mock-claude-counter";
let i = 0;
try { i = parseInt(fs.readFileSync(counterFile, "utf8"), 10) || 0; } catch {}
const step = scenario[Math.min(i, scenario.length - 1)] ?? { exit: 0 };
fs.writeFileSync(counterFile, String(i + 1));

if (step.stdout) process.stdout.write(step.stdout);
if (step.stderr) process.stderr.write(step.stderr);
process.exit(step.exit ?? 0);
