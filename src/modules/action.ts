import { api, config } from "../index";
import { sortGlobalMiddleware } from "./../utils/sortGlobalMiddleware";

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

export namespace action {
  /**
   * Add a middleware component avaialable to pre or post-process actions.
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
      sortGlobalMiddleware(
        api.actions.globalMiddleware,
        api.actions.middleware
      );
    }
  }
}
