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

// cannot import this until we know where to load from!
function determineProjectRoot() {
  let projectRoot = process.cwd();
  if (process.env.project_root) {
    projectRoot = process.env.project_root;
  } else if (process.env.projectRoot) {
    projectRoot = process.env.projectRoot;
  } else if (process.env.PROJECT_ROOT) {
    projectRoot = process.env.PROJECT_ROOT;
  }

  return projectRoot;
}

const projectRoot = determineProjectRoot();

(async () => {
  const formatParams = (runner: Runner) => {
    const params: any = {};

    if (!runner.inputs) {
      runner.inputs = {};
    }

    Object.keys(runner.inputs).forEach((inputName) => {
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
    try {
      // when generating the project from scratch, we cannot rely on the normal initializers
      const ExportedRunnerClasses = await import(
        path.join(__dirname, "methods", commands.join(path.sep))
      );

      if (Object.keys(ExportedRunnerClasses).length > 1) {
        throw new Error("actionhero CLI files should only export one method");
      }

      const runner = new ExportedRunnerClasses[
        Object.keys(ExportedRunnerClasses)[0]
      ]();
      const params = formatParams(runner);
      await runner.run({ params: params });
      setTimeout(process.exit, 100, 0);
    } catch (error) {
      console.error(error.toString());
      process.exit(1);
    }
  };

  const handleMethod = async (commands: Array<string>) => {
    console.log("₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋₋");
    console.log(`ACTIONHERO COMMAND >> ${commands.join(" ")}`);
    console.log("⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻⁻");

    const { config, Process } = await import("../index");
    const actionHeroProcess = new Process();
    await actionHeroProcess.initialize();

    try {
      let ExportedClasses;

      let p: string;
      p = path.join(__dirname, "methods", commands.join(path.sep) + ".js");
      if (fs.existsSync(p) && config.general.cliIncludeInternal !== false) {
        ExportedClasses = await import(p);
      }

      p = path.join(__dirname, "methods", commands.join(path.sep) + ".ts");
      if (fs.existsSync(p) && config.general.cliIncludeInternal !== false) {
        ExportedClasses = await import(p);
      }

      if (!ExportedClasses) {
        config.general.paths.cli.forEach(async (cliPath: string) => {
          p = path.join(cliPath, commands.join(path.sep) + ".js");
          if (fs.existsSync(p)) {
            ExportedClasses = await import(p);
          }

          p = path.join(cliPath, commands.join(path.sep) + ".ts");
          if (fs.existsSync(p)) {
            ExportedClasses = await import(p);
          }
        });
      }

      if (!ExportedClasses) {
        for (const pluginName in config.plugins) {
          if (config.plugins[pluginName].cli !== false) {
            const pluginPath = config.plugins[pluginName].path;
            p = path.join(pluginPath, "bin", commands.join(path.sep) + ".js");
            if (fs.existsSync(p)) {
              ExportedClasses = await import(p);
            }

            p = path.join(
              pluginPath,
              "dist",
              "bin",
              commands.join(path.sep) + ".js"
            );
            if (fs.existsSync(p)) {
              ExportedClasses = await import(p);
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
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  };

  const commands = [];
  if (!optimist.argv._ || optimist.argv._.length === 0) {
    commands.push("help");
  }
  optimist.argv._.forEach(function (arg: string) {
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
