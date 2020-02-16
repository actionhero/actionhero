import * as fs from "fs";
import * as path from "path";

// import { api, projectRoot, CLI } from "./../../index";
// we need to load each component directly so we don't accidentally source `config... which doesn't exist`
import { CLI } from "./../../classes/cli";
import { projectRoot } from "./../../classes/process/projectRoot";
import {
  createDirSafely,
  createFileSafely
} from "../../modules/utils/fileUtils";

export class Generate extends CLI {
  constructor() {
    super();
    this.name = "generate";
    this.description =
      "will prepare an empty directory with a template ActionHero project";
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
      configApiJs: "/src/config/api.ts",
      configLoggerJs: "/src/config/logger.ts",
      configRedisJs: "/src/config/redis.ts",
      configTasksJs: "/src/config/tasks.ts",
      configErrorsJs: "/src/config/errors.ts",
      configPluginsJs: "/src/config/plugins.ts",
      configI18nJs: "/src/config/i18n.ts",
      configRoutesJs: "/src/config/routes.ts",
      configWebJs: "/src/config/servers/web.ts",
      configWebsocketJs: "/src/config/servers/websocket.ts",
      packageJson: "/package.json",
      actionStatus: "/src/actions/status.ts",
      actionChatRoom: "/src/actions/createChatRoom.ts",
      actionDocumentation: "/src/actions/showDocumentation.ts",
      publicIndex: "/public/index.html",
      publicChat: "/public/chat.html",
      publicLogo: "/public/logo/actionhero.png",
      publicCss: "/public/css/cosmo.css",
      exampleTest: "/__tests__/template.ts.example",
      enLocale: "/locales/en.json",
      gitignore: "/templates/gitignore.template"
    };

    for (const name in oldFileMap) {
      const localPath = oldFileMap[name];
      const source = path.join(__dirname, "/../../../", localPath);
      const extension = localPath.split(".")[1];
      documents[name] = fs.readFileSync(source);
      if (extension === "ts" || extension === "js" || extension === "json") {
        documents[name] = documents[name].toString();
        documents[name] = documents[name].replace(
          'from "./../index"',
          'from "actionhero"'
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
      "/src/config/servers",
      "/src/actions",
      "/src/tasks",
      "/src/initializers",
      "/src/servers",
      "/src/bin",
      "/log",
      "/pids",
      "/locales",
      "/public",
      "/public/javascript",
      "/public/css",
      "/public/logo",
      "/__tests__",
      "/__tests__/actions",
      "/__tests__/tasks"
    ].forEach(dir => {
      try {
        const message = createDirSafely(projectRoot + dir);
        console.log(message);
      } catch (error) {
        console.log(error.toString());
      }
    });

    const newFileMap = {
      "/tsconfig.json": "tsconfig",
      "/src/config/api.ts": "configApiJs",
      "/src/config/logger.ts": "configLoggerJs",
      "/src/config/redis.ts": "configRedisJs",
      "/src/config/tasks.ts": "configTasksJs",
      "/src/config/errors.ts": "configErrorsJs",
      "/src/config/plugins.ts": "configPluginsJs",
      "/src/config/i18n.ts": "configI18nJs",
      "/src/config/routes.ts": "configRoutesJs",
      "/src/config/servers/web.ts": "configWebJs",
      "/src/config/servers/websocket.ts": "configWebsocketJs",
      "/package.json": "packageJson",
      "/src/actions/status.ts": "actionStatus",
      "/src/actions/createChatRoom.ts": "actionChatRoom",
      "/src/actions/showDocumentation.ts": "actionDocumentation",
      "/public/index.html": "publicIndex",
      "/public/chat.html": "publicChat",
      "/public/css/cosmo.css": "publicCss",
      "/public/logo/actionhero.png": "publicLogo",
      "/README.md": "readmeMd",
      "/__tests__/actions/status.ts": "exampleTest",
      "/locales/en.json": "enLocale",
      "/.gitignore": "gitignore"
    };

    for (const file in newFileMap) {
      try {
        const message = createFileSafely(
          projectRoot + file,
          documents[newFileMap[file]]
        );
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
    documents.projectMap
      .toString()
      .split("\n")
      .forEach(function(line) {
        console.log(line);
      });

    console.log(
      `
-------------------------------------------------------------------------------------------------------------------
You need to run \`npm install\` to install dependencies, and then \`npm run build\` to build the .js from this .ts project.
Then, run 'npm run dev' to start your server

<3, the Actionhero Team
www.actionherojs.com
-------------------------------------------------------------------------------------------------------------------
      `
    );

    return true;
  }
}
