/// <reference path="./../../node_modules/@types/ioredis/index.d.ts" />

import * as IORedis from "ioredis";
import * as uuid from "uuid";
import * as dotProp from "dot-prop";
import { api, config, id, log, Initializer } from "../index";

export interface PubSubMessage {
  [key: string]: any;
}

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
  publish?: Function;
  doCluster?: Function;
  respondCluster?: Function;
}

/**
 * Redis helpers and connections.
 */
export class Redis extends Initializer {
  constructor() {
    super();
    this.name = "redis";
    this.loadPriority = 200;
    this.startPriority = 101;
    this.stopPriority = 99999;
  }

  async initialize() {
    if (config.redis.enabled === false) {
      return;
    }

    api.redis = {
      clients: {},
      subscriptionHandlers: {},
      rpcCallbacks: {},
      status: {
        subscribed: false
      }
    };

    /**
     * Publish a message to all other ActionHero nodes in the clsuter.  Will be autneticated against `api.config.serverToken`
     * ```js
     * let payload = {
     *   messageType: 'myMessageType',
     *   serverId: api.id,
     *   serverToken: api.config.general.serverToken,
     *   message: 'hello!'
     * }
     * await api.redis.publish(payload)
     * ```
     */
    api.redis.publish = async (payload: object | Array<any>) => {
      const channel = config.general.channel;
      return api.redis.clients.client.publish(channel, JSON.stringify(payload));
    };

    api.redis.subscriptionHandlers.do = async (message: PubSubMessage) => {
      if (
        !message.connectionId ||
        (api.connections && api.connections.connections[message.connectionId])
      ) {
        const cmdParts = message.method.split(".");
        const cmd = cmdParts.shift();
        if (cmd !== "api") {
          throw new Error(
            "cannot operate on a method outside of the api object"
          );
        }

        const callabaleApi = Object.assign(api, { log });

        const method: Function = dotProp.get(callabaleApi, cmdParts.join("."));
        let args = message.args;
        if (args === null) {
          args = [];
        }
        if (!Array.isArray(args)) {
          args = [args];
        }
        if (method) {
          const response = await method.apply(null, args);
          await api.redis.respondCluster(message.messageId, response);
        } else {
          log("RPC method `" + cmdParts.join(".") + "` not found", "warning");
        }
      }
    };

    api.redis.subscriptionHandlers.doResponse = function(
      message: PubSubMessage
    ) {
      if (api.redis.rpcCallbacks[message.messageId]) {
        const { resolve, timer } = api.redis.rpcCallbacks[message.messageId];
        clearTimeout(timer);
        resolve(message.response);
        delete api.redis.rpcCallbacks[message.messageId];
      }
    };

    /**
     * Invoke a command on all servers in this cluster.
     */
    api.redis.doCluster = async (
      method: string,
      args: Array<any> = [],
      connectionId: string,
      waitForResponse: boolean = false
    ) => {
      const messageId = uuid.v4();
      const payload = {
        messageType: "do",
        serverId: id,
        serverToken: config.general.serverToken,
        messageId: messageId,
        method: method,
        connectionId: connectionId,
        args: args // [1,2,3]
      };

      // we need to be sure that we build the response-handling promise before sending the request to Redis
      // it is possible for another node to get and work the request before we resolve our write
      // see https://github.com/actionhero/actionhero/issues/1244 for more information
      if (waitForResponse) {
        return new Promise(async (resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("RPC Timeout")),
            config.general.rpcTimeout
          );
          api.redis.rpcCallbacks[messageId] = { timer, resolve, reject };
          try {
            await api.redis.publish(payload);
          } catch (e) {
            clearTimeout(timer);
            delete api.redis.rpcCallbacks[messageId];
            throw e;
          }
        });
      }

      await api.redis.publish(payload);
    };

    api.redis.respondCluster = async (
      messageId: string,
      response: PubSubMessage
    ) => {
      const payload = {
        messageType: "doResponse",
        serverId: id,
        serverToken: config.general.serverToken,
        messageId: messageId,
        response: response // args to pass back, including error
      };

      await api.redis.publish(payload);
    };

    const connectionNames = ["client", "subscriber", "tasks"];
    for (var i in connectionNames) {
      const r = connectionNames[i];
      if (config.redis[r].buildNew === true) {
        const args = config.redis[r].args;
        api.redis.clients[r] = new config.redis[r].konstructor(
          args[0],
          args[1],
          args[2]
        );

        api.redis.clients[r].on("error", error => {
          log(`Redis connection \`${r}\` error`, "alert", error);
        });

        api.redis.clients[r].on("connect", () => {
          log(`Redis connection \`${r}\` connected`, "debug");
        });
      } else {
        api.redis.clients[r] = config.redis[r].konstructor.apply(
          null,
          config.redis[r].args
        );
        api.redis.clients[r].on("error", error => {
          log(`Redis connection \`${r}\` error`, "alert", error);
        });
        log(`Redis connection \`${r}\` connected`, "debug");
      }

      await api.redis.clients[r].get("_test");
    }

    if (!api.redis.status.subscribed) {
      await api.redis.clients.subscriber.subscribe(config.general.channel);
      api.redis.status.subscribed = true;

      const messageHandler = async (
        messageChannel: string,
        stringifiedMessage: string
      ) => {
        let message: PubSubMessage;
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
    if (config.redis.enabled === false) {
      log("redis is disabled", "notice");
    } else {
      await api.redis.doCluster("api.log", [
        `actionhero member ${id} has joined the cluster`
      ]);
    }
  }

  async stop() {
    if (config.redis.enabled === false) {
      return;
    }

    await api.redis.clients.subscriber.unsubscribe();
    api.redis.status.subscribed = false;
    await api.redis.doCluster("api.log", [
      `actionhero member ${id} has left the cluster`
    ]);

    const keys = Object.keys(api.redis.clients);
    for (const i in keys) {
      const client = api.redis.clients[keys[i]];
      if (typeof client.quit === "function") {
        await client.quit();
        //@ts-ignore
      } else if (typeof client.end === "function") {
        //@ts-ignore
        await client.end();
      } else if (typeof client.disconnect === "function") {
        await client.disconnect();
      }
    }
  }
}
