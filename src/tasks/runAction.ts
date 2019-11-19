import { log, Task, Connection, ActionProcessor } from "./../index";

export class RunAction extends Task {
  constructor() {
    super();
    this.name = "runAction";
    this.description = "I will run an action and return the connection object";
    this.frequency = 0;
    this.queue = "default";
    this.middleware = [];
  }

  async run(params) {
    if (!params) {
      params = {};
    }

    const connection = new Connection({
      type: "task",
      remotePort: "0",
      remoteIP: "0",
      rawConnection: {}
    });

    connection.params = params;

    const actionProcessor = new ActionProcessor(connection);
    const { response } = await actionProcessor.processAction();

    if (response.error) {
      log("task error: " + response.error, "error", {
        params: JSON.stringify(params)
      });
    } else {
      log("[ action @ task ]", "debug", { params: JSON.stringify(params) });
    }

    connection.destroy();
    return response;
  }
}
