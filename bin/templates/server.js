'use strict'
const ActionHero = require('actionhero')

module.exports = class MyServer extends ActionHero.Server {
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

  initialize (api) {
    this.on('connection', (conection) => {

    })

    this.on('actionComplete', (data) => {

    })
  }

  start (api) {
    // this.buildConnection (api, data)
    // this.processAction (api, connection)
    // this.processFile (connection)
  }

  stop (api) {

  }

  sendMessage (connection, message, messageCount) {

  }

  sendFile (connection, error, fileStream, mime, length, lastModified) {

  }

  goodbye (connection) {

  }
}
