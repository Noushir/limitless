import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  it("bare invocation -> interactive (fresh)", () => {
    expect(parseArgs([])).toMatchObject({ command: "interactive", adopt: false });
  });
  it("resume -> interactive adopt", () => {
    expect(parseArgs(["resume"])).toMatchObject({ command: "interactive", adopt: true });
  });
  it("interactive posture flags", () => {
    expect(parseArgs(["--safe"]).posture).toBe("safe");
    expect(parseArgs(["--normal"]).posture).toBe("normal");
    expect(parseArgs([]).posture).toBeUndefined();
  });
  it("passthrough after --", () => {
    expect(parseArgs(["--", "--model", "opus"]).passthrough).toEqual(["--model", "opus"]);
  });
  it("headless task", () => {
    expect(parseArgs(["headless", "do x"])).toMatchObject({ command: "headless" });
    expect(parseArgs(["headless", "do x"]).headless).toMatchObject({ mode: { kind: "task", task: "do x" } });
  });
  it("headless --goal", () => {
    expect(parseArgs(["headless", "--goal", "tests pass"]).headless).toMatchObject({ mode: { kind: "goal", condition: "tests pass" } });
  });
  it("status / config subcommands", () => {
    expect(parseArgs(["status"]).command).toBe("status");
    expect(parseArgs(["config"]).command).toBe("config");
  });
});
