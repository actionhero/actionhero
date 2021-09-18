import { api, log, task, CLI } from "./../../../index";

export class TaskEnqueueCLI extends CLI {
  constructor() {
    super();
    this.name = "task-enqueue";
    this.description = "Enqueue a defined Task into your actionhero cluster";
    this.example =
      "actionhero task enqueue --name=[taskName] --args=[JSON-encoded args]";
    this.inputs = {
      name: { required: true, description: "The name of the Task to enqueue" },
      args: {
        required: false,
        description: "Arguments to the Task (JSON encoded)",
      },
    };
  }

  async run({ params }: { params: { name: string; args: string } }) {
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
