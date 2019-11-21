import * as REPL from "repl";
import { config, api, env, utils, CLI } from "./../../index";

export class Console extends CLI {
  constructor() {
    super();
    this.name = "console";
    this.description =
      "start an interactive REPL session with the api object in-scope";
  }

  async run() {
    for (const i in config.servers) {
      config.servers[i].enabled = false;
    }
    config.general.developmentMode = false;
    config.tasks.scheduler = false;
    config.tasks.queues = [];
    config.tasks.minTaskProcessors = 0;
    config.tasks.maxTaskProcessors = 0;

    await api.commands.start.call(api.process);
    await utils.sleep(500);

    await new Promise((resolve, reject) => {
      const repl = REPL.start({
        prompt: "[ AH::" + env + " ] >> ",
        input: process.stdin,
        output: process.stdout,
        useGlobal: false
      });

      repl.context.api = api;

      repl.on("exit", resolve);
      repl.on("error", reject);
    });

    return true;
  }
}
