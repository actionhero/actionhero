'use strict'

const Primus = require('primus')
const UglifyJS = require('uglify-js')
const fs = require('fs')
const path = require('path')
const util = require('util')
const BrowserFingerprint = require('browser_fingerprint')
const ActionHero = require('./../index.js')
const api = ActionHero.api

module.exports = class WebSocketServer extends ActionHero.Server {
  constructor () {
    super()
    this.type = 'websocket'

    this.attributes = {
      canChat: true,
      logConnections: true,
      logExits: true,
      sendWelcomeMessage: true,
      verbs: [
        'quit',
        'exit',
        'documentation',
        'roomAdd',
        'roomLeave',
        'roomView',
        'detailsView',
        'say'
      ]
    }
  }

  initialize () {
    this.fingerprinter = new BrowserFingerprint(api.config.servers.web.fingerprintOptions)
  }

  start () {
    const webserver = api.servers.servers.web
    this.server = new Primus(webserver.server, this.config.server)

    this.writeClientJS()

    this.server.on('connection', (rawConnection) => { this.handleConnection(rawConnection) })
    this.server.on('disconnection', (rawConnection) => { this.handleDisconnection(rawConnection) })

    this.log(`webSockets bound to ${webserver.options.bindIP}: ${webserver.options.port}`, 'debug')
    this.active = true

    this.on('connection', (connection) => {
      connection.rawConnection.on('data', (data) => { this.handleData(connection, data) })
    })

    this.on('actionComplete', (data) => {
      if (data.toRender !== false) {
        data.connection.response.messageCount = data.messageCount
        this.sendMessage(data.connection, data.response, data.messageCount)
      }
    })
  }

  stop () {
    this.active = false
    if (this.config.destroyClientsOnShutdown === true) {
      this.connections().forEach((connection) => { connection.destroy() })
    }

    if (this.server) { this.server.destroy() }
  }

  sendMessage (connection, message, messageCount) {
    if (message.error) {
      message.error = api.config.errors.serializers.servers.websocket(message.error)
    }

    if (!message.context) { message.context = 'response' }
    if (!messageCount) { messageCount = connection.messageCount }
    if (message.context === 'response' && !message.messageCount) { message.messageCount = messageCount }
    connection.rawConnection.write(message)
  }

  sendFile (connection, error, fileStream, mime, length, lastModified) {
    let content = ''
    let response = {
      error: error,
      content: null,
      mime: mime,
      length: length,
      lastModified: lastModified
    }

    try {
      if (!error) {
        fileStream.on('data', (d) => { content += d })
        fileStream.on('end', () => {
          response.content = content
          this.sendMessage(connection, response, connection.messageCount)
        })
      } else {
        this.sendMessage(connection, response, connection.messageCount)
      }
    } catch (e) {
      this.log(e, 'warning')
      this.sendMessage(connection, response, connection.messageCount)
    }
  }

  goodbye (connection) {
    connection.rawConnection.end()
  }

  compileActionheroWebsocketClientJS () {
    let ahClientSource = fs.readFileSync(path.join(__dirname, '/../client/ActionheroWebsocketClient.js')).toString()
    let url = this.config.clientUrl
    ahClientSource = ahClientSource.replace(/%%URL%%/g, url)
    let defaults = {}
    for (let i in this.config.client) { defaults[i] = this.config.client[i] }
    defaults.url = url
    let defaultsString = util.inspect(defaults)
    defaultsString = defaultsString.replace('\'window.location.origin\'', 'window.location.origin')
    ahClientSource = ahClientSource.replace('%%DEFAULTS%%', 'return ' + defaultsString)

    return ahClientSource
  }

  renderClientJS (minimize) {
    if (!minimize) { minimize = false }
    let libSource = api.servers.servers.websocket.server.library()
    let ahClientSource = this.compileActionheroWebsocketClientJS()
    ahClientSource =
      ';;;\r\n' +
      '(function(exports){ \r\n' +
      ahClientSource +
      '\r\n' +
      'exports.ActionheroWebsocketClient = ActionheroWebsocketClient; \r\n' +
      'exports.ActionheroWebsocketClient = ActionheroWebsocketClient; \r\n' +
      '})(typeof exports === \'undefined\' ? window : exports);'

    if (minimize) {
      return UglifyJS.minify(libSource + '\r\n\r\n\r\n' + ahClientSource).code
    } else {
      return (libSource + '\r\n\r\n\r\n' + ahClientSource)
    }
  }

  writeClientJS () {
    if (!api.config.general.paths['public'] || api.config.general.paths['public'].length === 0) {
      return
    }

    if (this.config.clientJsPath && this.config.clientJsName) {
      let clientJSPath = path.normalize(
        api.config.general.paths['public'][0] +
        path.sep +
        this.config.clientJsPath +
        path.sep
      )
      let clientJSName = this.config.clientJsName
      let clientJSFullPath = clientJSPath + clientJSName
      try {
        if (!fs.existsSync(clientJSPath)) {
          fs.mkdirSync(clientJSPath)
        }
        fs.writeFileSync(clientJSFullPath + '.js', this.renderClientJS(false))
        api.log(`wrote ${clientJSFullPath}.js`, 'debug')
        fs.writeFileSync(clientJSFullPath + '.min.js', this.renderClientJS(true))
        api.log(`wrote ${clientJSFullPath}.min.js`, 'debug')
      } catch (e) {
        api.log('Cannot write client-side JS for websocket server:', 'warning')
        api.log(e, 'warning')
        throw e
      }
    }
  }

  handleConnection (rawConnection) {
    const parsedCookies = this.fingerprinter.parseCookies(rawConnection)
    const fingerprint = parsedCookies[api.config.servers.web.fingerprintOptions.cookieKey]
    this.buildConnection({
      rawConnection: rawConnection,
      remoteAddress: rawConnection.address.ip,
      remotePort: rawConnection.address.port,
      fingerprint: fingerprint
    })
  }

  handleDisconnection (rawConnection) {
    const connections = this.connections()
    for (let i in connections) {
      if (connections[i] && rawConnection.id === connections[i].rawConnection.id) {
        connections[i].destroy()
        break
      }
    }
  }

  async handleData (connection, data) {
    const verb = data.event
    delete data.event
    connection.messageCount++
    connection.params = {}

    if (verb === 'action') {
      for (let v in data.params) {
        connection.params[v] = data.params[v]
      }
      connection.error = null
      connection.response = {}
      return this.processAction(connection)
    }

    if (verb === 'file') {
      connection.params = {
        file: data.file
      }
      return this.processFile(connection)
    }

    let words = []
    let message
    if (data.room) {
      words.push(data.room)
      delete data.room
    }
    for (let i in data) { words.push(data[i]) }
    try {
      let data = await connection.verbs(verb, words)
      message = {status: 'OK', context: 'response', data: data}
      return this.sendMessage(connection, message)
    } catch (error) {
      message = {status: error, context: 'response', data: data}
      return this.sendMessage(connection, message)
    }
  }
}
