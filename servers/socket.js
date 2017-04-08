'use strict'

const net = require('net')
const tls = require('tls')

const initialize = function (api, options, next) {
  // ////////
  // INIT //
  // ////////

  const type = 'socket'
  const attributes = {
    canChat: true,
    logConnections: true,
    logExits: true,
    pendingShutdownWaitLimit: 5000,
    sendWelcomeMessage: true,
    verbs: [
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
    ]
  }

  const server = new api.GenericServer(type, options, attributes)

  // ////////////////////
  // REQUIRED METHODS //
  // ////////////////////

  server.start = function (next) {
    if (options.secure === false) {
      server.server = net.createServer(api.config.servers.socket.serverOptions, (rawConnection) => {
        handleConnection(rawConnection)
      })
    } else {
      server.server = tls.createServer(api.config.servers.socket.serverOptions, (rawConnection) => {
        handleConnection(rawConnection)
      })
    }

    server.server.on('error', (e) => {
      return next(new Error('Cannot start socket server @ ' + options.bindIP + ':' + options.port + ' => ' + e.message))
    })

    server.server.listen(options.port, options.bindIP, () => {
      process.nextTick(next)
    })
  }

  server.stop = function (next) {
    gracefulShutdown(next)
  }

  server.sendMessage = function (connection, message, messageCount) {
    if (message.error) {
      message.error = api.config.errors.serializers.servers.socket(message.error)
    }

    if (connection.respondingTo) {
      message.messageCount = messageCount
      connection.respondingTo = null
    } else if (message.context === 'response') {
      if (messageCount) {
        message.messageCount = messageCount
      } else {
        message.messageCount = connection.messageCount
      }
    }
    try {
      connection.rawConnection.write(JSON.stringify(message) + '\r\n')
    } catch (e) {
      api.log(`socket write error: ${e}`, 'error')
    }
  }

  server.goodbye = function (connection) {
    try {
      connection.rawConnection.end(JSON.stringify({status: connection.localize('actionhero.goodbyeMessage'), context: 'api'}) + '\r\n')
    } catch (e) {}
  }

  server.sendFile = function (connection, error, fileStream) {
    if (error) {
      server.sendMessage(connection, error, connection.messageCount)
    } else {
      fileStream.pipe(connection.rawConnection, {end: false})
    }
  }

  // //////////
  // EVENTS //
  // //////////

  server.on('connection', function (connection) {
    connection.params = {}

    const parseLine = function (line) {
      if (api.config.servers.socket.maxDataLength > 0) {
        let blen = Buffer.byteLength(line, 'utf8')
        if (blen > api.config.servers.socket.maxDataLength) {
          let error = api.config.errors.dataLengthTooLarge(api.config.servers.socket.maxDataLength, blen)
          server.log(error, 'error')
          return server.sendMessage(connection, {status: 'error', error: error, context: 'response'})
        }
      }
      if (line.length > 0) {
        // increment at the start of the request so that responses can be caught in order on the client
        // this is not handled by the GenericServer
        connection.messageCount++
        parseRequest(connection, line)
      }
    }

    connection.rawConnection.on('data', (chunk) => {
      if (checkBreakChars(chunk)) {
        connection.destroy()
      } else {
        // Replace all carriage returns with newlines.
        connection.rawConnection.socketDataString += chunk.toString('utf-8').replace(/\r/g, '\n')
        let index
        let d = String(api.config.servers.socket.delimiter)

        while ((index = connection.rawConnection.socketDataString.indexOf(d)) > -1) {
          let data = connection.rawConnection.socketDataString.slice(0, index)
          connection.rawConnection.socketDataString = connection.rawConnection.socketDataString.slice(index + d.length)
          data.split(d).forEach(parseLine)
        }
      }
    })

    connection.rawConnection.on('end', () => {
      if (connection.destroyed !== true) {
        try { connection.rawConnection.end() } catch (e) {}
        connection.destroy()
      }
    })

    connection.rawConnection.on('error', (e) => {
      if (connection.destroyed !== true) {
        server.log('socket error: ' + e, 'error')
        try { connection.rawConnection.end() } catch (e) {}
        connection.destroy()
      }
    })
  })

  server.on('actionComplete', (data) => {
    if (data.toRender === true) {
      data.response.context = 'response'
      server.sendMessage(data.connection, data.response, data.messageCount)
    }
  })

  // ///////////
  // HELPERS //
  // ///////////

  const parseRequest = function (connection, line) {
    let words = line.split(' ')
    let verb = words.shift()
    if (verb === 'file') {
      if (words.length > 0) {
        connection.params.file = words[0]
      }
      server.processFile(connection)
    } else {
      connection.verbs(verb, words, (error, data) => {
        if (!error) {
          server.sendMessage(connection, {status: 'OK', context: 'response', data: data})
        } else if (error.toString().match('verb not found or not allowed')) {
          // check for and attempt to check single-use params
          try {
            let requestHash = JSON.parse(line)
            if (requestHash.params !== undefined) {
              connection.params = {}
              for (let v in requestHash.params) {
                connection.params[v] = requestHash.params[v]
              }
            }
            if (requestHash.action) {
              connection.params.action = requestHash.action
            }
          } catch (e) {
            connection.params.action = verb
          }
          connection.error = null
          connection.response = {}
          server.processAction(connection)
        } else {
          server.sendMessage(connection, {status: error.toString().replace(/^Error:\s/, ''), context: 'response', data: data})
        }
      })
    }
  }

  const handleConnection = function (rawConnection) {
    if (api.config.servers.socket.setKeepAlive === true) {
      rawConnection.setKeepAlive(true)
    }
    rawConnection.socketDataString = ''
    server.buildConnection({
      rawConnection: rawConnection,
      remoteAddress: rawConnection.remoteAddress,
      remotePort: rawConnection.remotePort
    }) // will emit 'connection'
  }

  // I check for ctrl+c in the stream
  const checkBreakChars = function (chunk) {
    let found = false
    let hexChunk = chunk.toString('hex', 0, chunk.length)
    if (hexChunk === 'fff4fffd06') {
      found = true // CTRL + C
    } else if (hexChunk === '04') {
      found = true // CTRL + D
    }
    return found
  }

  const gracefulShutdown = function (next, alreadyShutdown) {
    if (!alreadyShutdown || alreadyShutdown === false) {
      if (server.server) { server.server.close() }
    }
    let pendingConnections = 0
    server.connections().forEach((connection) => {
      if (connection.pendingActions === 0) {
        connection.destroy()
      } else {
        pendingConnections++
        if (!connection.rawConnection.shutDownTimer) {
          connection.rawConnection.shutDownTimer = setTimeout(() => {
            connection.destroy()
          }, attributes.pendingShutdownWaitLimit)
        }
      }
    })
    if (pendingConnections > 0) {
      server.log('waiting on shutdown, there are still ' + pendingConnections + ' connected clients waiting on a response', 'notice')
      setTimeout(() => {
        gracefulShutdown(next, true)
      }, 1000)
    } else if (typeof next === 'function') { next() }
  }

  next(server)
}

// ///////////////////////////////////////////////////////////////////
// exports
exports.initialize = initialize
