import * as uuid from "uuid";
import { config, api, id, log } from "./../index";

export namespace redis {
  export interface PubSubMessage {
    [key: string]: any;
  }

  /**
   * Publish a message to all other ActionHero nodes in the cluster.  Will be authenticated against `api.config.serverToken`
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
  export async function publish(payload: object | Array<any>) {
    const channel = config.general.channel;
    return api.redis.clients.client.publish(channel, JSON.stringify(payload));
  }

  /**
   * Invoke a command on all servers in this cluster.
   */
  export async function doCluster(
    method: string,
    args: Array<any> = [],
    connectionId?: string,
    waitForResponse: boolean = false
  ) {
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
          await redis.publish(payload);
        } catch (e) {
          clearTimeout(timer);
          delete api.redis.rpcCallbacks[messageId];
          throw e;
        }
      });
    }

    await redis.publish(payload);
  }

  export async function respondCluster(
    messageId: string,
    response: PubSubMessage
  ) {
    const payload = {
      messageType: "doResponse",
      serverId: id,
      serverToken: config.general.serverToken,
      messageId: messageId,
      response: response // args to pass back, including error
    };

    await redis.publish(payload);
  }
}
