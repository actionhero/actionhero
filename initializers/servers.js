'use strict'

const path = require('path')

module.exports = {
  startPriority: 900,
  stopPriority: 100,
  loadPriority: 599,
  initialize: function (api) {
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

    serverFolders.forEach((p) => {
      api.utils.recursiveDirectoryGlob(p).forEach(async (f) => {
        let parts = f.split(/[/\\]+/)
        let serverName = parts[(parts.length - 1)].split('.')[0]
        if (api.config.servers[serverName] && api.config.servers[serverName].enabled === true) {
          let init = require(f).initialize
          let options = api.config.servers[serverName]
          let serverObject = await init(api, options)
          api.servers.servers[serverName] = serverObject
          api.log(`Initialized server: ${serverName}`, 'debug')
        }

        api.watchFileAndAct(f, () => {
          api.log(`*** Rebooting due to server (${serverName}) change ***`, 'info')
          api.commands.restart()
        })
      })
    })
  },

  start: async function (api) {
    Object.keys(api.servers.servers).forEach(async (serverName) => {
      let server = api.servers.servers[serverName]
      if (server && server.options.enabled === true) {
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
    })
  },

  stop: async function (api) {
    Object.keys(api.servers.servers).forEach(async (serverName) => {
      let server = api.servers.servers[serverName]
      if ((server && server.options.enabled === true) || !server) {
        api.log(`Stopping server: ${serverName}`, 'notice')
        await server.stop()
        api.log(`Server stopped: ${serverName}`, 'debug')
      }
    })
  }
}
