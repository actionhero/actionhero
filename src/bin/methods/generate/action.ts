import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI, ParamsFrom } from "./../../../index";

export class GenerateActionCLI extends CLI {
  name = "generate-action";
  description = "Generate a new Action";
  example =
    "actionhero generate action --name=<name> --description=[description]";
  inputs = {
    name: {
      required: true,
      description: "The name of the Action to Generate",
      letter: "n",
    },
    description: {
      required: false,
      description: "The description of the Action",
      default: "an actionhero action",
      letter: "d",
    },
  };

  async run({ params }: { params: ParamsFrom<GenerateActionCLI> }) {
    let actionTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "../../../../templates/action.ts.template")
    );
    let actionTemplate = actionTemplateBuffer.toString();

    let testTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/test/action.ts.template")
    );
    let testTemplate = testTemplateBuffer.toString();

    for (const [k, v] of Object.entries(params)) {
      const regex = new RegExp("%%" + k + "%%", "g");
      actionTemplate = actionTemplate.replace(regex, v);
      testTemplate = testTemplate.replace(regex, v);
    }

    let message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(config.general.paths.action[0]) +
        "/" +
        params.name +
        ".ts",
      actionTemplate
    );
    console.info(message);

    message = utils.fileUtils.createFileSafely(
      config.general.paths.test[0] + "/actions/" + params.name + ".ts",
      testTemplate
    );
    console.info(message);

    return true;
  }
}
