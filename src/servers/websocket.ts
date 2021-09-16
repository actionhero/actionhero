import { IncomingMessage } from "http";
import * as fs from "fs";
import * as path from "path";
import * as uuid from "uuid";
import * as WebSocket from "ws";
import { api, config, utils, Server, Connection } from "../index";

const pingSleep = 15 * 1000;

export class ActionHeroWebSocketServer extends Server {
  server: WebSocket.Server;
  pingTimer: NodeJS.Timeout;

  constructor() {
    super();
    this.type = "websocket";

    this.attributes = {
      canChat: true,
      logConnections: true,
      logExits: true,
      sendWelcomeMessage: true,
      verbs: [
        "quit",
        "exit",
        "documentation",
        "roomAdd",
        "roomLeave",
        "roomView",
        "detailsView",
        "say",
      ],
    };
  }

  async initialize() {
    // we rely on the web server :D
  }

  async start() {
    const webserver = api.servers.servers.web;
    this.server = new WebSocket.Server({ server: webserver.server });

    this.server.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.log(
      `webSockets bound to ${webserver.options.bindIP}: ${webserver.options.port}`,
      "debug"
    );

    this.on("connection", (connection: Connection) => {
      connection.rawConnection.ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleData(connection, data);
        } catch (error) {
          this.log(`cannot parse client message`, "error", message);
        }
      });

      connection.rawConnection.ws.on("close", () => connection.destroy());

      connection.rawConnection.ws.isAlive = true;
      connection.rawConnection.ws.on("pong", heartbeat);
    });

    this.on("actionComplete", (data) => {
      if (data.toRender !== false) {
        data.connection.response.messageId = data.messageId;
        this.sendMessage(data.connection, data.response, data.messageId);
      }
    });

    this.pingTimer = setInterval(() => {
      this.connections().forEach((connection: Connection) => {
        if (connection.rawConnection.ws.isAlive === false) {
          return connection.rawConnection.ws.terminate();
        }

        connection.rawConnection.ws.isAlive = false;
        connection.rawConnection.ws.ping(noop);
      });
    }, pingSleep);

    this.copyClientLib();
  }

  async stop() {
    if (!this.server) return;
    clearInterval(this.pingTimer);

    if (this.config.destroyClientsOnShutdown === true) {
      this.connections().forEach((connection: Connection) => {
        connection.destroy();
      });
    }
  }

  async sendMessage(
    connection: Connection,
    message: Record<string, any>,
    messageId: string
  ) {
    if (message.error) {
      message.error = config.errors.serializers.servers.websocket(
        message.error
      );
    }

    if (!message.context) message.context = "response";
    if (!messageId) messageId = connection.messageId;
    if (message.context === "response" && !message.messageId)
      message.messageId = messageId;

    connection.rawConnection.ws.send(JSON.stringify(message));
  }

  async sendFile(
    connection: Connection,
    error: Error,
    fileStream: any,
    mime: string,
    length: number,
    lastModified: Date
  ) {
    const messageId = connection.messageId;
    let content = "";
    const response = {
      error: error,
      content: null,
      mime: mime,
      length: length,
      lastModified: lastModified,
    };

    try {
      if (!error) {
        fileStream.on("data", (d) => (content += d));
        fileStream.on("end", () => {
          response.content = content;
          this.sendMessage(connection, response, messageId);
        });
      } else {
        this.sendMessage(connection, response, messageId);
      }
    } catch (e) {
      this.log(e, "warning");
      this.sendMessage(connection, response, messageId);
    }
  }

  async goodbye(connection: Connection) {
    connection.rawConnection.ws.terminate();
  }

  handleConnection(ws: WebSocket, req: IncomingMessage) {
    const webserver = api.servers.servers.web;
    const { fingerprint } = webserver["fingerPrinter"].fingerprint(req);
    const { ip, port } = utils.parseHeadersForClientAddress(req.headers);

    this.buildConnection({
      rawConnection: { ws, req },
      remoteAddress: ip || req.connection.remoteAddress || "0.0.0.0",
      remotePort: port || req.connection.remotePort || "0",
      fingerprint: fingerprint,
    });
  }

  async handleData(connection: Connection, data: Record<string, any>) {
    const verb = data.event;
    delete data.event;

    connection.messageId = data.messageId || uuid.v4();
    delete data.messageId;
    connection.params = {};

    if (verb === "action") {
      for (const v in data.params) {
        connection.params[v] = data.params[v];
      }
      connection.error = null;
      connection["response"] = {};
      return this.processAction(connection);
    }

    if (verb === "file") {
      connection.params = {
        file: data.file,
      };
      return this.processFile(connection);
    }

    const words = [];
    let message;
    if (data.room) {
      words.push(data.room);
      delete data.room;
    }
    for (const i in data) {
      words.push(data[i]);
    }
    const messageId = connection.messageId;
    try {
      const data = await connection.verbs(verb, words);
      message = { status: "OK", context: "response", data: data };
      return this.sendMessage(connection, message, messageId);
    } catch (error) {
      const formattedError = error.toString();
      message = {
        status: formattedError,
        error: formattedError,
        context: "response",
        data: data,
      };
      return this.sendMessage(connection, message, messageId);
    }
  }

  copyClientLib() {
    const files = ["websocket.d.ts", "websocket.js", "websocket.js.map"];
    const src = path.join(__dirname, "..", "..", "public", "clients");
    for (const p of config.general.paths.public) {
      fs.mkdirSync(path.join(p, "clients"), { recursive: true });
      for (const f of files) {
        fs.copyFileSync(path.join(src, f), path.join(p, "clients", f));
      }
    }
  }
}

function noop() {}

function heartbeat() {
  this.isAlive = true;
}
