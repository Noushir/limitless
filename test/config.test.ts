import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_CONFIG, loadConfig } from "../src/config.js";
import { configPath, limitlessDir } from "../src/paths.js";

let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "limitless-cfg-"));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    expect(loadConfig(home)).toEqual(DEFAULT_CONFIG);
  });

  it("deep-merges a partial file over defaults", () => {
    fs.mkdirSync(limitlessDir(home), { recursive: true });
    fs.writeFileSync(
      configPath(home),
      JSON.stringify({ guards: { weeklyLimitBehavior: "wait" } }),
    );
    const cfg = loadConfig(home);
    expect(cfg.guards.weeklyLimitBehavior).toBe("wait");
    expect(cfg.guards.maxCycles).toBe(DEFAULT_CONFIG.guards.maxCycles);
    expect(cfg.permissions.default).toBe("safe");
  });

  it("defaults interactive.permissions to auto", () => {
    expect(loadConfig(home).interactive.permissions).toBe("auto");
  });

  it("lets a partial file override interactive.permissions", () => {
    fs.mkdirSync(limitlessDir(home), { recursive: true });
    fs.writeFileSync(configPath(home), JSON.stringify({ interactive: { permissions: "safe" } }));
    expect(loadConfig(home).interactive.permissions).toBe("safe");
  });
});
