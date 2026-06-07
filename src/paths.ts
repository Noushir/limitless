import os from "node:os";
import path from "node:path";

export function limitlessDir(home: string = os.homedir()): string {
  return path.join(home, ".limitless");
}
export function runsDir(home?: string): string {
  return path.join(limitlessDir(home), "runs");
}
export function configPath(home?: string): string {
  return path.join(limitlessDir(home), "config.json");
}
