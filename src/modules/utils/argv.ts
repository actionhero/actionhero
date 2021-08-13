const yargs = require("yargs/yargs"); // cannot be partially imported
const { hideBin } = require("yargs/helpers");
export const argv: { [key: string]: string } = yargs(hideBin(process.argv));
