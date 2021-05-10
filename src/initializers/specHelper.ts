import * as uuid from "uuid";
import { api, log, env, Initializer, Server, Connection } from "../index";

export interface SpecHelperApi {
  returnMetadata?: boolean;
  // Server?: Server;
  Server?: any;
  Connection?: any;
}

/**
 * A special "mock" server which enables you to test actions and tasks in a simple way.  Only available in the TEST environment.
 */
export class SpecHelper extends Initializer {
  enabled: boolean;

  constructor() {
    super();
    this.name = "specHelper";
    this.loadPriority = 900;
    this.startPriority = 901;
    this.enabled = false;
  }

  async initialize(config) {
    if (env === "test" || String(process.env.SPECHELPER) === "true") {
      this.enabled = true;
    }

    if (!this.enabled) {
      return;
    }

    class TestServer extends Server {
      constructor() {
        super();

        this.type = "testServer";
        this.attributes = {
          canChat: true,
          logConnections: false,
          logExits: false,
          sendWelcomeMessage: true,
          verbs: api.connections.allowedVerbs,
        };
      }

      async initialize() {}

      async start() {
        log("loading the testServer", "info");
        this.on("connection", (connection) => {
          this.handleConnection(connection);
        });
        this.on("actionComplete", (data) => {
          this.actionComplete(data);
        });
      }

      async stop() {}

      async sendMessage(connection, message, messageId) {
        process.nextTick(() => {
          connection.messages.push(message);
          if (typeof connection.actionCallbacks[messageId] === "function") {
            connection.actionCallbacks[messageId](message, connection);
            delete connection.actionCallbacks[messageId];
          }
        });
      }

      async sendFile(connection, error, fileStream, mime, length) {
        let content = "";
        const messageId = connection.messageId;
        const response = {
          content: null,
          mime: mime,
          length: length,
          error: undefined,
        };

        if (error) {
          response.error = error;
        }

        try {
          if (!error) {
            fileStream.on("data", (d) => {
              content += d;
            });
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

      handleConnection(connection) {
        connection.messages = [];
        connection.actionCallbacks = {};
      }

      async actionComplete(data) {
        if (typeof data.response === "string" || Array.isArray(data.response)) {
          if (data.response.error) {
            data.response = await config.errors.serializers.servers.specHelper(
              data.response.error
            );
          }
        } else {
          if (data.response.error) {
            data.response.error =
              await config.errors.serializers.servers.specHelper(
                data.response.error
              );
          }

          if (api.specHelper.returnMetadata) {
            data.response.messageId = data.messageId;

            data.response.serverInformation = {
              serverName: config.general.serverName,
              apiVersion: config.general.apiVersion,
            };

            data.response.requesterInformation = {
              id: data.connection.id,
              remoteIP: data.connection.remoteIP,
              receivedParams: {},
            };

            for (const k in data.params) {
              data.response.requesterInformation.receivedParams[k] =
                data.params[k];
            }
          }
        }

        if (data.toRender === true) {
          this.sendMessage(data.connection, data.response, data.messageId);
        }
      }
    }

    api.specHelper = {
      returnMetadata: true,
      Server: TestServer,
    };

    /**
     * A special connection usable in tests.  Create via `await api.specHelper.Connection.createAsync()`
     */
    api.specHelper.Connection = class {
      static async createAsync(data) {
        const id = uuid.v4();

        await api.servers.servers.testServer.buildConnection({
          id: id,
          fingerprint: id,
          rawConnection: {},
          remoteAddress: "testServer",
          remotePort: 0,
        });
        return api.connections.connections[id];
      }
    };
  }

  async start() {
    if (!this.enabled) {
      return;
    }

    const server = new api.specHelper.Server();
    server.config = { enabled: true };
    await server.start(api);
    api.servers.servers.testServer = server;
  }
}
