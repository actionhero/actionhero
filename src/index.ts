// export classes (capitalized)
export { Api } from "./classes/api";
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
export { config } from "./modules/config";
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

// API object to hold connections, actions, tasks, initializers, and servers
import { Api } from "./classes/api";

// backwards-compatibility for older versions of node.js
// we can't use globalThis for node v8, v10

declare global {
  namespace NodeJS {
    interface Global {
      api: Api;
    }
  }
}

if (!global.api) {
  global.api = new Api();
}
export const api: Api = global.api;
