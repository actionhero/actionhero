import * as fs from "fs";
import { api, id, utils, config, i18n } from "../index";

export namespace cache {
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
    retry?: boolean | number;
  }

  export const redisPrefix = config.general.cachePrefix;
  export const lockPrefix = config.general.lockPrefix;
  export const lockDuration = config.general.lockDuration;
  export const lockRetry = 100;

  export function client() {
    if (config.redis.enabled && api.redis.clients && api.redis.clients.client) {
      return api.redis.clients.client;
    } else {
      throw new Error("redis not connected, cache cannot be used");
    }
  }

  let lockNameOverride;
  export function lockName() {
    if (lockNameOverride) {
      return lockNameOverride;
    }
    return id;
  }

  export function overrideLockName(name: string) {
    lockNameOverride = name;
  }

  /**
   * Returns all the keys in redis which are under this ActionHero namespace.  Potentially very slow.
   */
  export async function keys(): Promise<Array<string>> {
    return client().keys(redisPrefix + "*");
  }

  /**
   * Returns all the locks in redis which are under this ActionHero namespace.  Potentially slow.
   */
  export async function locks(): Promise<Array<string>> {
    return client().keys(lockPrefix + "*");
  }

  /**
   * Returns the number of keys in redis which are under this ActionHero namespace.  Potentially very slow.
   */
  export async function size(): Promise<number> {
    const keys = await cache.keys();
    let length = 0;
    if (keys) {
      length = keys.length;
    }

    return length;
  }

  /**
   * Removes all keys in redis which are under this ActionHero namespace.  Potentially very slow.
   */
  export async function clear(): Promise<boolean> {
    const keys = await cache.keys();
    const jobs = [];
    keys.forEach((key: string) => {
      jobs.push(client().del(key));
    });

    await Promise.all(jobs);
    return true;
  }

  /**
   * Write the current concents of redis (only the keys in ActionHero's namespace) to a file.
   */
  export async function dumpWrite(file: string): Promise<number> {
    const data = {};
    const jobs = [];
    const keys = await cache.keys();

    keys.forEach((key: string) => {
      jobs.push(
        client()
          .get(key)
          .then(content => {
            data[key] = content;
          })
      );
    });

    await Promise.all(jobs);

    fs.writeFileSync(file, JSON.stringify(data));
    return keys.length;
  }

  /**
   * Load in contents for redis (and api.cache) saved to a file
   * Warning! Any existing keys in redis (under this ActionHero namespace) will be removed.
   */
  export async function dumpRead(file: string): Promise<number> {
    const jobs = [];
    await cache.clear();
    const fileData = fs.readFileSync(file).toString();
    const data = JSON.parse(fileData);
    const count = Object.keys(data).length;

    const saveDumpedElement = async (key: string, content: any) => {
      const parsedContent = JSON.parse(content);
      await client().set(key, content);
      if (parsedContent.expireTimestamp) {
        const expireTimeSeconds = Math.ceil(
          (parsedContent.expireTimestamp - new Date().getTime()) / 1000
        );
        await client().expire(key, expireTimeSeconds);
      }
    };

    Object.keys(data).forEach(key => {
      const content = data[key];
      jobs.push(saveDumpedElement(key, content));
    });

    await Promise.all(jobs);
    return count;
  }

  /**
   * Load an item from the cache.  Will throw an error if the item named by `key` cannot be found.
   * Automatically handles `api.cache.redisPrefix`
   */
  export async function load(
    key: string,
    options: CacheOptions = {}
  ): Promise<CacheObject> {
    let cacheObj: CacheObject;
    let cachedStringifiedObjet = await client().get(`${redisPrefix}${key}`);
    try {
      cacheObj = JSON.parse(cachedStringifiedObjet);
    } catch (e) {}

    if (!cacheObj) {
      throw new Error(i18n.localize("actionhero.cache.objectNotFound"));
    }

    if (
      cacheObj.expireTimestamp &&
      cacheObj.expireTimestamp < new Date().getTime()
    ) {
      throw new Error(i18n.localize("actionhero.cache.objectExpired"));
    }

    const lastReadAt = cacheObj.readAt;
    let expireTimeSeconds: number;
    cacheObj.readAt = new Date().getTime();

    if (cacheObj.expireTimestamp) {
      if (options.expireTimeMS) {
        cacheObj.expireTimestamp = new Date().getTime() + options.expireTimeMS;
        expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
      } else {
        expireTimeSeconds = Math.floor(
          (cacheObj.expireTimestamp - new Date().getTime()) / 1000
        );
      }
    }

    const lockOk = await cache.checkLock(key, options.retry);
    if (lockOk !== true) {
      throw new Error(i18n.localize("actionhero.cache.objectLocked"));
    }

    await client().set(redisPrefix + key, JSON.stringify(cacheObj));
    if (expireTimeSeconds) {
      await client().expire(redisPrefix + key, expireTimeSeconds);
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
  }

  /**
   * Delete an item in the cache.  Will throw an error if the item named by `key` is locked.
   * Automatically handles `api.cache.redisPrefix`
   */
  export async function destroy(key: string): Promise<boolean> {
    const lockOk = await cache.checkLock(key, null);
    if (!lockOk) {
      throw new Error(i18n.localize("actionhero.cache.objectLocked"));
    }
    const count = await client().del(redisPrefix + key);
    let response = true;
    if (count !== 1) {
      response = false;
    }
    return response;
  }

  /**
   * Save an item in the cache.  If an item is already in the cache with the same key, it will be overwritten.  Throws an error if the object is already in the cache and is locked.
   * Automatically handles `api.cache.redisPrefix`
   */
  export async function save(
    key: string,
    value: any,
    expireTimeMS?: number
  ): Promise<boolean> {
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

    const lockOk = await cache.checkLock(key, null);
    if (!lockOk) {
      throw new Error(i18n.localize("actionhero.cache.objectLocked"));
    }
    await client().set(redisPrefix + key, JSON.stringify(cacheObj));
    if (expireTimeSeconds) {
      await client().expire(redisPrefix + key, expireTimeSeconds);
    }
    return true;
  }

  /**
   * Push an item to a shared queue/list in redis.
   * Automatically handles `api.cache.redisPrefix`
   */
  export async function push(key: string, item: any): Promise<boolean> {
    const object = JSON.stringify({ data: item });
    await client().rpush(redisPrefix + key, object);
    return true;
  }

  /**
   * Pop (get) an item to a shared queue/list in redis.
   * Automatically handles `api.cache.redisPrefix`
   */
  export async function pop(key: string): Promise<boolean> {
    const object = await client().lpop(redisPrefix + key);
    if (!object) {
      return null;
    }
    const item = JSON.parse(object);
    return item.data;
  }

  /**
   * Check how many items are stored in a shared queue/list in redis.
   */
  export async function listLength(key: string): Promise<number> {
    return client().llen(redisPrefix + key);
  }

  /**
   * Lock an item in redis (can be a list or a saved item) to this ActionHero process.
   */
  export async function lock(
    key: string,
    expireTimeMS: number = lockDuration
  ): Promise<boolean> {
    const lockOk = await cache.checkLock(key, null);
    if (!lockOk) {
      return false;
    }

    const result = await client().setnx(lockPrefix + key, lockName());
    if (!result) {
      return false;
    } // value was already set, so we cannot obtain the lock

    await client().expire(lockPrefix + key, Math.ceil(expireTimeMS / 1000));

    return true;
  }

  /**
   * Unlock an item in redis (can be a list or a saved item) which was previously locked by this ActionHero process.
   */
  export async function unlock(key: string): Promise<boolean> {
    const lockOk = await cache.checkLock(key, null);

    if (!lockOk) {
      return false;
    }

    await client().del(lockPrefix + key);
    return true;
  }

  export async function checkLock(
    key: string,
    retry: boolean | number = false,
    startTime: number = new Date().getTime()
  ) {
    const lockedBy = await client().get(lockPrefix + key);
    if (lockedBy === lockName() || lockedBy === null) {
      return true;
    } else {
      const delta = new Date().getTime() - startTime;
      if (!retry || delta > retry) {
        return false;
      }

      await utils.sleep(lockRetry);
      return cache.checkLock(key, retry, startTime);
    }
  }
}
