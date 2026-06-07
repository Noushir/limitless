export function main(argv: string[]): void {
  void argv;
  console.log("limitless");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
