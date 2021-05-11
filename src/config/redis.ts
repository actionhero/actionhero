import { URL } from "url";

/**
 * This is the standard redis config for Actionhero.
 * This will use a redis server to persist cache, share chat message between processes, etc.
 */

export const DEFAULT = {
  redis: (config) => {
    const konstructor = require("ioredis");
    let protocol = process.env.REDIS_SSL ? "rediss" : "redis";
    let host = process.env.REDIS_HOST || "127.0.0.1";
    let port = process.env.REDIS_PORT || 6379;
    let db = process.env.REDIS_DB || process.env.JEST_WORKER_ID || "0";
    let password = process.env.REDIS_PASSWORD || null;

    if (process.env.REDIS_URL) {
      const parsed = new URL(process.env.REDIS_URL);
      if (parsed.protocol) protocol = parsed.protocol.split(":")[0];
      if (parsed.password) password = parsed.password;
      if (parsed.hostname) host = parsed.hostname;
      if (parsed.port) port = parsed.port;
      if (parsed.pathname) db = parsed.pathname.substring(1);
    }

    const maxBackoff = 1000;
    const commonArgs = {
      port,
      host,
      password,
      db: parseInt(db),
      // ssl options
      tls: protocol === "rediss" ? { rejectUnauthorized: false } : undefined,
      // you can learn more about retryStrategy @ https://github.com/luin/ioredis#auto-reconnect
      retryStrategy: (times) => {
        if (times === 1) {
          console.error(
            "Unable to connect to Redis - please check your Redis config!"
          );
          return 5000;
        }
        return Math.min(times * 50, maxBackoff);
      },
    };

    return {
      scanCount: 1000,

      _toExpand: false,
      client: {
        konstructor,
        args: [commonArgs],
        buildNew: true,
      },
      subscriber: {
        konstructor,
        args: [commonArgs],
        buildNew: true,
      },
      tasks: {
        konstructor,
        args: [commonArgs],
        buildNew: true,
      },
    };
  },
};

/**
 * If you do not want to connect to a real redis server, and want to emulate the functionally of redis in-memory, you can use `MockIORedis`
 * Note that large data sets will be stored in RAM, and not persisted to disk.  Multiple Actionhero processes cannot share cache, chat messages, etc.
 * Redis Pub/Sub works with this configuration.
 */

// export const DEFAULT = {
//   redis: (config) => {
//     const MockIORedis = require("ioredis-mock");
//     const baseRedis = new MockIORedis();

//     return {
//       scanCount: 1000,

//       _toExpand: false,
//       client: {
//         konstructor: () => baseRedis,
//         args: [],
//         buildNew: false,
//       },
//       subscriber: {
//         konstructor: () => baseRedis.createConnectedClient(),
//         args: [],
//         buildNew: false,
//       },
//       tasks: {
//         konstructor: () => baseRedis.createConnectedClient(),
//         args: [],
//         buildNew: false,
//       },
//     };
//   },
// };
