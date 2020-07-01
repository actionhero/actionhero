import { Task } from "../../../../src/index";

export class PluginTask extends Task {
  constructor() {
    super();
    this.name = "pluginTask";
    this.description = "pluginTask";
    this.frequency = 0;
    this.queue = "default";
  }

  async run(params) {
    return true;
  }
}
