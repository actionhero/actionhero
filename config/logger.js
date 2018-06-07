'use strict'

const fs = require('fs')
const cluster = require('cluster')

function createDirectory (path) {
  try {
    fs.mkdirSync(path)
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw (new Error('Cannot create directory @ ' + path))
    }
  }
}

exports['default'] = {
  logger: (api) => {
    let logger = {transports: []}

    // console logger
    if (cluster.isMaster) {
      logger.transports.push(function (api, winston) {
        return new (winston.transports.Console)({
          colorize: true,
          level: 'info',
          timestamp: function () { return api.id + ' @ ' + new Date().toISOString() }
        })
      })
    }

    // file logger
    const hasLogDirectoryConfigured = (api.config.general.paths.log.length === 1)

    if (hasLogDirectoryConfigured) {
      logger.transports.push(function (api, winston) {
        const logDirectory = api.config.general.paths.log[0]

        createDirectory(logDirectory)

        return new (winston.transports.File)({
          filename: api.config.general.paths.log[0] + '/' + api.pids.title + '.log',
          level: 'info',
          timestamp: function () { return api.id + ' @ ' + new Date().toISOString() }
        })
      })
    }

    // the maximum length of param to log (we will truncate)
    logger.maxLogStringLength = 100

    // you can optionally set custom log levels
    // logger.levels = {good: 0, bad: 1};

    // you can optionally set custom log colors
    // logger.colors = {good: 'blue', bad: 'red'};

    return logger
  }
}

exports.test = {
  logger: (api) => {
    let logger = { transports: [] }

    // file logger
    const hasLogDirectoryConfigured = (api.config.general.paths.log.length === 1)

    if (hasLogDirectoryConfigured) {
      logger.transports.push(function (api, winston) {
        const logDirectory = api.config.general.paths.log[0]

        createDirectory(logDirectory)

        return new (winston.transports.File)({
          filename: api.config.general.paths.log[0] + '/' + api.pids.title + '.log',
          maxsize: 20480,
          maxFiles: 1,
          level: 'debug',
          timestamp: function () { return api.id + ' @ ' + new Date().toISOString() }
        })
      })
    }

    return logger
  }
}
