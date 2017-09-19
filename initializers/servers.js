'use strict'

const path = require('path')

module.exports = {
  startPriority: 900,
  stopPriority: 100,
  loadPriority: 599,
  initialize: async (api) => {
    api.servers = {}
    api.servers.servers = {}

    // Load the servers

    let serverFolders = [
      path.resolve(path.join(__dirname, '/../servers'))
    ]

    api.config.general.paths.server.forEach((p) => {
      p = path.resolve(p)
      if (serverFolders.indexOf(p) < 0) { serverFolders.push(p) }
    })

    for (let i in serverFolders) {
      let p = serverFolders[i]
      let files = api.utils.recursiveDirectoryGlob(p)
      for (let j in files) {
        let filename = files[j]
        let ServerClass = require(filename)
        let server = new ServerClass()
        server.config = api.config.servers.web // shorthand access
        if (server.config && server.config.enabled === true) {
          server.api = api // this is terrible, but needed pass the connection, logger, and staticFile classes on
          await server.initialize()
          api.servers.servers[server.type] = server
          api.log(`Initialized server: ${server.type}`, 'debug')
        }

        api.watchFileAndAct(filename, () => {
          api.log(`*** Rebooting due to server (${server.type}) change ***`, 'info')
          api.commands.restart()
        })
      }
    }
  },

  start: async (api) => {
    const serverNames = Object.keys(api.servers.servers)
    for (let i in serverNames) {
      let serverName = serverNames[i]
      let server = api.servers.servers[serverName]
      if (server && server.config.enabled === true) {
        let message = ''
        message += `Starting server: \`${serverName}\``
        if (api.config.servers[serverName].bindIP) {
          message += ` @ ${api.config.servers[serverName].bindIP}`
        }
        if (api.config.servers[serverName].port) {
          message += `:${api.config.servers[serverName].port}`
        }
        api.log(message, 'notice')
        await server.start()
        api.log(`Server started: ${serverName}`, 'debug')
      }
    }
  },

  stop: async (api) => {
    const serverNames = Object.keys(api.servers.servers)
    for (let i in serverNames) {
      let serverName = serverNames[i]
      let server = api.servers.servers[serverName]
      if ((server && server.config.enabled === true) || !server) {
        api.log(`Stopping server: ${serverName}`, 'notice')
        await server.stop()
        api.log(`Server stopped: ${serverName}`, 'debug')
      }
    }
  }
}
