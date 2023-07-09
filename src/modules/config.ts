import * as fs from "fs";
import * as path from "path";
import { utils } from "./utils";
import { ensureNoTsHeaderOrSpecFiles } from "./utils/ensureNoTsHeaderOrSpecFiles";

import { env, recalculateEnv } from "./../classes/process/env";
import { id, recalcuateId } from "./../classes/process/id";
import {
  actionheroVersion,
  recalculateActionheroVersion,
} from "./../classes/process/actionheroVersion";
import {
  recalculateIsTypescript,
  typescript,
} from "./../classes/process/typescript";
import {
  projectRoot,
  recalculateProjectRoot,
} from "./../classes/process/projectRoot";
import { RouteMethod, RoutesConfig, RouteType } from "..";
import { ActionheroConfigInterface } from "../classes/config";
import { safeGlobSync } from "./utils/safeGlob";

export function buildConfig() {
  const configPaths: string[] = [];

  let config: Partial<ActionheroConfigInterface> = {
    process: {
      env,
      id,
      typescript,
      projectRoot,
      actionheroVersion,
    },
  };

  // We support multiple configuration paths as follows:
  //
  // 1. Use the project 'config' folder, if it exists.
  // 2. "actionhero --config=PATH1 --config=PATH2 --config=PATH3,PATH4"
  // 3. "ACTIONHERO_CONFIG=PATH1,PATH2 npm start"
  // 4. "ACTIONHERO_CONFIG_OVERRIDES" (stringified JSON) can partially override any of the config objects loaded from the above
  //
  // Note that if --config or ACTIONHERO_CONFIG are used, they _overwrite_ the use of the default "config" folder. If
  // you wish to use both, you need to re-specify "config", e.g. "--config=config,local-config". Also, note that
  // specifying multiple --config options on the command line does exactly the same thing as using one parameter with
  // comma separators, however the environment variable method only supports the comma-delimited syntax.

  function addConfigPath(
    pathToCheck: string | Array<string>,
    alreadySplit: boolean,
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
      pathToCheck.map((entry) => {
        addConfigPath(entry, alreadySplit);
      });
    }
  }

  [utils.argv.config?.toString(), process.env.ACTIONHERO_CONFIG].map(
    (entry) => {
      addConfigPath(entry, false);
    },
  );

  if (configPaths.length < 1 && typescript) {
    addConfigPath("src/config", false);
  }

  if (configPaths.length < 1) {
    addConfigPath("dist/config", false);
  }

  if (configPaths.length < 1) {
    throw new Error(
      configPaths +
        "No config directory found in this project.  Did you compile your typescript project?",
    );
  }

  const loadConfigFile = (f: string) => {
    const localConfig = require(f);
    if (f.includes("routes.js") || f.includes("routes.ts")) {
      // We don't want to merge in routes from Actionhero core unless we are running core directly
      // Routes can be loaded by plugins via `registerRoute`
      if (
        f.includes(`${path.sep}node_modules${path.sep}actionhero${path.sep}`)
      ) {
        return;
      }

      let localRoutes: { routes: Partial<RoutesConfig> } = { routes: {} };

      if (localConfig.DEFAULT) {
        // @ts-ignore
        localRoutes = utils.hashMerge(localRoutes, localConfig.DEFAULT, config);
      }

      if (localConfig[env]) {
        // @ts-ignore
        localRoutes = utils.hashMerge(localRoutes, localConfig[env], config);
      }

      (Object.keys(localRoutes.routes) as RouteMethod[]).forEach((v) => {
        if (config.routes && config.routes[v]) {
          config.routes[v].push(...localRoutes.routes[v]);
        } else {
          if (!config.routes) config.routes = {};
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
    const configFiles = ensureNoTsHeaderOrSpecFiles(
      safeGlobSync(path.join(configPath, "**", "**/*(*.js|*.ts)")),
    );

    let loadRetries = 0;
    let loadErrors: Record<
      string,
      { error: NodeJS.ErrnoException; msg: string }
    > = {};
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
          Object.keys(loadErrors).forEach((e) => {
            console.log(loadErrors[e].error.stack);
            console.log("");
            delete loadErrors[e].error;
          });

          throw new Error(
            "Unable to load configurations, errors: " +
              JSON.stringify(loadErrors),
          );
        }
        // adjust configuration files list: remove and push
        // failed configuration to the end of the list and
        // continue with next file at same index
        configFiles.push(configFiles.splice(i--, 1)[0]);
        continue;
      }
    }

    // We load the config twice. Utilize configuration files load order that succeeded on the first pass.
    // This is to allow 'literal' values to be loaded whenever possible, and then for references to be resolved
    configFiles.forEach(loadConfigFile);

    // Remove duplicate routes since we might be loading from multiple config directories, also we load every
    // config directory twice.
    if (config.routes) {
      (Object.keys(config.routes) as RouteMethod[]).forEach((v) => {
        config.routes[v] = config.routes[v].filter(
          (route: RouteType, index: number, self: RouteType[]) =>
            index ===
            self.findIndex(
              (r) =>
                r.path === route.path &&
                r.action === route.action &&
                r.apiVersion === route.apiVersion &&
                r.matchTrailingPathParts === route.matchTrailingPathParts &&
                r.dir === route.dir,
            ),
        );
      });
    }
  };

  // load the default config of actionhero
  loadConfigDirectory(path.join(__dirname, "/../config"), false);

  // load the project specific config
  configPaths.map((p) => loadConfigDirectory(p, false));

  if (process.env.ACTIONHERO_CONFIG_OVERRIDES) {
    try {
      config = utils.hashMerge(
        config,
        JSON.parse(process.env.ACTIONHERO_CONFIG_OVERRIDES),
      );
    } catch (error) {
      throw new Error(`could not parse ACTIONHERO_CONFIG_OVERRIDES: ${error}`);
    }
  }

  if (utils.argv.ACTIONHERO_CONFIG_OVERRIDES) {
    try {
      config = utils.hashMerge(
        config,
        JSON.parse(utils.argv.ACTIONHERO_CONFIG_OVERRIDES.toString()),
      );
    } catch (error) {
      throw new Error(`could not parse ACTIONHERO_CONFIG_OVERRIDES: ${error}`);
    }
  }

  return config;
}

export let config = buildConfig();

/**
 * Rebuild Actionhero's `config` object.  Useful when Environment variables effecting the config may have changed.
 */
export const rebuildConfig = () => {
  recalculateEnv();
  recalculateActionheroVersion();
  recalcuateId();
  recalculateProjectRoot();
  recalculateIsTypescript();
  config = buildConfig();
};
