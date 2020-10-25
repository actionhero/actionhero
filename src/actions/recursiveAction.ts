import { Action, action } from "./../index";

export class RecursiveAction extends Action {
  constructor() {
    super();
    this.name = "recursiveAction";
    this.description = "I am an action that runs another action";
    this.outputExample = {};
  }

  async run() {
    const localResponse = { local: true };
    const actionResponse = await action.run("randomNumber");
    return Object.assign(actionResponse, localResponse);
  }
}
