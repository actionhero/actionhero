'use strict'

const cluster = require('cluster')

module.exports = class ClusterWorker {
  constructor (parent, id, env) {
    this.state = null
    this.id = id
    this.env = env
    this.parent = parent
  }

  logPrefix () {
    let s = ''
    s += '[worker #' + this.id
    if (this.worker && this.worker.process) {
      s += ' (' + this.worker.process.pid + ')]: '
    } else {
      s += ']: '
    }
    return s
  }

  start () {
    this.worker = cluster.fork(this.env)

    this.worker.on('exit', () => {
      this.parent.log(this.logPrefix() + 'exited', 'info')

      for (let i in this.parent.workers) {
        if (this.parent.workers[i].id === this.id) {
          this.parent.workers.splice(i, 1)
          break
        }
      }

      this.parent.work()
    })

    this.worker.on('message', (message) => {
      if (message.state) {
        this.state = message.state
        this.parent.log(this.logPrefix() + message.state, 'info')
      }

      if (message.uncaughtException) {
        this.parent.log(this.logPrefix() + 'uncaught exception => ' + message.uncaughtException.message, 'alert')
        message.uncaughtException.stack.forEach((line) => {
          this.parent.log(this.logPrefix() + '   ' + line, 'alert')
        })
        this.parent.flapCount++
      }

      if (message.unhandledRejection) {
        this.parent.log('worker #' + this.worker.id + ' [' + this.worker.process.pid + ']: unhandled rejection => ' + JSON.stringify(message.unhandledRejection), 'alert')
        this.parent.flapCount++
      }

      this.parent.work()
    })
  }

  stop () {
    this.worker.send('stopProcess')
  }

  restart () {
    this.worker.send('restart')
  }
}
