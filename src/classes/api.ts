import { Process } from "./process";

import { ActionsApi } from "./../initializers/actions";
import { TaskApi } from "./../initializers/tasks";
import { ConnectionsApi } from "./../initializers/connections";
import { ServersApi } from "./../initializers/servers";
import { ChatRoomApi } from "./../initializers/chatRoom";
import { ExceptionHandlerAPI } from "./../initializers/exceptions";
import { ParamsApi } from "./../initializers/params";
import { ResqueApi } from "./../initializers/resque";
import { RedisApi } from "./../initializers/redis";
import { StaticFileApi } from "./../initializers/staticFile";
import { RoutesApi } from "./../initializers/routes";
import { SpecHelperApi } from "./../initializers/specHelper";

export class Api {
  running: boolean;
  bootTime: number;

  process?: Process;

  commands: {
    initialize?: Process["initialize"];
    start?: Process["start"];
    stop?: Process["stop"];
    restart?: Process["restart"];
  };

  connections: ConnectionsApi;
  actions: ActionsApi;
  tasks: TaskApi;
  servers: ServersApi;
  chatRoom: ChatRoomApi;
  params: ParamsApi;
  staticFile: StaticFileApi;
  redis: RedisApi;
  resque: ResqueApi;
  routes: RoutesApi;
  exceptionHandlers: ExceptionHandlerAPI;
  specHelper: SpecHelperApi;

  constructor() {
    this.bootTime = new Date().getTime();
    this.running = false;
    this.commands = {};
  }
}
