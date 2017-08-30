'use strict'

const cluster = require('cluster')
const readline = require('readline')
const os = require('os')

module.exports = {
  name: 'start',
  description: 'start this ActionHero server',
  example: 'actionhero start --config=[/path/to/config] --title=[processTitle] --daemon',

  inputs: {
    config: {
      required: false,
      note: 'path to config.js, defaults to "process.cwd() + \'/\' + config.js". You can also use ENV[ACTIONHERO_CONFIG]'
    },
    title: {
      required: false,
      note: 'process title to use for ActionHero\'s ID, ps, log, and pidFile defaults. Must be unique for each member of the cluster. You can also use ENV[ACTIONHERO_TITLE]. Process renaming does not work on OSX/Windows'
    },
    daemon: {
      required: false,
      note: 'to fork and run as a new background process defaults to false'
    }
  },

  run: async function (api, data) {
    let state

    // number of ms to wait to do a forcible shutdown if actionhero won't stop gracefully
    let shutdownTimeout = 1000 * 30
    if (process.env.ACTIONHERO_SHUTDOWN_TIMEOUT) {
      shutdownTimeout = parseInt(process.env.ACTIONHERO_SHUTDOWN_TIMEOUT)
    }

    const startServer = async function () {
      state = 'starting'
      if (cluster.isWorker) { process.send({state: state}) }
      let apiFromCallback = await api._context.start()
      state = 'started'
      if (cluster.isWorker) { process.send({state: state}) }
      api = apiFromCallback
      checkForInernalStop()
    }

    const stopServer = async function () {
      state = 'stopping'
      if (cluster.isWorker) { process.send({state: state}) }
      await api._context.stop()
      state = 'stopped'
      if (cluster.isWorker) { process.send({state: state}) }
    }

    const restartServer = async function () {
      state = 'restarting'
      if (cluster.isWorker) { process.send({state: state}) }
      let apiFromCallback = await api._context.restart()
      state = 'started'
      if (cluster.isWorker) { process.send({state: state}) }
      api = apiFromCallback
    }

    const stopProcess = async function () {
      setTimeout(function () {
        throw new Error('process stop timeout reached.  terminating now.')
      }, shutdownTimeout)
      await stopServer()
      setTimeout(() => { process.exit() }, 1)
    }

    // check for an internal stop which doesn't close the processs
    let checkForInernalStopTimer
    const checkForInernalStop = () => {
      clearTimeout(checkForInernalStopTimer)
      if (api.running !== true && state === 'started') { process.exit(0) }
      checkForInernalStopTimer = setTimeout(checkForInernalStop, shutdownTimeout)
    }

    if (cluster.isWorker) {
      process.on('message', function (msg) {
        if (msg === 'start') {
          startServer()
        } else if (msg === 'stop') {
          stopServer()
        } else if (msg === 'stopProcess') {
          stopProcess()
        // in cluster, we cannot re-bind the port
        // so kill this worker, and then let the cluster start a new worker
        } else if (msg === 'restart') { stopProcess() }
      })

      process.on('uncaughtException', function (error) {
        let stack
        try {
          stack = error.stack.split(os.EOL)
        } catch (e) {
          stack = [error]
        }
        process.send({uncaughtException: {
          message: error.message,
          stack: stack
        }})
        process.nextTick(process.exit)
      })

      process.on('unhandledRejection', function (reason, p) {
        process.send({unhandledRejection: {reason: reason, p: p}})
        process.nextTick(process.exit)
      })
    }

    process.on('SIGINT', function () { stopProcess() })
    process.on('SIGTERM', function () { stopProcess() })
    process.on('SIGUSR2', function () { restartServer() })

    if (process.platform === 'win32' && !process.env.IISNODE_VERSION) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.on('SIGINT', function () {
        process.emit('SIGINT')
      })
    }

    // start the server!
    await startServer()
    return false
  }
}
