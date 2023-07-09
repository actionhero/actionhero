import * as IORedis from "ioredis";
import * as dotProp from "dot-prop";
import { api, config, id, log, Initializer, redis, utils } from "../index";
import * as RedisModule from "./../modules/redis";

export interface RedisApi {
  clients: {
    [key: string]: IORedis.Redis;
  };
  subscriptionHandlers: {
    [key: string]: Function;
  };
  rpcCallbacks: {
    [key: string]: any;
  };
  status: {
    subscribed: boolean;
  };
}

/**
 * Redis helpers and connections.
 */
export class RedisInitializer extends Initializer {
  constructor() {
    super();
    this.name = "redis";
    this.loadPriority = 200;
    this.startPriority = 101;
    this.stopPriority = 99999;
  }

  async initialize() {
    api.redis = {
      clients: {},
      subscriptionHandlers: {},
      rpcCallbacks: {},
      status: {
        subscribed: false,
      },
    };

    api.redis.subscriptionHandlers.do = async (
      message: RedisModule.redis.PubSubMessage,
    ) => {
      if (
        !message.connectionId ||
        (api.connections && api.connections.connections[message.connectionId])
      ) {
        const cmdParts = message.method.split(".");
        const cmd = cmdParts.shift();
        if (cmd !== "api") {
          throw new Error(
            "cannot operate on a method outside of the api object",
          );
        }

        const callableApi = Object.assign(api, { log });

        const method: Function = dotProp.get(callableApi, cmdParts.join("."));
        let args = message.args;
        if (args === null) {
          args = [];
        }
        if (!Array.isArray(args)) {
          args = [args];
        }
        if (method) {
          const response = await method.apply(null, args);
          await redis.respondCluster(message.messageId, response);
        } else {
          log("RPC method `" + cmdParts.join(".") + "` not found", "crit");
        }
      }
    };

    api.redis.subscriptionHandlers.doResponse = function (
      message: RedisModule.redis.PubSubMessage,
    ) {
      if (api.redis.rpcCallbacks[message.messageId]) {
        const { resolve, timer } = api.redis.rpcCallbacks[message.messageId];
        clearTimeout(timer);
        resolve(message.response);
        delete api.redis.rpcCallbacks[message.messageId];
      }
    };

    const connectionNames = ["client", "subscriber", "tasks"] as const;
    for (const r of connectionNames) {
      if (config.redis[r].buildNew === true) {
        api.redis.clients[r] = new config.redis[r].konstructor(
          ...(config.redis[r].args ?? []),
        );

        api.redis.clients[r].on("error", (error) => {
          log(`Redis connection \`${r}\` error`, "alert", error);
        });

        api.redis.clients[r].on("connect", () => {
          log(`Redis connection \`${r}\` connected`, "debug");
        });

        api.redis.clients[r].on("ready", () => {
          log(`Redis connection \`${r}\` ready`, "debug");
        });

        api.redis.clients[r].on("close", () => {
          log(`Redis connection \`${r}\` closed`, "debug");
        });

        api.redis.clients[r].on("end", () => {
          log(`Redis connection \`${r}\` ended`, "debug");
        });

        api.redis.clients[r].on("reconnecting", () => {
          log(`Redis connection \`${r}\` reconnecting`, "info");
        });
      } else {
        api.redis.clients[r] = config.redis[r].konstructor(
          config.redis[r].args,
        );
        api.redis.clients[r].on("error", (error) => {
          log(`Redis connection \`${r}\` error`, "alert", error);
        });
        log(`Redis connection \`${r}\` connected`, "debug");
      }

      if (r !== "subscriber") await api.redis.clients[r].get("_test");
    }

    if (!api.redis.status.subscribed) {
      await api.redis.clients.subscriber.subscribe(config.general.channel);
      api.redis.status.subscribed = true;

      const messageHandler = async (
        messageChannel: string,
        stringifiedMessage: string,
      ) => {
        let message: RedisModule.redis.PubSubMessage;
        try {
          message = JSON.parse(stringifiedMessage);
        } catch (e) {
          message = {};
        }

        if (
          messageChannel === config.general.channel &&
          message.serverToken === config.general.serverToken
        ) {
          if (api.redis.subscriptionHandlers[message.messageType]) {
            await api.redis.subscriptionHandlers[message.messageType](message);
          }
        }
      };

      api.redis.clients.subscriber.on("message", messageHandler);
    }
  }

  async start() {
    await redis.doCluster("api.log", [
      `actionhero member ${id} has joined the cluster`,
    ]);
  }

  async stop() {
    await api.redis.clients.subscriber.unsubscribe();
    api.redis.status.subscribed = false;
    await redis.doCluster("api.log", [
      `actionhero member ${id} has left the cluster`,
    ]);

    await utils.sleep(config.redis.stopTimeout); // allow some time for the goodbye message to propagate

    const keys = Object.keys(api.redis.clients);
    for (const i in keys) {
      const client = api.redis.clients[keys[i]];
      //@ts-ignore
      if (typeof client.end === "function") {
        //@ts-ignore
        await client.end();
      } else if (typeof client.quit === "function") {
        await client.quit();
      } else if (typeof client.disconnect === "function") {
        await client.disconnect();
      }
    }

    await utils.sleep(config.redis.stopTimeout); // allow some time for the connection to close
  }
}
