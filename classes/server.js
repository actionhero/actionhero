const EventEmitter = require('events').EventEmitter
const ActionHero = require('./../index.js')
let api

module.exports = class Server extends EventEmitter {
  /**
   * Create a new ActionHero Server. The required properties of an server. These can be defined statically (this.name) or as methods which return a value.
   *
   * @class ActionHero.Server
   *
   * @property {string}   type               - The name & type of the server.
   * @property {Array}    verbs              - What connection verbs can connections of this type use?
   * @property {Object}   config             - Shorthand for `api.config.servers[this.type]`
   * @property {Boolean}  canChat            - Can connections of this server use the chat system?
   * @property {Boolean}  logConnections     - Should we log every new connection?
   * @property {Boolean}  logExits           - Should we log when a connection disconnects/exits?
   * @property {Boolean}  sendWelcomeMessage - Should every new connection of this server type recieve the wecome message (defiend in locales, `actionhero.welcomeMessage`)
   *
   * @tutorial servers
   * @example
const {Server, api} = require('actionhero')

module.exports = class MyServer extends Server {
  constructor () {
    super()
    this.type = '%%name%%'

    this.attributes = {
      canChat: false,
      logConnections: true,
      logExits: true,
      sendWelcomeMessage: false,
      verbs: []
    }
    // this.config will be set to equal api.config.servers[this.type]
  }

  initialize () {
    this.on('connection', (conection) => {

    })

    this.on('actionComplete', (data) => {

    })
  }

  start () {
    // this.buildConnection (data)
    // this.processAction (connection)
    // this.processFile (connection)
  }

  stop () {

  }

  sendMessage (connection, message, messageCount) {

  }

  sendFile (connection, error, fileStream, mime, length, lastModified) {

  }

  goodbye (connection) {

  }
}

  */
  constructor (config) {
    super()

    // Only in files required by `index.js` do we need to delay the loading of the API object
    // This is due to cyclical require issues
    api = require('./../index.js').api

    this.options = {}
    this.attributes = {}
    this.config = config
    this.connectionCustomMethods = {}
    let defaultAttributes = this.defaultAttributes()
    for (let key in defaultAttributes) {
      if (!this.attributes[key]) { this.attributes[key] = defaultAttributes[key] }
      if (typeof this.attributes[key] === 'function') { this.attributes[key] = this[key]() }
    }
  }

  /**
   * Event called when a formal new connection is created for this server type.  This is a resposne to calling ActionHero.Server#buildConnection
   *
   * @event ActionHero.Server#connection
   * @memberof ActionHero.Server
   * @type {object}
   */

  /**
   * Event called when a an action is complete for a connection created by this server.  You may want to send a response to the client as a response to this event.
   *
   * @event ActionHero.Server#actionComplete
   * @memberof ActionHero.Server
   * @type {object}
   * @property {object} data - The same data from the Action.  Includes the connection, response, etc.
   * @see ActionHero.Action
   */

  /**
   * @function initialize
   * @async
   * @memberof ActionHero.Server
   * @description Method run as part of the `initialize` lifecycle of your server.  Ususally configures the server.
   */

  /**
   * @function start
   * @async
   * @memberof ActionHero.Server
   * @description Method run as part of the `start` lifecycle of your server.  Ususally boots the server (listens on port, etc).
   */

  /**
   * @function stop
   * @async
   * @memberof ActionHero.Server
   * @description Method run as part of the `stop` lifecycle of your server.  Ususally configures the server (disconnects from port, etc).
   */

  /**
   * @function sendMessage
   * @async
   * @memberof ActionHero.Server
   * @param  {Object}  connection The connection in question.
   * @param  {Object}  message The message to send.  May be an Object, Array, or String.
   * @param  {Object}  messageCount A count of which message this is to be sent to the client.
   * @description Must be defined explaining how to send a message to an induvidual connection.
   */

  /**
   * @function sendFile
   * @async
   * @memberof ActionHero.Server
   * @param  {Object}  connection The connection in question.
   * @param  {Error}   error If there was any errror finding or reading this file.
   * @param  {Object}  fileStream A stream from the file reader which can be piped to the connection.
   * @param  {string}  mime The mime type of the files
   * @param  {Number}  length The length in bytes of the file.  Useful for setting headers.
   * @param  {Date}    lastModified The timestamp when the file was last modifeid on disk.  Useful for headers.
   * @description Must be defined explaining how to send a file to an induvidual connection.  Might be a noop for some connection types.
   */

  defaultAttributes () {
    return {
      type: null,
      canChat: true,
      logConnections: true,
      logExits: true,
      sendWelcomeMessage: true,
      verbs: []
    }
  }

  validate () {
    if (!this.type) { throw new Error('type is required for this server') }

    [
      'start',
      'stop',
      'sendFile',    // connection, error, fileStream, mime, length, lastModified
      'sendMessage', // connection, message
      'goodbye'
    ].forEach((method) => {
      if (!this[method] || typeof this[method] !== 'function') {
        throw new Error(`${method} is a required method for the server \`${this.name}\``)
      }
    })
  }

  /**
   * Build a the ActionHero.Connection from the raw parts provided by the server.
   *
   * @function ActionHero.Server.buildConnection
   * @memberof ActionHero.Server
   * @emits ActionHero.Server#connection
   * @example
// from the web server

this.buildConnection({
  rawConnection: {
    req: req,
    res: res,
    params: {},
    method: method,
    cookies: cookies,
    responseHeaders: responseHeaders,
    responseHttpCode: responseHttpCode,
    parsedURL: parsedURL
  },
  id: fingerprint + '-' + uuid.v4(),
  fingerprint: fingerprint,
  remoteAddress: remoteIP,
  remotePort: remotePort
})
   */
  buildConnection (data) {
    const details = {
      type: this.type,
      id: data.id,
      remotePort: data.remotePort,
      remoteIP: data.remoteAddress,
      rawConnection: data.rawConnection
    }

    if (this.attributes.canChat === true) { details.canChat = true }
    if (data.fingerprint) { details.fingerprint = data.fingerprint }

    let connection = new ActionHero.Connection(details)

    connection.sendMessage = (message) => {
      this.sendMessage(connection, message)
    }

    connection.sendFile = (path) => {
      connection.params.file = path
      this.processFile(connection)
    }

    this.emit('connection', connection)

    if (this.attributes.logConnections === true) {
      this.log('new connection', 'info', {to: connection.remoteIP})
    }

    if (this.attributes.sendWelcomeMessage === true) {
      connection.sendMessage({welcome: connection.localize('actionhero.welcomeMessage'), context: 'api'})
    }

    if (typeof this.attributes.sendWelcomeMessage === 'number') {
      setTimeout(() => {
        try {
          connection.sendMessage({welcome: connection.localize('actionhero.welcomeMessage'), context: 'api'})
        } catch (e) {
          this.log(e, 'error')
        }
      }, this.attributes.sendWelcomeMessage)
    }
  }

  /**
   * When a connection has called an Action command, and all properties are set.  Connection should have `params.action` set at least.
   *
   * @function ActionHero.Server.processAction
   * @memberof ActionHero.Server
   * @async
   * @emits ActionHero.Server#actionComplete
   * @param  {Object}  connection The Connection.
   * @return {Promise}
   */
  async processAction (connection) {
    const actionProcessor = new ActionHero.ActionProcessor(connection)
    let data = await actionProcessor.processAction()
    this.emit('actionComplete', data)
  }

  /**
   * When a connection has called an File command, and all properties are set.  Connection should have `params.file` set at least.  Will eventuall call ActionHero.Server#sendFile.
   *
   * @function ActionHero.Server.processFile
   * @memberof ActionHero.Server
   * @async
   * @param  {Object}  connection The Connection.
   * @return {Promise}
   */
  async processFile (connection) {
    let results = await api.staticFile.get(connection)
    this.sendFile(
      results.connection,
      results.error,
      results.fileStream,
      results.mime,
      results.length,
      results.lastModified
    )
  }

  /**
   * Enumerate the connections for this server type on this server.
   *
   * @function ActionHero.Server.connections
   * @memberof ActionHero.Server
   * @return {Array} An array of ActionHero.Connection objects
   */
  connections () {
    let connections = []

    for (let i in api.connections.connections) {
      let connection = api.connections.connections[i]
      if (connection.type === this.type) { connections.push(connection) }
    }

    return connections
  }

  /**
   * Log a message from this server type.  A wrapper around api.log with a server prefix.
   *
   * @function ActionHero.Server.log
   * @memberof ActionHero.Server
   * @param  {string} message  The message to log.
   * @param  {string} severity The severity of the message, ie: 'debug', 'info', 'warning', etc (default 'info').
   * @param  {Object} data     Any metadata to add to the log message.
   */
  log (message, severity, data) {
    api.log(`[server: ${this.type}] ${message}`, severity, data)
  }
}
