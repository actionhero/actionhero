import { api } from "./../index";

export namespace route {
  /**
   * Programmatically define a route, rather than using `api.config.routes`.  This is useful for plugins which may define routes as well.
   * You can use both `api.routes.registerRoute` and `api.config.routes` in the same project.
   *
   * * method:                 HTTP verb (get, put, etc)
   * * path:                   The route in question.  Can use variables.
   * * action:                 The action to call with this route.
   * * apiVersion:             The version of the action to call, if more than one.
   * * matchTrailingPathParts: Allows the final segment of your route to absorb all trailing path parts in a matched variable. (ie: /api/user would match /api/user/123)
   * * dir:                    Which folder to serve static files from (must by included in api.config.general.paths)
   */
  export function registerRoute(
    method: string,
    path: string,
    action: string,
    apiVersion?: number,
    matchTrailingPathParts: boolean = false,
    dir?: string
  ) {
    const verbs = method === "all" ? api.routes.verbs : [method];
    for (const vi in verbs) {
      const verb = verbs[vi];
      api.routes.routes[verb].push({
        path: path,
        matchTrailingPathParts: matchTrailingPathParts,
        action: action,
        dir: dir,
        apiVersion: apiVersion
      });
    }
  }
}
