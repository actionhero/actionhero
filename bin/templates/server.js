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
