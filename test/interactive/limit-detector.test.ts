import { describe, it, expect } from "vitest";
import { stripAnsi, createLimitDetector } from "../../src/interactive/limit-detector.js";

describe("stripAnsi", () => {
  it("removes CSI escape sequences", () => {
    expect(stripAnsi("\x1b[31mhi\x1b[0m")).toBe("hi");
  });
});

describe("limit detector", () => {
  it("does not fire on normal output", () => {
    const d = createLimitDetector();
    expect(d.push("just some assistant text\n")).toBe(false);
  });

  it("fires on a limit banner (with ansi)", () => {
    const d = createLimitDetector();
    expect(d.push("\x1b[2m\x1b[33mYou've hit your usage limit · resets 3:45pm\x1b[0m")).toBe(true);
  });

  it("detects a banner split across chunks", () => {
    const d = createLimitDetector();
    expect(d.push("...working...\nYou've hit your ")).toBe(false);
    expect(d.push("session limit\n")).toBe(true);
  });

  it("can be reset and re-armed", () => {
    const d = createLimitDetector();
    expect(d.push("usage limit reached")).toBe(true);
    d.reset();
    expect(d.push("normal output")).toBe(false);
  });
});
