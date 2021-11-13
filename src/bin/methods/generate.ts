import * as fs from "fs";
import * as path from "path";

// import { api, projectRoot, CLI } from "./../../index";
// we need to load each component directly so we don't accidentally source `config... which doesn't exist`
import { CLI } from "./../../classes/cli";
import { projectRoot } from "./../../classes/process/projectRoot";
import {
  createDirSafely,
  createFileSafely,
} from "../../modules/utils/fileUtils";

export class GenerateCLI extends CLI {
  constructor() {
    super();
    this.name = "generate";
    this.description =
      "Generate a new Actionhero Project in an empty directory";
    this.initialize = false;
  }

  async run() {
    const documents: {
      [key: string]: any;
    } = {};

    documents.projectMap = fs.readFileSync(
      path.join(__dirname, "/../../../templates/projectMap.txt")
    );

    const oldFileMap = {
      tsconfig: "tsconfig.json",
      serverJs: "/templates/projectServer.ts.template",
      configApiJs: "/src/config/api.ts",
      configLoggerJs: "/src/config/logger.ts",
      configRedisJs: "/src/config/redis.ts",
      configTasksJs: "/src/config/tasks.ts",
      configErrorsJs: "/src/config/errors.ts",
      configPluginsJs: "/src/config/plugins.ts",
      configRoutesJs: "/src/config/routes.ts",
      configWebJs: "/src/config/web.ts",
      configWebsocketJs: "/src/config/websocket.ts",
      packageJson: "/package.json",
      actionStatus: "/src/actions/status.ts",
      actionChatRoom: "/src/actions/createChatRoom.ts",
      actionSwagger: "/src/actions/swagger.ts",
      publicIndex: "/public/index.html",
      publicChat: "/public/chat.html",
      publicSwagger: "/public/swagger.html",
      publicLogo: "/public/logo/actionhero.png",
      publicCss: "/public/css/cosmo.css",
      exampleTest: "/__tests__/template.ts.example",
      gitignore: "/templates/gitignore.template",
    };

    for (const [name, localPath] of Object.entries(oldFileMap)) {
      const source = path.join(__dirname, "/../../../", localPath);
      const extension = localPath.split(".")[1];
      documents[name] = fs.readFileSync(source);
      if (extension === "ts" || extension === "js" || extension === "json") {
        documents[name] = documents[name].toString();
        documents[name] = documents[name].replace(
          'from "./../index"',
          'from "actionhero"'
        );
        documents[name] = documents[name].replace(
          'from ".."',
          'from "actionhero"'
        );
        documents[name] = documents[name].replace(
          'declare module ".."',
          'declare module "actionhero"'
        );
      }
    }

    const AHversionNumber = JSON.parse(documents.packageJson).version;

    documents.packageJson = String(
      fs.readFileSync(
        path.join(__dirname, "/../../../templates/package.json.template")
      )
    );

    documents.packageJson = documents.packageJson.replace(
      "%%versionNumber%%",
      AHversionNumber
    );

    documents.readmeMd = String(
      fs.readFileSync(
        path.join(__dirname, "/../../../templates/README.md.template")
      )
    );

    console.log("Generating a new actionhero project...");

    [
      "/src",
      "/src/config",
      "/src/actions",
      "/src/tasks",
      "/src/initializers",
      "/src/servers",
      "/src/bin",
      "/log",
      "/pids",
      "/public",
      "/public/javascript",
      "/public/css",
      "/public/logo",
      "/__tests__",
      "/__tests__/actions",
      "/__tests__/tasks",
    ].forEach((dir) => {
      try {
        const message = createDirSafely(projectRoot + dir);
        console.log(message);
      } catch (error) {
        console.log(error.toString());
      }
    });

    const newFileMap = {
      "/tsconfig.json": "tsconfig",
      "/src/server.ts": "serverJs",
      "/src/config/api.ts": "configApiJs",
      "/src/config/logger.ts": "configLoggerJs",
      "/src/config/redis.ts": "configRedisJs",
      "/src/config/tasks.ts": "configTasksJs",
      "/src/config/errors.ts": "configErrorsJs",
      "/src/config/plugins.ts": "configPluginsJs",
      "/src/config/routes.ts": "configRoutesJs",
      "/src/config/web.ts": "configWebJs",
      "/src/config/websocket.ts": "configWebsocketJs",
      "/package.json": "packageJson",
      "/src/actions/status.ts": "actionStatus",
      "/src/actions/createChatRoom.ts": "actionChatRoom",
      "/src/actions/swagger.ts": "actionSwagger",
      "/public/index.html": "publicIndex",
      "/public/chat.html": "publicChat",
      "/public/swagger.html": "publicSwagger",
      "/public/css/cosmo.css": "publicCss",
      "/public/logo/actionhero.png": "publicLogo",
      "/README.md": "readmeMd",
      "/__tests__/actions/status.ts": "exampleTest",
      "/.gitignore": "gitignore",
    };

    for (const [file, name] of Object.entries(newFileMap)) {
      try {
        const message = createFileSafely(projectRoot + file, documents[name]);
        console.log(message);
      } catch (error) {
        console.log(error.toString());
      }
    }

    console.log("");
    console.log(
      "Generation Complete.  Your project directory should look like this:"
    );

    console.log("");
    (documents.projectMap.toString() as string).split("\n").forEach((line) => {
      console.log(line);
    });

    console.log(
      `
-------------------------------------------------------------------------------------------------------------------
You need to run \`npm install\` to install dependencies, and then \`npm run build\` to build the .js from this .ts project.
Then, run 'npm run dev' to start your server

❤️  the Actionhero Team
www.actionherojs.com
-------------------------------------------------------------------------------------------------------------------
      `
    );

    return true;
  }
}
