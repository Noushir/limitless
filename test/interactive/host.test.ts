import { describe, it, expect } from "vitest";
import path from "node:path";
import { createPtyHost } from "../../src/interactive/host.js";

const stub = path.resolve("test/fixtures/stub-tui.mjs");

describe("PtyHost", () => {
  it("captures child output and forwards written input", async () => {
    const chunks: string[] = [];
    const host = createPtyHost("node", [stub], { cols: 80, rows: 24 });
    host.onData((c) => chunks.push(c));

    await new Promise((r) => setTimeout(r, 600));
    host.write("hello\r");
    await new Promise((r) => setTimeout(r, 600));

    const all = chunks.join("");
    expect(all).toContain("STUB-TUI-READY");
    expect(all).toContain("GOT:hello<CR>");

    await new Promise<void>((resolve) => {
      host.onExit(() => resolve());
      host.write("quit\r");
    });
  });
});
