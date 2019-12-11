import { Action } from "../../../../src/index";

module.exports = class PluginAction extends Action {
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
