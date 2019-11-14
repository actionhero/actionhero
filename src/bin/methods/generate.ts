import * as fs from "fs";
import * as path from "path";
import { api, CLI } from "./../../index";

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
      configApiJs: "/config/api.js",
      configLoggerJs: "/config/logger.js",
      configRedisJs: "/config/redis.js",
      configTasksJs: "/config/tasks.js",
      configErrorsJs: "/config/errors.js",
      configPluginsJs: "/config/plugins.js",
      configI18nJs: "/config/i18n.js",
      configRoutesJs: "/config/routes.js",
      configWebJs: "/config/servers/web.js",
      configWebsocketJs: "/config/servers/websocket.js",
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

    documents.bootJS = String(
      fs.readFileSync(
        path.join(__dirname, "/../../../templates/boot.js.template")
      )
    );

    console.log("Generating a new actionhero project...");

    [
      "/src",
      "/src/actions",
      "/pids",
      "/config",
      "/config/servers",
      "/src/initializers",
      "/log",
      "/locales",
      "/src/bin",
      "/src/servers",
      "/public",
      "/public/javascript",
      "/public/css",
      "/public/logo",
      "/src/tasks",
      "/__tests__",
      "/__tests__/actions",
      "/__tests__/tasks"
    ].forEach(dir => {
      try {
        const message = api.utils.createDirSafely(api.projectRoot + dir);
        console.log(message);
      } catch (error) {
        console.log(error.toString());
      }
    });

    const newFileMap = {
      "tsconfig.json": "tsconfig",
      "/config/api.js": "configApiJs",
      "/config/logger.js": "configLoggerJs",
      "/config/redis.js": "configRedisJs",
      "/config/tasks.js": "configTasksJs",
      "/config/errors.js": "configErrorsJs",
      "/config/plugins.js": "configPluginsJs",
      "/config/i18n.js": "configI18nJs",
      "/config/routes.js": "configRoutesJs",
      "/config/servers/web.js": "configWebJs",
      "/config/servers/websocket.js": "configWebsocketJs",
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
      "/.gitignore": "gitignore",
      "/boot.js": "bootJS"
    };

    for (const file in newFileMap) {
      try {
        const message = api.utils.createFileSafely(
          api.projectRoot + file,
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
      "You may need to run `npm install` to install some dependancies",
      "alert"
    );
    console.log("Run 'npm start' to start your server");

    return true;
  }
}
