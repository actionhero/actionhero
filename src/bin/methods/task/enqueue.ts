import { api, log, task, CLI, ParamsFrom } from "./../../../index";

export class TaskEnqueueCLI extends CLI {
  name = "task-enqueue";
  description = "Enqueue a defined Task into your actionhero cluster";
  example =
    "actionhero task enqueue --name=[taskName] --args=[JSON-encoded args]";
  inputs = {
    name: {
      required: true,
      description: "The name of the Task to enqueue",
      letter: "n",
    },
    args: {
      required: false,
      description: "Arguments to the Task (JSON encoded)",
      letter: "a",
    },
  };

  async run({ params }: { params: ParamsFrom<TaskEnqueueCLI> }) {
    if (!api.tasks.tasks[params.name]) {
      throw new Error('Task "' + params.name + '" not found');
    }

    let args = {};
    if (params.args) {
      args = JSON.parse(params.args);
    }

    const toRun = await task.enqueue(params.name, args);
    log(`enqueued: ${toRun}`, "info");
    return true;
  }
}
