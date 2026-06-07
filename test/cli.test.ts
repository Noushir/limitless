import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  it("parses a goal run", () => {
    const r = parseArgs(["--goal", "tests pass"]);
    expect(r).toMatchObject({ command: "run", mode: { kind: "goal", condition: "tests pass" } });
  });

  it("parses a plain task from the positional arg", () => {
    const r = parseArgs(["refactor the auth module"]);
    expect(r).toMatchObject({ command: "run", mode: { kind: "task", task: "refactor the auth module" } });
  });

  it("parses --continue", () => {
    const r = parseArgs(["--continue"]);
    expect(r).toMatchObject({ command: "run", mode: { kind: "continue" } });
  });

  it("maps --yolo and --safe to a posture override", () => {
    expect(parseArgs(["x", "--yolo"]).postureOverride).toBe("yolo");
    expect(parseArgs(["x", "--safe"]).postureOverride).toBe("safe");
  });

  it("parses the status subcommand", () => {
    expect(parseArgs(["status"]).command).toBe("status");
  });
});
