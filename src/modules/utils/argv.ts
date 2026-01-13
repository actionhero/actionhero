const minimist = require("minimist");

// Minimal replacement for yargs' hideBin helper.
const hideBin = (argv: string[]) => argv.slice(2);

export const argv: Record<string, unknown> = minimist(hideBin(process.argv));
