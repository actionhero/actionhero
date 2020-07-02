import { Action, config, api } from "./../index";
import * as fs from "fs";
import * as path from "path";

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
    description: "Not Fount",
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

  getLatestAction(route) {
    let matchedAction;
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
    const swaggerPaths = {};
    const tags = [];

    Object.keys(api.routes.routes).map((method) => {
      api.routes.routes[method].map((route) => {
        const action = this.getLatestAction(route);
        if (!action) {
          return;
        }

        const tag = action.name.split(":")[0];
        const formattedPath = route.path
          .replace("/v:apiVersion", "")
          .replace(/\/:(\w*)/, "/{$1}");

        // in simpleRouting is enabled, only show the "post" verb for this action, not all 5
        if (config.servers.web.simpleRouting && method !== "get") {
          return;
        }

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

  async run(data) {
    const { swaggerPaths, tags } = this.buildSwaggerPaths();

    data.response = {
      swagger: SWAGGER_VERSION,
      info: {
        description: parentPackageJSON.description,
        version: parentPackageJSON.version,
        title: parentPackageJSON.name,
        license: { name: parentPackageJSON.license },
      },
      host: config.servers.web.allowedRequestHosts[0]
        ? config.servers.web.allowedRequestHosts[0]
            .replace("https://", "")
            .replace("http://", "")
        : `localhost:${config.servers.web.port}`,
      basePath: `/api/${API_VERSION}`,
      // tags: tags.map((tag) => {
      //   return { name: tag, description: `topic: ${tag}` };
      // }),
      schemes: config.servers.web.allowedRequestHosts[0]
        ? ["https", "http"]
        : ["http"],
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
