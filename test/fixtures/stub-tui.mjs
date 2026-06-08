#!/usr/bin/env node
// Echoes a banner, then echoes back anything it receives on stdin, prefixed.
// Set raw mode so the PTY line discipline does not translate \r -> \n.
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write("STUB-TUI-READY\n");
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => {
  process.stdout.write("GOT:" + d.replace(/\r/g, "<CR>"));
  if (d.includes("quit")) process.exit(0);
});
setTimeout(() => process.exit(0), 5000);
