import * as path from "path";
import {
  api,
  config,
  log,
  utils,
  route,
  Initializer,
  RouteType,
  Connection,
  RouteMethod,
} from "../index";
import { routerMethods } from "../modules/route";

export interface RoutesApi {
  routes: { [method in RouteMethod]: RouteType[] };
  processRoute?: RoutesInitializer["processRoute"];
  matchURL?: RoutesInitializer["matchURL"];
  loadRoutes?: RoutesInitializer["loadRoutes"];
}

/**
 * Contains routing options for web clients.  Can associate routes with actions or files.
 */
export class RoutesInitializer extends Initializer {
  constructor() {
    super();
    this.name = "routes";
    this.loadPriority = 500;
  }

  processRoute = (connection: Connection, pathParts: string[]) => {
    if (
      connection.params.action === undefined ||
      api.actions.actions[connection.params.action] === undefined
    ) {
      let method = connection.rawConnection.method.toLowerCase() as RouteMethod;
      if (method === "head" && !api.routes.routes.head) method = "get";

      for (const i in api.routes.routes[method]) {
        const route = api.routes.routes[method][i];
        const match = api.routes.matchURL(
          pathParts,
          route.path,
          route.matchTrailingPathParts
        );
        if (match.match) {
          if (route.apiVersion) {
            connection.params.apiVersion ||= route.apiVersion;
          }

          for (const param in match.params) {
            try {
              const decodedName = decodeURIComponent(param.replace(/\+/g, " "));
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

  matchURL = (
    pathParts: string[],
    match: string,
    matchTrailingPathParts: boolean
  ) => {
    const response: { match: boolean; params: { [key: string]: any } } = {
      match: false,
      params: {},
    };
    const matchParts = match.split("/");
    let regexp = "";
    let variable = "";

    if (matchParts[0] === "") matchParts.splice(0, 1);
    if (matchParts[matchParts.length - 1] === "") matchParts.pop();

    if (matchParts.length !== pathParts.length && !matchTrailingPathParts) {
      return response;
    }

    for (const i in matchParts) {
      const matchPart = matchParts[i];
      let pathPart = pathParts[i];

      if (matchTrailingPathParts && parseInt(i, 10) === matchParts.length - 1) {
        for (const j in pathParts) {
          if (j > i) pathPart = pathPart + "/" + pathParts[j];
        }
      }

      if (!pathPart) return response;

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

  loadRoutes = (rawRoutes?: typeof config["routes"]) => {
    let counter = 0;

    if (!rawRoutes) if (config.routes) rawRoutes = config.routes;

    for (const [method, collection] of Object.entries(rawRoutes)) {
      for (const configRoute of collection as RouteType[]) {
        if (method === "all") {
          for (const verb of routerMethods) {
            route.registerRoute(
              verb as RouteMethod,
              configRoute.path,
              configRoute.action,
              configRoute.apiVersion,
              configRoute.matchTrailingPathParts,
              configRoute.dir
            );
          }
        } else {
          route.registerRoute(
            method as RouteMethod,
            configRoute.path,
            configRoute.action,
            configRoute.apiVersion,
            configRoute.matchTrailingPathParts,
            configRoute.dir
          );
        }
        counter++;
      }
    }

    api.params.postVariables = utils.arrayUnique(api.params.postVariables);

    if (config.web && Array.isArray(config.web.automaticRoutes)) {
      config.web.automaticRoutes.forEach((verb: RouteMethod) => {
        if (!routerMethods.includes(verb)) {
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
    return counter;
  };

  async initialize() {
    api.routes = {
      routes: {
        all: [],
        head: [],
        get: [],
        post: [],
        put: [],
        delete: [],
      },
    };

    api.routes.processRoute = this.processRoute;
    api.routes.matchURL = this.matchURL;
    api.routes.loadRoutes = this.loadRoutes;

    api.routes.loadRoutes();
  }
}
