'use strict'

const fs = require('fs')
const {promisify} = require('util')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * Redis cache connectivity and support methods.
 *
 * @namespace api.cache
 * @property {string} redisPrefix - The prefix for all redis keys (from `api.config.general.cachePrefix`).
 * @property {string} lockPrefix - The prefix for all redis locks (from `api.config.general.lockPrefix`).
 * @property {Number} lockDuration - The default time a key will be locked for (from `api.config.general.lockDuration`).
 * @property {string} lockName - The name of the lock for this ActionHero instance (from `api.id`).
 * @property {Number} lockRetry - How long to wait before trying to get a lock again (100ms).
 * @extends ActionHero.Initializer
 */
class Cache extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'cache'
    this.loadPriority = 300
    this.startPriority = 300
  }

  initialize () {
    if (api.config.redis.enabled === false) { return }

    const redis = api.redis.clients.client

    api.cache = {
      redisPrefix: api.config.general.cachePrefix,
      lockPrefix: api.config.general.lockPrefix,
      lockDuration: api.config.general.lockDuration,
      lockName: api.id,
      lockRetry: 100
    }

    /**
     * Returns all the keys in redis which are under this ActionHero namespace.  Potentially very slow.
     *
     * @async
     * @return {Promise<Array>} Promise resolves an Array of keys
     */
    api.cache.keys = async () => {
      return redis.keys(api.cache.redisPrefix + '*')
    }

    /**
     * Returns all the locks in redis which are under this ActionHero namespace.  Potentially slow.
     *
     * @async
     * @return {Promise<Array>} Promise resolves an Array of keys
     */
    api.cache.locks = async () => {
      return redis.keys(api.cache.lockPrefix + '*')
    }

    /**
     * Returns the number of keys in redis which are under this ActionHero namespace.  Potentially very slow.
     *
     * @async
     * @return {Promise<Number>} Promise reslves in interger (length)
     */
    api.cache.size = async () => {
      let keys = await api.cache.keys()
      let length = 0
      if (keys) { length = keys.length }
      return length
    }

    /**
     * Removes all keys in redis which are under this ActionHero namespace.  Potentially very slow.
     *
     * @async
     * @return {Promise<Boolean>} will return true if successful.
     */
    api.cache.clear = async () => {
      let keys = await api.cache.keys()
      let jobs = []
      keys.forEach((key) => { jobs.push(redis.del(key)) })
      await Promise.all(jobs)
      return true
    }

    /**
     * Write the current concents of redis (only the keys in ActionHero's namespace) to a file.
     *
     * @async
     * @param  {string}  file The file to save the cache to.
     * @return {Promise<Number>} The number of keys saved to disk.
     * @see api.cache.dumpRead
     */
    api.cache.dumpWrite = async (file) => {
      let data = {}
      let jobs = []
      let keys = await api.cache.keys()

      keys.forEach((key) => {
        jobs.push(redis.get(key).then((content) => { data[key] = content }))
      })

      await Promise.all(jobs)

      fs.writeFileSync(file, JSON.stringify(data))
      return keys.length
    }

    /**
     * Load in contents for redis (and api.cache) saved to a file
     * Warning! Any existing keys in redis (under this ActionHero namespace) will be removed.
     *
     * @async
     * @param  {string}  file The file to load into the cache.
     * @return {Promise<Number>} The number of keys loaded into redis.
     * @see api.cache.dumpWrite
     */
    api.cache.dumpRead = async (file) => {
      let jobs = []
      await api.cache.clear()
      let data = JSON.parse(fs.readFileSync(file))
      let count = Object.keys(data).length

      Object.keys(data).forEach((key) => {
        let content = data[key]
        jobs.push(api.cache.saveDumpedElement(key, content))
      })

      await Promise.all(jobs)
      return count
    }

    api.cache.saveDumpedElement = async (key, content) => {
      let parsedContent = JSON.parse(content)
      await redis.set(key, content)
      if (parsedContent.expireTimestamp) {
        let expireTimeSeconds = Math.ceil((parsedContent.expireTimestamp - new Date().getTime()) / 1000)
        await redis.expire(key, expireTimeSeconds)
      }
    }

    /**
     * Load an item from the cache.  Will throw an error if the item named by `key` cannot be found.
     *
     * @async
     * @param  {string}  key     The name of the item to load from the cache.
     * @param  {Object}  options  Options is an object with the propety `expireTimeMS`.  This can be used to re-set an expiry time on the cached object after reading it.
     * @return {Promise<Object>}   Returns an object with {key, value, expireTimestamp, createdAt, lastReadAt}
     * @see api.cache.save
     * @see api.cache.destroy
     */
    api.cache.load = async (key, options) => {
      if (!options) { options = {} }
      let cacheObj = await redis.get(api.cache.redisPrefix + key)
      try { cacheObj = JSON.parse(cacheObj) } catch (e) {}

      if (!cacheObj) { throw new Error(api.i18n.localize('actionhero.cache.objectNotFound')) }
      if (cacheObj.expireTimestamp && cacheObj.expireTimestamp < new Date().getTime()) { throw new Error(api.i18n.localize('actionhero.cache.objectExpired')) }

      let lastReadAt = cacheObj.readAt
      let expireTimeSeconds
      cacheObj.readAt = new Date().getTime()

      if (cacheObj.expireTimestamp) {
        if (options.expireTimeMS) {
          cacheObj.expireTimestamp = new Date().getTime() + options.expireTimeMS
          expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000)
        } else {
          expireTimeSeconds = Math.floor((cacheObj.expireTimestamp - new Date().getTime()) / 1000)
        }
      }

      let lockOk = await api.cache.checkLock(key, options.retry)
      if (lockOk !== true) { throw new Error(api.i18n.localize('actionhero.cache.objectLocked')) }

      await redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj))
      if (expireTimeSeconds) {
        await redis.expire(api.cache.redisPrefix + key, expireTimeSeconds)
        return {key, value: cacheObj.value, expireTimestamp: cacheObj.expireTimestamp, createdAt: cacheObj.createdAt, lastReadAt}
      } else {
        return {key, value: cacheObj.value, expireTimestamp: cacheObj.expireTimestamp, createdAt: cacheObj.createdAt, lastReadAt}
      }
    }

    /**
     * Delete an item in the cache.  Will throw an error if the item named by `key` is locked.
     *
     * @async
     * @param  {string}  key The name of the item to destroy in the cache.
     * @return {Promise<Boolean>}     returns true if the item was deleted, false if it was not (or not found).
     * @see api.cache.load
     * @see api.cache.destroy
     */
    api.cache.destroy = async (key) => {
      let lockOk = await api.cache.checkLock(key, null)
      if (!lockOk) { throw new Error(api.i18n.localize('actionhero.cache.objectLocked')) }
      let count = await redis.del(api.cache.redisPrefix + key)
      let response = true
      if (count !== 1) { response = false }
      return response
    }

    /**
     * Save an item in the cache.  If an item is already in the cache with the same key, it will be overritten.  Throws an error if the object is already in the cache and is locked.
     *
     * @async
     * @param  {string}  key          The name of the object to save.
     * @param  {Object}  value        The object to save.  It can also be a Number, String, or Array.
     * @param  {Number}  expireTimeMS (optional) Should the saved item expire after expireTimeMS?
     * @return {Promise<Boolean>}     Returns true if the object was saved.
     * @see api.cache.load
     * @see api.cache.destroy
     */
    api.cache.save = async (key, value, expireTimeMS) => {
      let expireTimeSeconds = null
      let expireTimestamp = null
      if (expireTimeMS !== null) {
        expireTimeSeconds = Math.ceil(expireTimeMS / 1000)
        expireTimestamp = new Date().getTime() + expireTimeMS
      }

      let cacheObj = {
        value: value,
        expireTimestamp: expireTimestamp,
        createdAt: new Date().getTime(),
        readAt: null
      }

      let lockOk = await api.cache.checkLock(key, null)
      if (!lockOk) { throw new Error(api.i18n.localize('actionhero.cache.objectLocked')) }
      await redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj))
      if (expireTimeSeconds) {
        await redis.expire(api.cache.redisPrefix + key, expireTimeSeconds)
      }
      return true
    }

    /**
     * Push an item to a shared queue/list in redis.
     *
     * @async
     * @param  {string}  key  Name of the shared queue/list.
     * @param  {Object}  item The item The object to save.  It can also be a Number, String, or Array.
     * @return {Promise<Boolean>}      Returns true if the object was pushed.
     * @see api.cache.pop
     * @see api.cache.listLength
     */
    api.cache.push = async (key, item) => {
      let object = JSON.stringify({data: item})
      await redis.rpush(api.cache.redisPrefix + key, object)
      return true
    }

    /**
     * Pop (get) an item to a shared queue/list in redis.
     *
     * @async
     * @param  {string}  key  The name of the shared queue/list.
     * @return {Promise<Object>}   The item The object which was saved.  It can also be a Number, String, or Array.
     * @see api.cache.push
     * @see api.cache.listLength
     */
    api.cache.pop = async (key) => {
      let object = await redis.lpop(api.cache.redisPrefix + key)
      if (!object) { return null }
      let item = JSON.parse(object)
      return item.data
    }

    /**
     * Check how many items are stored in a shared queue/list in redis.
     *
     * @async
     * @param  {string}  key  The name of the object to save.
     * @return {Promise<Number>}     The length of the list in redis.  0 will re returned for non-existant lists.
     */
    api.cache.listLength = async (key) => {
      return redis.llen(api.cache.redisPrefix + key)
    }

    /**
     * Lock an item in redis (can be a list or a saved item) to this ActionHero process.
     *
     * @async
     * @param  {string}  key          The name of the object to lock.
     * @param  {string}  expireTimeMS How long to lock this item for.
     * @return {Promise<Boolean>}     Returns true or false, depending on if the item was locked successfully.
     * @see api.cache.unlock
     * @see api.cache.checkLock
     */
    api.cache.lock = async (key, expireTimeMS) => {
      if (expireTimeMS === null) { expireTimeMS = api.cache.lockDuration }
      let lockOk = await api.cache.checkLock(key, null)
      if (!lockOk) { return false }

      let result = await redis.setnx(api.cache.lockPrefix + key, api.cache.lockName)
      if (!result) { return false } // value was already set, so we cannot obtain the lock

      await redis.expire(api.cache.lockPrefix + key, Math.ceil(expireTimeMS / 1000))
      return true
    }

    /**
     * Unlock an item in redis (can be a list or a saved item) which was previously locked by this ActionHero process.
     *
     * @async
     * @param  {string}  key The name of the object to unlock.
     * @return {Promise<Boolean>}     Returns true or false, depending on if the item was unlocked successfully.
     * @see api.cache.lock
     * @see api.cache.checkLock
     */
    api.cache.unlock = async (key) => {
      let lockOk = await api.cache.checkLock(key, null)
      if (!lockOk) { return false }

      await redis.del(api.cache.lockPrefix + key)
      return true
    }

    /**
     * @private
     */
    api.cache.checkLock = async (key, retry, startTime) => {
      if (!startTime) { startTime = new Date().getTime() }

      let lockedBy = await redis.get(api.cache.lockPrefix + key)
      if (lockedBy === api.cache.lockName || lockedBy === null) {
        return true
      } else {
        let delta = new Date().getTime() - startTime
        if (!retry || retry === false || delta > retry) {
          return false
        }

        await promisify(setTimeout)(api.cache.lockRetry)
        return api.cache.checkLock(key, retry, startTime)
      }
    }
  }
}

module.exports = Cache
