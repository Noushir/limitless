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
  const base = join(ptyRoot, "prebuilds");
  if (existsSync(base)) {
    for (const dir of readdirSync(base)) {
      const helper = join(base, dir, "spawn-helper");
      if (existsSync(helper)) {
        try {
          chmodSync(helper, 0o755);
          console.log("[limitless postinstall] chmod +x", helper);
        } catch (e) {
          console.warn("[limitless postinstall] could not chmod", helper, String(e));
        }
      }
    }
  }
}
