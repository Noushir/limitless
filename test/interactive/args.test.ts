import { describe, it, expect } from "vitest";
import { interactivePermissionFlags, buildInteractiveArgs, passthroughEscalates } from "../../src/interactive/args.js";

describe("interactivePermissionFlags", () => {
  it("auto -> skip permissions", () => {
    expect(interactivePermissionFlags("auto")).toEqual(["--dangerously-skip-permissions"]);
  });
  it("safe -> acceptEdits + allowlist", () => {
    const f = interactivePermissionFlags("safe");
    expect(f).toContain("--permission-mode");
    expect(f).toContain("acceptEdits");
    expect(f).toContain("--allowed-tools");
  });
  it("normal -> no permission flags", () => {
    expect(interactivePermissionFlags("normal")).toEqual([]);
  });
});

describe("buildInteractiveArgs", () => {
  it("fresh launch: just permission flags", () => {
    expect(buildInteractiveArgs({ adopt: false, posture: "auto" })).toEqual(["--dangerously-skip-permissions"]);
  });
  it("adopt: prepends --continue", () => {
    const a = buildInteractiveArgs({ adopt: true, posture: "auto" });
    expect(a[0]).toBe("--continue");
    expect(a).toContain("--dangerously-skip-permissions");
  });
  it("passthrough args are appended", () => {
    const a = buildInteractiveArgs({ adopt: false, posture: "normal", passthrough: ["--model", "opus"] });
    expect(a).toEqual(["--model", "opus"]);
  });
  it("resume with a session id uses --resume <id>, not --continue", () => {
    const a = buildInteractiveArgs({ adopt: true, resumeId: "fee6a4d1", posture: "safe" });
    expect(a).toContain("--resume");
    expect(a).toContain("fee6a4d1");
    expect(a).not.toContain("--continue");
  });
  it("resume without an id falls back to --continue", () => {
    const a = buildInteractiveArgs({ adopt: true, posture: "safe" });
    expect(a).toContain("--continue");
    expect(a).not.toContain("--resume");
  });
});

describe("passthroughEscalates", () => {
  it("flags a skip-permissions passthrough under a non-auto posture", () => {
    expect(passthroughEscalates("safe", ["--dangerously-skip-permissions"])).toBe(true);
    expect(passthroughEscalates("normal", ["--permission-mode", "acceptEdits"])).toBe(true);
  });
  it("does not flag clean passthrough or auto posture", () => {
    expect(passthroughEscalates("safe", ["--model", "opus"])).toBe(false);
    expect(passthroughEscalates("auto", ["--dangerously-skip-permissions"])).toBe(false);
    expect(passthroughEscalates("safe", undefined)).toBe(false);
  });
});
