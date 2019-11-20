import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { Process } from "./../../src/index";
import { buildConfig } from "./../../src/modules/config";

const actionhero = new Process();
let config;
let configFolders;

const newConfigFolderPaths = [
  path.join(__dirname, "first_config"),
  path.join(__dirname, "second_config")
];

const routeFilesContent = [
  "export const DEFAULT = {\n  routes: (api) => {\n    return {\n\n      get: [\n        { path: '/api-status', action: 'status' }\n      ]\n\n    }\n  }\n}\n",
  "export const DEFAULT= {\n  routes: (api) => {\n    return {\n\n      get: [\n        { path: '/random-number', action: 'randomNumber' }\n      ]\n\n    }\n  }\n}\n"
];

const createRouteFile = async (newConfigFolderPath, routeFileContent) => {
  try {
    await promisify(fs.mkdir)(newConfigFolderPath);
  } catch (ex) {}

  try {
    const newRoutesFilePath = path.join(newConfigFolderPath, "routes.ts");

    await promisify(fs.writeFile)(newRoutesFilePath, routeFileContent, {
      encoding: "utf-8"
    });
  } catch (ex) {}
};

const removeRouteFile = async newConfigFolderPath => {
  try {
    const newRoutesFilePath = path.join(newConfigFolderPath, "routes.ts");

    await promisify(fs.unlink)(newRoutesFilePath);
  } catch (ex) {}

  try {
    await promisify(fs.rmdir)(newConfigFolderPath);
  } catch (ex) {}
};

describe("Core: config folders", () => {
  beforeAll(async () => {
    configFolders = process.env.ACTIONHERO_CONFIG;

    await removeRouteFile(newConfigFolderPaths[0]);
    await removeRouteFile(newConfigFolderPaths[1]);
    await createRouteFile(newConfigFolderPaths[0], routeFilesContent[0]);
    await createRouteFile(newConfigFolderPaths[1], routeFilesContent[1]);

    process.env.ACTIONHERO_CONFIG = newConfigFolderPaths.join(",");

    await actionhero.start();
    config = buildConfig();
  });

  afterAll(async () => {
    await actionhero.stop();
    await removeRouteFile(newConfigFolderPaths[0]);
    await removeRouteFile(newConfigFolderPaths[1]);
    process.env.ACTIONHERO_CONFIG = configFolders;
  });

  test("routes should be rebuilt and contain both paths", async () => {
    expect(config.routes).toEqual({
      get: [
        { path: "/api-status", action: "status" },
        { path: "/random-number", action: "randomNumber" }
      ]
    });
  });
});
