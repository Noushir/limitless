import { chmodSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ptyRoot = null;
try {
  ptyRoot = dirname(require.resolve("node-pty/package.json"));
} catch {
  // node-pty not installed; nothing to do.
}

if (ptyRoot) {
  // node-pty's spawn-helper must be executable or macOS spawns fail with posix_spawnp.
  // Depending on whether the binary was prebuilt-extracted or compiled from source it lands
  // in build/Release/ or prebuilds/<platform>/, so chmod whichever copies we find (best-effort).
  const candidates = [];
  const release = join(ptyRoot, "build", "Release", "spawn-helper");
  if (existsSync(release)) candidates.push(release);
  const prebuilds = join(ptyRoot, "prebuilds");
  if (existsSync(prebuilds)) {
    for (const dir of readdirSync(prebuilds)) {
      const helper = join(prebuilds, dir, "spawn-helper");
      if (existsSync(helper)) candidates.push(helper);
    }
  }
  for (const helper of candidates) {
    try {
      chmodSync(helper, 0o755);
      console.log("[limitless postinstall] chmod +x", helper);
    } catch (e) {
      console.warn("[limitless postinstall] could not chmod", helper, String(e));
    }
  }
}
