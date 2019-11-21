import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI } from "./../../../index";

export class GenerateInitializer extends CLI {
  constructor() {
    super();
    this.name = "generate initializer";
    this.description = "generate a new initializer";
    this.example =
      "actionhero generate initializer --name=[name] --loadPriority=[p] --startPriority=[p] --stopPriority=[p]";
    this.inputs = {
      name: { required: true },
      loadPriority: { required: true, default: 1000 },
      startPriority: { required: true, default: 1000 },
      stopPriority: { required: true, default: 1000 }
    };
  }

  async run({ params }) {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/initializer.ts.template")
    );
    let template = String(templateBuffer);

    ["name", "loadPriority", "startPriority", "stopPriority"].forEach(v => {
      const regex = new RegExp("%%" + v + "%%", "g");
      template = template.replace(regex, params[v]);
    });

    const message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(
        config.general.paths.initializer[0] + "/" + params.name + ".ts"
      ),
      template
    );
    console.log(message);

    return true;
  }
}
