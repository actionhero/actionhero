import { log, Task, action } from "./../index";

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
    if (!params) params = {};

    const response = await action.run(
      params.action,
      params.version,
      params.params
    );

    if (response.error) {
      log("task error: " + response.error, "error", {
        params: JSON.stringify(params),
      });
    } else {
      log("[ action @ task ]", "debug", { params: JSON.stringify(params) });
    }

    return response;
  }
}
