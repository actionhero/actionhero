import * as path from "path";
import * as fs from "fs";

// import { CLI } from "./../../index";
// we need to load each component directly so we don't accidentally source `config... which doesn't exist`
import { CLI } from "./../../classes/cli";

const packageJSON = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/../../../package.json")).toString()
);

export class Version extends CLI {
  constructor() {
    super();
    this.name = "version";
    this.description = "return the Actionhero version within this project";
  }

  async run() {
    console.log(packageJSON.version);
    return true;
  }
}
