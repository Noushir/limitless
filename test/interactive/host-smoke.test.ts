import { describe, it, expect } from "vitest";
import pty from "node-pty";

describe("node-pty environment", () => {
  it("can fork a process in a pty and capture its output", async () => {
    const out = await new Promise<string>((resolve) => {
      const term = pty.spawn("/bin/echo", ["hello-pty"], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env as Record<string, string>,
      });
      let buf = "";
      term.onData((d) => (buf += d));
      term.onExit(() => resolve(buf));
      setTimeout(() => { try { term.kill(); } catch {} resolve(buf); }, 3000);
    });
    expect(out).toContain("hello-pty");
  });
});
