import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI } from "./../../../index";

export class GenerateTask extends CLI {
  constructor() {
    super();
    this.name = "generate task";
    this.description = "generate a new task";
    this.example =
      "actionhero generate task --name=[name] --description=[description] --scope=[scope] --frequency=[frequency]";
    this.inputs = {
      name: { required: true },
      queue: { required: true },
      description: { required: true, default: "an actionhero task" },
      frequency: { required: true, default: 0 }
    };
  }

  async run({ params }) {
    let taskTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/task.ts.template")
    );
    let taskTemplate = String(taskTemplateBuffer);

    let testTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/test/task.ts.template")
    );
    let testTemplate = String(testTemplateBuffer);

    ["name", "description", "queue", "frequency"].forEach(v => {
      const regex = new RegExp("%%" + v + "%%", "g");
      taskTemplate = taskTemplate.replace(regex, params[v]);
      testTemplate = testTemplate.replace(regex, params[v]);
    });

    let message = utils.fileUtils.createFileSafely(
      utils.replaceDistWithSrc(
        config.general.paths.task[0] + "/" + params.name + ".ts"
      ),
      taskTemplate
    );
    console.info(message);

    message = utils.fileUtils.createFileSafely(
      config.general.paths.test[0] + "/tasks/" + params.name + ".ts",
      testTemplate
    );
    console.info(message);

    return true;
  }
}
