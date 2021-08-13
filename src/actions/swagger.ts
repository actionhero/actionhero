import { Action, config, api } from "./../index";
import * as fs from "fs";
import * as path from "path";
import { route, RouteMethod, RouteType } from "../modules/route";

const SWAGGER_VERSION = "2.0";
const API_VERSION = ""; // if you need a prefix to your API routes, like `v1`
const parentPackageJSON = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json")).toString()
);

const responses = {
  200: {
    description: "successful operation",
  },
  400: {
    description: "Invalid input",
  },
  404: {
    description: "Not Found",
  },
  422: {
    description: "Missing or invalid params",
  },
  500: {
    description: "Server error",
  },
};

export class Swagger extends Action {
  constructor() {
    super();
    this.name = "swagger";
    this.description = "return API documentation in the OpenAPI specification";
    this.outputExample = {};
  }

  getLatestAction(route: RouteType) {
    let matchedAction: Action;
    Object.keys(api.actions.actions).forEach((actionName) => {
      Object.keys(api.actions.actions[actionName]).forEach((version) => {
        const action = api.actions.actions[actionName][version];
        if (action.name === route.action) {
          matchedAction = action;
        }
      });
    });

    return matchedAction;
  }

  buildSwaggerPaths() {
    const swaggerPaths: {
      [path: string]: {
        [method: string]: {
          tags: string[];
          summary: string;
          consumes: string[];
          produces: string[];
          parameters: Array<{
            in: string;
            name: string;
            type: string;
            required: boolean;
            default: string | number | boolean;
          }>;
          responses: typeof responses;
          security: string[];
        };
      };
    } = {};
    const tags: string[] = [];

    Object.keys(api.routes.routes).map((method: RouteMethod) => {
      api.routes.routes[method].map((route) => {
        const action = this.getLatestAction(route);
        if (!action) return;

        const tag = action.name.split(":")[0];
        const formattedPath = route.path
          .replace("/v:apiVersion", "")
          .replace(/\/:(\w*)/, "/{$1}")
          .replace(/\/:(\w*)/, "/{$1}")
          .replace(/\/:(\w*)/, "/{$1}")
          .replace(/\/:(\w*)/, "/{$1}")
          .replace(/\/:(\w*)/, "/{$1}");

        swaggerPaths[formattedPath] = swaggerPaths[formattedPath] || {};
        swaggerPaths[formattedPath][method] = {
          tags: [tag],
          summary: action.description,
          // description: action.description, // this is redundant
          consumes: ["application/json"],
          produces: ["application/json"],
          parameters: Object.keys(action.inputs)
            .sort()
            .map((inputName) => {
              return {
                in: route.path.includes(`:${inputName}`) ? "path" : "query",
                name: inputName,
                type: "string", // not really true, but helps the swagger validator
                required:
                  action.inputs[inputName].required ||
                  route.path.includes(`:${inputName}`)
                    ? true
                    : false,
                default:
                  action.inputs[inputName].default !== null &&
                  action.inputs[inputName].default !== undefined
                    ? typeof action.inputs[inputName].default === "object"
                      ? JSON.stringify(action.inputs[inputName].default)
                      : typeof action.inputs[inputName].default === "function"
                      ? action.inputs[inputName].default()
                      : `${action.inputs[inputName].default}`
                    : undefined,
              };
            }),
          responses,
          security: [],
        };

        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });

    return { swaggerPaths, tags };
  }

  async run() {
    const { swaggerPaths, tags } = this.buildSwaggerPaths();
    const allowedRequestHosts =
      config.get<string[]>("servers", "web", "allowedRequestHosts") ?? [];
    const port = config.get<number | string>("servers", "web", "port");

    return {
      swagger: SWAGGER_VERSION,
      info: {
        description: parentPackageJSON.description,
        version: parentPackageJSON.version,
        title: parentPackageJSON.name,
        license: { name: parentPackageJSON.license },
      },
      host: allowedRequestHosts[0]
        ? allowedRequestHosts[0].replace("https://", "").replace("http://", "")
        : `localhost:${port}`,
      basePath: `/api/${API_VERSION}`,
      // tags: tags.map((tag) => {
      //   return { name: tag, description: `topic: ${tag}` };
      // }),
      schemes: allowedRequestHosts[0] ? ["https", "http"] : ["http"],
      paths: swaggerPaths,

      securityDefinitions: {
        // TODO (custom)?
      },
      externalDocs: {
        description: "Learn more about Actionhero",
        url: "https://www.actionherojs.com",
      },
    };
  }
}
