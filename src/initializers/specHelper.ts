import { EventEmitter } from "stream";
import * as uuid from "uuid";
import { ActionProcessor } from "../classes/actionProcessor";
import { connectionVerbs } from "../classes/connection";
import {
  api,
  config,
  log,
  env,
  Initializer,
  Server,
  Connection,
} from "../index";

export type SpecHelperConnection = Connection & {
  actionCallbacks?: { [key: string]: Function };
};

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

  async initialize() {
    if (env === "test") this.enabled = true;
    if (!this.enabled) return;

    class TestServer extends Server {
      constructor() {
        super();

        this.type = "testServer";
        this.attributes = {
          canChat: true,
          logConnections: false,
          logExits: false,
          sendWelcomeMessage: true,
          verbs: connectionVerbs,
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

      async sendMessage(
        connection: SpecHelperConnection,
        message: any,
        messageId: string | number
      ) {
        process.nextTick(() => {
          connection.messages.push(message);
          if (typeof connection.actionCallbacks[messageId] === "function") {
            connection.actionCallbacks[messageId](message, connection);
            delete connection.actionCallbacks[messageId];
          }
        });
      }

      async sendFile(
        connection: Connection,
        error: NodeJS.ErrnoException,
        fileStream: EventEmitter,
        mime: string,
        length: number
      ) {
        let content = "";
        const messageId = connection.messageId;
        const response = {
          content: null as string,
          mime: mime,
          length: length,
          error: undefined as Error,
        };

        if (error) {
          response.error = error;
        }

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

      handleConnection(connection: SpecHelperConnection) {
        connection.messages = [];
        connection.actionCallbacks = {};
      }

      async actionComplete(data: ActionProcessor<any>) {
        data.response.error;
        if (typeof data.response === "string" || Array.isArray(data.response)) {
          // nothing to do...
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
      static async createAsync() {
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
    if (!this.enabled) return;

    const server = new api.specHelper.Server();
    server.config = { enabled: true };
    await server.start(api);
    api.servers.servers.testServer = server;
  }
}
