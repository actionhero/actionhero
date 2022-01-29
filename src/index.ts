// export classes (capitalized)
export { Api } from "./classes/api";
export { Process } from "./classes/process";
export { ActionheroConfigInterface } from "./classes/config";
export { Initializer } from "./classes/initializer";
export { Connection } from "./classes/connection";
export { ExceptionReporter } from "./classes/exceptionReporter";
export { Action } from "./classes/action";
export { Task } from "./classes/task";
export { Server } from "./classes/server";
export { CLI } from "./classes/cli";
export { ActionProcessor } from "./classes/actionProcessor";
export { PluginConfig } from "./classes/config";
export { Inputs, ParamsFrom } from "./classes/inputs";
export { Input } from "./classes/input";

// export modules (lower case)
export { utils } from "./modules/utils";
export { config, rebuildConfig } from "./modules/config";
export { log, loggers, ActionheroLogLevel } from "./modules/log";
export { action } from "./modules/action";
export { task } from "./modules/task";
export { cache } from "./modules/cache";
export { chatRoom } from "./modules/chatRoom";
export { redis } from "./modules/redis";
export { route, RouteMethod, RouteType, RoutesConfig } from "./modules/route";
export { specHelper } from "./modules/specHelper";

// export static members of this process (lower case)
export { env } from "./classes/process/env";
export { actionheroVersion } from "./classes/process/actionheroVersion";
export { projectRoot } from "./classes/process/projectRoot";
export { typescript } from "./classes/process/typescript";
export { id } from "./classes/process/id";

// API object to hold connections, actions, tasks, initializers, and servers
import { Api } from "./classes/api";

// export a global API instance

declare module globalThis {
  let api: Api;
}

if (!globalThis.api) globalThis.api = new Api();
export const api = globalThis.api;
