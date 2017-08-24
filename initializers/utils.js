'use strict'

const fs = require('fs')
const path = require('path')
const async = require('async')
const dotProp = require('dot-prop')
const os = require('os')

module.exports = {
  loadPriority: 0,
  initialize: function (api, next) {
    if (!api.utils) { api.utils = {} }

    api.utils.dotProp = dotProp

    // //////////////////////////////////////////////////////////////////////////
    // do an array of async functions in order (either with or without args)
    api.utils.asyncWaterfall = async (jobs) => {
      let results = []
      while (jobs.length > 0) {
        let collection = jobs.shift()
        let job
        let args
        if (typeof collection === 'function') {
          job = collection
          args = []
        } else {
          job = collection.method
          args = collection.args
        }

        let value = await job.apply(this, args)
        results.push(value)
      }

      if (results.length === 0) { return null }
      if (results.length === 1) { return results[0] }
      return results
    }

    // //////////////////////////////////////////////////////////////////////////
    // merge two hashes recursively
    api.utils.hashMerge = (a, b, arg) => {
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

    // //////////////////////////////////////////////////////////////////////////
    // unique-ify an array
    api.utils.arrayUniqueify = (arr) => {
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
    api.utils.recursiveDirectoryGlob = (dir, extension, followLinkFiles) => {
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

    api.utils.sourceRelativeLinkPath = (linkfile, pluginPaths) => {
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
    api.utils.objClone = (obj) => {
      return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce((memo, name) => {
        return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo
      }, {}))
    }

    // //////////////////////////////////////////////////////////////////////////
    // attempt to collapse this object to an array; ie: {"0": "a", "1": "b"}
    api.utils.collapseObjectToArray = (obj) => {
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

    // //////////////////////////////////////////////////////////////////////////
    // get this servers external interface
    api.utils.getExternalIPAddress = () => {
      let ifaces = os.networkInterfaces()
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

    // //////////////////////////////////////////////////////////////////////////
    // cookie parse from headers of http(s) requests
    api.utils.parseCookies = (req) => {
      let cookies = {}
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach((cookie) => {
          let parts = cookie.split('=')
          cookies[parts[0].trim()] = (parts[1] || '').trim()
        })
      }
      return cookies
    }

    // //////////////////////////////////////////////////////////////////////////
    // parse an IPv6 address
    // https://github.com/actionhero/actionhero/issues/275 && https://github.com/nullivex
    api.utils.parseIPv6URI = (addr) => {
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

    // //////////////////////////////////////////////////////////////////////////
    // Check on how long the event loop is blocked for
    api.utils.eventLoopDelay = async (itterations) => {
      let intervalJobs = []
      let intervalTimes = []

      if (!itterations) { throw new Error('itterations is required') }

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
        return avg
      })
    }

    // //////////////////////////////////////////////////////////////////////////
    // Sort Global Middleware
    api.utils.sortGlobalMiddleware = (globalMiddlewareList, middleware) => {
      globalMiddlewareList.sort((a, b) => {
        if (middleware[a].priority > middleware[b].priority) {
          return 1
        } else {
          return -1
        }
      })
    }

    // //////////////////////////////////////////////////////////////////////////
    // File utils
    api.utils.dirExists = (dir) => {
      try {
        let stats = fs.lstatSync(dir)
        return (stats.isDirectory() || stats.isSymbolicLink())
      } catch (e) { return false }
    }

    api.utils.fileExists = (file) => {
      try {
        let stats = fs.lstatSync(file)
        return (stats.isFile() || stats.isSymbolicLink())
      } catch (e) { return false }
    }

    api.utils.createDirSafely = (dir) => {
      if (api.utils.dirExists(dir)) {
        api.log(` - directory '${path.normalize(dir)}' already exists, skipping`, 'alert')
      } else {
        api.log(` - creating directory '${path.normalize(dir)}'`)
        fs.mkdirSync(path.normalize(dir), '0766')
      }
    }

    api.utils.createFileSafely = (file, data, overwrite) => {
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

    api.utils.createLinkfileSafely = (filePath, type, refrence) => {
      if (api.utils.fileExists(filePath)) {
        api.log(` - link file '${filePath}' already exists, skipping`, 'alert')
      } else {
        api.log(` - creating linkfile '${filePath}'`)
        fs.writeFileSync(filePath, type)
      }
    }

    api.utils.removeLinkfileSafely = (filePath, type, refrence) => {
      if (!api.utils.fileExists(filePath)) {
        api.log(` - link file '${filePath}' doesn't exist, skipping`, 'alert')
      } else {
        api.log(` - removing linkfile '${filePath}'`)
        fs.unlinkSync(filePath)
      }
    }

    api.utils.createSymlinkSafely = (destination, source) => {
      if (api.utils.dirExists(destination)) {
        api.log(` - symbolic link '${destination}' already exists, skipping`, 'alert')
      } else {
        api.log(` - creating symbolic link '${destination}' => '${source}'`)
        fs.symlinkSync(source, destination, 'dir')
      }
    }

    api.utils.filterObjectForLogging = (actionParams) => {
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
