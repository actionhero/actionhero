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
    api.config.general.paths.log.forEach((p) => {
      try {
        api.utils.createDirSafely(p)
      } catch (error) {
        if (error.code !== 'EEXIST') { throw error }
      }
    })

    api.loggers = api.config.logger.loggers.map((loggerBuilder) => {
      const resolvedLogger = loggerBuilder(api)
      return winston.createLogger(resolvedLogger)
    })

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
      api.loggers.map((logger) => {
        if (severity === undefined || severity === null || logger.levels[severity] === undefined) { severity = 'info' }
        const args = [severity, message]
        if (data !== null && data !== undefined) { args.push(data) }
        return logger.log.apply(logger, args)
      })
    }
  }
}
