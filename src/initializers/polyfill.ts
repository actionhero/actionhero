import * as apiExports from "../index";

export class Polyfill extends apiExports.Initializer {
  constructor() {
    super();
    this.name = "polyfill";
    this.loadPriority = 999;
  }

  async initialize(config) {
    if (config.general.legacyApiPolyfill) {
      const development =
        !config.process.env || config.process.env === "development";
      const api = apiExports.api;

      if (development) {
        const message = `Polyfilling the [api] object...
        Accessing modules via the api object 
        (e.g. api.log, api.cache, api.tasks) will 
        soon be deprecated in favor of importing those 
        namespaces from Actionhero directly.`;
        apiExports.log(message, "info");
      }

      for (const key in apiExports) {
        if (development) {
          apiExports.log(`apiExports.${key}`, "debug");
        }

        if (key === "api" || api[key]) {
          continue;
        }

        api[key] = apiExports[key];
      }

      // Don't forget the config!
      api.config = config;

      if (development) {
        apiExports.api.log("Polyfilled [api] object", "debug");
        for (const key in apiExports.api) {
          apiExports.api.log(`api.${key}`, "debug");
        }
      }
    }
  }
}
