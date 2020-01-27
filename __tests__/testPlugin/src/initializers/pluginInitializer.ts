import { api, Initializer } from "../../../../src/index";

export class PluginInitializer extends Initializer {
  constructor() {
    super();
    this.name = "pluginInitializer";
  }

  async initialize() {
    api.pluginInitializer = { here: true };
  }

  async stop() {
    // this seems silly, but is needed for testing, as we never clear properties on the API object
    delete api.pluginInitializer;
  }
}
