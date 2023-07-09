import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI, ParamsFrom } from "./../../../index";

export class GenerateInitializerCLI extends CLI {
  name = "generate-initializer";
  description = "Generate a new Initializer";
  example =
    "actionhero generate initializer --name=<name> --loadPriority=[p] --startPriority=[p] --stopPriority=[p]";
  inputs = {
    name: {
      required: true as true,
      description: "The name of the Initializer to generate",
      letter: "n",
    },
    loadPriority: {
      required: true as true,
      description: "The order that this Initializer will initialize",
      default: "1000",
    },
    startPriority: {
      required: true as true,
      description: "The order that this Initializer will start",
      default: "1000",
    },
    stopPriority: {
      required: true as true,
      description: "The order that this Initializer will stop",
      default: "1000",
    },
  };

  async run({ params }: { params: ParamsFrom<GenerateInitializerCLI> }) {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/initializer.ts.template"),
    );
    let template = String(templateBuffer);

    for (const [k, v] of Object.entries(params)) {
      const regex = new RegExp("%%" + k + "%%", "g");
      template = template.replace(regex, v);
    }

    const message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(
        config.general.paths.initializer[0] + "/" + params.name + ".ts",
      ),
      template,
    );
    console.log(message);

    return true;
  }
}
