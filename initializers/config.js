'use strict'

const fs = require('fs')
const path = require('path')
const glob = require('glob')
const argv = require('optimist').argv
const ActionHero = require('./../index.js')
const api = ActionHero.api

const RELOAD_DELAY = 2000

/**
 * Countains ActionHero configuration.
 *
 * @namespace api.config
 * @extends ActionHero.Initializer
 */
module.exports = class Config extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'config'
    this.loadPriority = 1
    this.startPriority = 1
    this.stopPriority = 1
  }

  async initialize () {
    if (api._startingParams && api._startingParams.api) {
      api.utils.hashMerge(api, api._startingParams.api)
    }

    api.env = 'development'

    if (argv.NODE_ENV) {
      api.env = argv.NODE_ENV
    } else if (process.env.NODE_ENV) {
      api.env = process.env.NODE_ENV
    }

    // reloading in development mode

    api.watchedFiles = api.watchedFiles || {}
    api.watchFileAndAct = (file, handler) => {
      file = path.normalize(file)

      if (!fs.existsSync(file)) {
        throw new Error(file + ' does not exist, and cannot be watched')
      }

      if (api.config.general.developmentMode === true && !api.watchedFiles[file]) {
        const watcher = fs.watch(file, {persistent: false}, (eventType) => {
          const stats = fs.statSync(file)
          if (
            api.running === true &&
            api.config.general.developmentMode === true &&
            eventType === 'change' &&
            (stats.mtimeMs - api.watchedFiles[file].stats.mtimeMs) >= RELOAD_DELAY
          ) {
            api.watchedFiles[file].stats = stats
            let cleanPath = file
            if (process.platform === 'win32') { cleanPath = file.replace(/\//g, '\\') }
            delete require.cache[require.resolve(cleanPath)]
            setTimeout(() => { api.watchedFiles[file].blocked = false }, 1000)
            handler(file)
          }
        })

        api.watchedFiles[file] = {watcher, stats: fs.statSync(file)}
      }
    }

    api.unWatchAllFiles = () => {
      for (let file in api.watchedFiles) {
        api.watchedFiles[file].watcher.close()
        delete api.watchedFiles[file]
      }
    }

    // We support multiple configuration paths as follows:
    //
    // 1. Use the project 'config' folder, if it exists.
    // 2. "actionhero --config=PATH1 --config=PATH2 --config=PATH3,PATH4"
    // 3. "ACTIONHERO_CONFIG=PATH1,PATH2 npm start"
    //
    // Note that if --config or ACTIONHERO_CONFIG are used, they _overwrite_ the use of the default "config" folder. If
    // you wish to use both, you need to re-specify "config", e.g. "--config=config,local-config". Also, note that
    // specifying multiple --config options on the command line does exactly the same thing as using one parameter with
    // comma separators, however the environment variable method only supports the comma-delimited syntax.
    let configPaths = []

    function addConfigPath (pathToCheck, alreadySplit) {
      if (typeof pathToCheck === 'string') {
        if (!alreadySplit) {
          addConfigPath(pathToCheck.split(','), true)
        } else {
          if (pathToCheck.charAt(0) !== '/') {
            pathToCheck = path.resolve(api.projectRoot, pathToCheck)
          }
          if (fs.existsSync(pathToCheck)) {
            configPaths.push(pathToCheck)
          }
        }
      } else if (Array.isArray(pathToCheck)) {
        pathToCheck.map((entry) => { addConfigPath(entry, alreadySplit) })
      }
    }

    [argv.config, process.env.ACTIONHERO_CONFIG].map((entry) => {
      addConfigPath(entry, false)
    })

    if (configPaths.length < 1) {
      addConfigPath('config', false)
    }

    if (configPaths.length < 1) {
      throw new Error(configPaths + 'No config directory found in this project, specified with --config, or found in process.env.ACTIONHERO_CONFIG')
    }

    const rebootHandler = (file) => {
      api.log(`*** rebooting due to config change (${file}) ***`, 'info')
      delete require.cache[require.resolve(file)]
      api.commands.restart()
    }

    api.loadConfigDirectory = (configPath, watch) => {
      const configFiles = glob.sync(path.join(configPath, '**', '*.js'))

      let loadRetries = 0
      let loadErrors = {}
      for (let i = 0, limit = configFiles.length; (i < limit); i++) {
        const f = configFiles[i]
        try {
          // attempt configuration file load
          let localConfig = require(f)
          if (localConfig['default']) { api.config = api.utils.hashMerge(api.config, localConfig['default'], api) }
          if (localConfig[api.env]) { api.config = api.utils.hashMerge(api.config, localConfig[api.env], api) }
          // configuration file load success: clear retries and
          // errors since progress has been made
          loadRetries = 0
          loadErrors = {}
        } catch (error) {
          // error loading configuration, abort if all remaining
          // configuration files have been tried and failed
          // indicating inability to progress
          loadErrors[f] = {error: error, msg: error.toString()}
          if (++loadRetries === limit - i) {
            Object.keys(loadErrors).forEach((e) => {
              console.log(loadErrors[e].error.stack)
              console.log('')
              delete loadErrors[e].error
            })

            throw new Error('Unable to load configurations, errors: ' + JSON.stringify(loadErrors))
          }
          // adjust configuration files list: remove and push
          // failed configuration to the end of the list and
          // continue with next file at same index
          configFiles.push(configFiles.splice(i--, 1)[0])
          continue
        }

        if (watch !== false) {
          // configuration file loaded: set watch
          api.watchFileAndAct(f, rebootHandler)
        }
      }

      // We load the config twice. Utilize configuration files load order that succeeded on the first pass.
      // This is to allow 'literal' values to be loaded whenever possible, and then for refrences to be resolved
      configFiles.forEach((f) => {
        const localConfig = require(f)
        if (localConfig['default']) { api.config = api.utils.hashMerge(api.config, localConfig['default'], api) }
        if (localConfig[api.env]) { api.config = api.utils.hashMerge(api.config, localConfig[api.env], api) }
      })
    }

    api.config = {}

    // load the default config of actionhero
    api.loadConfigDirectory(path.join(__dirname, '/../config'), false)

    // load the project specific config
    configPaths.map(api.loadConfigDirectory)

    // apply any configChanges
    if (api._startingParams && api._startingParams.configChanges) {
      api.config = api.utils.hashMerge(api.config, api._startingParams.configChanges)
    }
  }

  start () {
    api.log(`environment: ${api.env}`, 'notice')
  }

  stop () {
    api.unWatchAllFiles()
  }
}
