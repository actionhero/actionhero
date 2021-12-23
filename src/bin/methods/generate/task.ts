import * as fs from "fs";
import * as path from "path";
import { config, utils, CLI, ParamsFrom } from "./../../../index";

export class GenerateTaskCLI extends CLI {
  name = "generate-task";
  description = "Generate a new Task";
  example =
    "actionhero generate task --name=<name> -queue=<queue> --description=[description] --frequency=[frequency]";
  inputs = {
    name: {
      required: true,
      description: "The name of the Task to generate",
      letter: "n",
    },
    queue: {
      required: true,
      description: "The queue that this Task will run on",
      letter: "q",
    },
    description: {
      required: true,
      description: "The description of this Task",
      default: "an actionhero task",
      letter: "d",
    },
    frequency: {
      required: true,
      description: "Should this Task run periodically? Frequency is in ms",
      default: "0",
      letter: "f",
    },
  };

  async run({ params }: { params: ParamsFrom<GenerateTaskCLI> }) {
    let taskTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/task.ts.template")
    );
    let taskTemplate = String(taskTemplateBuffer);

    let testTemplateBuffer = fs.readFileSync(
      path.join(__dirname, "/../../../../templates/test/task.ts.template")
    );
    let testTemplate = String(testTemplateBuffer);

    for (const [k, v] of Object.entries(params)) {
      const regex = new RegExp("%%" + k + "%%", "g");
      taskTemplate = taskTemplate.replace(regex, v);
      testTemplate = testTemplate.replace(regex, v);
    }

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
