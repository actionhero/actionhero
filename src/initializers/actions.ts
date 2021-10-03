import * as glob from "glob";
import * as path from "path";
import { api, log, utils, Initializer, Action } from "../index";
import { action } from "./../modules/action";

export interface ActionsApi {
  actions: {
    [key: string]: { [key: string]: Action };
  };
  versions: {
    [key: string]: Array<string | number>;
  };
  middleware: {
    [key: string]: action.ActionMiddleware;
  };
  globalMiddleware: Array<string>;
  loadFile?: ActionsInitializer["loadFile"];
}

export class ActionsInitializer extends Initializer {
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
      globalMiddleware: [],
      loadFile: this.loadFile.bind(this),
    };

    for (const p of config.general.paths.action) {
      let files = glob.sync(path.join(p, "**", "**/*(*.js|*.ts)"));
      files = utils.ensureNoTsHeaderFiles(files);
      for (const j in files) {
        await api.actions.loadFile(files[j]);
      }
    }

    for (const pluginName in config.plugins) {
      if (config.plugins[pluginName].actions !== false) {
        const pluginPath = config.plugins[pluginName].path;
        // old style at the root of the project
        let files = glob.sync(path.join(pluginPath, "actions", "**", "*.js"));

        files = files.concat(
          glob.sync(path.join(pluginPath, "dist", "actions", "**", "*.js"))
        );

        utils
          .ensureNoTsHeaderFiles(files)
          .forEach((f) => api.actions.loadFile(f));
      }
    }

    // now that the actions are loaded, we can add all the inputs to api.params
    api.params.buildPostVariables();
  }

  async loadFile(fullFilePath: string, reload: boolean = false) {
    const loadMessage = (action) => {
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

    let action;

    try {
      let collection = await import(fullFilePath);
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
        api.exceptionHandlers.initializer(error, fullFilePath);
        delete api.actions.actions[action.name][action.version];
      } catch (_error) {
        throw error;
      }
    }
  }
}
