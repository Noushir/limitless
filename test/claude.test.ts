import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnClaude } from "../src/claude.js";

const fixture = path.resolve("test/fixtures/mock-claude.mjs");
let counter: string;

function scenario(steps: unknown[]): string {
  return Buffer.from(JSON.stringify(steps)).toString("base64");
}

beforeEach(() => {
  counter = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mc-")), "c");
});
afterEach(() => fs.rmSync(path.dirname(counter), { recursive: true, force: true }));

describe("spawnClaude", () => {
  it("captures stdout, exit code, and parsed trailing json", async () => {
    process.env.MOCK_CLAUDE_COUNTER = counter;
    process.env.MOCK_CLAUDE_SCENARIO = scenario([
      { stdout: 'noise\n{"session_id":"s-1","result":"ok"}', exit: 0 },
    ]);
    const result = await spawnClaude.run([], process.cwd(), { command: "node", prefixArgs: [fixture] });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("session_id");
    expect((result.json as { session_id: string }).session_id).toBe("s-1");
  });
});
