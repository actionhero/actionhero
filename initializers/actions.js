'use strict'

const glob = require('glob')
const path = require('path')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * This callback is displayed as part of the Requester class.
 * @callback ActionHero~ActionCallback
 * @param {Object} data - The data object.
 * @see ActionHero~ActionMiddleware
 */

/**
 * Middleware definition for Actions
 *
 * @async
 * @typedef {Object} ActionHero~ActionMiddleware
 * @property {string} name - Unique name for the middleware.
 * @property {Boolean} global - Is this middleware applied to all actions?
 * @property {Number} priority - Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`.
 * @property {ActionHero~ActionCallback} preProcessor - Called berore the action runs.  Has access to all params, before sanitizartion.  Can modify the data object for use in actions.
 * @property {ActionHero~ActionCallback} postProcessor - Called after the action runs.
 * @see api.actions.addMiddleware
 * @example
var middleware = {
  name: 'userId checker',
  global: false,
  priority: 1000,
  preProcessor: async (data) => {
    if(!data.params.userId){
      throw new Error('All actions require a userId')
    }
  },
  postProcessor: async (data) => {
    if(data.thing.stuff == false){ data.toRender = false }
  }
}

api.actions.addMiddleware(middleware);
 */

/**
 * Server connection handling.
 *
 * @namespace api.actions
 * @property {Object} actions - Dictionary of available connections, orginized by version.
 * @property {Object} versions - Dictionary of available action versions.
 * @property {Object} middleware - Dictionary of loaded middleware modules.
 * @property {Array} globalMiddleware - Array of global middleware modules.
 * @extends ActionHero.Initializer
 */

module.exports = class Actions extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'actions'
    this.loadPriority = 410
  }

  async initialize () {
    api.actions = {
      actions: {},
      versions: {},
      middleware: {},
      globalMiddleware: []
    }

    /**
     * Add a middleware component avaialable to pre or post-process actions.
     *
     * @param {object} data The middleware definition to add.
     * @memberOf api.actions
     * @see ActionHero~ActionMiddleware
     */
    api.actions.addMiddleware = (data) => {
      if (!data.name) { throw new Error('middleware.name is required') }
      if (!data.priority) { data.priority = api.config.general.defaultMiddlewarePriority }
      data.priority = Number(data.priority)
      api.actions.middleware[data.name] = data
      if (data.global === true) {
        api.actions.globalMiddleware.push(data.name)
        api.utils.sortGlobalMiddleware(api.actions.globalMiddleware, api.actions.middleware)
      }
    }

    api.actions.loadFile = async (fullFilePath, reload) => {
      if (reload === null) { reload = false }

      const loadMessage = (action) => {
        if (reload) {
          api.log(`action reloaded: ${action.name} @ v${action.version}, ${fullFilePath}`, 'debug')
        } else {
          api.log(`action loaded: ${action.name} @ v${action.version}, ${fullFilePath}`, 'debug')
        }
      }

      api.watchFileAndAct(fullFilePath, () => {
        api.actions.loadFile(fullFilePath, true)
        api.params.buildPostVariables()
        api.routes.loadRoutes()
      })

      let action

      try {
        let collection = require(fullFilePath)
        if (typeof collection === 'function') { collection = [collection] }
        for (let i in collection) {
          action = new collection[i]()
          await action.validate(api)
          if (!api.actions.actions[action.name]) { api.actions.actions[action.name] = {} }
          if (!api.actions.versions[action.name]) { api.actions.versions[action.name] = [] }

          if (api.actions.actions[action.name][action.version] && !reload) {
            api.log(`an existing action with the same name \`${action.name}\` will be overridden by the file ${fullFilePath}`, 'warning')
          }

          api.actions.actions[action.name][action.version] = action
          api.actions.versions[action.name].push(action.version)
          api.actions.versions[action.name].sort()
          loadMessage(action)
        }
      } catch (error) {
        try {
          api.exceptionHandlers.loader(fullFilePath, error)
          delete api.actions.actions[action.name][action.version]
        } catch (_error) {
          throw error
        }
      }
    }

    for (let i in api.config.general.paths.action) {
      let p = api.config.general.paths.action[i]
      let files = glob.sync(path.join(p, '**', '*.js'))
      for (let j in files) { await api.actions.loadFile(files[j]) }
    }

    for (let pluginName in api.config.plugins) {
      if (api.config.plugins[pluginName].actions !== false) {
        let pluginPath = api.config.plugins[pluginName].path
        let files = glob.sync(path.join(pluginPath, 'actions', '**', '*.js'))
        for (let j in files) { await api.actions.loadFile(files[j]) }
      }
    }
  }
}
