import { describe, it, expect, vi } from "vitest";
import { wireSession } from "../../src/interactive/session.js";

function fakeHost() {
  let dataCb: (c: string) => void = () => {};
  let exitCb: (code: number) => void = () => {};
  return {
    writes: [] as string[],
    emitData(c: string) { dataCb(c); },
    emitExit(code: number) { exitCb(code); },
    onData(cb: (c: string) => void) { dataCb = cb; },
    onExit(cb: (code: number) => void) { exitCb = cb; },
    write(d: string) { this.writes.push(d); },
    resize() {},
    relaunch() {},
    kill() {},
  };
}

describe("wireSession", () => {
  it("pipes host output to stdout and feeds the controller; pipes input to host", () => {
    const host = fakeHost();
    const stdout = { write: vi.fn() };
    const controller = { onOutput: vi.fn(), onInput: vi.fn(), getState: () => "pass_through" as const };

    const sendInput = wireSession({ host: host as any, stdout: stdout as any, controller: controller as any });

    host.emitData("hello from claude");
    expect(stdout.write).toHaveBeenCalledWith("hello from claude");
    expect(controller.onOutput).toHaveBeenCalledWith("hello from claude");

    sendInput("typed text");
    expect(host.writes).toContain("typed text");
    expect(controller.onInput).toHaveBeenCalledWith("typed text");
  });
});
