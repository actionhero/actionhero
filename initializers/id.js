'use strict'

const cluster = require('cluster')
const argv = require('optimist').argv
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * I build this server's ID.
 *
 * @namespace api.id
 * @extends ActionHero.Initializer
 */
module.exports = class ID extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'id'
    this.loadPriority = 10
    this.startPriority = 2
  }

  initialize () {
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
  }

  start () {
    api.log(`server ID: ${api.id}`, 'notice')
  }
}
