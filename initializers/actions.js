'use strict'

const ActionHero = require('./../index.js')
const api = ActionHero.api

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
      let path = api.config.general.paths.action[i]
      let files = api.utils.recursiveDirectoryGlob(path)
      for (let j in files) { await api.actions.loadFile(files[j]) }
    }
  }
}
