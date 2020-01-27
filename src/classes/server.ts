import { EventEmitter } from "events";
import { Connection } from "./connection";
import { ActionProcessor } from "./actionProcessor";
import { api } from "../index";
import { log } from "../modules/log";

interface ServerConfig {
  [key: string]: any;
}

/**
 * Create a new ActionHero Server. The required properties of an server. These can be defined statically (this.name) or as methods which return a value.
 */
export abstract class Server extends EventEmitter {
  /**The name & type of the server. */
  type: string;
  /**What connection verbs can connections of this type use? */
  verbs?: Array<string>;
  /**Shorthand for `api.config.servers[this.type]` */
  config?: ServerConfig;
  options?: {
    [key: string]: any;
  };
  /** attributes of the server */
  attributes: {
    [key: string]: any;
  };
  /**Can connections of this server use the chat system? */
  canChat: boolean;
  /**Should we log every new connection? */
  logConnections: boolean;
  /**Should we log when a connection disconnects/exits? */
  logExits: boolean;
  /**Should every new connection of this server type receive the welcome message (defined in locales, `actionhero.welcomeMessage`) */
  sendWelcomeMessage: boolean;
  /**Methods described by the server to apply to each connection (like connection.setHeader for web connections) */
  connectionCustomMethods: {
    [key: string]: Function;
  };
  /**An optional message to send to clients when they disconnect */
  goodbye?: Function;
  /**A place to store the actually server object you create */
  server?: any;

  constructor() {
    super();

    this.options = {};
    this.attributes = {};
    this.config = {}; // will be applied by the initializer
    this.connectionCustomMethods = {};
    const defaultAttributes = this.defaultAttributes();
    for (const key in defaultAttributes) {
      if (!this.attributes[key]) {
        this.attributes[key] = defaultAttributes[key];
      }
      if (typeof this.attributes[key] === "function") {
        this.attributes[key] = this[key]();
      }
    }
  }

  /**
   * Event called when a formal new connection is created for this server type.  This is a response to calling ActionHero.Server#buildConnection
   *
   * @event ActionHero.Server#connection
   */

  /**
   * Event called when a an action is complete for a connection created by this server.  You may want to send a response to the client as a response to this event.
   *
   * @event ActionHero.Server#actionComplete
   * @property {object} data - The same data from the Action.  Includes the connection, response, etc.
   */

  /**
   * Method run as part of the `initialize` lifecycle of your server.  Usually configures the server.
   */
  abstract async initialize(): Promise<void>;

  /**
   * Method run as part of the `start` lifecycle of your server.  Usually boots the server (listens on port, etc).
   */
  abstract async start(): Promise<void>;

  /**
   * Method run as part of the `stop` lifecycle of your server.  Usually configures the server (disconnects from port, etc).
   */
  abstract async stop(): Promise<void>;

  /**
   * Must be defined explaining how to send a message to an individual connection.
   */
  abstract async sendMessage(
    connection: Connection,
    message: string | object | Array<any>,
    messageId?: string
  ): Promise<void>;

  /**
   * Must be defined explaining how to send a file to an individual connection.  Might be a noop for some connection types.
   */
  abstract async sendFile(
    connection: Connection,
    error: Error,
    fileStream: any,
    mime: string,
    length: number,
    lastModified: Date
  ): Promise<void>;

  defaultAttributes() {
    return {
      type: null,
      canChat: true,
      logConnections: true,
      logExits: true,
      sendWelcomeMessage: true,
      verbs: []
    };
  }

  validate() {
    if (!this.type) {
      throw new Error("type is required for this server");
    }

    [
      "start",
      "stop",
      "sendFile", // connection, error, fileStream, mime, length, lastModified
      "sendMessage", // connection, message
      "goodbye"
    ].forEach(method => {
      if (!this[method] || typeof this[method] !== "function") {
        throw new Error(
          `${method} is a required method for the server \`${this.type}\``
        );
      }
    });
  }

  /**
   *   * Build a the ActionHero.Connection from the raw parts provided by the server.
   * ```js
   *this.buildConnection({
   *  rawConnection: {
   *    req: req,
   *    res: res,
   *    params: {},
   *    method: method,
   *    cookies: cookies,
   *    responseHeaders: responseHeaders,
   *    responseHttpCode: responseHttpCode,
   *    parsedURL: parsedURL
   *  },
   *  id: fingerprint + '-' + uuid.v4(),
   *  fingerprint: fingerprint,
   *  remoteAddress: remoteIP,
   *  remotePort: remotePort
   *})
   * ```
   */
  async buildConnection(data: any) {
    const details = {
      type: this.type,
      id: data.id,
      remotePort: data.remotePort,
      remoteIP: data.remoteAddress,
      rawConnection: data.rawConnection,
      messageId: data.messageId,
      canChat: null,
      fingerprint: null
    };

    if (this.attributes.canChat === true) {
      details.canChat = true;
    }

    if (data.fingerprint) {
      details.fingerprint = data.fingerprint;
    }

    const connection = await Connection.createAsync(details);

    connection.sendMessage = async message => {
      this.sendMessage(connection, message);
    };

    connection.sendFile = async path => {
      connection.params.file = path;
      this.processFile(connection);
    };

    this.emit("connection", connection);

    if (this.attributes.logConnections === true) {
      this.log("new connection", "info", { to: connection.remoteIP });
    }

    if (this.attributes.sendWelcomeMessage === true) {
      connection.sendMessage({
        welcome: connection.localize("actionhero.welcomeMessage"),
        context: "api"
      });
    }

    if (typeof this.attributes.sendWelcomeMessage === "number") {
      setTimeout(() => {
        try {
          connection.sendMessage({
            welcome: connection.localize("actionhero.welcomeMessage"),
            context: "api"
          });
        } catch (e) {
          this.log(e, "error");
        }
      }, this.attributes.sendWelcomeMessage);
    }
  }

  /**
   * When a connection has called an Action command, and all properties are set.  Connection should have `params.action` set at least.
   * on(event: 'actionComplete', cb: (data: object) => void): this;
   */
  async processAction(connection: Connection) {
    const actionProcessor = new ActionProcessor(connection);
    const data = await actionProcessor.processAction();
    this.emit("actionComplete", data);
  }

  /**
   * When a connection has called an File command, and all properties are set.  Connection should have `params.file` set at least.  Will eventually call ActionHero.Server#sendFile.
   */
  async processFile(connection: Connection) {
    const results = await api.staticFile.get(connection);
    this.sendFile(
      results.connection,
      results.error,
      results.fileStream,
      results.mime,
      results.length,
      results.lastModified
    );
  }

  /**
   * Enumerate the connections for this server type on this server.
   */
  connections(): Array<Connection> {
    const connections = [];

    for (const i in api.connections.connections) {
      const connection = api.connections.connections[i];
      if (connection.type === this.type) {
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Log a message from this server type.  A wrapper around log() with a server prefix.
   */
  log(message: string, severity?: string, data?: any) {
    log(`[server: ${this.type}] ${message}`, severity, data);
  }
}
