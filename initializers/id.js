'use strict'

const cluster = require('cluster')
const path = require('path')
const argv = require('optimist').argv

/**
 * I build this server's ID.
 *
 * @namespace api.id
 */

module.exports = {
  loadPriority: 10,
  startPriority: 2,
  initialize: function (api, next) {
    if (argv.title) {
      api.id = argv.title
    } else if (process.env.ACTIONHERO_TITLE) {
      api.id = process.env.ACTIONHERO_TITLE
    } else if (!api.config.general.id) {
      let externalIP = api.utils.getExternalIPAddress()
      if (externalIP === false) {
        let message = ' * Error fetching this hosts external IP address; setting id base to \'actionhero\''
        try {
          api.log(message, 'crit')
        } catch (e) {
          console.log(message)
        }
        externalIP = 'actionhero'
      }

      api.id = externalIP
      if (cluster.isWorker) { api.id += ':' + process.pid }
    } else {
      api.id = api.config.general.id
    }

    api.actionheroVersion = require('..' + path.sep + 'package.json').version

    next()
  },

  start: function (api, next) {
    api.log(`server ID: ${api.id}`, 'notice')
    next()
  }
}
