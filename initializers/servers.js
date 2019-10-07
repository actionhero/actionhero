'use strict'

const path = require('path')
const glob = require('glob')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * Manages the servers in this ActionHero instance.
 *
 * @namespace api.servers
 * @property {Object} servers - The collection of servers active in thi ActionHero instance.
 * @extends ActionHero.Initializer
 */
module.exports = class Servers extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'servers'
    this.loadPriority = 599
    this.startPriority = 900
    this.stopPriority = 100
  }

  async initialize () {
    api.servers = {
      servers: {}
    }

    const serverFolders = [
      path.resolve(path.join(__dirname, '..', 'servers'))
    ]

    api.config.general.paths.server.forEach((p) => {
      p = path.resolve(p)
      if (serverFolders.indexOf(p) < 0) { serverFolders.push(p) }
    })

    for (const i in serverFolders) {
      const p = serverFolders[i]
      let files = glob.sync(path.join(p, '**', '*.js'))

      for (const pluginName in api.config.plugins) {
        if (api.config.plugins[pluginName].servers !== false) {
          const pluginPath = api.config.plugins[pluginName].path
          files = files.concat(glob.sync(path.join(pluginPath, 'servers', '**', '*.js')))
        }
      }

      for (const j in files) {
        const filename = files[j]
        const ServerClass = require(filename)
        const server = new ServerClass()
        server.config = api.config.servers[server.type] // shorthand access
        if (server.config && server.config.enabled === true) {
          await server.initialize()

          if (api.servers.servers[server.type]) {
            api.log(`an existing server with the same type \`${server.type}\` will be overridden by the file ${filename}`, 'warning')
          }

          api.servers.servers[server.type] = server
          api.log(`Initialized server: ${server.type}`, 'debug')
        }

        api.watchFileAndAct(filename, () => {
          api.log(`*** Rebooting due to server (${server.type}) change ***`, 'info')
          api.commands.restart()
        })
      }
    }
  }

  async start () {
    const serverNames = Object.keys(api.servers.servers)
    for (const i in serverNames) {
      const serverName = serverNames[i]
      const server = api.servers.servers[serverName]
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
  }

  async stop () {
    const serverNames = Object.keys(api.servers.servers)
    for (const i in serverNames) {
      const serverName = serverNames[i]
      const server = api.servers.servers[serverName]
      if ((server && server.config.enabled === true) || !server) {
        api.log(`Stopping server: ${serverName}`, 'notice')
        await server.stop()
        server.removeAllListeners()
        api.log(`Server stopped: ${serverName}`, 'debug')
      }
    }
  }
}
