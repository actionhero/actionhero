import * as uuid from "uuid";
import { RouteType } from "../modules/route";
import { api, chatRoom } from "./../index";
import { config } from "./../modules/config";

export type ConnectionData = {
  id?: string;
  fingerprint?: string;
  messageId?: string;
  type: string;
  rawConnection: any;
  remotePort: number | string;
  remoteIP: string;
  canChat: boolean;
};

export const connectionVerbs = [
  "quit",
  "exit",
  "paramAdd",
  "paramDelete",
  "paramView",
  "paramsView",
  "paramsDelete",
  "roomAdd",
  "roomLeave",
  "roomView",
  "detailsView",
  "say",
] as const;
export type ConnectionVerb = (typeof connectionVerbs)[number];

/**
 * The generic representation of a connection for all server types is an Actionhero.Connection.  You will never be creating these yourself via an action or task, but you will find them in your Actions and Action Middleware.
 */
export class Connection {
  /**A unique string identifer for this connection. */
  id: string;
  /** A unique string identifer for this connection, but common among subsequent requests.  For example, all web requests from the same client have the same fingerprint, but not the same id */
  fingerprint: string;
  /**The type of this connection (web, websocket, etc) as defined by the name of the server which created it */
  type: string;
  /**Any rooms this connection is a member of, it it can chat */
  rooms: Array<string>;
  /**Can this connection use the chat system? */
  canChat: boolean;
  /**Any params this connection has saved for use in subsequent Actions. */
  params: ConnectionParams;
  /**How many actions are currently running for this connection?  Most server types have a limit */
  pendingActions: number;
  /**How many actions has this connection run since it connected. */
  totalActions: number;
  /**The Id of the latest message this connection has sent to the server. */
  messageId: string;
  /**The timestamp of when this connection was created */
  connectedAt: number;
  /**The remote connection's IP address (as best as we can tell).  May be either IPv4 or IPv6. */
  remoteIP: string;
  /**The remote connection's port. Related to connection.remoteIP */
  remotePort: string | number;
  /**Any connection-specific properties.  For, example, the HTTP res and req objects for `web` connections are here */
  rawConnection: any;
  /**If there's a local error */
  error?: NodeJS.ErrnoException;
  /**If there's a local extension to the request*/
  extension?: string;
  destroyed: boolean;
  /** storage for a response payload */
  response?: Record<string, unknown>;
  /** storage for session data */
  session?: Record<string, any>;

  // --- custom methods ---

  /** for specHelper */
  messages?: Array<{ message: string; [key: string]: any }>;

  //** for web connections */
  setHeader?: (key: string, value: string) => {};
  setStatusCode?: (code: number) => {};
  matchedRoute?: RouteType;
  pipe?: Function;

  /**
   * @param data The specifics of this connection
   * @param callCreateMethods The specifics of this connection will calls create methods in the constructor. This property will exist for backward compatibility. If you want to construct connection and call create methods within async, you can use `await Actionhero.Connection.createAsync(details)` for construction.
   */
  constructor(data: ConnectionData, callCreateMethods = true) {
    this.setup(data);
    if (callCreateMethods) Connection.callConnectionCreateMethods(this);
    api.connections.connections[this.id] = this;
  }

  /**
   * @param data The specifics of this connection
   */
  static async createAsync(data: ConnectionData) {
    const connection = new this(data, false);
    await this.callConnectionCreateMethods(connection);
    return connection;
  }

  private static async callConnectionCreateMethods(connection: Connection) {
    for (const i in api.connections.globalMiddleware) {
      const middlewareName = api.connections.globalMiddleware[i];
      if (
        typeof api.connections.middleware[middlewareName].create === "function"
      ) {
        await api.connections.middleware[middlewareName].create(connection);
      }
    }
  }

  private setup(data: ConnectionData) {
    (["type", "rawConnection"] as const).forEach((req) => {
      if (!data[req]) {
        throw new Error(`${req} is required to create a new connection object`);
      }
    });

    if (config.general.enforceConnectionProperties) {
      if (!data.remotePort && data.remotePort?.toString() !== "0")
        throw new Error(
          "remotePort is required to create a new connection object",
        );
      if (!data.remoteIP && data.remoteIP?.toString() !== "0")
        throw new Error(
          "remoteIP is required to create a new connection object",
        );

      this.type = data.type;
      this.rawConnection = data.rawConnection;
      this.id = data.id ?? this.generateID();
      this.fingerprint = data.fingerprint ?? this.id;
      this.remotePort = data.remotePort ?? 0;
      this.remoteIP = data.remoteIP ?? "0";
      this.messageId = data.messageId ?? "0";

      this.connectedAt = new Date().getTime();
      this.error = null;
      this.rooms = [];
      this.params = {};
      this.session = {};
      this.pendingActions = 0;
      this.totalActions = 0;
      this.canChat = data["canChat"];
      this.destroyed = false;

      const server = api.servers.servers[this.type];
      if (server && server.connectionCustomMethods) {
        for (const [name] of Object.entries(server.connectionCustomMethods)) {
          //@ts-ignore
          this.set(name, async (...args) => {
            args.unshift(this);
            return server.connectionCustomMethods[name].apply(null, args);
          });
        }
      }
    }
  }

  /**
   * Send a file to a connection (usually in the context of an Action).  Be sure to set `data.toRender = false` in the action!
   * Uses Server#processFile and will set `connection.params.file = path`
   */
  async sendFile(path: string) {
    throw new Error("not implemented");
  }

  /**
   * Send a message to a connection.  Uses Server#sendMessage.
   */
  async sendMessage(message: string | object | Array<any>, verb?: string) {
    throw new Error("not implemented");
  }

  private generateID() {
    return uuid.v4();
  }

  /**
   * Destroys the connection.  If the type/sever of the connection has a goodbye message, it will be sent.  The connection will be removed from all rooms.  The connection's socket will be closed when possible.
   */
  async destroy() {
    this.destroyed = true;

    for (const i in api.connections.globalMiddleware) {
      const middlewareName = api.connections.globalMiddleware[i];
      if (
        typeof api.connections.middleware[middlewareName].destroy === "function"
      ) {
        await api.connections.middleware[middlewareName].destroy(this);
      }
    }

    if (this.canChat === true) {
      const promises = [];
      for (const i in this.rooms) {
        const room = this.rooms[i];
        promises.push(chatRoom.removeMember(this.id, room));
      }
      await Promise.all(promises);
    }

    const server = api.servers.servers[this.type];

    if (server) {
      if (server.attributes.logExits === true) {
        server.log("connection closed", "info", { to: this.remoteIP });
      }
      if (typeof server.goodbye === "function") {
        server.goodbye(this);
      }
    }

    delete api.connections.connections[this.id];
  }

  private set(key: keyof typeof this, value: any) {
    this[key] = value;
  }

  /**
   * Try to run a verb command for a connection
   */
  async verbs(verb: string, words: string[] | string) {
    let key: string;
    let value: string;
    let room: string;
    const server = api.servers.servers[this.type];
    const allowedVerbs = server.attributes.verbs;

    if (!Array.isArray(words)) words = [words];

    if (server && allowedVerbs.indexOf(verb) >= 0) {
      server.log("verb", "debug", {
        verb: verb,
        to: this.remoteIP,
        params: JSON.stringify(words),
      });

      // TODO: investigate allowedVerbs being an array of Constants or Symbols

      switch (verb) {
        case "quit":
        case "exit":
          return this.destroy();
        case "paramAdd":
          key = words[0];
          value = words[1];
          if (words[0] && words[0].indexOf("=") >= 0) {
            const parts = words[0].split("=");
            key = parts[0];
            value = parts[1];
          }

          if (
            config.general.disableParamScrubbing ||
            api.params.postVariables.indexOf(key) >= 0
          ) {
            this.params[key] = value;
          }
          return;
        case "paramDelete":
          key = words[0];
          delete this.params[key];
          return;
        case "paramView":
          key = words[0];
          return this.params[key];
        case "paramsView":
          return this.params;
        case "paramsDelete":
          for (const i in this.params) {
            delete this.params[i];
          }
          return;
        case "roomAdd":
          room = words[0];
          return chatRoom.addMember(this.id, room);
        case "roomLeave":
          room = words[0];
          return chatRoom.removeMember(this.id, room);
        case "roomView":
          room = words[0];
          if (this.rooms.indexOf(room) >= 0) {
            return chatRoom.roomStatus(room);
          }
          throw new Error(await config.errors.connectionNotInRoom(this, room));
        case "detailsView":
          return {
            id: this.id,
            fingerprint: this.fingerprint,
            remoteIP: this.remoteIP,
            remotePort: this.remotePort,
            params: this.params,
            connectedAt: this.connectedAt,
            rooms: this.rooms,
            totalActions: this.totalActions,
            pendingActions: this.pendingActions,
          };
        case "documentation":
          return api.documentation.documentation;
        case "say":
          room = words.shift();
          await api.chatRoom.broadcast(this, room, words.join(" "));
          return;
      }

      const error = new Error(await config.errors.verbNotFound(this, verb));
      throw error;
    } else {
      const error = new Error(await config.errors.verbNotAllowed(this, verb));
      throw error;
    }
  }
}

export interface ConnectionParams {
  [key: string]: any;
}
