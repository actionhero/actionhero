import { Worker } from "node-resque";
import * as uuid from "uuid";
import { api, Initializer, Server } from "../index";

/**
 * A speical "mock" server which enables you to test actions and tasks in a simple way.  Only availalbe in the TEST environment.
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
    if (api.env === "test" || String(process.env.SPECHELPER) === "true") {
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
          verbs: api.connections.allowedVerbs
        };
      }

      async initialize() {}

      async start() {
        api.log("loading the testServer", "info");
        this.on("connection", connection => {
          this.handleConnection(connection);
        });
        this.on("actionComplete", data => {
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
          error: undefined
        };

        if (error) {
          response.error = error;
        }

        try {
          if (!error) {
            fileStream.on("data", d => {
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
            data.response = await api.config.errors.serializers.servers.specHelper(
              data.response.error
            );
          }
        } else {
          if (data.response.error) {
            data.response.error = await api.config.errors.serializers.servers.specHelper(
              data.response.error
            );
          }

          if (api.specHelper.returnMetadata) {
            data.response.messageId = data.messageId;

            data.response.serverInformation = {
              serverName: api.config.general.serverName,
              apiVersion: api.config.general.apiVersion
            };

            data.response.requesterInformation = {
              id: data.connection.id,
              remoteIP: data.connection.remoteIP,
              receivedParams: {}
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
      Server: TestServer
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
          remotePort: 0
        });
        return api.connections.connections[id];
      }
    };

    /**
     * Run an action via the specHelper server.
     *
     * @async
     * @param  {string}  actionName The name of the action to run.
     * @param  {Object}  input      You can provide either a pre-build connection `api.specHelper.Connection.createAsync()`, or just a Object with params for your action.
     * @return {Promise<Object>}    The `response` from the action.
     */
    api.specHelper.runAction = async (actionName, input) => {
      let connection;
      if (!input) {
        input = {};
      }
      if (input.id && input.type === "testServer") {
        connection = input;
      } else {
        connection = await api.specHelper.Connection.createAsync();
        connection.params = input;
      }

      connection.params.action = actionName;

      connection.messageId = connection.params.messageId || uuid.v4();
      const response = await new Promise(resolve => {
        api.servers.servers.testServer.processAction(connection);
        connection.actionCallbacks[connection.messageId] = resolve;
      });

      return response;
    };

    /**
     * Mock a specHelper connection requesting a file from the server.
     *
     * @async
     * @param  {string}  file The name & path of the file to request.
     * @return {Promise<Object>} The body contents and metadata of the file requested.  Conatins: mime, length, body, and more.
     */
    api.specHelper.getStaticFile = async file => {
      const connection = await api.specHelper.Connection.createAsync();
      connection.params.file = file;

      connection.messageCount = uuid.v4();
      const response = await new Promise(resolve => {
        api.servers.servers.testServer.processFile(connection);
        connection.actionCallbacks[connection.messageId] = resolve;
      });

      return response;
    };

    /**
     * Use the specHelper to run a task.
     * Note: this only runs the task's `run()` method, and no middleware.  This is faster than api.specHelper.runFullTask.
     *
     * @async
     * @param  {string}   taskName The name of the task.
     * @param  {Object}   params   Params to pass to the task
     * @return {Promise<Object>}   The return value from the task.
     * @see api.specHelper.runFullTask
     */
    api.specHelper.runTask = async (taskName, params) => {
      return api.tasks.tasks[taskName].run(params);
    };

    /**
     * Use the specHelper to run a task.
     * Note: this will run a full Task worker, and will also include any middleware.  This is slower than api.specHelper.runTask.
     *
     * @async
     * @param  {string}   taskName The name of the task.
     * @param  {Object}   params   Params to pass to the task
     * @return {Promise<Object>}   The return value from the task.
     * @see api.specHelper.runTask
     */
    api.specHelper.runFullTask = async (taskName, params) => {
      const worker = new Worker(
        {
          connection: {
            redis: api.redis.clients.tasks
          },
          queues: api.config.tasks.queues || ["default"]
        },
        api.tasks.jobs
      );

      try {
        await worker.connect();
        const result = await worker.performInline(taskName, params);
        await worker.end();
        return result;
      } catch (error) {
        try {
          worker.end();
        } catch (error) {}
        throw error;
      }
    };

    /**
     * Use the specHelper to find enqueued instances of a task
     * This will return an array of intances of the task which have been enqueued either in the normal queues or delayed queues
     * If a task is enqued in a delayed queue, it will have a 'timestamp' propery
     * i.e. [ { class: 'regularTask', queue: 'testQueue', args: [ [Object] ] } ]
     *
     * @async
     * @param  {string}   taskName The name of the task.
     */
    api.specHelper.findEnqueuedTasks = async taskName => {
      let found = [];

      // normal queues
      const queues = await api.resque.queue.queues();
      for (const i in queues) {
        const q = queues[i];
        const length = await api.resque.queue.length(q);
        const batchFound = await api.tasks.queued(q, 0, length + 1);
        let matches = batchFound.filter(t => t.class === taskName);
        matches = matches.map(m => {
          m.timestamp = null;
          return m;
        });
        found = found.concat(matches);
      }

      // delayed queues
      const allDelayed = await api.resque.queue.allDelayed();
      for (const timestamp in allDelayed) {
        let matches = allDelayed[timestamp].filter(t => t.class === taskName);
        matches = matches.map(m => {
          m.timestamp = parseInt(timestamp);
          return m;
        });
        found = found.concat(matches);
      }

      return found;
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
