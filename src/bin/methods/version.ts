import * as path from "path";
// import { CLI } from "./../../index";
// we need to load each component directly so we don't accidentally source `config... which doesn't exist`
import { CLI } from "./../../classes/cli";

const packageJSON = require(path.join(__dirname, "/../../../package.json"));

export class Version extends CLI {
  constructor() {
    super();
    this.name = "version";
    this.description = "return the ActionHero version within this project";
  }

  async run() {
    console.log(packageJSON.version);
    return true;
  }
}
