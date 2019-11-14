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
      configApiJs: "/config/api.ts",
      configLoggerJs: "/config/logger.ts",
      configRedisJs: "/config/redis.ts",
      configTasksJs: "/config/tasks.ts",
      configErrorsJs: "/config/errors.ts",
      configPluginsJs: "/config/plugins.ts",
      configI18nJs: "/config/i18n.ts",
      configRoutesJs: "/config/routes.ts",
      configWebJs: "/config/servers/web.ts",
      configWebsocketJs: "/config/servers/websocket.ts",
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
      if (extension === "js" || extension === "json") {
        documents[name] = documents[name].toString();
        documents[name] = documents[name].replace(
          "require('./../index.js')",
          "require('actionhero')"
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

    documents.bootJs = String(
      fs.readFileSync(
        path.join(__dirname, "/../../../templates/boot.ts.template")
      )
    );

    console.log("Generating a new actionhero project...");

    [
      "/actions",
      "/pids",
      "/config",
      "/config/servers",
      "/initializers",
      "/log",
      "/locales",
      "/bin",
      "/servers",
      "/public",
      "/public/javascript",
      "/public/css",
      "/public/logo",
      "/tasks",
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
      "/config/api.ts": "configApiJs",
      "/config/logger.ts": "configLoggerJs",
      "/config/redis.ts": "configRedisJs",
      "/config/tasks.ts": "configTasksJs",
      "/config/errors.ts": "configErrorsJs",
      "/config/plugins.ts": "configPluginsJs",
      "/config/i18n.ts": "configI18nJs",
      "/config/routes.ts": "configRoutesJs",
      "/config/servers/web.ts": "configWebJs",
      "/config/servers/websocket.ts": "configWebsocketJs",
      "/package.json": "packageJson",
      "/actions/status.ts": "actionStatus",
      "/actions/createChatRoom.ts": "actionChatRoom",
      "/actions/showDocumentation.ts": "actionDocumentation",
      "/public/index.html": "publicIndex",
      "/public/chat.html": "publicChat",
      "/public/css/cosmo.css": "publicCss",
      "/public/logo/actionhero.png": "publicLogo",
      "/README.md": "readmeMd",
      "/__tests__/actions/status.ts": "exampleTest",
      "/locales/en.json": "enLocale",
      "/.gitignore": "gitignore",
      "/boot.ts": "bootTs"
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
