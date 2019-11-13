import * as fs from "fs";
import { api, Initializer } from "../index";

export interface CacheObject {
  key: string;
  value: any;
  expireTimestamp: number;
  createdAt: number;
  lastReadAt: number;
  readAt?: number;
}

export interface CacheOptions {
  expireTimeMS?: number;
  retry?: boolean;
}

/**
 * Redis cache connectivity and support methods.
 */
export class Cache extends Initializer {
  constructor() {
    super();
    this.name = "cache";
    this.loadPriority = 300;
    this.startPriority = 300;
  }

  async initialize() {
    if (api.config.redis.enabled === false) {
      return;
    }

    const redis = api.redis.clients.client;

    api.cache = {
      redisPrefix: api.config.general.cachePrefix,
      lockPrefix: api.config.general.lockPrefix,
      lockDuration: api.config.general.lockDuration,
      lockName: api.id,
      lockRetry: 100
    };

    /**
     * Returns all the keys in redis which are under this ActionHero namespace.  Potentially very slow.
     */
    api.cache.keys = async (): Promise<Array<string>> => {
      return redis.keys(api.cache.redisPrefix + "*");
    };

    /**
     * Returns all the locks in redis which are under this ActionHero namespace.  Potentially slow.
     */
    api.cache.locks = async (): Promise<Array<string>> => {
      return redis.keys(api.cache.lockPrefix + "*");
    };

    /**
     * Returns the number of keys in redis which are under this ActionHero namespace.  Potentially very slow.
     */
    api.cache.size = async (): Promise<number> => {
      const keys = await api.cache.keys();
      let length = 0;
      if (keys) {
        length = keys.length;
      }

      return length;
    };

    /**
     * Removes all keys in redis which are under this ActionHero namespace.  Potentially very slow.
     */
    api.cache.clear = async (): Promise<boolean> => {
      const keys = await api.cache.keys();
      const jobs = [];
      keys.forEach((key: string) => {
        jobs.push(redis.del(key));
      });

      await Promise.all(jobs);
      return true;
    };

    /**
     * Write the current concents of redis (only the keys in ActionHero's namespace) to a file.
     */
    api.cache.dumpWrite = async (file: string): Promise<number> => {
      const data = {};
      const jobs = [];
      const keys = await api.cache.keys();

      keys.forEach((key: string) => {
        jobs.push(
          redis.get(key).then(content => {
            data[key] = content;
          })
        );
      });

      await Promise.all(jobs);

      fs.writeFileSync(file, JSON.stringify(data));
      return keys.length;
    };

    /**
     * Load in contents for redis (and api.cache) saved to a file
     * Warning! Any existing keys in redis (under this ActionHero namespace) will be removed.
     */
    api.cache.dumpRead = async (file: string): Promise<number> => {
      const jobs = [];
      await api.cache.clear();
      const fileData = fs.readFileSync(file).toString();
      const data = JSON.parse(fileData);
      const count = Object.keys(data).length;

      const saveDumpedElement = async (key: string, content: any) => {
        const parsedContent = JSON.parse(content);
        await redis.set(key, content);
        if (parsedContent.expireTimestamp) {
          const expireTimeSeconds = Math.ceil(
            (parsedContent.expireTimestamp - new Date().getTime()) / 1000
          );
          await redis.expire(key, expireTimeSeconds);
        }
      };

      Object.keys(data).forEach(key => {
        const content = data[key];
        jobs.push(saveDumpedElement(key, content));
      });

      await Promise.all(jobs);
      return count;
    };

    /**
     * Load an item from the cache.  Will throw an error if the item named by `key` cannot be found.
     * Automatically handels `api.cache.redisPrefix`
     */
    api.cache.load = async (
      key: string,
      options: CacheOptions = {}
    ): Promise<CacheObject> => {
      let cacheObj: CacheObject;
      let cachedStringifiedObjet = await redis.get(
        `${api.cache.redisPrefix}${key}`
      );
      try {
        cacheObj = JSON.parse(cachedStringifiedObjet);
      } catch (e) {}

      if (!cacheObj) {
        throw new Error(api.i18n.localize("actionhero.cache.objectNotFound"));
      }

      if (
        cacheObj.expireTimestamp &&
        cacheObj.expireTimestamp < new Date().getTime()
      ) {
        throw new Error(api.i18n.localize("actionhero.cache.objectExpired"));
      }

      const lastReadAt = cacheObj.readAt;
      let expireTimeSeconds: number;
      cacheObj.readAt = new Date().getTime();

      if (cacheObj.expireTimestamp) {
        if (options.expireTimeMS) {
          cacheObj.expireTimestamp =
            new Date().getTime() + options.expireTimeMS;
          expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
        } else {
          expireTimeSeconds = Math.floor(
            (cacheObj.expireTimestamp - new Date().getTime()) / 1000
          );
        }
      }

      const lockOk = await api.cache.checkLock(key, options.retry);
      if (lockOk !== true) {
        throw new Error(api.i18n.localize("actionhero.cache.objectLocked"));
      }

      await redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj));
      if (expireTimeSeconds) {
        await redis.expire(api.cache.redisPrefix + key, expireTimeSeconds);
        return {
          key,
          value: cacheObj.value,
          expireTimestamp: cacheObj.expireTimestamp,
          createdAt: cacheObj.createdAt,
          lastReadAt
        };
      } else {
        return {
          key,
          value: cacheObj.value,
          expireTimestamp: cacheObj.expireTimestamp,
          createdAt: cacheObj.createdAt,
          lastReadAt
        };
      }
    };

    /**
     * Delete an item in the cache.  Will throw an error if the item named by `key` is locked.
     * Automatically handels `api.cache.redisPrefix`
     */
    api.cache.destroy = async (key: string): Promise<boolean> => {
      const lockOk = await api.cache.checkLock(key, null);
      if (!lockOk) {
        throw new Error(api.i18n.localize("actionhero.cache.objectLocked"));
      }
      const count = await redis.del(api.cache.redisPrefix + key);
      let response = true;
      if (count !== 1) {
        response = false;
      }
      return response;
    };

    /**
     * Save an item in the cache.  If an item is already in the cache with the same key, it will be overritten.  Throws an error if the object is already in the cache and is locked.
     * Automatically handels `api.cache.redisPrefix`
     */
    api.cache.save = async (
      key: string,
      value: any,
      expireTimeMS?: number
    ): Promise<boolean> => {
      let expireTimeSeconds = null;
      let expireTimestamp = null;
      if (expireTimeMS !== null) {
        expireTimeSeconds = Math.ceil(expireTimeMS / 1000);
        expireTimestamp = new Date().getTime() + expireTimeMS;
      }

      const cacheObj = {
        value: value,
        expireTimestamp: expireTimestamp,
        createdAt: new Date().getTime(),
        readAt: null
      };

      const lockOk = await api.cache.checkLock(key, null);
      if (!lockOk) {
        throw new Error(api.i18n.localize("actionhero.cache.objectLocked"));
      }
      await redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj));
      if (expireTimeSeconds) {
        await redis.expire(api.cache.redisPrefix + key, expireTimeSeconds);
      }
      return true;
    };

    /**
     * Push an item to a shared queue/list in redis.
     * Automatically handels `api.cache.redisPrefix`
     */
    api.cache.push = async (key: string, item: any): Promise<boolean> => {
      const object = JSON.stringify({ data: item });
      await redis.rpush(api.cache.redisPrefix + key, object);
      return true;
    };

    /**
     * Pop (get) an item to a shared queue/list in redis.
     * Automatically handels `api.cache.redisPrefix`
     */
    api.cache.pop = async (key: string): Promise<boolean> => {
      const object = await redis.lpop(api.cache.redisPrefix + key);
      if (!object) {
        return null;
      }
      const item = JSON.parse(object);
      return item.data;
    };

    /**
     * Check how many items are stored in a shared queue/list in redis.
     */
    api.cache.listLength = async (key: string): Promise<number> => {
      return redis.llen(api.cache.redisPrefix + key);
    };

    /**
     * Lock an item in redis (can be a list or a saved item) to this ActionHero process.
     */
    api.cache.lock = async (
      key: string,
      expireTimeMS: number = api.cache.lockDuration
    ): Promise<boolean> => {
      const lockOk = await api.cache.checkLock(key, null);
      if (!lockOk) {
        return false;
      }

      const result = await redis.setnx(
        api.cache.lockPrefix + key,
        api.cache.lockName
      );
      if (!result) {
        return false;
      } // value was already set, so we cannot obtain the lock

      await redis.expire(
        api.cache.lockPrefix + key,
        Math.ceil(expireTimeMS / 1000)
      );

      return true;
    };

    /**
     * Unlock an item in redis (can be a list or a saved item) which was previously locked by this ActionHero process.
     */
    api.cache.unlock = async (key: number): Promise<boolean> => {
      const lockOk = await api.cache.checkLock(key, null);

      if (!lockOk) {
        return false;
      }

      await redis.del(api.cache.lockPrefix + key);
      return true;
    };

    api.cache.checkLock = async (
      key: string,
      retry: boolean | number,
      startTime: number
    ) => {
      if (!startTime) {
        startTime = new Date().getTime();
      }

      const lockedBy = await redis.get(api.cache.lockPrefix + key);
      if (lockedBy === api.cache.lockName || lockedBy === null) {
        return true;
      } else {
        const delta = new Date().getTime() - startTime;
        if (!retry || delta > retry) {
          return false;
        }

        await api.utils.sleep(api.cache.lockRetry);
        return api.cache.checkLock(key, retry, startTime);
      }
    };
  }
}
