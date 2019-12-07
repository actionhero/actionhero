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
import { DocumentationApi } from "./../initializers/documentation";
import { RoutesApi } from "./../initializers/routes";
import { SpecHelperApi } from "./../initializers/specHelper";

export class Api {
  running: boolean;
  bootTime: number;

  process?: Process;

  commands: {
    initialize?: Function;
    start?: Function;
    stop?: Function;
    restart?: Function;
  };

  connections: ConnectionsApi;
  actions: ActionsApi;
  tasks: TaskApi;
  servers: ServersApi;
  chatRoom: ChatRoomApi;
  params: ParamsApi;
  documentation: DocumentationApi;
  staticFile: StaticFileApi;
  redis: RedisApi;
  resque: ResqueApi;
  routes: RoutesApi;
  exceptionHandlers: ExceptionHandlerAPI;
  specHelper: SpecHelperApi;

  // this is left in as way for older methods to still extend the api object
  // going forward, all interfaces should be exposed via export to be consumed directly
  [key: string]: any;

  constructor() {
    this.bootTime = new Date().getTime();
    this.running = false;
    this.commands = {};
  }
}
