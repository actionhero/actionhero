import * as path from "path";
import * as fs from "fs";
import { PackageJson } from "type-fest";

const packageJson: PackageJson = JSON.parse(
  fs
    .readFileSync(path.join(__dirname, "..", "..", "..", "package.json"))
    .toString()
);

export const actionheroVersion: string = packageJson.version;
