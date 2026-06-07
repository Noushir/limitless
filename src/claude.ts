import { spawn } from "node:child_process";
import type { ClaudeResult } from "./types.js";

export interface RunOptions {
  command?: string;     // defaults to "claude"
  prefixArgs?: string[]; // injected before args (used by tests to run the mock via node)
}

export interface ClaudeRunner {
  run(args: string[], cwd: string, opts?: RunOptions): Promise<ClaudeResult>;
}

// Parse the last JSON object found in stdout (claude --output-format json prints a trailing object).
function parseTrailingJson(stdout: string): unknown {
  const start = stdout.lastIndexOf("{");
  if (start === -1) return undefined;
  try { return JSON.parse(stdout.slice(start)); } catch { return undefined; }
}

export const spawnClaude: ClaudeRunner = {
  run(args, cwd, opts = {}) {
    const command = opts.command ?? "claude";
    const fullArgs = [...(opts.prefixArgs ?? []), ...args];
    return new Promise((resolve) => {
      const child = spawn(command, fullArgs, { cwd });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (e) => resolve({ exitCode: null, stdout, stderr: stderr + String(e) }));
      child.on("close", (code) =>
        resolve({ exitCode: code, stdout, stderr, json: parseTrailingJson(stdout) }),
      );
    });
  },
};
