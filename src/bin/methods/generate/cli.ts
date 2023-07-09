import * as fs from "fs";
import * as path from "path";
import { config, utils, ParamsFrom, CLI } from "./../../../index";

export class GenerateCLICLI extends CLI {
  name = "generate-cli";
  description = "Generate a new cli command";
  example = "actionhero generate cli --name=<name>";
  inputs = {
    name: {
      required: true as true as true,
      description: "The name of the CLI Command to generate",
      letter: "n",
    },
    description: {
      required: false,
      description: "The name of the CLI Command",
      default: "an actionhero cli command",
      letter: "d",
    },
    example: {
      required: false,
      description: "An example to include for the CLI Command's help",
      default: "actionhero command --option=yes",
      letter: "e",
    },
  };

  async run({ params }: { params: ParamsFrom<GenerateCLICLI> }) {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/cli.ts.template"),
    );

    let template = templateBuffer.toString();

    for (const [k, v] of Object.entries(params)) {
      const regex = new RegExp("%%" + k + "%%", "g");
      template = template.replace(regex, v);
    }

    const message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(
        config.general.paths.cli[0] + "/" + params.name + ".ts",
      ),
      template,
    );
    console.log(message);

    return true;
  }
}
