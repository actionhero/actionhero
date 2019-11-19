// export classes
export { Process } from "./classes/process";
export { Initializer } from "./classes/initializer";
export { Connection } from "./classes/connection";
export { Action } from "./classes/action";
export { Task } from "./classes/task";
export { Server } from "./classes/server";
export { CLI } from "./classes/cli";
export { ActionProcessor } from "./classes/actionProcessor";

// export methods
export { log } from "./classes/log";
export { localize } from "./classes/i18n";

// export objects
export { config } from "./classes/config";

// export static members of this process
export { env } from "./classes/process/env";
export { actionheroVersion } from "./classes/process/actionheroVersion";
export { projectRoot } from "./classes/process/projectRoot";
export { typescript } from "./classes/process/typescript";
export { id } from "./classes/process/id";
export {
  watchFileAndAct,
  unWatchAllFiles
} from "./classes/process/watchFileAndAct";

// import { Api } from "./classes/api";
// export const api = new Api();
