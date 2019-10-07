'use strict'
const { Server } = require('actionhero')

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

  sendMessage (connection, message, messageId) {

  }

  sendFile (connection, error, fileStream, mime, length, lastModified) {

  }

  goodbye (connection) {

  }
}
