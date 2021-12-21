import { log, Task, action, ParamsFrom } from "./../index";

export class RunAction extends Task {
  name = "runAction";
  description = "I will run an action and return the connection object";
  frequency = 0;
  queue = "default";

  async run(params: ParamsFrom<RunAction>) {
    if (!params) params = {};

    const response = await action.run(
      params.action,
      params.version,
      // @ts-ignore
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
