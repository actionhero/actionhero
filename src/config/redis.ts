import { URL } from "url";

let host = process.env.REDIS_HOST || "127.0.0.1";
let port = process.env.REDIS_PORT || 6379;
let db = process.env.REDIS_DB || process.env.JEST_WORKER_ID || "0";
let password = process.env.REDIS_PASSWORD || null;
const maxBackoff = 1000;

if (process.env.REDIS_URL) {
  const parsed = new URL(process.env.REDIS_URL);
  if (parsed.password) {
    password = parsed.password;
  }
  if (parsed.hostname) {
    host = parsed.hostname;
  }
  if (parsed.port) {
    port = parsed.port;
  }
  if (parsed.pathname) {
    db = parsed.pathname.substring(1);
  }
}

export const DEFAULT = {
  redis: (config) => {
    // konstructor: The redis client constructor method.  All redis methods must be promises
    // args: The arguments to pass to the constructor
    // buildNew: is it `new konstructor()` or just `konstructor()`?

    const commonArgs = {
      port,
      host,
      password,
      db: parseInt(db),
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
      enabled: true,

      _toExpand: false,
      client: {
        konstructor: require("ioredis"),
        args: [commonArgs],
        buildNew: true,
      },
      subscriber: {
        konstructor: require("ioredis"),
        args: [commonArgs],
        buildNew: true,
      },
      tasks: {
        konstructor: require("ioredis"),
        args: [commonArgs],
        buildNew: true,
      },
    };
  },
};
