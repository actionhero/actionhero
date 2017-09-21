'use strict'

const fs = require('fs')
const ActionHero = require('./../index.js')

/**
 * @class Cache
 * @extends ActionHero.Initializer
 * @classdesc
 * Redis cache connectivity and support methods.
 */
module.exports = class Cache extends ActionHero.Initializer {
  /**
   * @constructor
   * @memberOf Cache
   */
  constructor () {
    super()
    this.name = 'cache'
    this.loadPriority = 300
    this.startPriority = 300
  }

  initialize (api) {
    const redis = api.redis.clients.client

    api.cache = {
      redisPrefix: api.config.general.cachePrefix,
      lockPrefix: api.config.general.lockPrefix,
      lockDuration: api.config.general.lockDuration,
      lockName: api.id,
      lockRetry: 100
    }

    api.cache.keys = async () => {
      return redis.keys(api.cache.redisPrefix + '*')
    }

    api.cache.locks = async () => {
      return redis.keys(api.cache.lockPrefix + '*')
    }

    api.cache.size = async () => {
      let keys = await api.cache.keys()
      let length = 0
      if (keys) { length = keys.length }
      return length
    }

    api.cache.clear = async () => {
      let keys = await api.cache.keys()
      let jobs = []
      keys.forEach((key) => { jobs.push(redis.del(key)) })
      await Promise.all(jobs)
      return true
    }

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

    api.cache.destroy = async (key) => {
      let lockOk = await api.cache.checkLock(key, null)
      if (!lockOk) { throw new Error(api.i18n.localize('actionhero.cache.objectLocked')) }
      let count = await redis.del(api.cache.redisPrefix + key)
      let response = true
      if (count !== 1) { response = false }
      return response
    }

    /**
     * Save a value to the cache. Performs a lock-checking operation to prevent simultaneous writes to the same key.
     * 
     * @param {string} key - Cache key to set. Will be prefixed automatically by `api.config.general.cachePrefix`.
     * @param {*} value - The value to set
     * @param {Number} [expireTimeMS] - Optional. If provided, the stored key will be set to expire after this interval.
     * @returns {Promise<boolean>}
     * @memberOf Cache
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

    api.cache.push = async (key, item) => {
      let object = JSON.stringify({data: item})
      await redis.rpush(api.cache.redisPrefix + key, object)
      return true
    }

    api.cache.pop = async (key) => {
      let object = await redis.lpop(api.cache.redisPrefix + key)
      if (!object) { return null }
      let item = JSON.parse(object)
      return item.data
    }

    api.cache.listLength = async (key) => {
      return redis.llen(api.cache.redisPrefix + key)
    }

    api.cache.lock = async (key, expireTimeMS) => {
      if (expireTimeMS === null) { expireTimeMS = api.cache.lockDuration }
      let lockOk = await api.cache.checkLock(key, null)
      if (!lockOk) { return false }

      let result = await redis.setnx(api.cache.lockPrefix + key, api.cache.lockName)
      if (!result) { return false } // value was already set, so we cannot obtain the lock

      await redis.expire(api.cache.lockPrefix + key, Math.ceil(expireTimeMS / 1000))
      return true
    }

    api.cache.unlock = async (key) => {
      let lockOk = await api.cache.checkLock(key, null)
      if (!lockOk) { return false }

      await redis.del(api.cache.lockPrefix + key)
      return true
    }

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

        await new Promise((resolve) => { setTimeout(resolve, api.cache.lockRetry) })
        return api.cache.checkLock(key, retry, startTime)
      }
    }
  }
}
