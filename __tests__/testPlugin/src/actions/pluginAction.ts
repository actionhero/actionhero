import { Action } from "../../../../src/index";

export default class PluginAction extends Action {
  constructor() {
    super();
    this.name = "pluginAction";
    this.description = "pluginAction";
    this.outputExample = {};
  }

  async run({ response }) {
    response.cool = true;
  }
};
