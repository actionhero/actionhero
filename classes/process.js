'use strict'

const path = require('path')
const glob = require('glob')
const packageJson = require(path.join(__dirname, '..', 'package.json'))
let api

module.exports = class Process {
  constructor () {
    // Only in files required by `index.js` do we need to delay the loading of the API object
    // This is due to cyclical require issues
    api = require('./../index.js').api

    this.initializers = {}

    let projectRoot = process.cwd()
    if (process.env.project_root) {
      projectRoot = process.env.project_root
    } else if (process.env.projectRoot) {
      projectRoot = process.env.projectRoot
    } else if (process.env.PROJECT_ROOT) {
      projectRoot = process.env.PROJECT_ROOT
    }

    api.running = false
    api.initialized = false
    api.shuttingDown = false
    api.projectRoot = projectRoot
    api.bootTime = null

    this.startCount = 0

    api.commands = {
      initialize: async (params) => { return this.initialize(params) },
      start: async (params) => { return this.start(params) },
      stop: async (callback) => { return this.stop() },
      restart: async (callback) => { return this.restart() }
    }

    api.actionheroVersion = packageJson.version
  }

  async initialize (params) {
    if (!params) { params = {} }

    api._startingParams = params

    let loadInitializerRankings = {}
    let startInitializerRankings = {}
    let stopInitializerRankings = {}
    let initializerFiles = []

    this.loadInitializers = []
    this.startInitializers = []
    this.stopInitializers = [];

    // we need to load the utils & config first
    [
      path.resolve(__dirname, '..', 'initializers', 'utils.js'),
      path.resolve(__dirname, '..', 'initializers', 'config.js')
    ].forEach(async (file) => {
      delete require.cache[require.resolve(file)]
      const InitializerClass = require(file)
      let initializer

      try {
        initializer = new InitializerClass()
      } catch (error) {
        this.fatalError(error, file)
      }

      try {
        initializer.validate()
        await initializer.initialize(api)
        this.initializers[initializer.name] = initializer
      } catch (error) {
        this.fatalError(error, initializer)
      }
    })

    // load initializers from core
    initializerFiles = initializerFiles.concat(glob.sync(path.join(__dirname, '..', 'initializers', '**', '*.js')))

    // load initializers from project
    api.config.general.paths.initializer.forEach((startPath) => {
      initializerFiles = initializerFiles.concat(glob.sync(path.join(startPath, '**', '*.js')))
    })

    // load initializers from plugins
    for (let pluginName in api.config.plugins) {
      if (api.config.plugins[pluginName] !== false) {
        let pluginPath = api.config.plugins[pluginName].path
        initializerFiles = initializerFiles.concat(glob.sync(path.join(pluginPath, 'initializers', '**', '*.js')))
      }
    }

    initializerFiles = api.utils.arrayUniqueify(initializerFiles)

    initializerFiles.forEach((f) => {
      let file = path.normalize(f)
      let fileParts = file.split('.')
      let ext = fileParts[(fileParts.length - 1)]
      if (ext !== 'js') { return }

      delete require.cache[require.resolve(file)]
      const InitializerClass = require(file)
      let initializer

      try {
        initializer = new InitializerClass()
      } catch (error) {
        this.fatalError(error, file)
      }

      // check if initializer already exists (exclude utils and config)
      if (
        this.initializers[initializer.name] &&
        file !== path.resolve(__dirname, '..', 'initializers', 'utils.js') &&
        file !== path.resolve(__dirname, '..', 'initializers', 'config.js')
      ) {
        let warningMessage = `an existing intializer with the same name \`${initializer.name}\` will be overridden by the file ${file}`
        if (api.log) { api.log(warningMessage, 'warning') } else { console.warn(warningMessage) }
      } else {
        initializer.validate()
        this.initializers[initializer.name] = initializer
      }

      let initializeFunction = async () => {
        api.watchFileAndAct(file, async () => {
          api.log(`*** Rebooting due to initializer change (${file}) ***`, 'info')
          await api.commands.restart()
        })

        if (typeof initializer.initialize === 'function') {
          if (typeof api.log === 'function') { api.log(`Loading initializer: ${initializer.name}`, 'debug', file) }
          try {
            await initializer.initialize()
            try { api.log(`Loaded initializer: ${initializer.name}`, 'debug', file) } catch (e) { }
          } catch (error) {
            let message = `Exception occured in initializer \`${initializer.name}\` during load`
            try {
              api.log(message, 'warning', error.toString())
            } catch (_error) {
              console.error(message)
            }
            throw error
          }
        }
      }

      let startFunction = async () => {
        if (typeof initializer.start === 'function') {
          if (typeof api.log === 'function') { api.log(`Starting initializer: ${initializer.name}`, 'debug', file) }
          try {
            await initializer.start()
            api.log(`Started initializer: ${initializer.name}`, 'debug', file)
          } catch (error) {
            api.log(`Exception occured in initializer: ${initializer.name} during start`, 'warning', error.toString())
            throw error
          }
        }
      }

      let stopFunction = async () => {
        if (typeof initializer.stop === 'function') {
          if (typeof api.log === 'function') { api.log(`Stopping initializer: ${initializer.name}`, 'debug', file) }
          try {
            await initializer.stop()
            api.log(`Stopped initializer: ${initializer.name}`, 'debug', file)
          } catch (error) {
            api.log(`Exception occured in initializer: ${initializer.name} during stop`, 'warning', error.toString())
            throw error
          }
        }
      }

      if (loadInitializerRankings[initializer.loadPriority] === undefined) { loadInitializerRankings[initializer.loadPriority] = [] }
      if (startInitializerRankings[initializer.startPriority] === undefined) { startInitializerRankings[initializer.startPriority] = [] }
      if (stopInitializerRankings[initializer.stopPriority] === undefined) { stopInitializerRankings[initializer.stopPriority] = [] }

      if (initializer.loadPriority > 0) { loadInitializerRankings[initializer.loadPriority].push(initializeFunction) }
      if (initializer.startPriority > 0) { startInitializerRankings[initializer.startPriority].push(startFunction) }
      if (initializer.stopPriority > 0) { stopInitializerRankings[initializer.stopPriority].push(stopFunction) }
    })

    // flatten all the ordered initializer methods
    this.loadInitializers = this.flattenOrderedInitialzer(loadInitializerRankings)
    this.startInitializers = this.flattenOrderedInitialzer(startInitializerRankings)
    this.stopInitializers = this.flattenOrderedInitialzer(stopInitializerRankings)

    try {
      await api.utils.asyncWaterfall(this.loadInitializers)
    } catch (error) {
      return this.fatalError(error, 'initialize')
    }

    api.initialized = true

    return api
  }

  async start (params) {
    if (!params) { params = {} }

    if (api.initialized !== true) {
      await this.initialize(params)
    }

    api.running = true
    api.log('*** Starting ActionHero ***', 'notice')

    this.startInitializers.push(() => {
      api.bootTime = new Date().getTime()
      if (this.startCount === 0) {
        api.log('*** ActionHero Started ***', 'alert')
        this.startCount++
      } else {
        api.log('*** ActionHero Restarted ***', 'alert')
      }
    })

    try {
      await api.utils.asyncWaterfall(this.startInitializers)
    } catch (error) {
      return this.fatalError(error, 'start')
    }

    return api
  }

  async stop () {
    if (api.running === true) {
      api.shuttingDown = true
      api.running = false
      api.initialized = false

      api.log('stopping process...', 'notice')

      this.stopInitializers.push(async () => {
        api.pids.clearPidFile()
        api.log('*** ActionHero Stopped ***', 'alert')
        api.log('***', 'debug')
        delete api.shuttingDown
        // reset initializers to prevent duplicate check on restart
        this.initializers = {}
      })

      try {
        await api.utils.asyncWaterfall(this.stopInitializers)
      } catch (error) {
        return this.fatalError(error, 'stop')
      }
      return api
    } else if (api.shuttingDown === true) {
      // double sigterm; ignore it
    } else {
      let message = 'Cannot shut down actionhero, not running'
      if (api.log) {
        api.log(message, 'error')
      } else {
        console.log(message)
      }
      return api
    }
  }

  async restart () {
    if (api.running === true) {
      await this.stop()
      await this.start(api._startingParams)
    } else {
      await this.start(api._startingParams)
    }
    return api
  }

  // HELPERS

  async fatalError (errors, type) {
    if (errors && !(errors instanceof Array)) { errors = [errors] }
    if (errors) {
      if (api.log) {
        api.log(`Error with initializer step: ${type}`, 'emerg')
        errors.forEach((error) => { api.log(error.stack, 'emerg') })
      } else {
        console.error('Error with initializer step: ' + type)
        errors.forEach((error) => { console.error(error.stack) })
      }
      await api.commands.stop.call(api)
      process.exit(1)
    }
  }

  flattenOrderedInitialzer (collection) {
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
}

function sortNumber (a, b) { return a - b }
