import { ConnectionVerbs } from "../classes/connection";
import { api, redis, Initializer, Connection } from "../index";

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
  allowedVerbs: typeof ConnectionVerbs;
  cleanConnection: ConnectionsInitializer["cleanConnection"];
  apply: ConnectionsInitializer["apply"];
  addMiddleware: ConnectionsInitializer["addMiddleware"];
}

export class ConnectionsInitializer extends Initializer {
  config: any;

  constructor() {
    super();
    this.name = "connections";
    this.loadPriority = 400;
  }

  async initialize(config) {
    this.config = config;

    api.connections = <ConnectionsApi>{
      connections: {},
      middleware: {},
      globalMiddleware: [],
      allowedVerbs: ConnectionVerbs,
      apply: this.apply.bind(this),
      applyResponder: this.applyResponder.bind(this),
      addMiddleware: this.addMiddleware.bind(this),
      cleanConnection: this.cleanConnection.bind(this),
    };
  }

  /**
   * Find a connection on any server in the cluster and call a method on it.
   */
  async apply(connectionId: string, method: string, args: any) {
    return redis.doCluster(
      "api.connections.applyResponder",
      [connectionId, method, args],
      connectionId,
      true
    );
  }

  async applyResponder(connectionId: string, method: string, args: any) {
    const connection: Connection = api.connections.connections[connectionId];
    if (!connection) {
      return;
    }

    if (method && args) {
      if (method === "sendMessage" || method === "sendFile") {
        await connection[method](args);
      } else {
        await connection[method].apply(connection, args);
      }
    }
    return api.connections.cleanConnection(connection);
  }

  /**
   * Add a middleware component to connection handling.
   */
  addMiddleware(data: ConnectionMiddleware) {
    if (!data.name) {
      throw new Error("middleware.name is required");
    }
    if (!data.priority) {
      data.priority = this.config.general.defaultMiddlewarePriority;
    }
    data.priority = Number(data.priority);
    api.connections.middleware[data.name] = data;

    api.connections.globalMiddleware.push(data.name);
    api.connections.globalMiddleware.sort((a, b) => {
      if (
        api.connections.middleware[a].priority >
        api.connections.middleware[b].priority
      ) {
        return 1;
      } else {
        return -1;
      }
    });
  }

  cleanConnection(connection: Connection) {
    const clean = {};
    for (const i in connection) {
      if (i !== "rawConnection" && i !== "api") {
        try {
          JSON.stringify(connection[i]);
          clean[i] = connection[i];
        } catch (error) {}
      }
    }

    return clean;
  }
}
