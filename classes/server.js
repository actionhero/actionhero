const EventEmitter = require('events').EventEmitter

// 2 events: connection and actionComplete
module.exports = class Server extends EventEmitter {
  constructor (config) {
    super()
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

  validate (api) {
    if (!this.type) { throw new Error('type is required for this server') }

    [
      'start',
      'stop',
      'sendFile',    // connection, error, fileStream, mime, length, lastModified
      'sendMessage', // connection, message
      'goodbye'
    ].forEach((method) => {
      if (!this[method] && typeof this[method] !== 'function') {
        throw new Error(`${method} is a required method for the server \`${this.name}\``)
      }
    })
  }

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

    let connection = new this.api.Connection(details)

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

  async processAction (connection) {
    const actionProcessor = new this.api.ActionProcessor(connection)
    let data = await actionProcessor.processAction()
    this.emit('actionComplete', data)
  }

  async processFile (connection) {
    let results = await this.api.staticFile.get(connection)
    this.sendFile(
      results.connection,
      results.error,
      results.fileStream,
      results.mime,
      results.length,
      results.lastModified
    )
  }

  connections () {
    let connections = []

    for (let i in this.api.connections.connections) {
      let connection = this.api.connections.connections[i]
      if (connection.type === this.type) { connections.push(connection) }
    }

    return connections
  }

  log (message, severity, data) {
    this.api.log(`[server: ${this.type}] ${message}`, severity, data)
  }
}
