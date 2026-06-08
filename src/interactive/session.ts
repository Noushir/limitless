import type { PtyHost } from "./host.js";
import type { ResumeController } from "./resume-controller.js";

export interface WireOptions {
  host: PtyHost;
  stdout: { write(data: string): void };
  controller: Pick<ResumeController, "onOutput" | "onInput">;
}

// Wire host<->controller<->stdout. Returns a function to feed user input
// (so the caller owns raw-stdin/resize/teardown, which can't be unit-tested headlessly).
export function wireSession(opts: WireOptions): (data: string) => void {
  opts.host.onData((chunk) => {
    opts.stdout.write(chunk); // transparent passthrough
    opts.controller.onOutput(chunk);
  });
  return (data: string) => {
    opts.controller.onInput(data); // presence + Enter-to-resume
    opts.host.write(data); // passthrough to claude
  };
}
