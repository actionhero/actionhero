import { api, utils, Initializer } from "../index";

export interface ParamsApi {
  globalSafeParams?: Array<string>;
  postVariables: Array<string>;
  buildPostVariables: ParamsInitializer["buildPostVariables"];
}

/**
 * Collects and formats allowed params for this server.
 */
export class ParamsInitializer extends Initializer {
  constructor() {
    super();
    this.name = "params";
    this.loadPriority = 400;
  }

  async initialize() {
    api.params = {
      postVariables: [],
      buildPostVariables: this.buildPostVariables.bind(this),
    };

    // special params we will always accept
    api.params.globalSafeParams = [
      "file",
      "apiVersion",
      "callback",
      "action",
      "messageId",
    ];
  }

  buildPostVariables() {
    const postVariables = [];
    let i: string;
    let j: string;

    api.params.globalSafeParams.forEach((p) => {
      postVariables.push(p);
    });

    for (i in api.actions.actions) {
      for (j in api.actions.actions[i]) {
        const action = api.actions.actions[i][j];
        for (const key in action.inputs) {
          postVariables.push(key);
        }
      }
    }

    api.params.postVariables = utils.arrayUnique(postVariables);
    return api.params.postVariables;
  }
}
