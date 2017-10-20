'use strict'

const fs = require('fs')
const path = require('path')
const async = require('async')
const dotProp = require('dot-prop')

/**
 * Utilites for any ActionHero project.
 *
 * @namespace api.utils
 * @property {Object} dotProp - The dotProp package.
 */

module.exports = {
  loadPriority: 0,
  initialize: function (api, next) {
    if (!api.utils) { api.utils = {} }

    api.utils.dotProp = dotProp

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
    api.utils.hashMerge = function (a, b, arg) {
      let c = {}
      let i
      let response

      for (i in a) {
        if (api.utils.isPlainObject(a[i]) && Object.keys(a[i]).length > 0) {
          c[i] = api.utils.hashMerge(c[i], a[i], arg)
        } else {
          if (typeof a[i] === 'function') {
            response = a[i](arg)
            if (api.utils.isPlainObject(response)) {
              c[i] = api.utils.hashMerge(c[i], response, arg)
            } else {
              c[i] = response
            }
          } else {
            c[i] = a[i]
          }
        }
      }
      for (i in b) {
        if (api.utils.isPlainObject(b[i]) && Object.keys(b[i]).length > 0) {
          c[i] = api.utils.hashMerge(c[i], b[i], arg)
        } else {
          if (typeof b[i] === 'function') {
            response = b[i](arg)
            if (api.utils.isPlainObject(response)) {
              c[i] = api.utils.hashMerge(c[i], response, arg)
            } else {
              c[i] = response
            }
          } else {
            c[i] = b[i]
          }
        }
      }
      return c
    }

    api.utils.isPlainObject = function (o) {
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
    api.utils.arrayUniqueify = function (arr) {
      let a = []
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[i] === arr[j]) { j = ++i }
        }
        a.push(arr[i])
      }
      return a
    }

    // //////////////////////////////////////////////////////////////////////////
    // get all .js files in a directory
    api.utils.recursiveDirectoryGlob = function (dir, extension, followLinkFiles) {
      let results = []

      if (!extension) { extension = '.js' }
      if (!followLinkFiles) { followLinkFiles = true }

      extension = extension.replace('.', '')

      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach((file) => {
          let fullFilePath = path.join(dir, file)
          if (file[0] !== '.') { // ignore 'system' files
            let stats = fs.statSync(fullFilePath)
            let child
            if (stats.isDirectory()) {
              child = api.utils.recursiveDirectoryGlob(fullFilePath, extension, followLinkFiles)
              child.forEach((c) => { results.push(c) })
            } else if (stats.isSymbolicLink()) {
              let realPath = fs.readlinkSync(fullFilePath)
              child = api.utils.recursiveDirectoryGlob(realPath, extension, followLinkFiles)
              child.forEach((c) => { results.push(c) })
            } else if (stats.isFile()) {
              let fileParts = file.split('.')
              let ext = fileParts[(fileParts.length - 1)]
               // real file match
              if (ext === extension) { results.push(fullFilePath) }
               // linkfile traversal
              if (ext === 'link' && followLinkFiles === true) {
                let linkedPath = api.utils.sourceRelativeLinkPath(fullFilePath, api.config.general.paths.plugin)
                if (linkedPath) {
                  child = api.utils.recursiveDirectoryGlob(linkedPath, extension, followLinkFiles)
                  child.forEach((c) => { results.push(c) })
                } else {
                  try {
                    api.log(`cannot find linked refrence to \`${file}\``, 'warning')
                  } catch (e) {
                    throw new Error('cannot find linked refrence to ' + file)
                  }
                }
              }
            }
          }
        })
      }

      return results.sort()
    }

    /**
     * @private
     */
    api.utils.sourceRelativeLinkPath = function (linkfile, pluginPaths) {
      const type = fs.readFileSync(linkfile).toString()
      const pathParts = linkfile.split(path.sep)
      const name = pathParts[(pathParts.length - 1)].split('.')[0]
      const pathsToTry = pluginPaths.slice(0)
      let pluginRoot

       // TODO: always also try the local destination's `node_modules` to allow for nested plugins
       // This might be a security risk without requiring explicit sourcing

      pathsToTry.forEach((pluginPath) => {
        let pluginPathAttempt = path.normalize(pluginPath + path.sep + name)
        try {
          let stats = fs.lstatSync(pluginPathAttempt)
          if (!pluginRoot && (stats.isDirectory() || stats.isSymbolicLink())) { pluginRoot = pluginPathAttempt }
        } catch (e) { }
      })

      if (!pluginRoot) { return false }
      let pluginSection = path.normalize(pluginRoot + path.sep + type)
      return pluginSection
    }

    // //////////////////////////////////////////////////////////////////////////
    // object Clone
    api.utils.objClone = function (obj) {
      return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce((memo, name) => {
        return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo
      }, {}))
    }

    /**
     * Collapsses an Object with numerical keys (like `arguments` in a function) to an Array
     *
     * @param  {Object} obj An Object with a depth of 1 and only Numerical keys
     * @return {Array}      Array
     */
    api.utils.collapseObjectToArray = function (obj) {
      try {
        const keys = Object.keys(obj)
        if (keys.length < 1) { return false }
        if (keys[0] !== '0') { return false }
        if (keys[(keys.length - 1)] !== String(keys.length - 1)) { return false }

        let arr = []
        for (let i in keys) {
          let key = keys[i]
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
    api.utils.getExternalIPAddress = function () {
      const os = require('os')
      const ifaces = os.networkInterfaces()
      let ip = false
      for (let dev in ifaces) {
        ifaces[dev].forEach((details) => {
          if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
            ip = details.address
          }
        })
      }
      return ip
    }

    /**
     * Transform the cookie headers of a node HTTP `req` Object into a hash.
     *
     * @param  {Object} req A node.js `req` Object
     * @return {Object}     A Object with Cookies.
     */
    api.utils.parseCookies = function (req) {
      let cookies = {}
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach((cookie) => {
          let parts = cookie.split('=')
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
    api.utils.parseIPv6URI = function (addr) {
      let host = '::1'
      let port = '80'
      let regexp = new RegExp(/\[([0-9a-f:]+)]:([0-9]{1,5})/)
      // if we have brackets parse them and find a port
      if (addr.indexOf('[') > -1 && addr.indexOf(']') > -1) {
        let res = regexp.exec(addr)
        if (res === null) {
          throw new Error('failed to parse address')
        }
        host = res[1]
        port = res[2]
      } else {
        host = addr
      }
      return {host: host, port: parseInt(port, 10)}
    }

    /**
     * Returns the averge delay in ms between a tick of hte node.js event loop, as measured for N calls of `process.nextTick`
     *
     * @param  {Number}  itterations How many `process.nextTick` cycles of the event loop should we measure?
     * @param  {numberCallback}  callback The callback to handle the response.
     */
    api.utils.eventLoopDelay = function (itterations, callback) {
      let intervalJobs = []
      let intervalTimes = []

      if (!itterations) { return callback(new Error('itterations is required')) }

      let i = 0
      while (i < itterations) {
        intervalJobs.push((intervalDone) => {
          let start = process.hrtime()
          process.nextTick(() => {
            let delta = process.hrtime(start)
            let ms = (delta[0] * 1000) + (delta[1] / 1000000)
            intervalTimes.push(ms)
            intervalDone()
          })
        })
        i++
      }

      async.series(intervalJobs, function () {
        let sum = 0
        intervalTimes.forEach((t) => { sum += t })
        let avg = Math.round(sum / intervalTimes.length * 10000) / 1000
        return callback(null, avg)
      })
    }

    /**
     * Sorts an Array of Objects with a priority key
     *
     * @param  {Array} globalMiddlewareList The Array to sort.
     * @param  {Array} middleware          A specific collection to sort against.
     */
    api.utils.sortGlobalMiddleware = function (globalMiddlewareList, middleware) {
      globalMiddlewareList.sort((a, b) => {
        if (middleware[a].priority > middleware[b].priority) {
          return 1
        } else {
          return -1
        }
      })
    }

    /**
     * Check if a directory exists.
     *
     * @param  {string} dir The directory to check.
     * @return {Boolean}
     */
    api.utils.dirExists = function (dir) {
      try {
        let stats = fs.lstatSync(dir)
        return (stats.isDirectory() || stats.isSymbolicLink())
      } catch (e) { return false }
    }

    /**
     * Check if a file exists.
     *
     * @param  {string} file The file to check.
     * @return {Boolean}
     */
    api.utils.fileExists = function (file) {
      try {
        let stats = fs.lstatSync(file)
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
    api.utils.createDirSafely = function (dir) {
      if (api.utils.dirExists(dir)) {
        api.log(` - directory '${path.normalize(dir)}' already exists, skipping`, 'alert')
      } else {
        api.log(` - creating directory '${path.normalize(dir)}'`)
        fs.mkdirSync(path.normalize(dir), '0766')
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
    api.utils.createFileSafely = function (file, data, overwrite) {
      if (api.utils.fileExists(file) && !overwrite) {
        api.log(` - file '${path.normalize(file)}' already exists, skipping`, 'alert')
      } else {
        if (overwrite && api.utils.fileExists(file)) {
          api.log(` - overwritten file '${path.normalize(file)}'`)
        } else {
          api.log(` - wrote file '${path.normalize(file)}'`)
        }
        fs.writeFileSync(path.normalize(file), data)
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
    api.utils.createLinkfileSafely = function (filePath, type, refrence) {
      if (api.utils.fileExists(filePath)) {
        api.log(` - link file '${filePath}' already exists, skipping`, 'alert')
      } else {
        api.log(` - creating linkfile '${filePath}'`)
        fs.writeFileSync(filePath, type)
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
    api.utils.removeLinkfileSafely = function (filePath, type, refrence) {
      if (!api.utils.fileExists(filePath)) {
        api.log(` - link file '${filePath}' doesn't exist, skipping`, 'alert')
      } else {
        api.log(` - removing linkfile '${filePath}'`)
        fs.unlinkSync(filePath)
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
    api.utils.createSymlinkSafely = function (destination, source) {
      if (api.utils.dirExists(destination)) {
        api.log(` - symbolic link '${destination}' already exists, skipping`, 'alert')
      } else {
        api.log(` - creating symbolic link '${destination}' => '${source}'`)
        fs.symlinkSync(source, destination, 'dir')
      }
    }

    /**
     * Prepares acton params for logging.
     * Hides any sensitieve data as defined by `api.config.general.filteredParams`
     * Truncates long strings via `api.config.logger.maxLogStringLength`
     *
     * @param  {Object} actionParams Params to filter.
     * @return {Object}        Filtered Params.
     */
    api.utils.filterObjectForLogging = function (actionParams) {
      let filteredParams = {}
      for (let i in actionParams) {
        if (api.utils.isPlainObject(actionParams[i])) {
          filteredParams[i] = api.utils.objClone(actionParams[i])
        } else if (typeof actionParams[i] === 'string') {
          filteredParams[i] = actionParams[i].substring(0, api.config.logger.maxLogStringLength)
        } else {
          filteredParams[i] = actionParams[i]
        }
      }
      api.config.general.filteredParams.forEach((configParam) => {
        if (api.utils.dotProp.get(actionParams, configParam) !== undefined) {
          api.utils.dotProp.set(filteredParams, configParam, '[FILTERED]')
        }
      })
      return filteredParams
    }

    next()
  }
}
