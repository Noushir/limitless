import { describe, it, expect } from "vitest";
import { MARK, brandLogo, brandStatus } from "../../src/interactive/brand.js";

describe("brand", () => {
  it("MARK is the infinity glyph", () => {
    expect(MARK).toBe("∞");
  });

  it("brandLogo shows the ∞ limitless wordmark in bold green and keeps the posture description", () => {
    const logo = brandLogo("limitless: posture=SAFE — edits auto-approved; raw shell/network gated.");
    expect(logo).toContain("∞ limitless");
    expect(logo).toContain("\x1b[1;32m"); // bold green
    expect(logo).toContain("posture=SAFE"); // posture description preserved
    expect(logo).not.toContain("limitless: posture"); // redundant prefix stripped (logo carries the brand)
  });

  it("brandLogo preserves the AUTO safety warning", () => {
    const logo = brandLogo("limitless: posture=AUTO — all tool approvals bypassed (shell + network run unattended). Use --safe or --normal to reduce.");
    expect(logo).toMatch(/unattended/i);
  });

  it("brandStatus formats a single branded, newline-terminated line", () => {
    const line = brandStatus("usage limit reached — waiting for 1:10am (Europe/London), then continuing");
    expect(line).toContain("∞ limitless");
    expect(line).toContain("\x1b[1;32m"); // bold green mark
    expect(line).toContain("usage limit reached — waiting for 1:10am (Europe/London), then continuing");
    expect(line.endsWith("\n")).toBe(true);
  });
});
