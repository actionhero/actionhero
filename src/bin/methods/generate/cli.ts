import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI } from "./../../../index";

export class GenerateCLI extends CLI {
  constructor() {
    super();
    this.name = "generate cli";
    this.description = "generate a new cli command";
    this.example = "actionhero generate cli --name=[name]";
    this.inputs = {
      name: { required: true },
      description: { required: false, default: "an actionhero cli command" },
      example: { required: false, default: "actionhero command --option=yes" }
    };
  }

  async run({ params }) {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/cli.ts.template")
    );

    let template = templateBuffer.toString();

    ["name", "description", "example"].forEach(v => {
      const regex = new RegExp("%%" + v + "%%", "g");
      template = template.replace(regex, params[v]);
    });

    const message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(
        config.general.paths.cli[0] + "/" + params.name + ".ts"
      ),
      template
    );
    console.log(message);

    return true;
  }
}
