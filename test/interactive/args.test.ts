import { describe, it, expect } from "vitest";
import { interactivePermissionFlags, buildInteractiveArgs, postureBanner, passthroughEscalates } from "../../src/interactive/args.js";

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
});

describe("postureBanner", () => {
  it("auto banner warns about bypassed approvals", () => {
    expect(postureBanner("auto")).toMatch(/AUTO/);
    expect(postureBanner("auto")).toMatch(/bypassed/i);
  });
  it("safe and normal banners are informative", () => {
    expect(postureBanner("safe")).toMatch(/SAFE/);
    expect(postureBanner("normal")).toMatch(/NORMAL/);
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
