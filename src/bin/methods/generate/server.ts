import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI } from "./../../../index";

export class GenerateServer extends CLI {
  constructor() {
    super();
    this.name = "generate server";
    this.description = "generate a new server";
    this.example = "actionhero generate server --name=[name]";
    this.inputs = {
      name: { required: true }
    };
  }

  async run({ params }) {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/server.ts.template")
    );
    let template = String(templateBuffer);

    ["name"].forEach(v => {
      const regex = new RegExp("%%" + v + "%%", "g");
      template = template.replace(regex, params[v]);
    });

    const message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(
        config.general.paths.server[0] + "/" + params.name + ".ts"
      ),
      template
    );
    console.log(message);

    return true;
  }
}
