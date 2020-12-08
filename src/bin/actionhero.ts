#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import * as glob from "glob";
import { program } from "commander";
import { typescript } from "../classes/process/typescript";
import { projectRoot } from "../classes/process/projectRoot";

export default async function main() {
  const parentPackageJSON = path.join(projectRoot, "package.json");

  program.storeOptionsAsProperties(false);
  program.version(getVersion());

  let pathsLoaded: string[] = [];
  try {
    const { config } = await import("../index");

    // this project
    for (const i in config.general.paths.cli) {
      await loadDirectory(path.join(config.general.paths.cli[i]));
    }

    // plugins
    for (const pluginName in config.plugins) {
      if (config.plugins[pluginName].cli !== false) {
        await loadDirectory(config.plugins[pluginName].path);
      }
    }

    // core
    if (config.general.cliIncludeInternal !== false) {
      await loadDirectory(__dirname);
    }
  } catch (e) {
    // we are trying to build a new project
    await loadDirectory(path.join(__dirname), "generate"); // core
  }

  program.parse(process.argv);

  // --- Utils --- //

  async function loadDirectory(dir: string, match = "*") {
    if (!fs.existsSync(dir)) return;
    const realpath = fs.realpathSync(dir);
    if (pathsLoaded.includes(realpath)) return;
    pathsLoaded.push(realpath);

    const matcher = `${realpath}/**/+(${
      typescript ? `${match}.js|*.ts` : `${match}.js`
    })`;
    const files = glob.sync(matcher);
    for (const i in files) {
      const collection = await import(files[i]);
      for (const j in collection) {
        const command = collection[j];
        convertCLIToCommanderAction(command);
      }
    }
  }

  async function convertCLIToCommanderAction(cli) {
    if (
      Object.getPrototypeOf(cli?.prototype?.constructor || {}).name !== "CLI"
    ) {
      return;
    }

    const instance = new cli();
    const command = program
      .command(instance.name)
      .description(instance.description)
      .action(async (_program) => {
        await runCommand(instance, _program);
      })
      .on("--help", () => {
        if (instance.example) {
          console.log("");
          console.log("Example: \r\n" + "  " + instance.example);
        }
      });

    for (const key in instance.inputs) {
      const input = instance.inputs[key];
      if (input.required && !input.default) {
        command.requiredOption(`--${key} <${key}>`, input.description);
      } else {
        command.option(`--${key} <${key}>`, input.description, input.default);
      }
    }
  }

  async function runCommand(instance, _program) {
    let toStop = false;
    const params = _program.opts();

    if (instance.initialize === false && instance.start === false) {
      toStop = await instance.run({ params });
    } else {
      try {
        const { Process } = await import("../index");
        const actionHeroProcess = new Process();

        if (instance.initialize) await actionHeroProcess.initialize();
        if (instance.start) await actionHeroProcess.start();

        toStop = await instance.run({ params });
      } catch (error) {
        console.error(error.toString());
        process.exit(1);
      }
    }

    if (toStop || toStop === null || toStop === undefined) {
      setTimeout(process.exit, 500, 0);
    }
  }

  function readPackageJSON(file) {
    return JSON.parse(fs.readFileSync(file).toString());
  }

  function getVersion(): string {
    if (fs.existsSync(parentPackageJSON)) {
      const pkg = readPackageJSON(parentPackageJSON);
      return pkg.version;
    } else {
      const pkg = readPackageJSON(
        path.join(__dirname, "..", "..", "package.json")
      );
      return pkg.version;
    }
  }
}

main();
