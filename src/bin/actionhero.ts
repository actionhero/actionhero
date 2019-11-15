#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import * as optimist from "optimist";
import { spawn } from "child_process";

interface RunnerInputs {
  [propName: string]: any;
}

interface Runner {
  name: string;
  inputs: RunnerInputs;
}

let projectRoot: string;

if (process.env.projectRoot) {
  projectRoot = process.env.projectRoot;
} else if (process.env.project_root) {
  projectRoot = process.env.project_root;
} else if (process.env.PROJECT_ROOT) {
  projectRoot = process.env.PROJECT_ROOT;
} else {
  projectRoot = path.normalize(process.cwd());
}

(async () => {
  const bootFilePaths = [
    `${projectRoot}/boot.js`,
    `${projectRoot}/dist/boot.js`
  ];

  for (const i in bootFilePaths) {
    const bootFile = bootFilePaths[i];
    if (fs.existsSync(bootFile)) {
      const Exports = require(bootFile);
      await Exports[Object.keys(Exports)[0]]();
    }
  }

  const { api, Process } = require(path.join(__dirname, "..", "index"));
  const actionheroRoot = path.normalize(path.join(__dirname, ".."));

  const formatParams = (runner: Runner) => {
    const params: any = {};

    if (!runner.inputs) {
      runner.inputs = {};
    }

    Object.keys(runner.inputs).forEach(inputName => {
      const collection = runner.inputs[inputName];
      let value = optimist.argv[inputName];

      if (
        collection.default &&
        (value === undefined || value === null || value === "")
      ) {
        if (typeof collection.default === "function") {
          value = collection.default();
        } else {
          value = collection.default;
        }
        console.log(`using default value of \`${value}\` for \`${inputName}\``);
      }

      if (
        collection.required === true &&
        (value === undefined || value === null || value === "")
      ) {
        console.error(
          `Error: \`${inputName}\` is a required command-line argument to the method \`${runner.name}\``
        );
        // console.log(`You can provide it via \`${runner.name} --${inputName}=value\``)
        process.exit(1);
      }

      params[inputName] = value;
    });

    return params;
  };

  const handleUnbuiltProject = async (commands: Array<string>) => {
    api.projectRoot = projectRoot;
    api.actionheroRoot = actionheroRoot;

    // reload utils, as they won't have been loaded yet
    try {
      const ExportedUtilClasses = require(path.normalize(
        path.join(__dirname, "/../initializers/utils")
      ));

      if (Object.keys(ExportedUtilClasses).length > 1) {
        throw new Error("actionhero CLI files should only export one method");
      }

      const utils = new ExportedUtilClasses[
        Object.keys(ExportedUtilClasses)[0]
      ]();
      await utils.initialize();

      // when generating the project from scratch, we cannot rely on the normal initilizers
      const ExportedRunnerClasses = require(path.join(
        __dirname,
        "methods",
        commands.join(path.sep)
      ));

      if (Object.keys(ExportedRunnerClasses).length > 1) {
        throw new Error("actionhero CLI files should only export one method");
      }

      const runner = new ExportedRunnerClasses[
        Object.keys(ExportedRunnerClasses)[0]
      ]();
      const params = formatParams(runner);
      await runner.run({ params: params });
      setTimeout(process.exit, 500, 0);
    } catch (error) {
      console.error(error.toString());
      process.exit(1);
    }
  };

  const handleMethod = async (commands: Array<string>) => {
    try {
      const actionHeroProcess = new Process();
      let configChanges = {};

      if (process.env.configChanges) {
        configChanges = JSON.parse(process.env.configChanges);
      }
      if (optimist.argv.configChanges) {
        configChanges = JSON.parse(optimist.argv.configChanges);
      }

      await actionHeroProcess.initialize({ configChanges });
      if (!api.projectRoot) {
        api.projectRoot = projectRoot;
      }
      if (!api.actionheroRoot) {
        api.actionheroRoot = actionheroRoot;
      }
      api._context = actionHeroProcess;
      let ExportedClasses;

      let p: string;
      p = path.join(__dirname, "methods", commands.join(path.sep) + ".js");
      if (fs.existsSync(p) && api.config.general.cliIncludeInternal !== false) {
        ExportedClasses = require(p);
      }

      p = path.join(__dirname, "methods", commands.join(path.sep) + ".ts");
      if (fs.existsSync(p) && api.config.general.cliIncludeInternal !== false) {
        ExportedClasses = require(p);
      }

      if (!ExportedClasses) {
        api.config.general.paths.cli.forEach((cliPath: string) => {
          p = path.join(cliPath, commands.join(path.sep) + ".js");
          if (fs.existsSync(p)) {
            ExportedClasses = require(p);
          }

          p = path.join(cliPath, commands.join(path.sep) + ".ts");
          if (fs.existsSync(p)) {
            ExportedClasses = require(p);
          }
        });
      }

      if (!ExportedClasses) {
        for (const pluginName in api.config.plugins) {
          if (api.config.plugins[pluginName].cli !== false) {
            const pluginPath = api.config.plugins[pluginName].path;
            p = path.join(pluginPath, "bin", commands.join(path.sep) + ".js");
            if (fs.existsSync(p)) {
              ExportedClasses = require(p);
            }

            p = path.join(pluginPath, "bin", commands.join(path.sep) + ".ts");
            if (fs.existsSync(p)) {
              ExportedClasses = require(p);
            }
          }
        }
      }

      if (!ExportedClasses) {
        console.error(
          `Error: \`${commands.join(" ")}\` is not a method I can perform.`
        );
        console.error("run `actionhero help` to learn more");
        setTimeout(process.exit, 500, 1);
      } else {
        console.log("₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋");
        console.log(`ACTIONHERO COMMAND >> ${commands.join(" ")}`);
        console.log("⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻");

        if (optimist.argv.daemon) {
          const newArgs: Array<string> = process.argv.splice(2);
          for (const i in newArgs) {
            if (newArgs[i].indexOf("--daemon") >= 0) {
              newArgs.splice(parseInt(i), 1);
            }
          }
          newArgs.push("--isDaemon=true");
          const command = path.normalize(actionheroRoot + "/bin/actionhero");
          const child = spawn(command, newArgs, {
            detached: true,
            cwd: process.cwd(),
            env: process.env,
            stdio: "ignore"
          });
          console.log(`spawned child process with pid ${child.pid}`, "notice");
          process.nextTick(process.exit);
        } else if (Object.keys(ExportedClasses).length > 1) {
          throw new Error("actionhero CLI files should only export one method");
        } else {
          const runner = new ExportedClasses[Object.keys(ExportedClasses)[0]]();
          const params = formatParams(runner);
          const toStop = await runner.run({ params: params });
          if (toStop || toStop === null || toStop === undefined) {
            setTimeout(process.exit, 500, 0);
          }
        }
      }
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  };

  const commands = [];
  if (!optimist.argv._ || optimist.argv._.length === 0) {
    commands.push("start");
  }
  optimist.argv._.forEach(function(arg: string) {
    commands.push(arg);
  });

  const argsMatch = (a: Array<string>, b: Array<string>) => {
    if (a.length !== b.length) {
      return false;
    }
    for (const i in a) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  };

  if (argsMatch(commands, ["version"])) {
    handleUnbuiltProject(commands);
  } else if (argsMatch(commands, ["generate"])) {
    handleUnbuiltProject(commands);
  } else if (argsMatch(commands, ["generate", "plugin"])) {
    handleUnbuiltProject(commands);
  } else {
    handleMethod(commands);
  }
})();
