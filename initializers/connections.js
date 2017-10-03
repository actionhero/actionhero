'use strict'

const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * This callback is displayed as part of the Requester class.
 * @callback ActionHero~ConnectionCallback
 * @param {Object} connection - The connection being created/destroyed.
 * @see ActionHero~ConnectionMiddleware
 */

/**
 * Middleware definition for processing connection events
 *
 * @typedef {Object} ActionHero~ConnectionMiddleware
 * @property {string} name - Unique name for the middleware.
 * @property {Number} priority - Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`.
 * @property {ActionHero~ConnectionCallback} create - Called for each new connection when it is created.
 * @property {ActionHero~ConnectionCallback} destroy - Called for each connection before it is destroyed.
 * @see api.connections.addMiddleware
 * @example
 var connectionMiddleware = {
  name: 'connection middleware',
  priority: 1000,
  create: (connection) => {
    // do stuff
  },
  destroy:(connection) => {
    // do stuff
  }
}

api.connections.addMiddleware(connectionMiddleware)
 */

/**
 * Server connection handling.
 *
 * @namespace api.connections
 * @property {Object} connections - Dictionary of currently-established client connections.
 * @property {Object} middleware - Dictionary of loaded middleware modules.
 * @property {Array} globalMiddleware - Array of global middleware modules.
 * @property {Array} allowedVerbs - Verbs the server will allow clients to send.
 * @extends ActionHero.Initializer
 */
module.exports = class Connections extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'connections'
    this.loadPriority = 400
  }

  initialize () {
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

      /**
       * Find a connection on any server in the cluster and call a method on it.
       *
       * @async
       * @param {String} connectionId The connection's ID
       * @param {String} method the name of the method to call
       * @param {Array} args the arguments to pass to method
       * @return {Promise<Object>} The return value from the remote server (if any)
       * @memberOf api.connections
       */
      apply: async (connectionId, method, args) => {
        return api.redis.doCluster('api.connections.applyResponder', [connectionId, method, args], connectionId, true)
      },

      /**
       * @private
       */
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

      /**
       * Add a middleware component to connection handling.
       *
       * @param {object} data The middleware definition to add.
       * @memberOf api.connections
       * @see ActionHero~ConnectionMiddleware
       */
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

      /**
       * @private
       */
      cleanConnection: (connection) => {
        let clean = {}
        for (let i in connection) {
          if (i !== 'rawConnection' && i !== 'api') {
            try {
              JSON.stringify(connection[i])
              clean[i] = connection[i]
            } catch (error) {}
          }
        }

        return clean
      }
    }
  }
}
