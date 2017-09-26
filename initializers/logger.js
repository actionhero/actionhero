'use strict'

const winston = require('winston')
const ActionHero = require('./../index.js')
const api = ActionHero.api

module.exports = class Logger extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'logger'
    this.loadPriority = 100
  }

  initialize () {
    let transports = []
    let i

    for (i in api.config.logger.transports) {
      let t = api.config.logger.transports[i]
      if (typeof t === 'function') {
        transports.push(t(api, winston))
      } else {
        transports.push(t)
      }
    }

    api.logger = new (winston.Logger)({transports: transports})

    if (api.config.logger.levels) {
      api.logger.setLevels(api.config.logger.levels)
    } else {
      api.logger.setLevels(winston.config.syslog.levels)
    }

    if (api.config.logger.colors) {
      winston.addColors(api.config.logger.colors)
    }

    api.log = (message, severity, data) => {
      if (severity === undefined || severity === null || api.logger.levels[severity] === undefined) { severity = 'info' }
      let args = [severity, message]
      if (data !== null && data !== undefined) { args.push(data) }
      api.logger.log.apply(api.logger, args)
    }

    let logLevels = []
    for (i in api.logger.levels) { logLevels.push(i) }

    api.log('Logger loaded.  Possible levels include:', 'debug', logLevels)
  }
}
