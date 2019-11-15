import * as fs from "fs";
import * as path from "path";
import { api, CLI } from "./../../../index";

export class GenerateAction extends CLI {
  constructor() {
    super();
    this.name = "generate action";
    this.description = "generate a new action";
    this.example =
      "actionhero generate action --name=[name] --description=[description]";
    this.inputs = {
      name: { required: true },
      description: { required: true, default: "an actionhero action" }
    };
  }

  async run({ params }) {
    let actionTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "../../../../templates/action.ts.template")
    );
    let actionTemplate = actionTemplateBuffer.toString();

    let testTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/test/action.ts.template")
    );
    let testTemplate = testTemplateBuffer.toString();

    ["name", "description"].forEach(v => {
      const regex = new RegExp("%%" + v + "%%", "g");
      actionTemplate = actionTemplate.replace(regex, params[v]);
      testTemplate = testTemplate.replace(regex, params[v]);
    });

    let message = api.utils.createFileSafely(
      api.utils.replaceDistWithSrc(api.config.general.paths.action[0]) +
        "/" +
        params.name +
        ".ts",
      actionTemplate
    );
    console.info(message);

    message = api.utils.createFileSafely(
      api.config.general.paths.test[0] + "/actions/" + params.name + ".ts",
      testTemplate
    );
    console.info(message);

    return true;
  }
}
