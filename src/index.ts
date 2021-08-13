// API object to hold connections, actions, tasks, initializers, and servers
import { Api } from "./classes/api";
import { Config } from "./classes/config";

declare global {
  namespace NodeJS {
    interface Global {
      api: Api;
      config: Config;
    }
  }
}

if (!global.api) global.api = new Api();
if (!global.config) global.config = new Config();

export const api: Api = global.api;
export const config: Config = global.config;

// export classes (capitalized)
export { Api } from "./classes/api";
export {
  Config,
  ConfigLoader,
  PluginConfigRecord,
  PluginConfig,
} from "./classes/config";
export { Process } from "./classes/process";
export { Initializer } from "./classes/initializer";
export { Connection } from "./classes/connection";
export { ExceptionReporter } from "./classes/exceptionReporter";
export { Action } from "./classes/action";
export { Task } from "./classes/task";
export { Server } from "./classes/server";
export { CLI } from "./classes/cli";
export { ActionProcessor } from "./classes/actionProcessor";

// export modules (lower case)
export { utils } from "./modules/utils";
export { log, loggers } from "./modules/log";
export { action } from "./modules/action";
export { task } from "./modules/task";
export { cache } from "./modules/cache";
export { chatRoom } from "./modules/chatRoom";
export { redis } from "./modules/redis";
export { route } from "./modules/route";
export { specHelper } from "./modules/specHelper";

// export static members of this process (lower case)
export { env } from "./classes/process/env";
export { actionheroVersion } from "./classes/process/actionheroVersion";
export { projectRoot } from "./classes/process/projectRoot";
export { typescript } from "./classes/process/typescript";
export { id } from "./classes/process/id";
