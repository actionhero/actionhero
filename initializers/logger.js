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

    /**
     * Log a message, with optional metadata.  The message can be logged to a number of locations (stdio, files, etc) as configured via config/logger.js
     * The default log levels are: `0=debug` `1=info` `2=notice` `3=warning` `4=error` `5=crit` `6=alert` `7=emerg`
     *
     * @memberof api
     * @param  {string} message  The message to log.
     * @param  {string} severity (optional) What log-level should this message be logged at. Default: 'info'.
     * @param  {Object} data     (optional) Any object you wish to append to this message.
     * @see https://github.com/winstonjs/winston
     *
     * @example
// the most basic use.  Will assume 'info' as the severity
api.log('hello');

// custom severity
api.log('OH NO!', 'warning');

// custom severity with a metadata object
api.log('OH NO, something went wrong', 'warning', { error: new Error('things are busted') });
     */
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
