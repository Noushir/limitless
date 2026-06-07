import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { saveRunState, loadRunState, listRunStates } from "../src/state.js";
import type { RunState } from "../src/types.js";

let home: string;
const sample = (id: string): RunState => ({
  id,
  mode: { kind: "task", task: "do x" },
  cwd: "/tmp/proj",
  sessionId: null,
  status: "running",
  nextWakeAt: null,
  cycle: 0,
  startedAt: 1_700_000_000,
  lastVerdict: null,
  lastReason: null,
});

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "limitless-state-"));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe("run state", () => {
  it("round-trips a run state to disk", () => {
    saveRunState(sample("abc"), home);
    expect(loadRunState("abc", home)).toEqual(sample("abc"));
  });

  it("returns null for a missing run", () => {
    expect(loadRunState("nope", home)).toBeNull();
  });

  it("lists all saved runs", () => {
    saveRunState(sample("a"), home);
    saveRunState(sample("b"), home);
    expect(listRunStates(home).map((s) => s.id).sort()).toEqual(["a", "b"]);
  });
});
