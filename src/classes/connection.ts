import * as uuidv4 from "uuid/v4";
import { api, chatRoom } from "./../index";
import { config } from "./../modules/config";
import { i18n } from "../modules/i18n";

/**
 * The generic representation of a connection for all server types is an ActionHero.Connection.  You will never be creating these yourself via an action or task, but you will find them in your Actions and Action Middleware.
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
  remotePort: number;
  /**Any connection-specific properties.  For, example, the HTTP res and req objects for `web` connections are here */
  rawConnection: any;
  /**If there's a local error */
  error?: Error;
  /**If there's a local extension to the request*/
  extension?: string;
  destroyed: boolean;

  /**
   * @param data The specifics of this connection
   * @param callCreateMethods The specifics of this connection will calls create methods in the constructor. This property will exist for backward compatibility. If you want to construct connection and call create methods within async, you can use `await ActionHero.Connection.createAsync(details)` for construction.
   */
  constructor(data, callCreateMethods = true) {
    this.setup(data);
    if (callCreateMethods) {
      Connection.callConnectionCreateMethods(this);
    }
    api.connections.connections[this.id] = this;
  }

  /**
   * @param data The specifics of this connection
   */
  static async createAsync(data) {
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

  private setup(data) {
    if (data.id) {
      this.id = data.id;
    } else {
      this.id = this.generateID();
    }
    this.connectedAt = new Date().getTime();

    ["type", "rawConnection"].forEach(req => {
      if (data[req] === null || data[req] === undefined) {
        throw new Error(`${req} is required to create a new connection object`);
      }
      this[req] = data[req];
    });

    ["remotePort", "remoteIP"].forEach(req => {
      if (data[req] === null || data[req] === undefined) {
        if (config.general.enforceConnectionProperties === true) {
          throw new Error(
            `${req} is required to create a new connection object`
          );
        } else {
          data[req] = 0; // could be a random uuid as well?
        }
      }
      this[req] = data[req];
    });

    const connectionDefaults = {
      error: null,
      fingerprint: this.id,
      rooms: [],
      params: {},
      pendingActions: 0,
      totalActions: 0,
      messageId: 0,
      canChat: false,
      destroyed: false
    };

    for (const i in connectionDefaults) {
      if (this[i] === undefined && data[i] !== undefined) {
        this[i] = data[i];
      }
      if (this[i] === undefined) {
        this[i] = connectionDefaults[i];
      }
    }

    const connection = this;
    const server = api.servers.servers[connection.type];
    if (server && server.connectionCustomMethods) {
      for (const name in server.connectionCustomMethods) {
        connection[name] = async (...args) => {
          args.unshift(connection);
          return server.connectionCustomMethods[name].apply(null, args);
        };
      }
    }

    i18n.invokeConnectionLocale(this);
  }

  /**
   * Localize a key for this connection's locale.  Keys usually look like `messages.errors.notFound`, and are defined in your locales directory.  Strings can be interpolated as well, connection.localize('the count was {{count}}', {count: 4})
   */
  localize(message: string) {
    // this.locale will be sourced automatically
    return i18n.localize(message, this);
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
    return uuidv4();
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

  private set(key, value) {
    this[key] = value;
  }

  /**
   * Try to run a verb command for a connection
   */
  private async verbs(verb: string, words: Array<string>) {
    let key: string;
    let value: string;
    let room: string;
    const server = api.servers.servers[this.type];
    const allowedVerbs = server.attributes.verbs;

    if (!(words instanceof Array)) {
      words = [words];
    }

    if (server && allowedVerbs.indexOf(verb) >= 0) {
      server.log("verb", "debug", {
        verb: verb,
        to: this.remoteIP,
        params: JSON.stringify(words)
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
            pendingActions: this.pendingActions
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
