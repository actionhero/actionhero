'use strict'

const cluster = require('cluster')
const winston = require('winston')

// learn more about winston v3 loggers @
// - https://github.com/winstonjs/winston
// - https://github.com/winstonjs/winston/blob/master/docs/transports.md

function buildConsoleLogger (level = 'info') {
  return function (api) {
    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(msg => {
          return `${api.id} @ ${msg.timestamp} - ${msg.level}: ${msg.message}`
        })
      ),
      level,
      levels: winston.config.syslog.levels,
      transports: [ new winston.transports.Console() ]
    })
  }
}

function buildFileLogger (path, level = 'info', maxFiles = undefined, maxsize = 20480) {
  return function (api) {
    let filename = `${path}/${api.pids.title}-${api.env}.log`

    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      level,
      levels: winston.config.syslog.levels,
      transports: [ new winston.transports.File({
        filename,
        maxsize,
        maxFiles
      }) ]
    })
  }
}

exports['default'] = {
  logger: (api) => {
    let loggers = []

    if (cluster.isMaster) {
      loggers.push(buildConsoleLogger())
    }

    api.config.general.paths.log.forEach((p) => {
      loggers.push(buildFileLogger(p))
    })

    return {
      loggers,

      // the maximum length of param to log (we will truncate)
      maxLogStringLength: 100
    }
  }
}

exports.test = {
  logger: (api) => {
    let loggers = []

    api.config.general.paths.log.forEach((p) => {
      loggers.push(buildFileLogger(p, 'debug', 1))
    })

    return {
      loggers
    }
  }
}
