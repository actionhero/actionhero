import { api, Initializer } from "../index";

export interface DocumentationApi {
  documentation: {
    [key: string]: any;
  };
  build: Function;
}

/**
 * Documentation of Actions.
 */
export class Documentation extends Initializer {
  constructor() {
    super();
    this.name = "documentation";
    this.loadPriority = 999;
  }

  async initialize() {
    api.documentation = {
      documentation: {},

      build: () => {
        let action;
        for (const i in api.actions.actions) {
          for (const j in api.actions.actions[i]) {
            action = api.actions.actions[i][j];
            if (action.toDocument !== false) {
              if (!api.documentation.documentation[action.name]) {
                api.documentation.documentation[action.name] = {};
              }
              api.documentation.documentation[action.name][action.version] = {
                name: action.name,
                version: action.version,
                description: action.description,
                inputs: action.inputs,
                outputExample: action.outputExample
              };
            }
          }
        }
      }
    };

    api.documentation.build();
  }
}
