'use strict'

const path = require('path')
const async = require('async')

/**
 * Manages the servers in this ActionHero instance.
 *
 * @namespace api.servers
 * @property {Object} servers - The collection of servers active in thi ActionHero instance.
 */

module.exports = {
  startPriority: 900,
  stopPriority: 100,
  loadPriority: 599,
  initialize: function (api, next) {
    api.servers = {}
    api.servers.servers = {}

    // Load the servers

    let serverFolders = [
      path.resolve(path.join(__dirname, '/../servers'))
    ]

    api.config.general.paths.server.forEach((p) => {
      p = path.resolve(p)
      if (serverFolders.indexOf(p) < 0) {
        serverFolders.push(p)
      }
    })

    let jobs = []

    serverFolders.forEach((p) => {
      api.utils.recursiveDirectoryGlob(p).forEach((f) => {
        let parts = f.split(/[/\\]+/)
        let serverName = parts[(parts.length - 1)].split('.')[0]
        if (api.config.servers[serverName] && api.config.servers[serverName].enabled === true) {
          let init = require(f).initialize
          let options = api.config.servers[serverName]
          jobs.push((done) => {
            init(api, options, (serverObject) => {
              api.servers.servers[serverName] = serverObject
              api.log(`Initialized server: ${serverName}`, 'debug')
              return done()
            })
          })
        }
        api.watchFileAndAct(f, () => {
          api.log(`*** Rebooting due to server (${serverName}) change ***`, 'info')
          api.commands.restart()
        })
      })
    })

    async.series(jobs, next)
  },

  start: function (api, next) {
    let jobs = []
    Object.keys(api.servers.servers).forEach((serverName) => {
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

        jobs.push((done) => {
          api.log(message, 'notice')
          server.start((error) => {
            if (error) { return done(error) }
            api.log(`Server started: ${serverName}`, 'debug')
            return done()
          })
        })
      }
    })

    async.series(jobs, next)
  },

  stop: function (api, next) {
    let jobs = []
    Object.keys(api.servers.servers).forEach((serverName) => {
      let server = api.servers.servers[serverName]
      if ((server && server.options.enabled === true) || !server) {
        jobs.push((done) => {
          api.log(`Stopping server: ${serverName}`, 'notice')
          server.stop((error) => {
            if (error) { return done(error) }
            api.log(`Server stopped: ${serverName}`, 'debug')
            return done()
          })
        })
      }
    })

    async.series(jobs, next)
  }
}
