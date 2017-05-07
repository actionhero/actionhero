'use strict'

// //////////////////////////////////////////////////////////////////////////
// actionhero framework in node.js
// http://www.actionherojs.com
// https://github.com/actionhero/actionhero

const path = require('path')
const async = require('async')

// HELPERS ///

const fatalError = function (api, errors, type) {
  if (errors && !(errors instanceof Array)) { errors = [errors] }
  if (errors) {
    if (api.log) {
      api.log(`Error with initializer step: ${type}`, 'emerg')
      errors.forEach((error) => { api.log(error.stack, 'emerg') })
    } else {
      console.error('Error with initializer step: ' + type)
      errors.forEach((error) => { console.error(error.stack) })
    }
    api.commands.stop.call(api, () => {
      process.exit(1)
    })
  }
}

const sortNumber = function (a, b) {
  return a - b
}

let startCount = 0

const flattenOrderedInitialzer = function (collection) {
  let output = []
  let keys = []
  for (let key in collection) {
    keys.push(parseInt(key))
  }
  keys.sort(sortNumber)
  keys.forEach((key) => {
    collection[key].forEach((d) => {
      output.push(d)
    })
  })

  return output
}

// ACTIONHERO //

const actionhero = function () {
  this.initializers = {}
  this.api = {
    running: false,
    initialized: false,
    shuttingDown: false
  }
}

actionhero.prototype.initialize = function (params, callback) {
  this.api.commands = {
    initialize: (params, callback) => { this.initialize(params, callback) },
    start: (params, callback) => { this.start(params, callback) },
    stop: (callback) => { this.stop(callback) },
    restart: (callback) => { this.restart(callback) }
  }

  this.api.projectRoot = process.cwd()

  if (process.env.project_root) {
    this.api.projectRoot = process.env.project_root
  } else if (process.env.projectRoot) {
    this.api.projectRoot = process.env.projectRoot
  } else if (process.env.PROJECT_ROOT) {
    this.api.projectRoot = process.env.PROJECT_ROOT
  }

  if (!callback && typeof params === 'function') {
    callback = params; params = {}
  }
  if (params === null) { params = {} }
  this.startingParams = params
  this.api._startingParams = this.startingParams

  this.api.initializerDefaults = {
    load: 1000,
    start: 1000,
    stop: 1000
  }

  let loadInitializerRankings = {}
  let startInitializerRankings = {}
  let stopInitializerRankings = {}

  this.configInitializers = []
  this.loadInitializers = []
  this.startInitializers = []
  this.stopInitializers = [];

  // we need to load the config first
  [
    path.resolve(__dirname, 'initializers', 'utils.js'),
    path.resolve(__dirname, 'initializers', 'config.js')
  ].forEach((file) => {
    let filename = file.replace(/^.*[\\/]/, '')
    let initializer = filename.split('.')[0]
    delete require.cache[require.resolve(file)]
    this.initializers[initializer] = require(file)
    this.configInitializers.push((next) => {
      this.initializers[initializer].initialize(this.api, next)
    })
  })

  this.configInitializers.push(() => {
    let customInitializers = []
    let duplicatedInitializers = []
    this.api.config.general.paths.initializer.forEach((startPath) => {
      customInitializers = customInitializers.concat(this.api.utils.recursiveDirectoryGlob(startPath))
    })
    // load all other initializers
    this.api.utils.arrayUniqueify(
      this.api.utils.recursiveDirectoryGlob(path.join(__dirname, 'initializers'))
      .sort()
      .concat(
        customInitializers
        .sort()
      )
    ).forEach((f) => {
      let file = path.normalize(f)
      let initializer = path.basename(f).split('.')[0]
      let fileParts = file.split('.')
      let ext = fileParts[(fileParts.length - 1)]
      if (ext === 'js') {
        // check if initializer already exists (exclude utils and config)
        if (this.initializers[initializer] &&
           file !== path.resolve(__dirname, 'initializers', 'utils.js') &&
           file !== path.resolve(__dirname, 'initializers', 'config.js')) {
          duplicatedInitializers.push(file)
        } else {
          delete require.cache[require.resolve(file)]
          this.initializers[initializer] = require(file)
        }

        const loadFunction = (next) => {
          this.api.watchFileAndAct(file, () => {
            this.api.log(`*** Rebooting due to initializer change (${file}) ***`, 'info')
            this.api.commands.restart()
          })

          if (typeof this.initializers[initializer].initialize === 'function') {
            if (typeof this.api.log === 'function') { this.api.log(`Loading initializer: ${initializer}`, 'debug', file) }
            try {
              this.initializers[initializer].initialize(this.api, (error) => {
                try { this.api.log(`Loaded initializer: ${initializer}`, 'debug', file) } catch (e) { }
                next(error)
              })
            } catch (e) {
              this.api.log(`Exception occured in initializer: ${initializer}  during load`, 'warning', e)
              next(e)
            }
          } else {
            next()
          }
        }

        const startFunction = (next) => {
          if (typeof this.initializers[initializer].start === 'function') {
            if (typeof this.api.log === 'function') { this.api.log(`Starting initializer: ${initializer}`, 'debug', file) }
            try {
              this.initializers[initializer].start(this.api, (error) => {
                this.api.log(`Started initializer: ${initializer}`, 'debug', file)
                next(error)
              })
            } catch (e) {
              this.api.log(`Exception occured in initializer: ${initializer} during start`, 'warning', e)
              next(e)
            }
          } else {
            next()
          }
        }

        const stopFunction = (next) => {
          if (typeof this.initializers[initializer].stop === 'function') {
            if (typeof this.api.log === 'function') { this.api.log(`Stopping initializer: ${initializer}`, 'debug', file) }
            try {
              this.initializers[initializer].stop(this.api, (error) => {
                this.api.log(`Stopped initializer: ${initializer}`, 'debug', file)
                next(error)
              })
            } catch (e) {
              this.api.log(`Exception occured in initializer: ${initializer} during stop`, 'warning', e)
              next(e)
            }
          } else {
            next()
          }
        }

        if (this.initializers[initializer].loadPriority === undefined) {
          this.initializers[initializer].loadPriority = this.api.initializerDefaults.load
        }
        if (this.initializers[initializer].startPriority === undefined) {
          this.initializers[initializer].startPriority = this.api.initializerDefaults.start
        }
        if (this.initializers[initializer].stopPriority === undefined) {
          this.initializers[initializer].stopPriority = this.api.initializerDefaults.stop
        }

        if (loadInitializerRankings[this.initializers[initializer].loadPriority] === undefined) {
          loadInitializerRankings[this.initializers[initializer].loadPriority] = []
        }
        if (startInitializerRankings[this.initializers[initializer].startPriority] === undefined) {
          startInitializerRankings[this.initializers[initializer].startPriority] = []
        }
        if (stopInitializerRankings[this.initializers[initializer].stopPriority] === undefined) {
          stopInitializerRankings[this.initializers[initializer].stopPriority] = []
        }

        if (this.initializers[initializer].loadPriority > 0) {
          loadInitializerRankings[this.initializers[initializer].loadPriority].push(loadFunction)
        }

        if (this.initializers[initializer].startPriority > 0) {
          startInitializerRankings[this.initializers[initializer].startPriority].push(startFunction)
        }

        if (this.initializers[initializer].stopPriority > 0) {
          stopInitializerRankings[this.initializers[initializer].stopPriority].push(stopFunction)
        }
      }
    })

    // flatten all the ordered initializer methods
    this.loadInitializers = flattenOrderedInitialzer(loadInitializerRankings)
    this.startInitializers = flattenOrderedInitialzer(startInitializerRankings)
    this.stopInitializers = flattenOrderedInitialzer(stopInitializerRankings)

    this.loadInitializers.push(() => {
      process.nextTick(() => {
        this.api.initialized = true

        if (duplicatedInitializers.length > 0) {
          duplicatedInitializers.forEach(initializer => this.api.log(`Initializer ${initializer} already exists!`, 'error'))
          this.api.commands.stop.call(this.api, () => {
            process.exit(1)
          })
        }
        callback(null, this.api)
      })
    })

    async.series(this.loadInitializers, (errors) => { fatalError(this.api, errors, 'initialize') })
  })

  async.series(this.configInitializers, (errors) => { fatalError(this.api, errors, 'config') })
}

actionhero.prototype.start = function (params, callback) {
  if (!callback && typeof params === 'function') {
    callback = params; params = {}
  }

  const _start = () => {
    this.api.running = true

    this.api.log('*** Starting ActionHero ***', 'notice')

    this.startInitializers.push(() => {
      this.api.bootTime = new Date().getTime()
      if (startCount === 0) {
        this.api.log('*** ActionHero Started ***', 'alert')
      } else {
        this.api.log('*** ActionHero Restarted ***', 'alert')
      }

      startCount++
      callback(null, this.api)
    })

    async.series(this.startInitializers, (errors) => { fatalError(this.api, errors, 'start') })
  }

  if (this.api.initialized === true) {
    _start()
  } else {
    this.initialize(params, () => {
      _start()
    })
  }
}

actionhero.prototype.stop = function (callback) {
  if (this.api.running === true) {
    this.api.shuttingDown = true
    this.api.running = false
    this.api.initialized = false

    this.api.log('Shutting down open servers and stopping task processing...', 'notice')

    this.stopInitializers.push(() => {
      this.api.unWatchAllFiles()
      this.api.pids.clearPidFile()
      this.api.log('*** ActionHero Stopped ***', 'alert')
      this.api.log('***', 'debug')
      delete this.api.shuttingDown
      // reset initializers to prevent duplicate check on restart
      this.initializers = {}
      process.nextTick(() => {
        if (typeof callback === 'function') { callback(null, this.api) }
      })
    })

    async.series(this.stopInitializers, (errors) => { fatalError(this.api, errors, 'stop') })
  } else if (this.api.shuttingDown === true) {
    // double sigterm; ignore it
  } else {
    if (this.api.log) { this.api.log('Cannot shut down actionhero, not running', 'error') }
    if (typeof callback === 'function') { callback(null, this.api) }
  }
}

actionhero.prototype.restart = function (callback) {
  if (this.api.running === true) {
    this.stop((error) => {
      if (error) { this.api.log(error, 'error') }
      this.start(this.startingParams, (error) => {
        if (error) { this.api.log(error, 'error') }
        if (typeof callback === 'function') { callback(null, this.api) }
      })
    })
  } else {
    this.start(this.startingParams, (error) => {
      if (error) { this.api.log(error, 'error') }
      if (typeof callback === 'function') { callback(null, this.api) }
    })
  }
}

module.exports = actionhero
