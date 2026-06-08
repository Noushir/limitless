import pty from "node-pty";

export interface PtyHostOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface PtyHost {
  onData(cb: (chunk: string) => void): void;
  onExit(cb: (code: number) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  relaunch(extraArgs: string[]): void; // respawn command with base args + extraArgs
  kill(): void;
}

export function createPtyHost(command: string, args: string[], opts: PtyHostOptions = {}): PtyHost {
  const dataCbs: ((c: string) => void)[] = [];
  const exitCbs: ((code: number) => void)[] = [];
  const baseArgs = args;
  let term: pty.IPty;

  const spawn = (spawnArgs: string[]) => {
    term = pty.spawn(command, spawnArgs, {
      name: "xterm-256color",
      cols: opts.cols ?? 80,
      rows: opts.rows ?? 24,
      cwd: opts.cwd ?? process.cwd(),
      env: opts.env ?? (process.env as Record<string, string>),
    });
    term.onData((d) => dataCbs.forEach((cb) => cb(d)));
    term.onExit((e) => exitCbs.forEach((cb) => cb(e.exitCode)));
  };

  spawn(baseArgs);

  return {
    onData(cb) { dataCbs.push(cb); },
    onExit(cb) { exitCbs.push(cb); },
    write(data) { term.write(data); },
    resize(cols, rows) { try { term.resize(cols, rows); } catch {} },
    relaunch(extraArgs) { try { term.kill(); } catch {} spawn([...baseArgs, ...extraArgs]); },
    kill() { try { term.kill(); } catch {} },
  };
}
