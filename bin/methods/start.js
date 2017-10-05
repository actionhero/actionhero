'use strict'

const cluster = require('cluster')
const readline = require('readline')
const os = require('os')
const ActionHero = require('./../../index.js')
const api = ActionHero.api

module.exports = class Start extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'start'
    this.description = 'start this ActionHero server'
    this.example = 'actionhero start --config=[/path/to/config] --title=[processTitle] --daemon'
    this.inputs = {
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
    }

    this.state = null

    // number of ms to wait to do a forcible shutdown if actionhero won't stop gracefully
    this.shutdownTimeout = 1000 * 30
    if (process.env.ACTIONHERO_SHUTDOWN_TIMEOUT) {
      this.shutdownTimeout = parseInt(process.env.ACTIONHERO_SHUTDOWN_TIMEOUT)
    }
  }

  sendState () {
    if (cluster.isWorker) { process.send({state: this.state}) }
  }

  async startServer () {
    this.state = 'starting'
    this.sendState()
    await api.commands.start()
    this.state = 'started'
    this.sendState()
    this.checkForInernalStop()
  }

  async stopServer () {
    this.state = 'stopping'
    this.sendState()
    await api.commands.stop()
    this.state = 'stopped'
    this.sendState()
  }

  async restartServer () {
    this.state = 'restarting'
    this.sendState()
    await api.commands.restart()
    this.state = 'started'
    this.sendState()
  }

  async stopProcess () {
    if (this.state === 'stopping' || this.state === 'stopped') { return }

    setTimeout(() => {
      throw new Error('process stop timeout reached.  terminating now.')
    }, this.shutdownTimeout)

    await this.stopServer()
    process.exit()
  }

  checkForInernalStop () {
    // check for an internal stop which doesn't close the processs
    clearTimeout(this.checkForInernalStopTimer)
    if (api.running !== true && this.state === 'started') { process.exit(0) }
    this.checkForInernalStopTimer = setTimeout(() => { this.checkForInernalStop() }, this.shutdownTimeout)
  }

  async run () {
    if (cluster.isWorker) {
      process.on('message', async (msg) => {
        if (msg === 'start') {
          await this.startServer()
        } else if (msg === 'stop') {
          await this.stopServer()
        } else if (msg === 'stopProcess') {
          await this.stopProcess()
        // in cluster, we cannot re-bind the port
        // so kill this worker, and then let the cluster start a new worker
        } else if (msg === 'restart') {
          await this.stopProcess()
        }
      })

      process.on('uncaughtException', (error) => {
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

      process.on('unhandledRejection', (reason, p) => {
        process.send({unhandledRejection: {reason: reason, p: p}})
        process.nextTick(process.exit)
      })
    }

    process.on('SIGINT', async () => { await this.stopProcess() })
    process.on('SIGTERM', async () => { await this.stopProcess() })
    process.on('SIGUSR2', async () => { await this.restartServer() })

    if (process.platform === 'win32' && !process.env.IISNODE_VERSION) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.on('SIGINT', () => { process.emit('SIGINT') })
    }

    // start the server!
    await this.startServer()
    return false
  }
}
