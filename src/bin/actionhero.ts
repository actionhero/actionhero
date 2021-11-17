#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import * as glob from "glob";
import { program } from "commander";
import { typescript } from "../classes/process/typescript";
import { projectRoot } from "../classes/process/projectRoot";
import { ensureNoTsHeaderFiles } from "../modules/utils/ensureNoTsHeaderFiles";
import { CLI } from "../classes/cli";
import { PackageJson } from "type-fest";

export namespace ActionheroCLIRunner {
  export async function run() {
    program.storeOptionsAsProperties(false);
    program.version(getVersion());

    let pathsLoaded: string[] = [];
    try {
      const { config } = await import("../index");

      // this project
      for (const i in config.general.paths.cli) {
        await loadDirectory(
          path.join(config.general.paths.cli[i]),
          pathsLoaded
        );
      }

      // plugins
      // this is needed vs Object.values to prevent TS compilation errors
      for (const pluginName of Object.keys(config.plugins)) {
        const plugin = config.plugins[pluginName];
        if (plugin.cli !== false) {
          // old plugins
          await loadDirectory(path.join(plugin.path, "bin"), pathsLoaded);
          // new plugins
          await loadDirectory(
            path.join(plugin.path, "dist", "bin"),
            pathsLoaded
          );
        }
      }

      // core
      if (config.general.cliIncludeInternal !== false) {
        await loadDirectory(__dirname, pathsLoaded);
      }
    } catch (e) {
      // we are trying to build a new project, only load the generate command
      await loadDirectory(path.join(__dirname), pathsLoaded, "generate");
    }

    program.parse(process.argv);
  }

  // --- Utils --- //

  export async function loadDirectory(
    dir: string,
    pathsLoaded: string[],
    match = "*"
  ) {
    if (!fs.existsSync(dir)) return;
    const realpath = fs.realpathSync(dir);
    if (pathsLoaded.includes(realpath)) return;
    pathsLoaded.push(realpath);

    const matcher = `${realpath}/**/+(${
      typescript ? `${match}.js|*.ts` : `${match}.js`
    })`;
    const files = ensureNoTsHeaderFiles(glob.sync(matcher));
    for (const i in files) {
      const collection = await import(files[i]);
      for (const j in collection) {
        const command = collection[j];
        convertCLIToCommanderAction(command);
      }
    }
  }

  export async function convertCLIToCommanderAction(
    cliConstructor: new () => CLI
  ) {
    if (
      Object.getPrototypeOf(cliConstructor?.prototype?.constructor || {})
        .name !== "CLI"
    ) {
      return;
    }

    const instance: CLI = new cliConstructor();
    const command = program
      .command(instance.name)
      .description(instance.description)
      .action(async (_arg1, _arg2, _arg3, _arg4, _arg5) => {
        await runCommand(instance, _arg1, _arg2, _arg3, _arg4, _arg5);
      })
      .on("--help", () => {
        if (instance.example) {
          console.log("");
          console.log("Example: \r\n" + "  " + instance.example);
        }
        if (typeof instance.help === "function") instance.help();
      });

    for (const key in instance.inputs) {
      const input = instance.inputs[key];

      if (input.flag && !input.letter) {
        throw new Error(
          `flag inputs require a short letter (${JSON.stringify(input)})`
        );
      }

      const separators = input.required ? ["<", ">"] : ["[", "]"];
      const methodName = input.required ? "requiredOption" : "option";
      const argString = `${input.letter ? `-${input.letter}, ` : ""}--${key} ${
        input.flag
          ? ""
          : `${separators[0]}${input.placeholder || key}${
              input.variadic ? "..." : ""
            }${separators[1]}`
      }`;

      command[methodName](argString, input.description, input.default);
    }
  }

  export async function runCommand(
    instance: CLI,
    _arg1: any,
    _arg2: any,
    _arg3: any,
    _arg4: any,
    _arg5: any
  ) {
    let toStop = false;

    let _arguments: string[] = [];
    let params: Record<string, string[]> = {};
    [_arg1, _arg2, _arg3, _arg4, _arg5].forEach((arg) => {
      if (typeof arg?.opts === "function") {
        params = arg.opts();
      } else if (arg !== null && arg !== undefined && typeof arg !== "object") {
        _arguments.push(arg);
      }
    });

    params["_arguments"] = _arguments;

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

  export function readPackageJSON(file: string) {
    return JSON.parse(fs.readFileSync(file).toString());
  }

  export function getVersion(): string {
    const parentPackageJSON = path.join(projectRoot, "package.json");

    if (fs.existsSync(parentPackageJSON)) {
      const pkg: PackageJson = readPackageJSON(parentPackageJSON);
      return pkg.version;
    } else {
      const pkg: PackageJson = readPackageJSON(
        path.join(__dirname, "..", "..", "package.json")
      );
      return pkg.version;
    }
  }
}

ActionheroCLIRunner.run();
