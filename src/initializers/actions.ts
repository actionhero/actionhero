import * as glob from "glob";
import * as path from "path";
import { api, Initializer } from "../index";

/**
 * var middleware = {
 *  name: 'userId checker',
 *  global: false,
 *  priority: 1000,
 *  preProcessor: async (data) => {
 *    if(!data.params.userId){
 *      throw new Error('All actions require a userId')
 *    }
 *  },
 *  postProcessor: async (data) => {
 *    if(data.thing.stuff == false){ data.toRender = false }
 *  }
 *}
 */
export interface ActionMiddleware {
  /**Unique name for the middleware. */
  name: string;
  /**Is this middleware applied to all actions? */
  global: boolean;
  /**Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`. */
  priority?: number;
  /**Called berore the action runs.  Has access to all params, before sanitizartion.  Can modify the data object for use in actions. */
  preProcessor?: Function;
  /**Called after the action runs. */
  postProcessor?: Function;
}

export class Actions extends Initializer {
  constructor() {
    super();
    this.name = "actions";
    this.loadPriority = 410;
  }

  async initialize() {
    api.actions = {
      actions: {},
      versions: {},
      middleware: {},
      globalMiddleware: []
    };

    /**
     * Add a middleware component avaialable to pre or post-process actions.
     */
    api.actions.addMiddleware = (data: ActionMiddleware) => {
      if (!data.name) {
        throw new Error("middleware.name is required");
      }
      if (!data.priority) {
        data.priority = api.config.general.defaultMiddlewarePriority;
      }
      data.priority = Number(data.priority);
      api.actions.middleware[data.name] = data;
      if (data.global === true) {
        api.actions.globalMiddleware.push(data.name);
        api.utils.sortGlobalMiddleware(
          api.actions.globalMiddleware,
          api.actions.middleware
        );
      }
    };

    api.actions.loadFile = async (fullFilePath: string, reload: boolean) => {
      if (reload === null) {
        reload = false;
      }

      const loadMessage = action => {
        if (reload) {
          api.log(
            `action reloaded: ${action.name} @ v${action.version}, ${fullFilePath}`,
            "info"
          );
        } else {
          api.log(
            `action loaded: ${action.name} @ v${action.version}, ${fullFilePath}`,
            "debug"
          );
        }
      };

      api.watchFileAndAct(fullFilePath, async () => {
        if (!api.config.general.developmentModeForceRestart) {
          // reload by updating in-memory copy of our action
          api.actions.loadFile(fullFilePath, true);
          api.params.buildPostVariables();
          api.routes.loadRoutes();
        } else {
          api.log(
            `*** Rebooting due to action change (${fullFilePath}) ***`,
            "info"
          );
          await api.commands.restart();
        }
      });

      let action;

      try {
        let collection = require(fullFilePath);
        if (typeof collection === "function") {
          collection = [collection];
        }
        for (const i in collection) {
          action = new collection[i]();
          await action.validate(api);
          if (!api.actions.actions[action.name]) {
            api.actions.actions[action.name] = {};
          }
          if (!api.actions.versions[action.name]) {
            api.actions.versions[action.name] = [];
          }

          if (api.actions.actions[action.name][action.version] && !reload) {
            api.log(
              `an existing action with the same name \`${action.name}\` will be overridden by the file ${fullFilePath}`,
              "warning"
            );
          }

          api.actions.actions[action.name][action.version] = action;
          api.actions.versions[action.name].push(action.version);
          api.actions.versions[action.name].sort();
          loadMessage(action);
        }
      } catch (error) {
        try {
          api.exceptionHandlers.loader(fullFilePath, error);
          delete api.actions.actions[action.name][action.version];
        } catch (_error) {
          throw error;
        }
      }
    };

    for (const i in api.config.general.paths.action) {
      const p = api.config.general.paths.action[i];
      let files = glob.sync(path.join(p, "**", "**/*(*.js|*.ts)"));
      files = api.utils.ensureNoTsHeaderFiles(files);
      for (const j in files) {
        await api.actions.loadFile(files[j]);
      }
    }

    for (const pluginName in api.config.plugins) {
      if (api.config.plugins[pluginName].actions !== false) {
        const pluginPath = api.config.plugins[pluginName].path;
        let files = glob.sync(
          path.join(pluginPath, "actions", "**", "**/*(*.js|*.ts)")
        );
        files = api.utils.ensureNoTsHeaderFiles(files);
        for (const j in files) {
          await api.actions.loadFile(files[j]);
        }
      }
    }
  }
}
