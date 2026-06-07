import fs from "node:fs";
import path from "node:path";
import { runsDir } from "./paths.js";
import type { RunState } from "./types.js";

function fileFor(id: string, home?: string): string {
  return path.join(runsDir(home), `${id}.json`);
}

export function saveRunState(state: RunState, home?: string): void {
  fs.mkdirSync(runsDir(home), { recursive: true });
  fs.writeFileSync(fileFor(state.id, home), JSON.stringify(state, null, 2));
}

export function loadRunState(id: string, home?: string): RunState | null {
  const p = fileFor(id, home);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as RunState;
}

export function listRunStates(home?: string): RunState[] {
  const dir = runsDir(home);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as RunState);
}
