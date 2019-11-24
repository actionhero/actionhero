import * as path from "path";

const packageJson = require(path.join(
  __dirname,
  "..",
  "..",
  "..",
  "package.json"
));

export const actionheroVersion = packageJson.version;
