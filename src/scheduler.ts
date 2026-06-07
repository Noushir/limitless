import type { Config } from "./types.js";

export interface Clock {
  now(): number; // unix epoch seconds
  sleep(seconds: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Math.floor(Date.now() / 1000),
  sleep: (seconds) => new Promise((r) => setTimeout(r, Math.max(0, seconds) * 1000)),
};

export interface WaitInput {
  resetsAt?: number;
  attempt: number; // 1-based
  now: number;
  config: Config;
  marginSeconds?: number;
}

export function nextWaitSeconds(input: WaitInput): number {
  const margin = input.marginSeconds ?? 30;
  if (typeof input.resetsAt === "number") {
    return Math.max(margin, input.resetsAt - input.now + margin);
  }
  const { initialSeconds, maxSeconds, factor } = input.config.pollRetry;
  const backoff = initialSeconds * Math.pow(factor, Math.max(0, input.attempt - 1));
  return Math.min(maxSeconds, backoff);
}
