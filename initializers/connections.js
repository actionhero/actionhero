'use strict'

const cleanConnection = (connection) => {
  let clean = {}
  for (let i in connection) {
    if (i !== 'rawConnection') {
      clean[i] = connection[i]
    }
  }
  return clean
}

module.exports = {
  loadPriority: 400,
  initialize: function (api) {
    api.connections = {

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

      connections: {},

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
        return cleanConnection(connection)
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
      }
    }
  }
}
