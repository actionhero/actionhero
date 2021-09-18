import * as REPL from "repl";
import { api, env, CLI } from "./../../index";

export class ConsoleCLI extends CLI {
  constructor() {
    super();
    this.name = "console";
    this.description =
      "Start an interactive REPL session with the api object in-scope";
  }

  async run() {
    await new Promise((resolve, reject) => {
      const repl = REPL.start({
        prompt: "[ AH::" + env + " ] >> ",
        input: process.stdin,
        output: process.stdout,
        useGlobal: false,
      });

      repl.context.api = api;

      repl.on("exit", resolve);
      repl.on("error", reject);
    });

    return true;
  }
}
