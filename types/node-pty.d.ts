// Local type contract for the `node-pty` import, decoupled from whichever distribution backs
// the alias. We install @homebridge/node-pty-prebuilt-multiarch (for prebuilt binaries, so
// users don't need a C++ toolchain) under the `node-pty` name, but that fork ships its types
// under `declare module '@homebridge/node-pty-prebuilt-multiarch'`, which doesn't match the
// `node-pty` specifier. This shim declares exactly the surface src/interactive/host.ts uses,
// so the type contract stays stable regardless of the backing package.
declare module "node-pty" {
  export interface IPtyForkOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: { [key: string]: string | undefined };
  }

  export interface IExitEvent {
    exitCode: number;
    signal?: number;
  }

  export interface IPty {
    onData(callback: (data: string) => void): void;
    onExit(callback: (e: IExitEvent) => void): void;
    write(data: string): void;
    resize(columns: number, rows: number): void;
    kill(signal?: string): void;
  }

  export function spawn(file: string, args: string[] | string, options: IPtyForkOptions): IPty;
}
