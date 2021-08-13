import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI } from "./../../../index";

export class GenerateCLI extends CLI {
  constructor() {
    super();
    this.name = "generate-cli";
    this.description = "Generate a new cli command";
    this.example = "actionhero generate cli --name=<name>";
    this.inputs = {
      name: {
        required: true,
        description: "The name of the CLI Command to generate",
      },
      description: {
        required: false,
        description: "The name of the CLI Command",
        default: "an actionhero cli command",
      },
      example: {
        required: false,
        description: "An example to include for the CLI Command's help",
        default: "actionhero command --option=yes",
      },
    };
  }

  async run({
    params,
  }: {
    params: { name: string; description: string; example: string };
  }) {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/cli.ts.template")
    );

    let template = templateBuffer.toString();

    (["name", "description", "example"] as const).forEach((v) => {
      const regex = new RegExp("%%" + v + "%%", "g");
      template = template.replace(regex, params[v]);
    });

    const cliPaths = config.get<string[]>("general", "paths", "cli");
    const message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(cliPaths[0] + "/" + params.name + ".ts"),
      template
    );
    console.log(message);

    return true;
  }
}
