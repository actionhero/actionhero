'use strict'

const fs = require('fs')
const cluster = require('cluster')

/**
 * Pid and Pidfile.
 *
 * @namespace api.pids
 * @property {Number} pid - The process ID for this process.
 * @property {string} path - The folder in which to save the pidfile (from `api.config.general.paths.pid`).
 * @property {string} title - The name of the pidfile.  Built from the `api.id`.
 */

module.exports = {
  startPriority: 1,
  loadPriority: 50,
  initialize: function (api, next) {
    api.pids = {}
    api.pids.pid = process.pid
    api.pids.path = api.config.general.paths.pid[0] // it would be silly to have more than one pid

    api.pids.sanitizeId = function () {
      let pidfile = api.id
      pidfile = pidfile.replace(new RegExp(':', 'g'), '-')
      pidfile = pidfile.replace(new RegExp(' ', 'g'), '_')
      pidfile = pidfile.replace(new RegExp('\r', 'g'), '') // eslint-disable-line
      pidfile = pidfile.replace(new RegExp('\n', 'g'), '') // eslint-disable-line

      return pidfile
    }

    if (cluster.isMaster) {
      api.pids.title = 'actionhero-' + api.pids.sanitizeId()
    } else {
      api.pids.title = api.pids.sanitizeId()
    }

    try { fs.mkdirSync(api.pids.path) } catch (e) {};

    api.pids.writePidFile = function () {
      fs.writeFileSync(api.pids.path + '/' + api.pids.title, api.pids.pid.toString(), 'ascii')
    }

    api.pids.clearPidFile = function () {
      try {
        fs.unlinkSync(api.pids.path + '/' + api.pids.title)
      } catch (e) {
        api.log('Unable to remove pidfile', 'error', e)
      }
    }

    next()
  },

  start: function (api, next) {
    api.pids.writePidFile()
    api.log(`pid: ${process.pid}`, 'notice')
    next()
  }
}
