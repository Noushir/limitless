import fs from "node:fs";
import { configPath } from "./paths.js";
import type { Config } from "./types.js";

export const DEFAULT_CONFIG: Config = {
  permissions: { default: "safe" },
  notify: { local: true, webhook: { url: null, format: "ntfy" } },
  guards: { maxCycles: 50, maxWallClockHours: 48, weeklyLimitBehavior: "stop" },
  pollRetry: { initialSeconds: 60, maxSeconds: 900, factor: 2 },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isObject(base) || !isObject(override)) return (override as T) ?? base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge((base as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}

export function loadConfig(home?: string): Config {
  const p = configPath(home);
  if (!fs.existsSync(p)) return DEFAULT_CONFIG;
  const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
  return deepMerge(DEFAULT_CONFIG, parsed);
}
