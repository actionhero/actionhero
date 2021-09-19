import * as path from "path";
import * as glob from "glob";
import * as fs from "fs";
import { buildConfig, ConfigInterface } from "./../modules/config";
import { log } from "../modules/log";
import { Initializer } from "./initializer";
import { Initializers } from "./initializers";
import { utils } from "../modules/utils";

import { id } from "./process/id";
import { env } from "./process/env";
import { writePidFile, clearPidFile } from "./process/pid";

import { api } from "../index";

const fatalErrorCode = "FATAL_ACTIONHERO_ERROR";

let config: ConfigInterface = {};

export class Process {
  running: boolean;
  initialized: boolean;
  started: boolean;
  stopped: boolean;
  stopReasons?: string[];
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
    this.initialized = false;
    this.started = false;
    this.stopped = false;
    this.initializers = {};
    this.loadInitializers = [];
    this.startInitializers = [];
    this.stopInitializers = [];
    this.stopReasons = [];

    this.startCount = 0;

    api.commands.initialize = async (...args) => {
      return this.initialize(...args);
    };

    api.commands.start = async (...args) => {
      return this.start(...args);
    };

    api.commands.stop = async () => {
      return this.stop();
    };

    api.commands.restart = async () => {
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

    for (const i in initializerFiles) {
      const f = initializerFiles[i];
      const file = path.normalize(f);
      if (require.cache[require.resolve(file)]) {
        delete require.cache[require.resolve(file)];
      }

      let exportedClasses = await import(file);

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

        function decorateInitError(error: Error, type: string) {
          error["data"] = error["data"] ?? {};
          error["data"].name = initializer.name;
          error["data"].file = file;
          error["data"].type = type;
        }

        const initializeFunction = async () => {
          if (typeof initializer.initialize === "function") {
            log(`Loading initializer: ${initializer.name}`, "debug", file);

            try {
              await initializer.initialize(config);
              log(`Loaded initializer: ${initializer.name}`, "debug", file);
            } catch (error) {
              decorateInitError(error, "initialize");
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
              decorateInitError(error, "start");
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
              decorateInitError(error, "stop");
              throw error;
            }
          }
        };

        if (!loadInitializerRankings[initializer.loadPriority]) {
          loadInitializerRankings[initializer.loadPriority] = [];
        }
        if (!startInitializerRankings[initializer.startPriority]) {
          startInitializerRankings[initializer.startPriority] = [];
        }
        if (!stopInitializerRankings[initializer.stopPriority]) {
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
    }

    // flatten all the ordered initializer methods
    this.loadInitializers = this.flattenOrderedInitializer(
      loadInitializerRankings
    );
    this.startInitializers = this.flattenOrderedInitializer(
      startInitializerRankings
    );
    this.stopInitializers = this.flattenOrderedInitializer(
      stopInitializerRankings
    );

    try {
      for (const loader of this.loadInitializers) await loader();
    } catch (error) {
      return this.fatalError(error, "initialize");
    }

    this.initialized = true;
  }

  async start(params = {}) {
    if (this.initialized !== true) await this.initialize(params);

    writePidFile();
    this.running = true;
    api.running = true;
    log(`environment: ${env}`, "notice");
    log(`*** Starting ${config.general.serverName} ***`, "info");

    this.startInitializers.push(() => {
      this.bootTime = new Date().getTime();
      if (this.startCount === 0) {
        log(`server ID: ${id}`, "notice");
        log(`*** ${config.general.serverName} Started ***`, "notice");
        this.startCount++;
      } else {
        log(`*** ${config.general.serverName} Restarted ***`, "notice");
      }
    });

    try {
      for (const starter of this.startInitializers) await starter();
    } catch (error) {
      return this.fatalError(error, "start");
    }

    this.started = true;
  }

  async stop(stopReasons: string | string[] = []) {
    if (this.running) {
      this.shuttingDown = true;
      this.running = false;
      this.initialized = false;
      this.started = false;
      this.stopReasons = Array.isArray(stopReasons)
        ? stopReasons
        : [stopReasons];

      log("stopping process...", "notice");
      if (this.stopReasons?.length > 0) {
        log(`stop reasons: ${this.stopReasons.join(", ")}`, "debug");
      }

      await utils.sleep(100);

      this.stopInitializers.push(async () => {
        clearPidFile();
        log(`*** ${config.general.serverName} Stopped ***`, "notice");
        delete this.shuttingDown;
        // reset initializers to prevent duplicate check on restart
        this.initializers = {};
        api.running = false;
        await utils.sleep(100);
      });

      try {
        for (const stopper of this.stopInitializers) await stopper();
      } catch (error) {
        return this.fatalError(error, "stop");
      }

      this.stopped = true;
    } else if (this.shuttingDown === true) {
      // double sigterm; ignore it
    } else {
      const message = `Cannot shut down ${config.general.serverName}, not running`;
      log(message, "crit");
    }
  }

  async restart() {
    if (this.running === true) {
      await this.stop();
      await this.start(this._startingParams);
    } else {
      await this.start(this._startingParams);
    }
  }

  /**
   * Register listeners for process signals and uncaught exceptions & rejections.
   * Try to gracefully shut down when signaled to do so
   */
  registerProcessSignals(stopCallback = (exitCode?: number) => {}) {
    const timeout = process.env.ACTIONHERO_SHUTDOWN_TIMEOUT
      ? parseInt(process.env.ACTIONHERO_SHUTDOWN_TIMEOUT)
      : 1000 * 30;

    function awaitHardStop() {
      return setTimeout(() => {
        console.error(
          `Process did not terminate within ${timeout}ms. Stopping now!`
        );
        process.nextTick(process.exit(1));
      }, timeout);
    }

    // handle errors & rejections
    process.once("uncaughtException", async (error: Error) => {
      if (error["code"] !== fatalErrorCode) {
        if (api.exceptionHandlers) {
          api.exceptionHandlers.report(
            error,
            "uncaught",
            "Exception",
            {},
            "emerg"
          );
        } else {
          console.error(error);
        }
      }

      if (this.shuttingDown !== true) {
        let timer = awaitHardStop();
        if (this.running) await this.stop();
        clearTimeout(timer);
        stopCallback(1);
      }
    });

    process.once("unhandledRejection", async (rejection: Error) => {
      if (rejection["code"] !== fatalErrorCode) {
        if (api.exceptionHandlers) {
          api.exceptionHandlers.report(
            rejection,
            "uncaught",
            "Rejection",
            {},
            "emerg"
          );
        } else {
          console.error(rejection);
        }
      }

      if (this.shuttingDown !== true) {
        let timer = awaitHardStop();
        if (this.running) await this.stop();
        clearTimeout(timer);
        stopCallback(1);
      }
    });

    // handle signals
    process.on("SIGINT", async () => {
      log(`[ SIGNAL ] - SIGINT`, "notice");
      let timer = awaitHardStop();
      if (this.running) await this.stop();
      if (!this.shuttingDown) {
        clearTimeout(timer);
        stopCallback(0);
      }
    });

    process.on("SIGTERM", async () => {
      log(`[ SIGNAL ] - SIGTERM`, "notice");
      let timer = awaitHardStop();
      if (this.running) await this.stop();
      if (!this.shuttingDown) {
        clearTimeout(timer);
        stopCallback(0);
      }
    });

    process.on("SIGUSR2", async () => {
      log(`[ SIGNAL ] - SIGUSR2`, "notice");
      let timer = awaitHardStop();
      await this.restart();
      clearTimeout(timer);
    });
  }

  // HELPERS
  async fatalError(errors: Error | Error[] = [], type: any) {
    if (!(errors instanceof Array)) errors = [errors];

    if (errors) {
      const showStack = process.env.ACTIONHERO_FATAL_ERROR_STACK_DISPLAY
        ? process.env.ACTIONHERO_FATAL_ERROR_STACK_DISPLAY === "true"
        : true;

      errors.forEach((error) => {
        if (!showStack) delete error.stack;
        if (api.exceptionHandlers) {
          api.exceptionHandlers.report(error, "initializer", type);
        } else {
          console.error(error);
        }
      });

      if (this.running) {
        await this.stop(errors.map((e) => e.message ?? e.toString())); // stop and set the stopReasons
      }
      await utils.sleep(100); // allow time for console.log to print

      if (!errors[0]["code"]) errors[0]["code"] = fatalErrorCode;
      throw errors[0];
    }
  }

  flattenOrderedInitializer(collection: any) {
    const output = [];
    const keys = [];

    for (const key in collection) keys.push(parseInt(key));
    keys.sort(sortNumber);

    keys.forEach((key) => {
      collection[key].forEach((d) => {
        output.push(d);
      });
    });

    return output;
  }
}

function sortNumber(a: number, b: number) {
  return a - b;
}
