import { describe, it, expect } from "vitest";
import { MARK, brandLogo, brandStatus, terminalTitle } from "../../src/interactive/brand.js";

// Visible text only: strip SGR color codes and OSC sequences so we can measure box width.
const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\][^\x07]*\x07/g, "");

describe("brand", () => {
  it("MARK is the infinity glyph", () => {
    expect(MARK).toBe("∞");
  });

  it("brandLogo draws a boxed wordmark with the tagline and posture in bold green", () => {
    const logo = brandLogo("safe");
    expect(logo).toContain("∞ limitless");
    expect(logo).toContain("keeps your session alive across usage limits"); // tagline (was missing before)
    expect(logo).toContain("posture: safe");
    expect(logo).toContain("\x1b[1;32m"); // bold green
    expect(logo).toMatch(/[╭╮╰╯│─]/); // box drawing
  });

  it("brandLogo box stays aligned despite ANSI color codes", () => {
    const rows = brandLogo("safe").split("\n").filter((l) => /[╭│╰]/.test(l));
    const widths = new Set(rows.map((r) => [...visible(r)].length));
    expect(widths.size).toBe(1); // every box row has the same visible width
    expect(rows.length).toBeGreaterThanOrEqual(5); // top + 3 content rows + bottom
  });

  it("brandLogo calls out the AUTO safety warning beneath the box", () => {
    expect(brandLogo("auto")).toMatch(/unattended/i);
    expect(brandLogo("safe")).not.toMatch(/unattended/i);
  });

  it("terminalTitle wraps text in an OSC title sequence", () => {
    expect(terminalTitle("∞ limitless — Claude")).toBe("\x1b]0;∞ limitless — Claude\x07");
  });

  it("brandStatus formats a single branded, newline-terminated line", () => {
    const line = brandStatus("the limit reset — continuing your session");
    expect(line).toContain("∞ limitless");
    expect(line).toContain("\x1b[1;32m"); // bold green mark
    expect(line).toContain("the limit reset — continuing your session");
    expect(line.endsWith("\n")).toBe(true);
  });
});
