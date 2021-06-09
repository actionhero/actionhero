import * as path from "path";
import * as fs from "fs";

const packageJson = JSON.parse(
  fs
    .readFileSync(path.join(__dirname, "..", "..", "..", "package.json"))
    .toString()
);

export const actionheroVersion: string = packageJson.version;
