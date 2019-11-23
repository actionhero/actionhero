import * as apiExports from "../index";

export class Polyfill extends apiExports.Initializer {
  constructor() {
    super();
    this.name = "polyfill";
    this.loadPriority = 999;
  }

  async initialize(config) {
    const development =
      !config.process.env || config.process.env === "development";
    const api = apiExports.api;

    if (development) {
      apiExports.log("Polyfilling [api] object", "info");
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

    if (development) {
      apiExports.api.log("Polyfilled [api] object", "info");
      for (const key in apiExports.api) {
        apiExports.api.log(`api.${key}`, "debug");
      }
    }
  }
}
