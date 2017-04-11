'use strict'

const initialize = function (api, options, next) {
  // ////////
  // INIT //
  // ////////

  const type = '%%name%%'

  const attributes = {
    canChat: true,
    logConnections: true,
    logExits: true,
    sendWelcomeMessage: true,
    verbs: []
  }

  const server = new api.GenericServer(type, options, attributes)

  // ////////////////////
  // REQUIRED METHODS //
  // ////////////////////

  server.start = function (next) {
    return next()
  }

  server.stop = function (next) {
    return next()
  }

  server.sendMessage = function (connection, message, messageCount) {

  }

  server.sendFile = function (connection, error, fileStream, mime, length) {

  }

  server.goodbye = function (connection, reason) {

  }

  // //////////
  // EVENTS //
  // //////////

  server.on('connection', function (connection) {

  })

  server.on('actionComplete', function (data) {

  })

  // ///////////
  // HELPERS //
  // ///////////

  next(server)
}

exports.initialize = initialize
