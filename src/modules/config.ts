import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import { argv } from "optimist";
import { utils } from "./utils";
import { ensureNoTsHeaderFiles } from "./utils/ensureNoTsHeaderFiles";

import { env } from "./../classes/process/env";
import { id } from "./../classes/process/id";
import { actionheroVersion } from "./../classes/process/actionheroVersion";
import { typescript } from "./../classes/process/typescript";
import { projectRoot } from "./../classes/process/projectRoot";

export interface ConfigInterface {
  [key: string]: any;
}

export function buildConfig(_startingParams: ConfigInterface = {}) {
  let config: ConfigInterface = {
    process: {
      env,
      id,
      typescript,
      projectRoot,
      actionheroVersion
    }
  };

  const configPaths = [];

  utils.hashMerge(config, _startingParams);
  // We support multiple configuration paths as follows:
  //
  // 1. Use the project 'config' folder, if it exists.
  // 2. "actionhero --config=PATH1 --config=PATH2 --config=PATH3,PATH4"
  // 3. "ACTIONHERO_CONFIG=PATH1,PATH2 npm start"
  //
  // Note that if --config or ACTIONHERO_CONFIG are used, they _overwrite_ the use of the default "config" folder. If
  // you wish to use both, you need to re-specify "config", e.g. "--config=config,local-config". Also, note that
  // specifying multiple --config options on the command line does exactly the same thing as using one parameter with
  // comma separators, however the environment variable method only supports the comma-delimited syntax.

  function addConfigPath(
    pathToCheck: string | Array<string>,
    alreadySplit: boolean
  ) {
    if (typeof pathToCheck === "string") {
      if (!alreadySplit) {
        addConfigPath(pathToCheck.split(","), true);
      } else {
        if (pathToCheck.charAt(0) !== "/") {
          pathToCheck = path.resolve(projectRoot, pathToCheck);
        }
        if (fs.existsSync(pathToCheck)) {
          configPaths.push(pathToCheck);
        }
      }
    } else if (Array.isArray(pathToCheck)) {
      pathToCheck.map(entry => {
        addConfigPath(entry, alreadySplit);
      });
    }
  }

  [argv.config, process.env.ACTIONHERO_CONFIG].map(entry => {
    addConfigPath(entry, false);
  });

  if (configPaths.length < 1 && typescript) {
    addConfigPath("src/config", false);
  }

  if (configPaths.length < 1) {
    addConfigPath("dist/config", false);
  }

  if (configPaths.length < 1) {
    throw new Error(
      configPaths +
        "No config directory found in this project.  Did you compile your typescript project?"
    );
  }

  // const rebootHandler = file => {
  //   log(`*** rebooting due to config change (${file}) ***`, "info");
  //   delete require.cache[require.resolve(file)];
  //   api.commands.restart();
  // };

  const loadConfigFile = (f: string) => {
    const localConfig = require(f);
    if (f.includes("routes.js") || f.includes("routes.ts")) {
      let localRoutes: { [key: string]: any } = { routes: {} };

      if (localConfig.DEFAULT) {
        localRoutes = utils.hashMerge(localRoutes, localConfig.DEFAULT, config);
      }

      if (localConfig[env]) {
        localRoutes = utils.hashMerge(localRoutes, localConfig[env], config);
      }

      Object.keys(localRoutes.routes).forEach(v => {
        if (config.routes && config.routes[v]) {
          config.routes[v].push(...localRoutes.routes[v]);
        } else {
          if (!config.routes) {
            config.routes = {};
          }

          config.routes[v] = localRoutes.routes[v];
        }
      });
    } else {
      if (localConfig.DEFAULT) {
        config = utils.hashMerge(config, localConfig.DEFAULT, config);
      }

      if (localConfig[env]) {
        config = utils.hashMerge(config, localConfig[env], config);
      }
    }
  };

  const loadConfigDirectory = (configPath: string, watch: boolean) => {
    const configFiles = ensureNoTsHeaderFiles(
      glob.sync(path.join(configPath, "**", "**/*(*.js|*.ts)"))
    );

    let loadRetries = 0;
    let loadErrors = {};
    for (let i = 0, limit = configFiles.length; i < limit; i++) {
      const f = configFiles[i];
      try {
        // attempt configuration file load
        loadConfigFile(f);

        // configuration file load success: clear retries and
        // errors since progress has been made
        loadRetries = 0;
        loadErrors = {};
      } catch (error) {
        // error loading configuration, abort if all remaining
        // configuration files have been tried and failed
        // indicating inability to progress
        loadErrors[f] = { error: error, msg: error.toString() };
        if (++loadRetries === limit - i) {
          Object.keys(loadErrors).forEach(e => {
            console.log(loadErrors[e].error.stack);
            console.log("");
            delete loadErrors[e].error;
          });

          throw new Error(
            "Unable to load configurations, errors: " +
              JSON.stringify(loadErrors)
          );
        }
        // adjust configuration files list: remove and push
        // failed configuration to the end of the list and
        // continue with next file at same index
        configFiles.push(configFiles.splice(i--, 1)[0]);
        continue;
      }

      // if (watch) {
      //   // configuration file loaded: set watch
      //   api.watchFileAndAct(f, rebootHandler);
      // }
    }

    // We load the config twice. Utilize configuration files load order that succeeded on the first pass.
    // This is to allow 'literal' values to be loaded whenever possible, and then for refrences to be resolved
    configFiles.forEach(loadConfigFile);

    // Remove duplicate routes since we might be loading from multiple config directories, also we load every
    // config directory twice.
    if (config.routes) {
      Object.keys(config.routes).forEach(v => {
        config.routes[v] = config.routes[v].filter(
          (route, index, self) =>
            index ===
            self.findIndex(
              r =>
                r.path === route.path &&
                r.action === route.action &&
                r.apiVersion === route.apiVersion &&
                r.matchTrailingPathParts === route.matchTrailingPathParts &&
                r.dir === route.dir
            )
        );
      });
    }
  };

  // load the default config of actionhero
  loadConfigDirectory(path.join(__dirname, "/../config"), false);

  // load the project specific config
  configPaths.map(p => loadConfigDirectory(p, false));

  // apply any configChanges
  if (_startingParams && _startingParams.configChanges) {
    config = utils.hashMerge(config, _startingParams.configChanges);
  }

  if (process.env.configChanges) {
    config = utils.hashMerge(config, JSON.parse(process.env.configChanges));
  }

  if (argv.configChanges) {
    config = utils.hashMerge(config, JSON.parse(argv.configChanges));
  }

  return config;
}

export const config = buildConfig();
