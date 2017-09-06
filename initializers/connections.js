'use strict'

const uuid = require('uuid')

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

        this.globalMiddleware.push(data.name)
        this.globalMiddleware.sort((a, b) => {
          if (api.connections.middleware[a].priority > api.connections.middleware[b].priority) {
            return 1
          } else {
            return -1
          }
        })
      }
    }

    // {type: type, remotePort: remotePort, remoteIP: remoteIP, rawConnection: rawConnection}
    // id is optional and will be generated if missing
    api.Connection = class Connection {
      constructor (data) {
        this.setup(data)
        api.connections.connections[this.id] = this

        api.connections.globalMiddleware.forEach((middlewareName) => {
          if (typeof api.connections.middleware[middlewareName].create === 'function') {
            api.connections.middleware[middlewareName].create(this)
          }
        })
      }

      setup (data) {
        if (data.id) {
          this.id = data.id
        } else {
          this.id = this.generateID()
        }
        this.connectedAt = new Date().getTime();

        ['type', 'rawConnection'].forEach((req) => {
          if (data[req] === null || data[req] === undefined) { throw new Error(req + ' is required to create a new connection object') }
          this[req] = data[req]
        });

        ['remotePort', 'remoteIP'].forEach((req) => {
          if (data[req] === null || data[req] === undefined) {
            if (api.config.general.enforceConnectionProperties === true) {
              throw new Error(req + ' is required to create a new connection object')
            } else {
              data[req] = 0 // could be a random uuid as well?
            }
          }
          this[req] = data[req]
        })

        const connectionDefaults = {
          error: null,
          fingerprint: this.id,
          rooms: [],
          params: {},
          pendingActions: 0,
          totalActions: 0,
          messageCount: 0,
          canChat: false
        }

        for (let i in connectionDefaults) {
          if (this[i] === undefined && data[i] !== undefined) { this[i] = data[i] }
          if (this[i] === undefined) { this[i] = connectionDefaults[i] }
        }

        let connection = this
        let server = api.servers.servers[connection.type]
        if (server && server.connectionCustomMethods) {
          for (let name in server.connectionCustomMethods) {
            connection[name] = function () {
              let args = [connection].concat(Array.from(arguments))
              server.connectionCustomMethods[name].apply(null, args)
            }
          }
        }

        api.i18n.invokeConnectionLocale(this)
      }

      localize (message) {
        // this.locale will be sourced automatically
        return api.i18n.localize(message, this)
      }

      generateID () {
        return uuid.v4()
      }

      destroy () {
        this.destroyed = true

        api.connections.globalMiddleware.forEach((middlewareName) => {
          if (typeof api.connections.middleware[middlewareName].destroy === 'function') {
            api.connections.middleware[middlewareName].destroy(this)
          }
        })

        if (this.canChat === true) {
          this.rooms.forEach((room) => {
            api.chatRoom.removeMember(this.id, room)
          })
        }

        const server = api.servers.servers[this.type]

        if (server) {
          if (server.attributes.logExits === true) {
            server.log('connection closed', 'info', {to: this.remoteIP})
          }
          if (typeof server.goodbye === 'function') { server.goodbye(this) }
        }

        delete api.connections.connections[this.id]
      }

      set (key, value) {
        this[key] = value
      }

      async verbs (verb, words) {
        let key
        let value
        let room
        const server = api.servers.servers[this.type]
        const allowedVerbs = server.attributes.verbs

        if (!(words instanceof Array)) { words = [words] }

        if (server && allowedVerbs.indexOf(verb) >= 0) {
          server.log('verb', 'debug', {verb: verb, to: this.remoteIP, params: JSON.stringify(words)})

          // TODO: make this a case statement
          // TODO: investigage allowedVerbs being an array of Constatnts or Symbols

          if (verb === 'quit' || verb === 'exit') {
            server.goodbye(this)
            return
          }

          if (verb === 'paramAdd') {
            key = words[0]
            value = words[1]
            if ((words[0]) && (words[0].indexOf('=') >= 0)) {
              let parts = words[0].split('=')
              key = parts[0]
              value = parts[1]
            }
            if (api.config.general.disableParamScrubbing || api.params.postVariables.indexOf(key) > 0) {
              this.params[key] = value
            }
            return
          }

          if (verb === 'paramDelete') {
            key = words[0]
            delete this.params[key]
            return
          }

          if (verb === 'paramView') {
            key = words[0]
            return this.params[key]
          }

          if (verb === 'paramsView') {
            return this.params
          }

          if (verb === 'paramsDelete') {
            for (let i in this.params) { delete this.params[i] }
            return
          }

          if (verb === 'roomAdd') {
            room = words[0]
            return api.chatRoom.addMember(this.id, room)
          }

          if (verb === 'roomLeave') {
            room = words[0]
            return api.chatRoom.removeMember(this.id, room)
          }

          if (verb === 'roomView') {
            room = words[0]
            if (this.rooms.indexOf(room) > -1) {
              return api.chatRoom.roomStatus(room)
            }

            throw new Error('not member of room ' + room)
          }

          if (verb === 'detailsView') {
            return {
              id: this.id,
              fingerprint: this.fingerprint,
              remoteIP: this.remoteIP,
              remotePort: this.remotePort,
              params: this.params,
              connectedAt: this.connectedAt,
              rooms: this.rooms,
              totalActions: this.totalActions,
              pendingActions: this.pendingActions
            }
          }

          if (verb === 'documentation') {
            return api.documentation.documentation
          }

          if (verb === 'say') {
            room = words.shift()
            await api.chatRoom.broadcast(this, room, words.join(' '))
            return
          }

          throw new Error(await api.config.errors.verbNotFound(this, verb))
        } else {
          throw new Error(await api.config.errors.verbNotAllowed(this, verb))
        }
      }
    }
  }
}
