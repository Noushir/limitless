import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, isMainModule } from "../src/cli.js";

describe("parseArgs", () => {
  it("bare invocation -> interactive (fresh)", () => {
    expect(parseArgs([])).toMatchObject({ command: "interactive", adopt: false });
  });
  it("resume -> interactive adopt", () => {
    expect(parseArgs(["resume"])).toMatchObject({ command: "interactive", adopt: true });
  });
  it("resume <id> -> interactive adopt with resumeId", () => {
    expect(parseArgs(["resume", "fee6a4d1-ce7c"])).toMatchObject({ command: "interactive", adopt: true, resumeId: "fee6a4d1-ce7c" });
  });
  it("resume with no id -> resumeId undefined", () => {
    expect(parseArgs(["resume"]).resumeId).toBeUndefined();
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
  it("--version / -v -> version", () => {
    expect(parseArgs(["--version"]).command).toBe("version");
    expect(parseArgs(["-v"]).command).toBe("version");
  });
  it("--help / -h / help -> help", () => {
    expect(parseArgs(["--help"]).command).toBe("help");
    expect(parseArgs(["-h"]).command).toBe("help");
    expect(parseArgs(["help"]).command).toBe("help");
  });
});

describe("isMainModule", () => {
  it("matches when argv1 is a symlink resolving to the module file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lim-main-"));
    const real = path.join(dir, "cli.js");
    fs.writeFileSync(real, "// stub");
    const link = path.join(dir, "limitless-link");
    fs.symlinkSync(real, link);
    const metaUrl = pathToFileURL(real).href;
    expect(isMainModule(metaUrl, link)).toBe(true); // symlink resolves to the real file
    expect(isMainModule(metaUrl, real)).toBe(true); // direct invocation
    expect(isMainModule(metaUrl, path.join(dir, "other"))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("returns false when argv1 is undefined", () => {
    expect(isMainModule("file:///x", undefined)).toBe(false);
  });
});
