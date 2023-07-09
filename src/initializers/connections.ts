import { api, config, redis, Initializer, Connection } from "../index";

/**
 * ```js
 *var connectionMiddleware = {
 *name: 'connection middleware',
 *priority: 1000,
 *create: (connection) => {
 *  // do stuff
 *},
 *destroy:(connection) => {
 *  // do stuff
 *}
 *}
 * ```
 */
export interface ConnectionMiddleware {
  /**Unique name for the middleware. */
  name: string;
  /**Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`. */
  priority?: number;
  /**Called for each new connection when it is created. Connection is passed to the event handler*/
  create?: Function;
  /**Called for each connection before it is destroyed. Connection is passed to the event handler*/
  destroy?: Function;
}

export interface ConnectionsApi {
  connections: {
    [key: string]: Connection;
  };
  middleware: {
    [key: string]: ConnectionMiddleware;
  };
  globalMiddleware: Array<string>;
  apply: ConnectionsInitializer["apply"];
  applyResponder: ConnectionsInitializer["applyResponder"];
  addMiddleware: ConnectionsInitializer["addMiddleware"];
  cleanConnection: ConnectionsInitializer["cleanConnection"];
}

export class ConnectionsInitializer extends Initializer {
  constructor() {
    super();
    this.name = "connections";
    this.loadPriority = 400;
  }

  apply = async (
    connectionId: string,
    method?: string,
    args?: any[] | Record<string, any>,
  ) => {
    return redis.doCluster<Connection>(
      "api.connections.applyResponder",
      [connectionId, method, args],
      connectionId,
      true,
    );
  };

  applyResponder = async (
    connectionId: string,
    method: keyof InstanceType<typeof Connection>,
    args: any,
  ) => {
    const connection = api.connections.connections[connectionId];
    if (!connection) return;

    if (method && args) {
      if (method === "sendMessage" || method === "sendFile") {
        await connection[method](args);
      } else {
        //@ts-ignore
        await connection[method].apply(connection, args);
      }
    }
    return api.connections.cleanConnection(connection);
  };

  addMiddleware = (data: ConnectionMiddleware) => {
    if (!data.name) {
      throw new Error("middleware.name is required");
    }
    if (!data.priority) {
      data.priority = config.general.defaultMiddlewarePriority;
    }
    data.priority = Number(data.priority);
    api.connections.middleware[data.name] = data;

    api.connections.globalMiddleware.push(data.name);
    api.connections.globalMiddleware.sort(
      (a, b) =>
        api.connections.middleware[a].priority -
        api.connections.middleware[b].priority,
    );
  };

  cleanConnection = (connection: Connection) => {
    const clean: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(connection)) {
      if (key !== "rawConnection" && key !== "api") {
        try {
          JSON.stringify(value);
          clean[key] = value;
        } catch (error) {}
      }
    }

    return clean;
  };

  async initialize() {
    api.connections = {
      connections: {},
      middleware: {},
      globalMiddleware: [],
      apply: this.apply,
      applyResponder: this.applyResponder,
      addMiddleware: this.addMiddleware,
      cleanConnection: this.cleanConnection,
    };
  }
}
