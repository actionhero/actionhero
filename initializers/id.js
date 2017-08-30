'use strict'

const cluster = require('cluster')
const argv = require('optimist').argv

module.exports = {
  loadPriority: 10,
  startPriority: 2,
  initialize: function (api) {
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
  },

  start: function (api) {
    api.log(`server ID: ${api.id}`, 'notice')
  }
}
