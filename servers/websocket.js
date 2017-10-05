'use strict'

const Primus = require('primus')
const UglifyJS = require('uglify-js')
const fs = require('fs')
const path = require('path')
const util = require('util')
const browserFingerprint = require('browser_fingerprint')

const initialize = function (api, options, next) {
  // ////////
  // INIT //
  // ////////

  const type = 'websocket'
  const attributes = {
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

  const server = new api.GenericServer(type, options, attributes)

  // ////////////////////
  // REQUIRED METHODS //
  // ////////////////////

  server.start = function (next) {
    const webserver = api.servers.servers.web
    server.server = new Primus(webserver.server, api.config.servers.websocket.server)

    server.server.on('connection', (rawConnection) => {
      handleConnection(rawConnection)
    })

    server.server.on('disconnection', (rawConnection) => {
      handleDisconnection(rawConnection)
    })

    api.log(`webSockets bound to ${webserver.options.bindIP}: ${webserver.options.port}`, 'debug')
    server.active = true

    server.writeClientJS()

    next()
  }

  server.stop = function (next) {
    server.active = false
    if (api.config.servers.websocket.destroyClientsOnShutdown === true) {
      server.connections().forEach((connection) => {
        connection.destroy()
      })
    }
    process.nextTick(next)
  }

  server.sendMessage = function (connection, message, messageCount) {
    if (message.error) {
      message.error = api.config.errors.serializers.servers.websocket(message.error)
    }

    if (!message.context) { message.context = 'response' }
    if (!messageCount) { messageCount = connection.messageCount }
    if (message.context === 'response' && !message.messageCount) { message.messageCount = messageCount }
    connection.rawConnection.write(message)
  }

  server.sendFile = function (connection, error, fileStream, mime, length, lastModified) {
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
        fileStream.on('data', function (d) { content += d })
        fileStream.on('end', () => {
          response.content = content
          server.sendMessage(connection, response, connection.messageCount)
        })
      } else {
        server.sendMessage(connection, response, connection.messageCount)
      }
    } catch (e) {
      api.log(e, 'warning')
      server.sendMessage(connection, response, connection.messageCount)
    }
  }

  server.goodbye = function (connection) {
    connection.rawConnection.end()
  }

  // //////////
  // EVENTS //
  // //////////

  server.on('connection', function (connection) {
    connection.rawConnection.on('data', (data) => {
      handleData(connection, data)
    })
  })

  server.on('actionComplete', function (data) {
    if (data.toRender !== false) {
      data.connection.response.messageCount = data.messageCount
      server.sendMessage(data.connection, data.response, data.messageCount)
    }
  })

  // //////////
  // CLIENT //
  // //////////

  server.compileActionheroClientJS = function () {
    let ahClientSource = fs.readFileSync(path.join(__dirname, '/../client/actionheroClient.js')).toString()
    let url = api.config.servers.websocket.clientUrl
    ahClientSource = ahClientSource.replace(/%%URL%%/g, url)
    let defaults = {}
    for (let i in api.config.servers.websocket.client) {
      defaults[i] = api.config.servers.websocket.client[i]
    }
    defaults.url = url
    let defaultsString = util.inspect(defaults)
    defaultsString = defaultsString.replace('\'window.location.origin\'', 'window.location.origin')
    ahClientSource = ahClientSource.replace('%%DEFAULTS%%', 'return ' + defaultsString)

    return ahClientSource
  }

  server.renderClientJS = function (minimize) {
    if (!minimize) { minimize = false }
    let libSource = api.servers.servers.websocket.server.library()
    let ahClientSource = server.compileActionheroClientJS()
    ahClientSource =
      ';;;\r\n' +
      '(function(exports){ \r\n' +
      ahClientSource +
      '\r\n' +
      'exports.ActionheroClient = ActionheroClient; \r\n' +
      'exports.actionheroClient = actionheroClient; \r\n' +
      '})(typeof exports === \'undefined\' ? window : exports);'
    if (minimize) {
      return UglifyJS.minify(libSource + '\r\n\r\n\r\n' + ahClientSource).code
    } else {
      return (libSource + '\r\n\r\n\r\n' + ahClientSource)
    }
  }

  server.writeClientJS = function () {
    if (!api.config.general.paths['public'] || api.config.general.paths['public'].length === 0) {
      return
    }
    if (api.config.servers.websocket.clientJsPath && api.config.servers.websocket.clientJsName) {
      let clientJSPath = path.normalize(
        api.config.general.paths['public'][0] +
        path.sep +
        api.config.servers.websocket.clientJsPath +
        path.sep
      )
      let clientJSName = api.config.servers.websocket.clientJsName
      let clientJSFullPath = clientJSPath + clientJSName
      try {
        if (!fs.existsSync(clientJSPath)) {
          fs.mkdirSync(clientJSPath)
        }
        fs.writeFileSync(clientJSFullPath + '.js', server.renderClientJS(false))
        api.log(`wrote ${clientJSFullPath}.js`, 'debug')
        fs.writeFileSync(clientJSFullPath + '.min.js', server.renderClientJS(true))
        api.log(`wrote ${clientJSFullPath}.min.js`, 'debug')
      } catch (e) {
        api.log('Cannot write client-side JS for websocket server:', 'warning')
        api.log(e, 'warning')
        throw e
      }
    }
  }

  // ///////////
  // HELPERS //
  // ///////////

  const handleConnection = function (rawConnection) {
    const parsedCookies = browserFingerprint.parseCookies(rawConnection)
    const fingerprint = parsedCookies[api.config.servers.web.fingerprintOptions.cookieKey]
    server.buildConnection({
      rawConnection: rawConnection,
      remoteAddress: rawConnection.address.ip,
      remotePort: rawConnection.address.port,
      fingerprint: fingerprint
    })
  }

  const handleDisconnection = function (rawConnection) {
    for (let i in server.connections()) {
      if (server.connections()[i] && rawConnection.id === server.connections()[i].rawConnection.id) {
        server.connections()[i].destroy()
        break
      }
    }
  }

  const handleData = function (connection, data) {
    const verb = data.event
    delete data.event
    connection.messageCount++
    const messageCount = connection.messageCount
    connection.params = {}
    if (verb === 'action') {
      for (let v in data.params) {
        connection.params[v] = data.params[v]
      }
      connection.error = null
      connection.response = {}
      server.processAction(connection)
    } else if (verb === 'file') {
      connection.params = {
        file: data.file
      }
      server.processFile(connection)
    } else {
      let words = []
      let message
      if (data.room) {
        words.push(data.room)
        delete data.room
      }
      for (let i in data) { words.push(data[i]) }
      connection.verbs(verb, words, (error, data) => {
        if (!error) {
          message = {status: 'OK', context: 'response', data: data}
          server.sendMessage(connection, message, messageCount)
        } else {
          message = {status: error, context: 'response', data: data}
          server.sendMessage(connection, message, messageCount)
        }
      })
    }
  }

  next(server)
}

// ///////////////////////////////////////////////////////////////////
// exports
exports.initialize = initialize
