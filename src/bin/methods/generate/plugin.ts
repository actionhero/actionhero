import * as fs from "fs";
import * as path from "path";
import { api, CLI } from "./../../../index";

const PackageJSON = require(path.join(
  __dirname,
  "..",
  "..",
  "..",
  "package.json"
));

export class GeneratePlugin extends CLI {
  constructor() {
    super();
    this.name = "generate plugin";
    this.description =
      "generate the structure of a new actionhero plugin in an empty directory";
    this.example = "actionhero generate plugin";
    this.inputs = {};
  }

  async run() {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../templates/package-plugin.json")
    );
    let template = String(templateBuffer);

    const regex = new RegExp("%%versionNumber%%", "g");
    template = template.replace(regex, PackageJSON.version);

    [
      "actions",
      "tasks",
      "initializers",
      "servers",
      "config",
      "bin",
      "public"
    ].forEach(type => {
      try {
        const message = api.utils.createDirSafely(
          path.join(process.cwd(), type),
          template
        );
        console.info(message);
      } catch (error) {
        console.log(error.toString());
      }
    });

    const message = api.utils.createFileSafely(
      path.join(process.cwd(), "package.json"),
      template
    );
    console.info(message);

    return true;
  }
}
