import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI, ParamsFrom } from "./../../../index";

export class GenerateServerCLI extends CLI {
  name = "generate-server";
  description = "Generate a new Server";
  example = "actionhero generate server --name=<name>";
  inputs = {
    name: {
      required: true as true,
      description: "The name of the Server to generate",
      letter: "n",
    },
  };

  async run({ params }: { params: ParamsFrom<GenerateServerCLI> }) {
    let templateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/server.ts.template")
    );
    let template = String(templateBuffer);

    for (const [k, v] of Object.entries(params)) {
      const regex = new RegExp("%%" + k + "%%", "g");
      template = template.replace(regex, v);
    }

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
