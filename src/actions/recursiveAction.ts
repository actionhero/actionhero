import { Action, action } from "./../index";

export class RecursiveAction extends Action {
  name = "recursiveAction";
  description = "I am an action that runs another action";
  outputExample = {};

  async run() {
    const localResponse = { local: true };
    const actionResponse = await action.run("randomNumber");
    return Object.assign(actionResponse, localResponse);
  }
}
