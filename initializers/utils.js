'use strict'

const fs = require('fs')
const path = require('path')
const dotProp = require('dot-prop')
const os = require('os')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * Utilites for any ActionHero project.
 *
 * @namespace api.utils
 * @property {Object} dotProp - The dotProp package.
 * @extends ActionHero.Initializer
 */
module.exports = class Utils extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'utils'
    this.loadPriority = 1
  }

  async initialize () {
    if (!api.utils) { api.utils = {} }

    api.utils.dotProp = dotProp

    /**
     * In series, run an array of `async` functions
     *
     * @async
     * @param  {Array}  jobs  Either an array of methods, or an Array of Objects, with `method` and `arg` properties.
     * @return {Promise<Array>} Array of returned values from the methods in `jobs`
     * @example

// without arguments
let sleepyFunc = async () => {
  await new Promise((resolve) => { setTimeout(resolve, 100) })
  return (new Date()).getTime()
}

let jobs = [sleepyFunc, sleepyFunc, sleepyFunc]

let responses = await api.utils.asyncWaterfall(jobs)
// responses = [1506536188356, 1506536188456, 1506536188456]

// with arguments
let sleepyFunc = async (response) => {
  await new Promise((resolve) => { setTimeout(resolve, 100) })
  return response
}

let jobs = [
  {method: sleepyFunc, args: ['a']},
  {method: sleepyFunc, args: ['b']},
  {method: sleepyFunc, args: ['c']}
]

let responses = await api.utils.asyncWaterfall(jobs)
// responses = ['a', 'b', 'c']
     */
    api.utils.asyncWaterfall = async (jobs) => {
      const results = []
      while (jobs.length > 0) {
        const collection = jobs.shift()
        let job
        let args
        if (typeof collection === 'function') {
          job = collection
          args = []
        } else {
          job = collection.method
          args = collection.args
        }

        const value = await job.apply(this, args)
        results.push(value)
      }

      if (results.length === 0) { return null }
      if (results.length === 1) { return results[0] }
      return results
    }

    /**
     * Recursivley merge 2 Objects together.  Will resolve functions if they are present, unless the parent Object has the propery `_toExpand = false`.
     * ActionHero uses this internally to construct and resolve the config.
     * Matching keys in B override A.
     *
     * @param  {Object} a   Object 1
     * @param  {Object} b   Object 2
     * @param  {Object} arg Arguments to pass to any functiosn which should be resolved.
     * @return {Object}     A new Object, combining A and B
     */
    api.utils.hashMerge = (a, b, arg) => {
      const c = {}
      let i
      let response

      for (i in a) {
        if (api.utils.isPlainObject(a[i])) {
          // can't be anded into above condition, or empty objects will overwrite and not merge
          // also make sure empty objects are created
          c[i] = Object.keys(a[i]).length > 0 ? api.utils.hashMerge(c[i], a[i], arg) : {}
        } else {
          if (typeof a[i] === 'function') {
            response = a[i](arg)
            if (api.utils.isPlainObject(response)) {
              c[i] = api.utils.hashMerge(c[i], response, arg)
            } else {
              c[i] = response
            }
          } else {
            // don't create first term if it is undefined or null
            if (a[i] === undefined || a[i] === null);
            else c[i] = a[i]
          }
        }
      }
      for (i in b) {
        if (api.utils.isPlainObject(b[i])) {
          // can't be anded into above condition, or empty objects will overwrite and not merge
          if (Object.keys(b[i]).length > 0) c[i] = api.utils.hashMerge(c[i], b[i], arg)
          // make sure empty objects are only created, when no key exists yet
          else if (!(i in c)) c[i] = {}
        } else {
          if (typeof b[i] === 'function') {
            response = b[i](arg)
            if (api.utils.isPlainObject(response)) {
              c[i] = api.utils.hashMerge(c[i], response, arg)
            } else {
              c[i] = response
            }
          } else {
            // ignore second term if it is undefined
            if (b[i] === undefined);
            // delete second term/key if value is null and it already exists
            else if (b[i] == null && (i in c)) delete c[i]
            // normal assignments for everything else
            else c[i] = b[i]
          }
        }
      }
      return c
    }

    /**
     * @private
     */
    api.utils.isPlainObject = (o) => {
      const safeTypes = [Boolean, Number, String, Function, Array, Date, RegExp, Buffer]
      const safeInstances = ['boolean', 'number', 'string', 'function']
      const expandPreventMatchKey = '_toExpand' // set `_toExpand = false` within an object if you don't want to expand it
      let i

      if (!o) { return false }
      if ((o instanceof Object) === false) { return false }
      for (i in safeTypes) {
        if (o instanceof safeTypes[i]) { return false }
      }
      for (i in safeInstances) {
        if (typeof o === safeInstances[i]) { return false } //eslint-disable-line
      }
      if (o[expandPreventMatchKey] === false) { return false }
      return (o.toString() === '[object Object]')
    }

    /**
     * Return only the unique values in an Array.
     *
     * @param  {Array} arr Source Array.
     * @return {Array}     Unique Array.
     */
    api.utils.arrayUniqueify = (arr) => {
      const a = []
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[i] === arr[j]) { j = ++i }
        }
        a.push(arr[i])
      }
      return a
    }

    /**
     * @private
     */
    api.utils.sourceRelativeLinkPath = (linkfile, pluginPaths) => {
      const type = fs.readFileSync(linkfile).toString()
      const pathParts = linkfile.split(path.sep)
      const name = pathParts[(pathParts.length - 1)].split('.')[0]
      const pathsToTry = pluginPaths.slice(0)
      let pluginRoot

      pathsToTry.forEach((pluginPath) => {
        const pluginPathAttempt = path.normalize(pluginPath + path.sep + name)
        try {
          const stats = fs.lstatSync(pluginPathAttempt)
          if (!pluginRoot && (stats.isDirectory() || stats.isSymbolicLink())) { pluginRoot = pluginPathAttempt }
        } catch (e) { }
      })

      if (!pluginRoot) { return false }
      const pluginSection = path.normalize(pluginRoot + path.sep + type)
      return pluginSection
    }

    /**
     * Collapsses an Object with numerical keys (like `arguments` in a function) to an Array
     *
     * @param  {Object} obj An Object with a depth of 1 and only Numerical keys
     * @return {Array}      Array
     */
    api.utils.collapseObjectToArray = (obj) => {
      try {
        const keys = Object.keys(obj)
        if (keys.length < 1) { return false }
        if (keys[0] !== '0') { return false }
        if (keys[(keys.length - 1)] !== String(keys.length - 1)) { return false }

        const arr = []
        for (const i in keys) {
          const key = keys[i]
          if (String(parseInt(key)) !== key) { return false } else { arr.push(obj[key]) }
        }

        return arr
      } catch (e) {
        return false
      }
    }

    /**
     * Returns this server's external/public IP address
     *
     * @return {string} This server's external IP address.
     */
    api.utils.getExternalIPAddress = () => {
      const ifaces = os.networkInterfaces()
      let ip = false
      for (const dev in ifaces) {
        ifaces[dev].forEach((details) => {
          if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
            ip = details.address
          }
        })
      }
      return ip
    }

    /**
     * Return ip and port information if defined in the header
     *
     * @param  {Object} headers key-value header parameters
     * @return {Object} A new Object, contains ip and port
     */
    api.utils.parseHeadersForClientAddress = (headers) => {
      let ip = null
      let port = null

      if (headers['x-forwarded-for']) {
        let parts
        let forwardedIp = headers['x-forwarded-for'].split(',')[0]
        if (forwardedIp.indexOf('.') >= 0 || (forwardedIp.indexOf('.') < 0 && forwardedIp.indexOf(':') < 0)) {
          // IPv4
          forwardedIp = forwardedIp.replace('::ffff:', '') // remove any IPv6 information, ie: '::ffff:127.0.0.1'
          parts = forwardedIp.split(':')
          if (parts[0]) { ip = parts[0] }
          if (parts[1]) { port = parts[1] }
        } else {
          // IPv6
          parts = api.utils.parseIPv6URI(forwardedIp)
          if (parts.host) { ip = parts.host }
          if (parts.port) { port = parts.port }
        }
      }
      if (headers['x-forwarded-port']) {
        port = headers['x-forwarded-port']
      }
      if (headers['x-real-ip']) { // https://distinctplace.com/2014/04/23/story-behind-x-forwarded-for-and-x-real-ip-headers/
        ip = headers['x-real-ip']
      }
      return { ip, port }
    }

    /**
     * Transform the cookie headers of a node HTTP `req` Object into a hash.
     *
     * @param  {Object} req A node.js `req` Object
     * @return {Object}     A Object with Cookies.
     */
    api.utils.parseCookies = (req) => {
      const cookies = {}
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach((cookie) => {
          const parts = cookie.split('=')
          cookies[parts[0].trim()] = (parts[1] || '').trim()
        })
      }
      return cookies
    }

    /**
     * Parse an IPv6 address, returning both host and port.
     *
     * @param  {string} addr An IPv6 address.
     * @return {Object}      An Object with {host, port}
     * @see https://github.com/actionhero/actionhero/issues/275
     */
    api.utils.parseIPv6URI = (addr) => {
      let host = '::1'
      let port = '80'
      const regexp = new RegExp(/\[([0-9a-f:]+(?:%.+)?)]:([0-9]{1,5})/)
      // if we have brackets parse them and find a port
      if (addr.indexOf('[') > -1 && addr.indexOf(']') > -1) {
        const res = regexp.exec(addr)
        if (res === null) {
          throw new Error('failed to parse address')
        }
        host = res[1]
        port = res[2]
      } else {
        host = addr
      }
      return { host: host, port: parseInt(port, 10) }
    }

    /**
     * Returns the averge delay between a tick of hte node.js event loop, as measured for N calls of `process.nextTick`
     *
     * @async
     * @param  {Number}  itterations How many `process.nextTick` cycles of the event loop should we measure?
     * @return {Promise<Number>}  Returns the average evnent loop dealy measured in ms.
     */
    api.utils.eventLoopDelay = async (itterations) => {
      const jobs = []

      if (!itterations) { throw new Error('itterations is required') }

      const sleepyFunc = async () => {
        return new Promise((resolve) => {
          const start = process.hrtime()
          process.nextTick(() => {
            const delta = process.hrtime(start)
            const ms = (delta[0] * 1000) + (delta[1] / 1000000)
            resolve(ms)
          })
        })
      }

      let i = 0
      while (i < itterations) {
        jobs.push(sleepyFunc)
        i++
      }

      const results = await api.utils.asyncWaterfall(jobs)
      let sum = 0
      results.forEach((t) => { sum += t })
      const avg = Math.round(sum / results.length * 10000) / 1000
      return avg
    }

    /**
     * Sorts an Array of Objects with a priority key
     *
     * @param  {Array} globalMiddlewareList The Array to sort.
     * @param  {Array} middleware          A specific collection to sort against.
     */
    api.utils.sortGlobalMiddleware = (globalMiddlewareList, middleware) => {
      globalMiddlewareList.sort((a, b) => {
        if (middleware[a].priority > middleware[b].priority) {
          return 1
        } else {
          return -1
        }
      })
    }

    /**
     * Prepares acton params for logging.
     * Hides any sensitieve data as defined by `api.config.general.filteredParams`
     * Truncates long strings via `api.config.logger.maxLogStringLength`
     *
     * @param  {Object} params Params to filter.
     * @return {Object}        Filtered Params.
     */
    api.utils.filterObjectForLogging = (params) => {
      const filteredParams = {}
      for (const i in params) {
        if (api.utils.isPlainObject(params[i])) {
          filteredParams[i] = Object.assign({}, params[i])
        } else if (typeof params[i] === 'string') {
          filteredParams[i] = params[i].substring(0, api.config.logger.maxLogStringLength)
        } else {
          filteredParams[i] = params[i]
        }
      }
      api.config.general.filteredParams.forEach((configParam) => {
        if (api.utils.dotProp.get(params, configParam) !== undefined) {
          api.utils.dotProp.set(filteredParams, configParam, '[FILTERED]')
        }
      })
      return filteredParams
    }

    /**
    Compare the first n elements of an array with another, logner array

    @param {Array} a The first sorted array, the shorter one
    @param {Array} b The second sorted array, the longer one
    */
    api.utils.arrayStartingMatch = (a, b) => {
      if (a.length === 0) { return false }
      if (b.length === 0) { return false }

      let matching = true
      let i = 0
      while (i < a.length) {
        if (a[i] !== b[i]) { matching = false }
        i++
      }
      return matching
    }

    /**
    Sleep with a Promise

    @param {Number} time The number of ms to sleep
    */
    api.utils.sleep = (time) => {
      return new Promise((resolve) => { setTimeout(resolve, time) })
    }

    /**
     * Check if a directory exists.
     *
     * @param  {string} dir The directory to check.
     * @return {Boolean}
     */
    api.utils.dirExists = (dir) => {
      try {
        const stats = fs.lstatSync(dir)
        return (stats.isDirectory() || stats.isSymbolicLink())
      } catch (e) { return false }
    }

    /**
     * Check if a file exists.
     *
     * @param  {string} file The file to check.
     * @return {Boolean}
     */
    api.utils.fileExists = (file) => {
      try {
        const stats = fs.lstatSync(file)
        return (stats.isFile() || stats.isSymbolicLink())
      } catch (e) { return false }
    }

    /**
     * Create a directory, only if it doesn't exist yet.
     * Throws an error if the directory already exists, or encounters a filesystem problem.
     *
     * @param  {string} dir The directory to create.
     * @return {string} a message if the file was created to log.
     */
    api.utils.createDirSafely = (dir) => {
      if (api.utils.dirExists(dir)) {
        const error = new Error(`directory '${path.normalize(dir)}' already exists`)
        error.code = 'EEXIST'
        throw error
      } else {
        fs.mkdirSync(path.normalize(dir), '0766')
        return `created directory '${path.normalize(dir)}'`
      }
    }

    /**
     * Create a file, only if it doesn't exist yet.
     * Throws an error if the file already exists, or encounters a filesystem problem.
     *
     * @param  {string} file The file to create.
     * @param  {string} data The new contents of the file.
     * @param  {boolean} overwrite Should we overwrite an existing file?.
     * @return {string} a message if the file was created to log.
     */
    api.utils.createFileSafely = (file, data, overwrite) => {
      if (api.utils.fileExists(file) && !overwrite) {
        const error = new Error(`file '${path.normalize(file)}' already exists`)
        error.code = 'EEXIST'
        throw error
      } else {
        let message = `wrote file '${path.normalize(file)}'`
        if (overwrite && api.utils.fileExists(file)) { message = ` - overwritten file '${path.normalize(file)}'` }
        fs.writeFileSync(path.normalize(file), data)
        return message
      }
    }

    /**
     * Create an ActionHero LinkFile, only if it doesn't exist yet.
     * Throws an error if the file already exists, or encounters a filesystem problem.
     *
     * @param  {string} filePath The path of the new LinkFile
     * @param  {string} type What are we linking (actions, tasks, etc).
     * @param  {string} refrence What we are refrencing via this link.
     * @return {string} a message if the file was created to log.
     */
    api.utils.createLinkfileSafely = (filePath, type, refrence) => {
      if (api.utils.fileExists(filePath)) {
        const error = new Error(`link file '${filePath}' already exists`)
        error.code = 'EEXIST'
        throw error
      } else {
        fs.writeFileSync(filePath, type)
        return `creating linkfile '${filePath}'`
      }
    }

    /**
     * Remove an ActionHero LinkFile, only if it exists.
     * Throws an error if the file does not exist, or encounters a filesystem problem.
     *
     * @param  {string} filePath The path of the LinkFile
     * @param  {string} type What are we linking (actions, tasks, etc).
     * @param  {string} refrence What we are refrencing via this link.
     * @return {string} a message if the file was created to log.
     */
    api.utils.removeLinkfileSafely = (filePath, type, refrence) => {
      if (!api.utils.fileExists(filePath)) {
        const error = new Error(`link file '${filePath}' doesn't exist`)
        error.code = 'ENOEXIST'
        throw error
      } else {
        fs.unlinkSync(filePath)
        return `removing linkfile '${filePath}'`
      }
    }

    /**
     * Create a system symbolic link.
     * Throws an error if it encounters a filesystem problem.
     *
     * @param  {string} destination
     * @param  {string} source
     * @return {string} a message if the symlionk was created to log.
     */
    api.utils.createSymlinkSafely = (destination, source) => {
      if (api.utils.dirExists(destination)) {
        const error = new Error(`symbolic link '${destination}' already exists`)
        error.code = 'EEXIST'
        throw error
      } else {
        fs.symlinkSync(source, destination, 'dir')
        return `creating symbolic link '${destination}' => '${source}'`
      }
    }
  }
}
