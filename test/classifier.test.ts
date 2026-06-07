import { describe, it, expect } from "vitest";
import { classify } from "../src/classifier.js";
import type { ClaudeResult } from "../src/types.js";

const base: ClaudeResult = { exitCode: 0, stdout: "", stderr: "" };

describe("classify", () => {
  it("clean exit is done", () => {
    expect(classify({ ...base, exitCode: 0, stdout: "all set" }).verdict).toBe("done");
  });

  it("detects a session (5-hour) limit from stderr text", () => {
    const r = classify({
      ...base,
      exitCode: 1,
      stderr: "You've hit your session limit · resets 3:45pm",
    });
    expect(r.verdict).toBe("rate_limited");
    expect(r.limitWindow).toBe("five_hour");
  });

  it("detects a weekly limit", () => {
    const r = classify({
      ...base,
      exitCode: 1,
      stderr: "You've hit your weekly limit · resets Mon 12:00am",
    });
    expect(r.verdict).toBe("rate_limited");
    expect(r.limitWindow).toBe("seven_day");
  });

  it("reads a structured resetsAt and sessionId from json", () => {
    const r = classify({
      ...base,
      exitCode: 1,
      json: { subtype: "rate_limit", session_id: "s-1", resets_at: 1_738_425_600 },
    });
    expect(r.verdict).toBe("rate_limited");
    expect(r.resetsAt).toBe(1_738_425_600);
    expect(r.sessionId).toBe("s-1");
  });

  it("non-zero exit with no limit marker is an error", () => {
    const r = classify({ ...base, exitCode: 2, stderr: "ENOENT: bad config" });
    expect(r.verdict).toBe("error");
  });

  it("captures sessionId on a successful run", () => {
    const r = classify({ ...base, exitCode: 0, json: { session_id: "s-9" } });
    expect(r.sessionId).toBe("s-9");
  });
});
