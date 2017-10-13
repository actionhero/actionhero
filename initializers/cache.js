'use strict'

const fs = require('fs')
const async = require('async')

/**
 * Redis cache connectivity and support methods.
 *
 * @namespace api.cache
 * @property {string} redisPrefix - The prefix for all redis keys (from `api.config.general.cachePrefix`).
 * @property {string} lockPrefix - The prefix for all redis locks (from `api.config.general.lockPrefix`).
 * @property {Number} lockDuration - The default time a key will be locked for (from `api.config.general.lockDuration`).
 * @property {string} lockName - The name of the lock for this ActionHero instance (from `api.id`).
 * @property {Number} lockRetry - How long to wait before trying to get a lock again (100ms).
 */

module.exports = {
  startPriority: 300,
  loadPriority: 300,
  initialize: function (api, next) {
    api.cache = {}
    api.cache.redisPrefix = api.config.general.cachePrefix
    api.cache.lockPrefix = api.config.general.lockPrefix
    api.cache.lockDuration = api.config.general.lockDuration
    api.cache.lockName = api.id
    api.cache.lockRetry = 100

    const redis = api.redis.clients.client

    /**
     * Returns all the keys in redis which are under this ActionHero namespace.  Potentially very slow.
     *
     * @param {keysCallback} callback - The callback that handles the response.
     */
    api.cache.keys = function (callback) {
      redis.keys(api.cache.redisPrefix + '*', callback)
    }

    /**
     * This callback is invoked by calls to Redis to get a listing of keys.
     * @callback keysCallback
     * @param {Error} error - An error or null.
     * @param {Array} keys - An array of keys.
     */

    /**
     * Returns all the locks in redis which are under this ActionHero namespace.  Potentially slow.
     *
     * @param {keysCallback} callback - The callback that handles the response.
     */
    api.cache.locks = function (callback) {
      redis.keys(api.cache.lockPrefix + '*', callback)
    }

    /**
     * Returns the number of keys in redis which are under this ActionHero namespace.  Potentially very slow.
     *
     * @param {lengthCallback} callback - The callback that handles the response.
     */
    api.cache.size = function (callback) {
      api.cache.keys((error, keys) => {
        let length = 0
        if (keys) { length = keys.length }
        callback(error, length)
      })
    }

    /**
     * This callback is invoked by calls to Redis to get a listing of keys.
     * @callback lengthCallback
     * @param {Error} error - An Error or null.
     * @param {number} length - The number of keys in redis.
     */

    /**
     * Removes all keys in redis which are under this ActionHero namespace.  Potentially very slow.
     *
     * @param {simpleCallback} - The callback that handles the response.
     */
    api.cache.clear = function (callback) {
      api.cache.keys((error, keys) => {
        if (error && typeof callback === 'function') { return callback(error) }
        let jobs = []
        keys.forEach((key) => {
          jobs.push((done) => { redis.del(key, done) })
        })

        async.parallel(jobs, (error) => {
          if (typeof callback === 'function') { return callback(error) }
        })
      })
    }

    /**
     * This callback is invoked with only an error or null.
     * @callback simpleCallback
     * @param {Error} error - An error or null.
     */

    /**
     * Write the current concents of redis (only the keys in ActionHero's namespace) to a file.
     *
     * @param  {string}  file The file to save the cache to.
     * @param  {lengthCallback}
     * @see api.cache.dumpRead
     */
    api.cache.dumpWrite = function (file, callback) {
      let data = {}
      api.cache.keys((error, keys) => {
        if (error && typeof callback === 'function') { return callback(error) }
        let jobs = []
        keys.forEach((key) => {
          jobs.push((done) => {
            redis.get(key, (error, content) => {
              if (error) { return done(error) }
              data[key] = content
              return done()
            })
          })
        })

        async.parallel(jobs, function (error) {
          if (error) {
            if (typeof callback === 'function') { return callback(error) }
          } else {
            fs.writeFileSync(file, JSON.stringify(data))
            if (typeof callback === 'function') { return callback(null, keys.length) }
          }
        })
      })
    }

    /**
     * Load in contents for redis (and api.cache) saved to a file
     * Warning! Any existing keys in redis (under this ActionHero namespace) will be removed.
     *
     * @param  {string}  file The file to load into the cache.
     * @param  {lengthCallback}
     * @see api.cache.dumpWrite
     */
    api.cache.dumpRead = function (file, callback) {
      api.cache.clear((error) => {
        if (error) {
          if (typeof callback === 'function') { return callback(error) }
        } else {
          let jobs = []
          let data
          try {
            data = JSON.parse(fs.readFileSync(file))
          } catch (error) { return callback(error) }

          Object.keys(data).forEach((key) => {
            let content = data[key]
            jobs.push(function (done) { api.cache.saveDumpedElement(key, content, done) })
          })

          async.series(jobs, (error) => {
            if (typeof callback === 'function') { return callback(error, Object.keys(data).length) }
          })
        }
      })
    }

    api.cache.saveDumpedElement = function (key, content, callback) {
      let parsedContent
      try {
        parsedContent = JSON.parse(content)
      } catch (error) { return callback(error) }

      redis.set(key, content, (error) => {
        if (error) { return callback(error) } else if (parsedContent.expireTimestamp) {
          const expireTimeSeconds = Math.ceil((parsedContent.expireTimestamp - new Date().getTime()) / 1000)
          redis.expire(key, expireTimeSeconds, () => {
            return callback(error)
          })
        } else {
          return callback()
        }
      })
    }

    /**
     * Load an item from the cache.  Will throw an error if the item named by `key` cannot be found.
     *
     * @param  {string}  key     The name of the item to load from the cache.
     * @param  {Object}  options  Options is an object with the propety `expireTimeMS`.  This can be used to re-set an expiry time on the cached object after reading it.
     * @param  {cacheCallback} callback The callback that handles the response.
     * @see api.cache.save
     * @see api.cache.destroy
     */
    api.cache.load = function (key, options, callback) {
      // optons: options.expireTimeMS, options.retry
      if (typeof options === 'function') {
        callback = options
        options = {}
      }

      redis.get(api.cache.redisPrefix + key, function (error, cacheObj) {
        if (error) { api.log(error, 'error') }
        try { cacheObj = JSON.parse(cacheObj) } catch (e) {}
        if (!cacheObj) {
          if (typeof callback === 'function') {
            return callback(new Error(api.i18n.localize('actionhero.cache.objectNotFound')), null, null, null, null)
          }
        } else if (cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp === null) {
          const lastReadAt = cacheObj.readAt
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

          api.cache.checkLock(key, options.retry, function (error, lockOk) {
            if (error || lockOk !== true) {
              if (typeof callback === 'function') { return callback(new Error(api.i18n.localize('actionhero.cache.objectLocked'))) }
            } else {
              redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj), (error) => {
                if (typeof callback === 'function' && typeof expireTimeSeconds !== 'number') {
                  return callback(error, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, lastReadAt)
                } else {
                  redis.expire(api.cache.redisPrefix + key, expireTimeSeconds, (error) => {
                    if (typeof callback === 'function') { return callback(error, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, lastReadAt) }
                  })
                }
              })
            }
          })
        } else {
          if (typeof callback === 'function') {
            return callback(new Error(api.i18n.localize('actionhero.cache.objectExpired')))
          }
        }
      })
    }

    /**
     * This callback is used invoked with the value of a cached object.
     * @callback cacheCallback
     * @param {Error} error An error or null.
     * @param {Object} value The value of the cached object.
     * @param {string} expireTimestam The time when the cached object will expire.
     * @param {string} createdAt The time when the cached object was first created.
     * @param {string} lastReadAt The time when the cached object was last read.
     */

    /**
     * Delete an item in the cache.  Will throw an error if the item named by `key` is locked.
     *
     * @param  {string}  key The name of the item to destroy in the cache.
     * @param  {booleanCallback} callback The callback that handles the response.
     * @see api.cache.load
     * @see api.cache.destroy
     */
    api.cache.destroy = function (key, callback) {
      api.cache.checkLock(key, null, (error, lockOk) => {
        if (error || lockOk !== true) {
          if (typeof callback === 'function') { callback(new Error(api.i18n.localize('actionhero.cache.objectLocked'))) }
        } else {
          redis.del(api.cache.redisPrefix + key, (error, count) => {
            if (error) { api.log(error, 'error') }
            let resp = true
            if (count !== 1) { resp = false }
            if (typeof callback === 'function') { callback(error, resp) }
          })
        }
      })
    }

    /**
     * This callback is invoked with an error and/or a boolean value.
     * @callback booleanCallback
     * @param {Error} error An error or null,
     * @param {boolean} response An boolean value representing the success of the operation.
     */

    /**
     * Save an item in the cache.  If an item is already in the cache with the same key, it will be overritten.  Throws an error if the object is already in the cache and is locked.
     *
     * @param  {string}  key          The name of the object to save.
     * @param  {Object}  value        The object to save.  It can also be a Number, String, or Array.
     * @param  {Number}  expireTimeMS (optional) Should the saved item expire after expireTimeMS?
     * @param  {booleanCallback} callback The callback that handles the response.
     * @see api.cache.load
     * @see api.cache.destroy
     */
    api.cache.save = function (key, value, expireTimeMS, callback) {
      if (typeof expireTimeMS === 'function' && typeof callback === 'undefined') {
        callback = expireTimeMS
        expireTimeMS = null
      }

      let expireTimeSeconds = null
      let expireTimestamp = null
      if (expireTimeMS !== null) {
        expireTimeSeconds = Math.ceil(expireTimeMS / 1000)
        expireTimestamp = new Date().getTime() + expireTimeMS
      }

      const cacheObj = {
        value: value,
        expireTimestamp: expireTimestamp,
        createdAt: new Date().getTime(),
        readAt: null
      }

      api.cache.checkLock(key, null, function (error, lockOk) {
        if (error || lockOk !== true) {
          if (typeof callback === 'function') { return callback(new Error(api.i18n.localize('actionhero.cache.objectLocked'))) }
        } else {
          redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj), (error) => {
            if (!error && expireTimeSeconds) {
              redis.expire(api.cache.redisPrefix + key, expireTimeSeconds, (error) => {
                if (typeof callback === 'function') { return callback(error, true) }
              })
            } else {
              if (typeof callback === 'function') { return callback(error, true) }
            }
          })
        }
      })
    }

    /**
     * Push an item to a shared queue/list in redis.
     *
     * @param  {string}  key  Name of the shared queue/list.
     * @param  {Object}  item The item The object to save.  It can also be a Number, String, or Array.
     * @param {simpleCallback} - The callback that handles the response.
     * @see api.cache.pop
     * @see api.cache.listLength
     */
    api.cache.push = function (key, item, callback) {
      let object = JSON.stringify({data: item})
      redis.rpush(api.cache.redisPrefix + key, object, (error) => {
        if (typeof callback === 'function') { callback(error) }
      })
    }

    /**
     * Pop (get) an item to a shared queue/list in redis.
     *
     * @param  {string}  key  The name of the shared queue/list.
     * @param  {objectCallback} callback The callback that handles the response.
     * @return {Promise<Object>}   The item The object which was saved.  It can also be a Number, String, or Array.
     * @see api.cache.push
     * @see api.cache.listLength
     */
    api.cache.pop = function (key, callback) {
      redis.lpop(api.cache.redisPrefix + key, (error, object) => {
        if (error) { return callback(error) }
        if (!object) { return callback() }
        let item
        try {
          item = JSON.parse(object)
        } catch (error) { return callback(error) }
        return callback(null, item.data)
      })
    }

    /**
     * This callback is invoked with an error and/or an object.
     * @callback objectCallback
     * @param {Error} error An error or null,
     * @param {Object} object An Object.
     */

    /**
     * Check how many items are stored in a shared queue/list in redis.
     *
     * @param  {string}  key  The name of the object to save.
     * @param  {lengthCallback} callback The callback that will handle the response.
     */
    api.cache.listLength = function (key, callback) {
      redis.llen(api.cache.redisPrefix + key, callback)
    }

    /**
     * Lock an item in redis (can be a list or a saved item) to this ActionHero process.
     *
     * @param  {string}  key          The name of the object to lock.
     * @param  {string}  expireTimeMS How long to lock this item for.
     * @param  {booleanCallback} callback The callback that will handle the response.
     * @see api.cache.unlock
     * @see api.cache.checkLock
     */
    api.cache.lock = function (key, expireTimeMS, callback) {
      if (typeof expireTimeMS === 'function' && callback === null) {
        callback = expireTimeMS
        expireTimeMS = null
      }
      if (expireTimeMS === null) {
        expireTimeMS = api.cache.lockDuration
      }

      api.cache.checkLock(key, null, (error, lockOk) => {
        if (error || lockOk !== true) {
          return callback(error, false)
        } else {
          redis.setnx(api.cache.lockPrefix + key, api.cache.lockName, (error, result) => {
            if (error) {
              return callback(error)
            } else {
              if (!result) { // value was already set, so we cannot obtain the lock
                return callback(null, false)
              }
              redis.expire(api.cache.lockPrefix + key, Math.ceil(expireTimeMS / 1000), (error) => {
                lockOk = true
                if (error) { lockOk = false }
                return callback(error, lockOk)
              })
            }
          })
        }
      })
    }

    /**
     * Unlock an item in redis (can be a list or a saved item) which was previously locked by this ActionHero process.
     *
     * @param  {string}  key The name of the object to unlock.
     * @param  {booleanCallback} callback The callback that will handle the response.
     * @see api.cache.lock
     * @see api.cache.checkLock
     */
    api.cache.unlock = function (key, callback) {
      api.cache.checkLock(key, null, (error, lockOk) => {
        if (error || lockOk !== true) {
          return callback(error, false)
        } else {
          redis.del(api.cache.lockPrefix + key, (error) => {
            lockOk = true
            if (error) { lockOk = false }
            return callback(error, lockOk)
          })
        }
      })
    }

    /**
     * @private
     */
    api.cache.checkLock = function (key, retry, callback, startTime) {
      if (startTime === null) { startTime = new Date().getTime() }

      redis.get(api.cache.lockPrefix + key, (error, lockedBy) => {
        if (error) {
          return callback(error, false)
        } else if (lockedBy === api.cache.lockName || lockedBy === null) {
          return callback(null, true)
        } else {
          const delta = new Date().getTime() - startTime
          if (retry === null || retry === false || delta > retry) {
            return callback(null, false)
          } else {
            return setTimeout(() => {
              api.cache.checkLock(key, retry, callback, startTime)
            }, api.cache.lockRetry)
          }
        }
      })
    }

    next()
  }
}
