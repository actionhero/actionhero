'use strict'

const ActionHero = require('./../index.js')

module.exports = class Connections extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'connections'
    this.loadPriority = 400
  }

  initialize (api) {
    api.connections = {
      connections: {},
      middleware: {},
      globalMiddleware: [],

      allowedVerbs: [
        'quit',
        'exit',
        'documentation',
        'paramAdd',
        'paramDelete',
        'paramView',
        'paramsView',
        'paramsDelete',
        'roomAdd',
        'roomLeave',
        'roomView',
        'detailsView',
        'say'
      ],

      apply: async (connectionId, method, args) => {
        return api.redis.doCluster('api.connections.applyResponder', [connectionId, method, args], connectionId, true)
      },

      applyResponder: async (connectionId, method, args) => {
        const connection = api.connections.connections[connectionId]
        if (!connection) { return }

        if (method && args) {
          if (method === 'sendMessage' || method === 'sendFile') {
            await connection[method](args)
          } else {
            await connection[method].apply(connection, args)
          }
        }
        return api.connections.cleanConnection(connection)
      },

      addMiddleware: (data) => {
        if (!data.name) { throw new Error('middleware.name is required') }
        if (!data.priority) { data.priority = api.config.general.defaultMiddlewarePriority }
        data.priority = Number(data.priority)
        api.connections.middleware[data.name] = data

        api.connections.globalMiddleware.push(data.name)
        api.connections.globalMiddleware.sort((a, b) => {
          if (api.connections.middleware[a].priority > api.connections.middleware[b].priority) {
            return 1
          } else {
            return -1
          }
        })
      },

      cleanConnection: (connection) => {
        let clean = {}
        for (let i in connection) {
          if (i !== 'rawConnection') {
            clean[i] = connection[i]
          }
        }
        return clean
      }
    }
  }
}
