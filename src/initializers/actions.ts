import * as glob from "glob";
import * as path from "path";
import { api, log, watchFileAndAct, Initializer, Action } from "../index";
import { ActionMiddleware } from "./../modules/action";
import { ensureNoTsHeaderFiles } from "./../utils/ensureNoTsHeaderFiles";

export interface ActionsApi {
  actions: {
    [key: string]: {
      [key: string]: Action;
    };
  };
  versions: {
    [key: string]: Array<string | number>;
  };
  middleware: {
    [key: string]: ActionMiddleware;
  };
  globalMiddleware: Array<string>;
  loadFile?: Function;
}

export class Actions extends Initializer {
  constructor() {
    super();
    this.name = "actions";
    this.loadPriority = 410;
  }

  async initialize(config) {
    api.actions = {
      actions: {},
      versions: {},
      middleware: {},
      globalMiddleware: []
    };

    api.actions.loadFile = async (fullFilePath: string, reload: boolean) => {
      if (reload === null) {
        reload = false;
      }

      const loadMessage = action => {
        if (reload) {
          log(
            `action reloaded: ${action.name} @ v${action.version}, ${fullFilePath}`,
            "info"
          );
        } else {
          log(
            `action loaded: ${action.name} @ v${action.version}, ${fullFilePath}`,
            "debug"
          );
        }
      };

      watchFileAndAct(fullFilePath, async () => {
        if (!config.general.developmentModeForceRestart) {
          // reload by updating in-memory copy of our action
          api.actions.loadFile(fullFilePath, true);
          api.params.buildPostVariables();
          api.routes.loadRoutes();
        } else {
          log(
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
            log(
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

    for (const i in config.general.paths.action) {
      const p = config.general.paths.action[i];
      let files = glob.sync(path.join(p, "**", "**/*(*.js|*.ts)"));
      files = ensureNoTsHeaderFiles(files);
      for (const j in files) {
        await api.actions.loadFile(files[j]);
      }
    }

    for (const pluginName in config.plugins) {
      if (config.plugins[pluginName].actions !== false) {
        const pluginPath = config.plugins[pluginName].path;
        let files = glob.sync(
          path.join(pluginPath, "actions", "**", "**/*(*.js|*.ts)")
        );
        files = ensureNoTsHeaderFiles(files);
        for (const j in files) {
          await api.actions.loadFile(files[j]);
        }
      }
    }
  }
}
