import * as path from "path";
import * as glob from "glob";
import { Config } from "./config";
import { Initializer } from "./initializer";
import { Initializers } from "./initializers";
import { arrayUniqueify } from "./../utils/arrayUniqueify";
import { ensureNoTsHeaderFiles } from "./../utils/ensureNoTsHeaderFiles";

import { id } from "./process/id";

export { env } from "./process/env";
export { actionheroVersion } from "./process/actionheroVersion";
export { projectRoot } from "./process/projectRoot";
export { typescript } from "./process/typescript";
export { id } from "./process/id";

export class Process {
  initializers: Initializers;
  startCount: number;
  loadInitializers: Array<Function>;
  startInitializers: Array<Function>;
  stopInitializers: Array<Function>;
  _startingParams: {
    [key: string]: any;
  };

  constructor() {
    this.initializers = {};
    this.loadInitializers = [];
    this.startInitializers = [];
    this.stopInitializers = [];

    this.startCount = 0;
  }

  async initialize(params: object = {}) {
    this._startingParams = params;

    const loadInitializerRankings = {};
    const startInitializerRankings = {};
    const stopInitializerRankings = {};
    let initializerFiles: Array<string> = [];

    // we need to load the utils & config first
    const files = [
      path.resolve(__dirname, "..", "initializers", "utils"),
      path.resolve(__dirname, "..", "initializers", "config")
    ];

    for (const file of files) {
      delete require.cache[require.resolve(file)];
      const exportedClasses = require(file);
      for (const exportKey in exportedClasses) {
        let initializer;
        let InitializerClass = exportedClasses[exportKey];
        try {
          initializer = new InitializerClass();
        } catch (error) {
          this.fatalError(error, file);
        }

        try {
          initializer.validate();
          await initializer.initialize();
          this.initializers[initializer.name] = initializer;
        } catch (error) {
          this.fatalError(error, initializer);
        }
      }
    }

    // load initializers from core
    initializerFiles = initializerFiles.concat(
      glob.sync(
        path.join(__dirname, "..", "initializers", "**", "**/*(*.js|*.ts)")
      )
    );

    // load initializers from project
    api.config.general.paths.initializer.forEach((startPath: string) => {
      initializerFiles = initializerFiles.concat(
        glob.sync(path.join(startPath, "**", "**/*(*.js|*.ts)"))
      );
    });

    // load initializers from plugins
    for (const pluginName in api.config.plugins) {
      if (api.config.plugins[pluginName] !== false) {
        const pluginPath = api.config.plugins[pluginName].path;
        initializerFiles = initializerFiles.concat(
          glob.sync(
            path.join(pluginPath, "initializers", "**", "**/*(*.js|*.ts)")
          )
        );
      }
    }

    initializerFiles = arrayUniqueify(initializerFiles);
    initializerFiles = initializerFiles.filter(file => {
      if (file.match("initializers/utils")) {
        return false;
      }
      if (file.match("initializers/config")) {
        return false;
      }

      return true;
    });

    initializerFiles = ensureNoTsHeaderFiles(initializerFiles);

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
          new Error(`no exported intializers found in ${file}`),
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
            const warningMessage = `an existing intializer with the same name \`${initializer.name}\` will be overridden by the file ${file}`;
            if (api.log) {
              api.log(warningMessage, "warning");
            } else {
              console.warn(warningMessage);
            }
          } else {
            initializer.validate();
            this.initializers[initializer.name] = initializer;
          }
        } catch (error) {
          this.fatalError(error, file);
        }

        const initializeFunction = async () => {
          api.watchFileAndAct(file, async () => {
            api.log(
              `*** Rebooting due to initializer change (${file}) ***`,
              "info"
            );
            await api.commands.restart();
          });

          if (typeof initializer.initialize === "function") {
            if (typeof api.log === "function") {
              api.log(
                `Loading initializer: ${initializer.name}`,
                "debug",
                file
              );
            }
            try {
              await initializer.initialize();
              try {
                api.log(
                  `Loaded initializer: ${initializer.name}`,
                  "debug",
                  file
                );
              } catch (e) {}
            } catch (error) {
              const message = `Exception occured in initializer \`${initializer.name}\` during load`;
              try {
                api.log(message, "emerg", error.toString());
              } catch (_error) {
                console.error(message);
              }
              throw error;
            }
          }
        };

        const startFunction = async () => {
          if (typeof initializer.start === "function") {
            if (typeof api.log === "function") {
              api.log(
                `Starting initializer: ${initializer.name}`,
                "debug",
                file
              );
            }
            try {
              await initializer.start();
              api.log(
                `Started initializer: ${initializer.name}`,
                "debug",
                file
              );
            } catch (error) {
              api.log(
                `Exception occured in initializer \`${initializer.name}\` during start`,
                "emerg",
                error.toString()
              );
              throw error;
            }
          }
        };

        const stopFunction = async () => {
          if (typeof initializer.stop === "function") {
            if (typeof api.log === "function") {
              api.log(
                `Stopping initializer: ${initializer.name}`,
                "debug",
                file
              );
            }
            try {
              await initializer.stop();
              api.log(
                `Stopped initializer: ${initializer.name}`,
                "debug",
                file
              );
            } catch (error) {
              api.log(
                `Exception occured in initializer \`${initializer.name}\` during stop`,
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
      await api.utils.asyncWaterfall(this.loadInitializers);
    } catch (error) {
      return this.fatalError(error, "initialize");
    }

    api.initialized = true;

    return api;
  }

  async start(params = {}) {
    if (api.initialized !== true) {
      await this.initialize(params);
    }

    api.running = true;
    api.log(`environment: ${api.env}`, "notice");
    api.log("*** Starting ActionHero ***", "info");

    this.startInitializers.push(() => {
      api.bootTime = new Date().getTime();
      if (this.startCount === 0) {
        api.log("*** ActionHero Started ***", "notice");
        this.startCount++;
      } else {
        api.log("*** ActionHero Restarted ***", "notice");
      }
    });

    try {
      await api.utils.asyncWaterfall(this.startInitializers);
    } catch (error) {
      return this.fatalError(error, "start");
    }

    api.log(`server ID: ${id}`, "notice");
    return api;
  }

  async stop() {
    if (api.running === true) {
      api.shuttingDown = true;
      api.running = false;
      api.initialized = false;

      api.log("stopping process...", "notice");

      this.stopInitializers.push(async () => {
        api.pids.clearPidFile();
        api.log("*** ActionHero Stopped ***", "notice");
        delete api.shuttingDown;
        // reset initializers to prevent duplicate check on restart
        this.initializers = {};
      });

      try {
        await api.utils.asyncWaterfall(this.stopInitializers);
      } catch (error) {
        return this.fatalError(error, "stop");
      }
      return api;
    } else if (api.shuttingDown === true) {
      // double sigterm; ignore it
    } else {
      const message = "Cannot shut down actionhero, not running";
      if (api.log) {
        api.log(message, "error");
      } else {
        console.log(message);
      }
    }
  }

  async restart() {
    if (api.running === true) {
      await this.stop();
      await this.start(this._startingParams);
    } else {
      await this.start(this._startingParams);
    }
  }

  // HELPERS

  async fatalError(errors, type) {
    if (errors && !(errors instanceof Array)) {
      errors = [errors];
    }
    if (errors) {
      if (api.log) {
        api.log(
          `Error with initializer step: ${JSON.stringify(type)}`,
          "emerg"
        );
        errors.forEach(error => {
          api.log(error.stack, "emerg");
        });
      } else {
        console.error(`Error with initializer step: ${JSON.stringify(type)}`);
        errors.forEach(error => {
          console.error(error.stack);
        });
      }
      await api.commands.stop.call(api);

      await api.utils.sleep(1000); // allow time for console.log to print
      process.exit(1);
    }
  }

  flattenOrderedInitialzer(collection) {
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
