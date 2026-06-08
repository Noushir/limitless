import { describe, it, expect } from "vitest";
import { interactivePermissionFlags, buildInteractiveArgs } from "../../src/interactive/args.js";

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
