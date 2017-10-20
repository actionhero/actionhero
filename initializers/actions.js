'use strict'

/**
 * Server connection handling.
 *
 * @namespace api.actions
 * @property {Object} actions - Dictionary of available connections, orginized by version.
 * @property {Object} versions - Dictionary of available action versions.
 * @property {Object} middleware - Dictionary of loaded middleware modules.
 * @property {Array} globalMiddleware - Array of global middleware modules.
 */

module.exports = {
  loadPriority: 410,
  initialize: function (api, next) {
    api.actions = {}
    api.actions.actions = {}
    api.actions.versions = {}

    api.actions.middleware = {}
    api.actions.globalMiddleware = []

    /**
     * Add a middleware component avaialable to pre or post-process actions.
     *
     * @param {object} data The middleware definition to add.
     * @memberOf api.actions
     * @see ActionHero~ActionMiddleware
     */
    api.actions.addMiddleware = function (data) {
      if (!data.name) { throw new Error('middleware.name is required') }
      if (!data.priority) { data.priority = api.config.general.defaultMiddlewarePriority }
      data.priority = Number(data.priority)
      api.actions.middleware[data.name] = data
      if (data.global === true) {
        api.actions.globalMiddleware.push(data.name)
        api.utils.sortGlobalMiddleware(api.actions.globalMiddleware, api.actions.middleware)
      }
    }

    api.actions.validateAction = function (action) {
      const fail = (msg) => {
        return next(new Error(msg))
      }

      if (action.inputs === undefined) {
        action.inputs = {}
      }

      if (typeof action.name !== 'string' || action.name.length < 1) {
        fail('an action is missing \'action.name\'')
        return false
      } else if (typeof action.description !== 'string' || action.description.length < 1) {
        fail('Action ' + action.name + ' is missing \'action.description\'')
        return false
      } else if (typeof action.run !== 'function') {
        fail('Action ' + action.name + ' has no run method')
        return false
      } else if (api.connections !== null && api.connections.allowedVerbs.indexOf(action.name) >= 0) {
        fail(action.name + ' is a reserved verb for connections. choose a new name')
        return false
      } else {
        return true
      }
    }

    api.actions.loadFile = function (fullFilePath, reload) {
      if (reload === null) { reload = false }

      const loadMessage = (action) => {
        if (reload) {
          api.log(`action reloaded: ${action.name} @ v${action.version}, ${fullFilePath}`, 'debug')
        } else {
          api.log(`action loaded: ${action.name} @ v${action.version}, ${fullFilePath}`, 'debug')
        }
      }

      api.watchFileAndAct(fullFilePath, function () {
        api.actions.loadFile(fullFilePath, true)
        api.params.buildPostVariables()
        api.routes.loadRoutes()
      })

      let action

      try {
        const collection = require(fullFilePath)
        for (let i in collection) {
          action = collection[i]
          if (action.version === null || action.version === undefined) { action.version = 1.0 }
          if (api.actions.actions[action.name] === null || api.actions.actions[action.name] === undefined) {
            api.actions.actions[action.name] = {}
          }
          api.actions.actions[action.name][action.version] = action
          if (api.actions.versions[action.name] === null || api.actions.versions[action.name] === undefined) {
            api.actions.versions[action.name] = []
          }
          api.actions.versions[action.name].push(action.version)
          api.actions.versions[action.name].sort()
          api.actions.validateAction(api.actions.actions[action.name][action.version])
          loadMessage(action)
        }
      } catch (error) {
        try {
          api.exceptionHandlers.loader(fullFilePath, error)
          delete api.actions.actions[action.name][action.version]
        } catch (err2) {
          throw error
        }
      }
    }

    api.config.general.paths.action.forEach(function (p) {
      api.utils.recursiveDirectoryGlob(p).forEach(function (f) {
        api.actions.loadFile(f)
      })
    })

    next()
  }
}
