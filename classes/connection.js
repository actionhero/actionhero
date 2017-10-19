const uuid = require('uuid')
let api

module.exports = class Connection {
  /**
   * The generic represenation of a connection for all server types is an ActionHero.Connection.  You will never be creating these yourself via an action or task, but you will find them in your Actons and Action Middleware.
   * All Connections share common properties:
   *
   * @class ActionHero.Connection
   *
   * @property {string} id             - A unique string identifer for this connection.
   * @property {string} fingerprint    - A unique string identifer for this connection, but common among subsequent requests.  For example, all web requests from the same client have the same fingerprint, but not the same id.
   * @property {string} type           - The type of this connection (web, websocket, etc) as defined by the name of the server which created it.
   * @property {Array} rooms           - Any rooms this connection is a member of, it it can chat.
   * @property {Boolean} canChat       - Can this connection use the chat system?
   * @property {Object} params         - Any params this connection has saved for use in subsequent Actions.
   * @property {Number} pendingActions - How many actions are currently running for this connection?  Most server types have a limit.
   * @property {Number} totalActions   - How many actions has this connection run since it connected.
   * @property {Number} messageCount   - How many messages has the server sent to thie connection since it connected.
   * @property {Number} connectedAt    - The timestamp of when this connection was created.
   * @property {string} remoteIP       - The remote connection's IP address (as best as we can tell).  May be either IPv4 or IPv6.
   * @property {Number} remotePort     - The remote connection's port.
   * @property {Object} rawConnection  - Any connection-specific properties.  For, example, the HTTP res and req objects for `web` connections are here
   *
   * @see ActionHero.Server
   *
   * @param  {Object} data The specifics of this connection
   */
  constructor (data) {
    // Only in files required by `index.js` do we need to delay the loading of the API object
    // This is due to cyclical require issues
    api = require('./../index.js').api

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

  /**
   * Localize a key for this connection's locale.  Keys usually look like `messages.errors.notFound`, and are defined in your locales directory.  Strings can be interploated as well, connection.localize('the count was {{count}}', {count: 4})
   *
   * @function localize
   * @memberof ActionHero.Connection
   * @param  {String} message The mesage key to be translated.
   * @return {String}         The translated message.  If an appropraite translation cannot be found, the key will be returned.
   * @see api.i18n
   */
  localize (message) {
    // this.locale will be sourced automatically
    return api.i18n.localize(message, this)
  }

  generateID () {
    return uuid.v4()
  }

  /**
   * Destroys the connection.  If the type/sever of the connection has a goodbye message, it will be sent.  The connection will be removed from all rooms.  The connection's socket will be closed when possible.
   *
   * @function destroy
   * @memberof ActionHero.Connection
   */
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

  /**
   * @private
   * @function set
   * @memberof ActionHero.Connection
   */
  set (key, value) {
    this[key] = value
  }

  /**
   * Try to run a verb command for a connection
   *
   * @function verbs
   * @memberof ActionHero.Connection
   * @async
   * @private
   * @param  {String}  verb  The verb
   * @param  {Array}   words All the arguments sent by the client
   * @return {Promise}
   */
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
      // TODO: investigate allowedVerbs being an array of Constatnts or Symbols

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

        if (api.config.general.disableParamScrubbing || api.params.postVariables.indexOf(key) >= 0) {
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
        if (this.rooms.indexOf(room) >= 0) {
          return api.chatRoom.roomStatus(room)
        }

        let error = new Error(await api.config.errors.connectionNotInRoom(this, room))
        throw error
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

      let error = new Error(await api.config.errors.verbNotFound(this, verb))
      error.verbNotFound = true
      throw error
    } else {
      let error = new Error(await api.config.errors.verbNotAllowed(this, verb))
      error.verbNotFound = true
      throw error
    }
  }
}
