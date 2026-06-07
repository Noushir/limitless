import { describe, it, expect } from "vitest";
import { buildStartArgs, buildResumeArgs, DEFAULT_CONTINUE_DIRECTIVE } from "../src/mode.js";

describe("buildStartArgs", () => {
  it("wraps a goal in a /goal prompt with json output and safe flags", () => {
    const args = buildStartArgs({ kind: "goal", condition: "tests pass" }, "safe");
    expect(args).toContain("-p");
    expect(args).toContain("/goal tests pass");
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
    expect(args).toContain("--permission-mode");
    expect(args).toContain("acceptEdits");
  });

  it("passes a plain task verbatim", () => {
    const args = buildStartArgs({ kind: "task", task: "refactor auth" }, "safe");
    expect(args).toContain("refactor auth");
    expect(args).not.toContain("/goal refactor auth");
  });

  it("yolo posture uses dangerously-skip-permissions", () => {
    const args = buildStartArgs({ kind: "task", task: "x" }, "yolo");
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--permission-mode");
  });
});

describe("buildResumeArgs", () => {
  it("resumes a known session with a continuation directive", () => {
    const args = buildResumeArgs("s-1", "safe");
    expect(args).toContain("--resume");
    expect(args).toContain("s-1");
    expect(args).toContain(DEFAULT_CONTINUE_DIRECTIVE);
  });

  it("falls back to --continue when no session id is known", () => {
    const args = buildResumeArgs(null, "safe");
    expect(args).toContain("--continue");
    expect(args).not.toContain("--resume");
  });
});
