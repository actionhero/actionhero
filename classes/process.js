'use strict'

const path = require('path')
const packageJson = require(path.join(__dirname, '..', 'package.json'))

module.exports = class Process {
  constructor () {
    this.initializers = {}
    this.startCount = 0

    let projectRoot = process.cwd()
    if (process.env.project_root) {
      projectRoot = process.env.project_root
    } else if (process.env.projectRoot) {
      projectRoot = process.env.projectRoot
    } else if (process.env.PROJECT_ROOT) {
      projectRoot = process.env.PROJECT_ROOT
    }

    this.api = {
      running: false,
      initialized: false,
      shuttingDown: false,
      projectRoot: projectRoot,
      bootTime: null
    }

    this.api.commands = {
      initialize: async (params) => { return this.initialize(params) },
      start: async (params) => { return this.start(params) },
      stop: async (callback) => { return this.stop() },
      restart: async (callback) => { return this.restart() }
    }

    this.api.actionheroVersion = packageJson.version
  }

  async initialize (params) {
    if (!params) { params = {} }

    let api = this.api
    api._startingParams = params

    let loadInitializerRankings = {}
    let startInitializerRankings = {}
    let stopInitializerRankings = {}
    let customInitializers = []
    let duplicatedInitializers = []

    this.loadInitializers = []
    this.startInitializers = []
    this.stopInitializers = [];

    // we need to load the utils & config first
    [
      path.resolve(__dirname, '..', 'initializers', 'utils.js'),
      path.resolve(__dirname, '..', 'initializers', 'config.js')
    ].forEach(async (file) => {
      let filename = file.replace(/^.*[\\/]/, '')
      let initializer = filename.split('.')[0]
      delete require.cache[require.resolve(file)]
      this.initializers[initializer] = require(file)
      try {
        await this.initializers[initializer].initialize(api)
      } catch (error) {
        this.fatalError(api, error, initializer)
      }
    })

    api.config.general.paths.initializer.forEach((startPath) => {
      customInitializers = customInitializers.concat(api.utils.recursiveDirectoryGlob(startPath))
    })

    // load all other initializers
    let initializers = api.utils.arrayUniqueify(
      api.utils.recursiveDirectoryGlob(path.join(__dirname, '..', 'initializers')).sort().concat(customInitializers.sort())
    )

    initializers.forEach((f) => {
      let file = path.normalize(f)
      let baseName = path.basename(f).split('.')[0]
      let fileParts = file.split('.')
      let ext = fileParts[(fileParts.length - 1)]

      if (ext !== 'js') { return }

      let initializer = this.initializers[baseName]

      // check if initializer already exists (exclude utils and config)
      if (
        initializer &&
        file !== path.resolve(__dirname, '..', 'initializers', 'utils.js') &&
        file !== path.resolve(__dirname, '..', 'initializers', 'config.js')
      ) {
        duplicatedInitializers.push(file)
      } else {
        delete require.cache[require.resolve(file)]
        initializer = require(file)
      }

      let loadFunction = async () => {
        api.watchFileAndAct(file, async () => {
          api.log(`*** Rebooting due to initializer change (${file}) ***`, 'info')
          await api.commands.restart()
        })

        if (typeof initializer.initialize === 'function') {
          if (typeof api.log === 'function') { api.log(`Loading initializer: ${baseName}`, 'debug', file) }
          try {
            await initializer.initialize(api)
            try { api.log(`Loaded initializer: ${baseName}`, 'debug', file) } catch (e) { }
          } catch (error) {
            let message = `Exception occured in initializer \`${baseName}\` during load`
            try {
              api.log(message, 'warning', error.toString())
            } catch (error) {
              console.error(message)
            }
            throw error
          }
        }
      }

      let startFunction = async () => {
        if (typeof initializer.start === 'function') {
          if (typeof api.log === 'function') { api.log(`Starting initializer: ${baseName}`, 'debug', file) }
          try {
            await initializer.start(api)
            api.log(`Started initializer: ${baseName}`, 'debug', file)
          } catch (error) {
            api.log(`Exception occured in initializer: ${baseName} during start`, 'warning', error.toString())
            throw error
          }
        }
      }

      let stopFunction = async () => {
        if (typeof initializer.stop === 'function') {
          if (typeof api.log === 'function') { api.log(`Stopping initializer: ${baseName}`, 'debug', file) }
          try {
            await initializer.stop(api)
            api.log(`Stopped initializer: ${baseName}`, 'debug', file)
          } catch (error) {
            api.log(`Exception occured in initializer: ${baseName} during stop`, 'warning', error.toString())
            throw error
          }
        }
      }

      if (initializer.loadPriority === undefined) { initializer.loadPriority = 1000 }
      if (initializer.startPriority === undefined) { initializer.startPriority = 1000 }
      if (initializer.stopPriority === undefined) { initializer.stopPriority = 1000 }

      if (loadInitializerRankings[initializer.loadPriority] === undefined) { loadInitializerRankings[initializer.loadPriority] = [] }
      if (startInitializerRankings[initializer.startPriority] === undefined) { startInitializerRankings[initializer.startPriority] = [] }
      if (stopInitializerRankings[initializer.stopPriority] === undefined) { stopInitializerRankings[initializer.stopPriority] = [] }

      if (initializer.loadPriority > 0) { loadInitializerRankings[initializer.loadPriority].push(loadFunction) }
      if (initializer.startPriority > 0) { startInitializerRankings[initializer.startPriority].push(startFunction) }
      if (initializer.stopPriority > 0) { stopInitializerRankings[initializer.stopPriority].push(stopFunction) }

      this.initializers[baseName] = initializer // re-assign with changes
    })

    // flatten all the ordered initializer methods
    this.loadInitializers = this.flattenOrderedInitialzer(loadInitializerRankings)
    this.startInitializers = this.flattenOrderedInitialzer(startInitializerRankings)
    this.stopInitializers = this.flattenOrderedInitialzer(stopInitializerRankings)

    try {
      await api.utils.asyncWaterfall(this.loadInitializers)
    } catch (error) {
      return this.fatalError(api, error, 'initialize')
    }

    api.initialized = true

    if (duplicatedInitializers.length > 0) {
      duplicatedInitializers.forEach(initializer => api.log(`Initializer ${initializer} already exists!`, 'error'))
      await api.commands.stop()
      return process.exit(1)
    }

    return api
  }

  async start (params) {
    let api = this.api
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
      } else {
        api.log('*** ActionHero Restarted ***', 'alert')
      }
    })

    try {
      await api.utils.asyncWaterfall(this.startInitializers)
    } catch (error) {
      return this.fatalError(api, error, 'start')
    }

    return api
  }

  async stop () {
    let api = this.api
    if (api.running === true) {
      api.shuttingDown = true
      api.running = false
      api.initialized = false

      api.log('Shutting down open servers and stopping task processing...', 'notice')

      this.stopInitializers.push(async () => {
        api.unWatchAllFiles()
        api.pids.clearPidFile()
        api.log('*** ActionHero Stopped ***', 'alert')
        api.log('***', 'debug')
        delete api.shuttingDown
        // reset initializers to prevent duplicate check on restart
        this.initializers = {}
        await new Promise((resolve) => process.nextTick(resolve))
      })

      try {
        await api.utils.asyncWaterfall(this.stopInitializers)
      } catch (error) {
        return this.fatalError(api, error, 'stop')
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
    let api = this.api
    if (api.running === true) {
      await this.stop()
      await this.start(api._startingParams)
    } else {
      await this.start(api._startingParams)
    }
    return api
  }

  // HELPERS

  async fatalError (api, errors, type) {
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
