import { Connection } from "../classes/connection";
import { ActionProcessor } from "../classes/actionProcessor";
import { api, utils, config } from "../index";

export namespace action {
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
    /**Called before the action runs.  Has access to all params, before sanitization.  Can modify the data object for use in actions. */
    preProcessor?: Function;
    /**Called after the action runs. */
    postProcessor?: Function;
  }

  /**
   * Add a middleware component available to pre or post-process actions.
   */
  export function addMiddleware(data: ActionMiddleware) {
    if (!data.name) {
      throw new Error("middleware.name is required");
    }
    if (!data.priority) {
      data.priority = config.general.defaultMiddlewarePriority;
    }
    data.priority = Number(data.priority);
    api.actions.middleware[data.name] = data;
    if (data.global === true) {
      api.actions.globalMiddleware.push(data.name);
      utils.sortGlobalMiddleware(
        api.actions.globalMiddleware,
        api.actions.middleware
      );
    }
  }

  /**
   * Run an Action in-line, perhaps from within another Action or Task.
   */
  export async function run<ActionClass>(
    actionName: string,
    actionVersion?: string | number,
    params: { [key: string]: any } = {},
    connectionProperties = {}
  ) {
    const connection = new Connection({
      type: "in-line-action",
      remotePort: 0,
      remoteIP: "0",
      rawConnection: {},
    });

    connection.params = params;
    Object.assign(connection, connectionProperties);

    try {
      const actionProcessor = new ActionProcessor(connection);
      const data = await actionProcessor.processAction(
        actionName,
        actionVersion
      );

      if (data.response.error) throw new Error(data.response.error);

      return data.response;
    } finally {
      await connection.destroy();
    }
  }
}
