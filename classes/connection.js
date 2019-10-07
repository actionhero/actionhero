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
   * @property {Number} messageId      - The Id of the latest message this connection has sent to the server.
   * @property {Number} connectedAt    - The timestamp of when this connection was created.
   * @property {string} remoteIP       - The remote connection's IP address (as best as we can tell).  May be either IPv4 or IPv6.
   * @property {Number} remotePort     - The remote connection's port.
   * @property {Object} rawConnection  - Any connection-specific properties.  For, example, the HTTP res and req objects for `web` connections are here
   *
   * @see ActionHero.Server
   *
   * @param  {Object} data The specifics of this connection
   * @param  {Boolean} callCreateMethods The specifics of this connection will calls create methods in the constructor. This property will exist for backward compatibility. If you want to construct connection and call create methods within async, you can use `await ActionHero.Connection.createAsync(details)` for construction.
   */
  constructor (data, callCreateMethods = true) {
    // Only in files required by `index.js` do we need to delay the loading of the API object
    // This is due to cyclical require issues
    api = require('./../index.js').api

    this.setup(data)

    if (callCreateMethods) {
      this.constructor.callConnectionCreateMethods(this)
    }

    api.connections.connections[this.id] = this
  }

  /**
   * @async
   * @static
   * @function createAsync
   * @memberof ActionHero.Connection
   * @param  {Object}  data The specifics of this connection
   */
  static async createAsync (data) {
    const connection = new this(data, false)

    await this.callConnectionCreateMethods(connection)

    return connection
  }

  /**
   * @private
   * @async
   * @static
   * @function callConnectionCreateMethods
   * @memberof ActionHero.Connection
   * @param  {Object}  connection ActionHero.Connection
   */
  static async callConnectionCreateMethods (connection) {
    for (const i in api.connections.globalMiddleware) {
      const middlewareName = api.connections.globalMiddleware[i]
      if (typeof api.connections.middleware[middlewareName].create === 'function') {
        await api.connections.middleware[middlewareName].create(connection)
      }
    }
  }

  setup (data) {
    if (data.id) {
      this.id = data.id
    } else {
      this.id = this.generateID()
    }
    this.connectedAt = new Date().getTime();

    ['type', 'rawConnection'].forEach((req) => {
      if (data[req] === null || data[req] === undefined) { throw new Error(`${req} is required to create a new connection object`) }
      this[req] = data[req]
    });

    ['remotePort', 'remoteIP'].forEach((req) => {
      if (data[req] === null || data[req] === undefined) {
        if (api.config.general.enforceConnectionProperties === true) {
          throw new Error(`${req} is required to create a new connection object`)
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
      messageId: 0,
      canChat: false
    }

    for (const i in connectionDefaults) {
      if (this[i] === undefined && data[i] !== undefined) { this[i] = data[i] }
      if (this[i] === undefined) { this[i] = connectionDefaults[i] }
    }

    const connection = this
    const server = api.servers.servers[connection.type]
    if (server && server.connectionCustomMethods) {
      for (const name in server.connectionCustomMethods) {
        connection[name] = async (...args) => {
          args.unshift(connection)
          return server.connectionCustomMethods[name].apply(null, args)
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

  /**
   * Send a file to a connection (usually in the context of an Action).  Be sure to set `data.toRender = false` in the action!
   * Uses Server#processFile and will set `connection.params.file = path`
   *
   * @function sendFile
   * @memberof ActionHero.Connection
   * @param  {String} path The path of the file to send, within one of your `api.config.general.paths.public` directories.
   * @tutorial file-server
   */

  /**
   * Send a message to a connection.  Uses Server#sendMessage.
   *
   * @function sendMessage
   * @memberof ActionHero.Connection
   * @param  {String} message The message to send.  Can be an Object or String... but it depends on the server in use.
   */

  generateID () {
    return uuid.v4()
  }

  /**
   * Destroys the connection.  If the type/sever of the connection has a goodbye message, it will be sent.  The connection will be removed from all rooms.  The connection's socket will be closed when possible.
   *
   * @function destroy
   * @memberof ActionHero.Connection
   */
  async destroy () {
    this.destroyed = true

    for (const i in api.connections.globalMiddleware) {
      const middlewareName = api.connections.globalMiddleware[i]
      if (typeof api.connections.middleware[middlewareName].destroy === 'function') {
        await api.connections.middleware[middlewareName].destroy(this)
      }
    }

    if (this.canChat === true) {
      const promises = []
      for (const i in this.rooms) {
        const room = this.rooms[i]
        promises.push(api.chatRoom.removeMember(this.id, room))
      }
      await Promise.all(promises)
    }

    const server = api.servers.servers[this.type]

    if (server) {
      if (server.attributes.logExits === true) {
        server.log('connection closed', 'info', { to: this.remoteIP })
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
      server.log('verb', 'debug', { verb: verb, to: this.remoteIP, params: JSON.stringify(words) })

      // TODO: investigate allowedVerbs being an array of Constatnts or Symbols

      switch (verb) {
        case 'quit':
        case 'exit':
          return this.destroy()
        case 'paramAdd':
          key = words[0]
          value = words[1]
          if ((words[0]) && (words[0].indexOf('=') >= 0)) {
            const parts = words[0].split('=')
            key = parts[0]
            value = parts[1]
          }

          if (api.config.general.disableParamScrubbing || api.params.postVariables.indexOf(key) >= 0) {
            this.params[key] = value
          }
          return
        case 'paramDelete':
          key = words[0]
          delete this.params[key]
          return
        case 'paramView':
          key = words[0]
          return this.params[key]
        case 'paramsView':
          return this.params
        case 'paramsDelete':
          for (const i in this.params) { delete this.params[i] }
          return
        case 'roomAdd':
          room = words[0]
          return api.chatRoom.addMember(this.id, room)
        case 'roomLeave':
          room = words[0]
          return api.chatRoom.removeMember(this.id, room)
        case 'roomView':
          room = words[0]
          if (this.rooms.indexOf(room) >= 0) {
            return api.chatRoom.roomStatus(room)
          }
          throw new Error(await api.config.errors.connectionNotInRoom(this, room))
        case 'detailsView':
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
        case 'documentation':
          return api.documentation.documentation
        case 'say':
          room = words.shift()
          await api.chatRoom.broadcast(this, room, words.join(' '))
          return
      }

      const error = new Error(await api.config.errors.verbNotFound(this, verb))
      error.verbNotFound = true
      throw error
    } else {
      const error = new Error(await api.config.errors.verbNotAllowed(this, verb))
      error.verbNotFound = true
      throw error
    }
  }
}
