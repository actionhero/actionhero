import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { Process, ActionheroConfigInterface } from "./../../src";
import { buildConfig } from "./../../src/modules/config";

const actionhero = new Process();
let config: Partial<ActionheroConfigInterface>;
let configFolders: string | undefined;

const newConfigFolderPaths = [
  path.join(__dirname, "first_config"),
  path.join(__dirname, "second_config"),
];

const routeFilesContent = [
  "export const DEFAULT = { collection: () => { return { a: 1 } } }",
  "export const DEFAULT = { collection: () => { return { b: 2 } } }",
];

const createRouteFile = async (
  newConfigFolderPath: string,
  routeFileContent: string,
) => {
  try {
    await promisify(fs.mkdir)(newConfigFolderPath);
  } catch (ex) {}

  try {
    const newRoutesFilePath = path.join(newConfigFolderPath, "collection.ts");

    await promisify(fs.writeFile)(newRoutesFilePath, routeFileContent, {
      encoding: "utf-8",
    });
  } catch (ex) {}
};

const removeRouteFile = async (newConfigFolderPath: string) => {
  try {
    const newRoutesFilePath = path.join(newConfigFolderPath, "collection.ts");

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
    expect(config.collection).toEqual({
      a: 1,
      b: 2,
    });
  });
});
