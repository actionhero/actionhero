import * as path from "path";
import { api, config, log, Initializer } from "../index";
import { arrayUniqueify } from "./../utils/arrayUniqueify";

export interface RoutesApi {
  routes: { [key: string]: any };
  verbs: Array<string>;
  processRoute?: Function;
  matchURL?: Function;
  registerRoute?: Function;
  loadRoutes?: Function;
}

/**
 * Countains routing options for web clients.  Can associate routes with actions or files.
 */
export class Routes extends Initializer {
  constructor() {
    super();
    this.name = "routes";
    this.loadPriority = 500;
  }

  async initialize() {
    api.routes = {
      routes: {},
      verbs: ["head", "get", "post", "put", "patch", "delete"]
    };

    api.routes.processRoute = (connection, pathParts) => {
      if (
        connection.params.action === undefined ||
        api.actions.actions[connection.params.action] === undefined
      ) {
        let method = connection.rawConnection.method.toLowerCase();
        if (method === "head" && !api.routes.routes.head) {
          method = "get";
        }
        for (const i in api.routes.routes[method]) {
          const route = api.routes.routes[method][i];
          const match = api.routes.matchURL(
            pathParts,
            route.path,
            route.matchTrailingPathParts
          );
          if (match.match === true) {
            if (route.apiVersion) {
              connection.params.apiVersion =
                connection.params.apiVersion || route.apiVersion;
            }

            for (const param in match.params) {
              try {
                const decodedName = decodeURIComponent(
                  param.replace(/\+/g, " ")
                );
                const decodedValue = decodeURIComponent(
                  match.params[param].replace(/\+/g, " ")
                );
                connection.params[decodedName] = decodedValue;
              } catch (e) {
                // malformed URL
              }
            }
            connection.matchedRoute = route;

            if (route.dir) {
              const requestedFile = connection.rawConnection.parsedURL.pathname.substring(
                route.path.length,
                connection.rawConnection.parsedURL.pathname.length
              );
              connection.params.file = path.normalize(
                route.dir + "/" + requestedFile
              );
            } else {
              connection.params.action = route.action;
            }
            break;
          }
        }
      }
    };

    api.routes.matchURL = (pathParts, match, matchTrailingPathParts) => {
      const response = { match: false, params: {} };
      const matchParts = match.split("/");
      let regexp = "";
      let variable = "";

      if (matchParts[0] === "") {
        matchParts.splice(0, 1);
      }
      if (matchParts[matchParts.length - 1] === "") {
        matchParts.pop();
      }

      if (
        matchParts.length !== pathParts.length &&
        matchTrailingPathParts !== true
      ) {
        return response;
      }

      for (const i in matchParts) {
        const matchPart = matchParts[i];
        let pathPart = pathParts[i];

        if (
          matchTrailingPathParts === true &&
          parseInt(i) === matchParts.length - 1
        ) {
          for (const j in pathParts) {
            if (j > i) {
              pathPart = pathPart + "/" + pathParts[j];
            }
          }
        }

        if (!pathPart) {
          return response;
        } else if (matchPart[0] === ":" && matchPart.indexOf("(") < 0) {
          variable = matchPart.replace(":", "");
          response.params[variable] = pathPart;
        } else if (matchPart[0] === ":" && matchPart.indexOf("(") >= 0) {
          variable = matchPart.replace(":", "").split("(")[0];
          regexp = matchPart.substring(
            matchPart.indexOf("(") + 1,
            matchPart.length - 1
          );
          const matches = pathPart.match(new RegExp(regexp, "g"));
          if (matches) {
            response.params[variable] = pathPart;
          } else {
            return response;
          }
        } else {
          if (
            pathPart === null ||
            pathPart === undefined ||
            pathParts[i].toLowerCase() !== matchPart.toLowerCase()
          ) {
            return response;
          }
        }
      }

      response.match = true;
      return response;
    };

    /**
     * Programatically define a route, rather than using `api.config.routes`.  This is useful for plugins which may define routes as well.
     * You can use both `api.routes.registerRoute` and `api.config.routes` in the same project.
     *
     * * method:                 HTTP verb (get, put, etc)
     * * path:                   The route in question.  Can use variables.
     * * action:                 The action to call with this route.
     * * apiVersion:             The version of the action to call, if more than one.
     * * matchTrailingPathParts: Allows the final segment of your route to absorb all trailing path parts in a matched variable. (ie: /api/user would match /api/user/123)
     * * dir:                    Which folder to serve static files from (must by included in api.config.general.paths)
     */
    api.routes.registerRoute = (
      method: string,
      path: string,
      action: string,
      apiVersion: number,
      matchTrailingPathParts: boolean = false,
      dir?: string
    ) => {
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
    };

    // load in the routes file
    api.routes.loadRoutes = rawRoutes => {
      let counter = 0;

      api.routes.verbs.forEach(verb => {
        api.routes.routes[verb] = api.routes.routes[verb] || [];
      });

      if (!rawRoutes) {
        if (config.routes) {
          rawRoutes = config.routes;
        }
      }

      let v;
      let verb;
      for (const i in rawRoutes) {
        const method = i.toLowerCase();
        for (const j in rawRoutes[i]) {
          const route = rawRoutes[i][j];
          if (method === "all") {
            for (v in api.routes.verbs) {
              verb = api.routes.verbs[v];
              api.routes.registerRoute(
                verb,
                route.path,
                route.action,
                route.apiVersion,
                route.matchTrailingPathParts,
                route.dir
              );
            }
          } else {
            api.routes.registerRoute(
              method,
              route.path,
              route.action,
              route.apiVersion,
              route.matchTrailingPathParts,
              route.dir
            );
          }
          counter++;
        }
      }

      api.params.postVariables = arrayUniqueify(api.params.postVariables);

      if (config.servers.web && config.servers.web.simpleRouting === true) {
        const simplePaths = [];
        for (const action in api.actions.actions) {
          simplePaths.push("/" + action);
          // api.routes.verbs.forEach(function(verb){
          for (v in api.routes.verbs) {
            verb = api.routes.verbs[v];
            api.routes.registerRoute(verb, "/" + action, action);
          }
        }
        log(
          `${simplePaths.length} simple routes loaded from action names`,
          "debug"
        );

        log("routes:", "debug", api.routes.routes);
      }
    };

    api.routes.loadRoutes();
  }
}
