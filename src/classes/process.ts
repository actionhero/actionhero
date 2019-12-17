import * as path from "path";
import * as glob from "glob";
import * as fs from "fs";
import { Api } from "./api";
import { buildConfig, ConfigInterface } from "./../modules/config";
import { log } from "../modules/log";
import { Initializer } from "./initializer";
import { Initializers } from "./initializers";
import { utils } from "../modules/utils";

import { id } from "./process/id";
import { env } from "./process/env";
import { writePidFile, clearPidFile } from "./process/pid";
import { typescript } from "./process/typescript";

let api: Api;
let config: ConfigInterface = {};

export class Process {
  running: boolean;
  initialized: boolean;
  shuttingDown: boolean;
  bootTime: number;
  initializers: Initializers;
  startCount: number;
  loadInitializers: Array<Function>;
  startInitializers: Array<Function>;
  stopInitializers: Array<Function>;
  _startingParams: {
    [key: string]: any;
  };

  constructor() {
    // Only in files required by `index.js` do we need to delay the loading of the API object
    // This is due to cyclical require issues
    api = require("../index").api;

    this.initializers = {};
    this.loadInitializers = [];
    this.startInitializers = [];
    this.stopInitializers = [];

    this.startCount = 0;

    api.commands.initialize = async (...args): Promise<Api | void> => {
      return this.initialize(...args);
    };

    api.commands.start = async (...args): Promise<Api | void> => {
      return this.start(...args);
    };

    api.commands.stop = async () => {
      return this.stop();
    };

    api.commands.restart = async (): Promise<Api | void> => {
      return this.restart();
    };

    api.process = this;
  }

  async initialize(params: object = {}) {
    this._startingParams = params;

    const loadInitializerRankings = {};
    const startInitializerRankings = {};
    const stopInitializerRankings = {};
    let initializerFiles: Array<string> = [];

    // rebuild config with startingParams
    config = buildConfig(this._startingParams);

    // load initializers from core
    initializerFiles = initializerFiles.concat(
      glob.sync(
        path.join(__dirname, "..", "initializers", "**", "**/*(*.js|*.ts)")
      )
    );

    // load initializers from project
    config.general.paths.initializer.forEach((startPath: string) => {
      initializerFiles = initializerFiles.concat(
        glob.sync(path.join(startPath, "**", "**/*(*.js|*.ts)"))
      );
    });

    // load initializers from plugins
    for (const pluginName in config.plugins) {
      if (config.plugins[pluginName] !== false) {
        const pluginPath: string = path.normalize(
          config.plugins[pluginName].path
        );

        if (!fs.existsSync(pluginPath)) {
          throw new Error(`plugin path does not exist: ${pluginPath}`);
        }

        // old style at the root of the project
        initializerFiles = initializerFiles.concat(
          glob.sync(path.join(pluginPath, "initializers", "**", "*.js"))
        );

        // new TS dist files
        initializerFiles = initializerFiles.concat(
          glob.sync(path.join(pluginPath, "dist", "initializers", "**", "*.js"))
        );
      }
    }

    initializerFiles = utils.arrayUnique(initializerFiles);
    initializerFiles = utils.ensureNoTsHeaderFiles(initializerFiles);

    initializerFiles.forEach(f => {
      const file = path.normalize(f);
      delete require.cache[require.resolve(file)];

      let exportedClasses = require(file);

      // allow for old-js style single default exports
      if (typeof exportedClasses === "function") {
        exportedClasses = { default: exportedClasses };
      }

      if (Object.keys(exportedClasses).length === 0) {
        this.fatalError(
          new Error(`no exported initializers found in ${file}`),
          file
        );
      }

      for (const exportKey in exportedClasses) {
        let initializer: Initializer;
        let InitializerClass = exportedClasses[exportKey];
        try {
          initializer = new InitializerClass();

          // check if initializer already exists (exclude utils and config)
          if (this.initializers[initializer.name]) {
            const warningMessage = `an existing initializer with the same name \`${initializer.name}\` will be overridden by the file ${file}`;
            log(warningMessage, "warning");
          } else {
            initializer.validate();
            this.initializers[initializer.name] = initializer;
          }
        } catch (error) {
          this.fatalError(error, file);
        }

        const initializeFunction = async () => {
          if (typeof initializer.initialize === "function") {
            log(`Loading initializer: ${initializer.name}`, "debug", file);

            try {
              await initializer.initialize(config);
              try {
                log(`Loaded initializer: ${initializer.name}`, "debug", file);
              } catch (e) {}
            } catch (error) {
              const message = `Exception occurred in initializer \`${initializer.name}\` during load`;
              try {
                log(message, "emerg", error.toString());
              } catch (_error) {
                console.error(message);
              }
              throw error;
            }
          }
        };

        const startFunction = async () => {
          if (typeof initializer.start === "function") {
            log(`Starting initializer: ${initializer.name}`, "debug", file);

            try {
              await initializer.start(config);
              log(`Started initializer: ${initializer.name}`, "debug", file);
            } catch (error) {
              log(
                `Exception occurred in initializer \`${initializer.name}\` during start`,
                "emerg",
                error.toString()
              );
              throw error;
            }
          }
        };

        const stopFunction = async () => {
          if (typeof initializer.stop === "function") {
            log(`Stopping initializer: ${initializer.name}`, "debug", file);

            try {
              await initializer.stop(config);
              log(`Stopped initializer: ${initializer.name}`, "debug", file);
            } catch (error) {
              log(
                `Exception occurred in initializer \`${initializer.name}\` during stop`,
                "emerg",
                error.toString()
              );
              throw error;
            }
          }
        };

        if (loadInitializerRankings[initializer.loadPriority] === undefined) {
          loadInitializerRankings[initializer.loadPriority] = [];
        }
        if (startInitializerRankings[initializer.startPriority] === undefined) {
          startInitializerRankings[initializer.startPriority] = [];
        }
        if (stopInitializerRankings[initializer.stopPriority] === undefined) {
          stopInitializerRankings[initializer.stopPriority] = [];
        }

        if (initializer.loadPriority > 0) {
          loadInitializerRankings[initializer.loadPriority].push(
            initializeFunction
          );
        }
        if (initializer.startPriority > 0) {
          startInitializerRankings[initializer.startPriority].push(
            startFunction
          );
        }
        if (initializer.stopPriority > 0) {
          stopInitializerRankings[initializer.stopPriority].push(stopFunction);
        }
      }
    });

    // flatten all the ordered initializer methods
    this.loadInitializers = this.flattenOrderedInitialzer(
      loadInitializerRankings
    );
    this.startInitializers = this.flattenOrderedInitialzer(
      startInitializerRankings
    );
    this.stopInitializers = this.flattenOrderedInitialzer(
      stopInitializerRankings
    );

    try {
      await utils.asyncWaterfall(this.loadInitializers);
    } catch (error) {
      return this.fatalError(error, "initialize");
    }

    this.initialized = true;
    return api;
  }

  async start(params = {}) {
    if (this.initialized !== true) {
      await this.initialize(params);
    }

    writePidFile();
    this.running = true;
    api.running = true;
    log(`environment: ${env}`, "notice");
    log("*** Starting ActionHero ***", "info");

    this.startInitializers.push(() => {
      this.bootTime = new Date().getTime();
      if (this.startCount === 0) {
        log(`server ID: ${id}`, "notice");
        log("*** ActionHero Started ***", "notice");
        this.startCount++;
      } else {
        log("*** ActionHero Restarted ***", "notice");
      }
    });

    try {
      await utils.asyncWaterfall(this.startInitializers);
    } catch (error) {
      return this.fatalError(error, "start");
    }

    return api;
  }

  async stop() {
    if (this.running) {
      this.shuttingDown = true;
      this.running = false;
      this.initialized = false;

      log("stopping process...", "notice");
      await utils.sleep(100);

      this.stopInitializers.push(async () => {
        clearPidFile();
        log("*** ActionHero Stopped ***", "notice");
        delete this.shuttingDown;
        // reset initializers to prevent duplicate check on restart
        this.initializers = {};
        api.running = false;
        await utils.sleep(100);
      });

      try {
        await utils.asyncWaterfall(this.stopInitializers);
      } catch (error) {
        return this.fatalError(error, "stop");
      }
    } else if (this.shuttingDown === true) {
      // double sigterm; ignore it
    } else {
      const message = "Cannot shut down actionhero, not running";
      log(message, "error");
    }
  }

  async restart() {
    if (this.running === true) {
      await this.stop();
      await this.start(this._startingParams);
    } else {
      await this.start(this._startingParams);
    }
    return api;
  }

  // HELPERS
  async fatalError(errors, type) {
    if (errors && !(errors instanceof Array)) {
      errors = [errors];
    }
    if (errors) {
      log(`Error with initializer step: ${JSON.stringify(type)}`, "emerg");

      errors.forEach(error => {
        log(error.stack, "emerg");
      });

      await this.stop();

      await utils.sleep(1000); // allow time for console.log to print
      process.exit(1);
    }
  }

  flattenOrderedInitialzer(collection: any) {
    const output = [];
    const keys = [];
    for (const key in collection) {
      keys.push(parseInt(key));
    }
    keys.sort(sortNumber);
    keys.forEach(key => {
      collection[key].forEach(d => {
        output.push(d);
      });
    });

    return output;
  }
}

function sortNumber(a: number, b: number) {
  return a - b;
}
