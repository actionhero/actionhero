import { watchFileAndAct, api, log, Initializer } from "../index";
import { configPaths } from "./../modules/config";
import * as glob from "glob";

/**
 * restarts the server when config files change
 */
export class Params extends Initializer {
  constructor() {
    super();
    this.name = "config";
    this.loadPriority = 100;
  }

  async initialize() {
    configPaths.map(configPath => {
      const files = glob.sync(`${configPath}/**/*`);
      files.map(file => {
        watchFileAndAct(file, async () => {
          log(`*** Rebooting due to config change (${file}) ***`, "info");
          await api.commands.restart();
        });
      });
    });
  }
}
