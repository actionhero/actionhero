import * as path from "path";
import { api, log, utils, route, Initializer } from "../index";

export interface RoutesApi {
  routes: { [key: string]: any };
  verbs: Array<string>;
  processRoute?: Function;
  matchURL?: Function;
  loadRoutes?: Function;
}

/**
 * Contains routing options for web clients.  Can associate routes with actions or files.
 */
export class Routes extends Initializer {
  constructor() {
    super();
    this.name = "routes";
    this.loadPriority = 500;
  }

  async initialize(config) {
    api.routes = {
      routes: {},
      verbs: ["head", "get", "post", "put", "patch", "delete"],
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
              const requestedFile =
                connection.rawConnection.parsedURL.pathname.substring(
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

    api.routes.matchURL = (
      pathParts,
      match: string,
      matchTrailingPathParts: boolean
    ) => {
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
        }

        if (matchPart.indexOf(":") >= 0) {
          const trimmedMatchParts = matchPart.split(":");
          const trimmedMatchPart =
            trimmedMatchParts[trimmedMatchParts.length - 1];
          const replacement = trimmedMatchParts[trimmedMatchParts.length - 2];
          if (replacement) {
            pathPart = pathPart.replace(replacement, "");
          }

          if (trimmedMatchPart.indexOf("(") < 0) {
            variable = trimmedMatchPart;
            response.params[variable] = pathPart;
          } else {
            variable = trimmedMatchPart.replace(":", "").split("(")[0];
            regexp = trimmedMatchPart.substring(
              trimmedMatchPart.indexOf("(") + 1,
              trimmedMatchPart.length - 1
            );
            const matches = pathPart.match(new RegExp(regexp, "g"));
            if (matches) {
              response.params[variable] = pathPart;
            } else {
              return response;
            }
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

    // load in the routes file
    api.routes.loadRoutes = (rawRoutes) => {
      let counter = 0;

      api.routes.verbs.forEach((verb) => {
        api.routes.routes[verb] = api.routes.routes[verb] || [];
      });

      if (!rawRoutes) {
        if (config.routes) {
          rawRoutes = config.routes;
        }
      }

      let v: string;
      let verb: string;
      for (const i in rawRoutes) {
        const method = i.toLowerCase();
        for (const j in rawRoutes[i]) {
          const thisRoute = rawRoutes[i][j];
          if (method === "all") {
            for (v in api.routes.verbs) {
              verb = api.routes.verbs[v];
              route.registerRoute(
                verb,
                thisRoute.path,
                thisRoute.action,
                thisRoute.apiVersion,
                thisRoute.matchTrailingPathParts,
                thisRoute.dir
              );
            }
          } else {
            route.registerRoute(
              method,
              thisRoute.path,
              thisRoute.action,
              thisRoute.apiVersion,
              thisRoute.matchTrailingPathParts,
              thisRoute.dir
            );
          }
          counter++;
        }
      }

      api.params.postVariables = utils.arrayUnique(api.params.postVariables);

      if (
        config.servers.web &&
        Array.isArray(config.servers.web.automaticRoutes)
      ) {
        config.servers.web.automaticRoutes.forEach((verb: string) => {
          if (!api.routes.verbs.includes(verb)) {
            throw new Error(`${verb} is not an HTTP verb`);
          }

          log(
            `creating routes automatically for all actions to ${verb} HTTP verb`
          );

          for (const action in api.actions.actions) {
            route.registerRoute(verb, "/" + action, action, null);
          }
        });
      }

      log("routes:", "debug", api.routes.routes);
    };

    api.routes.loadRoutes();
  }
}
