import * as path from "path";
import * as fs from "fs";
import { PackageJson } from "type-fest";

const getPackageJson: () => PackageJson = () => {
  return JSON.parse(
    fs
      .readFileSync(path.join(__dirname, "..", "..", "..", "package.json"))
      .toString()
  );
};

export let actionheroVersion = getPackageJson().version;
export const recalculateActionheroVersion = () =>
  (actionheroVersion = getPackageJson().version);
