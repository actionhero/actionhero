'use strict'

// ////////////////////////////////////////////////////////////////////////////////////////////////////
//
// TO START IN CONSOLE: "./bin/actionhero start cluster"
//
// ** Production-ready actionhero cluster **
// - be sure to enable redis so that workers can share state
// - workers which die will be restarted
// - maser/manager specific logging
// - pidfile for master
// - USR2 restarts (graceful reload of workers while handling requests)
//   -- Note, socket/websocket clients will be disconnected, but there will always be a worker to handle them
//   -- HTTP/HTTPS/TCP clients will be allowed to finish the action they are working on before the server goes down
// - TTOU and TTIN signals to subtract/add workers
// - TCP, HTTP(S), and Web-socket clients will all be shared across the cluster
// - Can be run as a daemon or in-console
//   -- Simple Daemon: "actionhero start cluster --daemon"
//
// * Setting process titles does not work on windows or OSX
//
// This tool was heavily inspired by Ruby Unicorns [[ http://unicorn.bogomips.org/ ]]
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////

const fs = require('fs')
const cluster = require('cluster')
const path = require('path')
const os = require('os')
const async = require('async')
const readline = require('readline')
const winston = require('winston')
const isrunning = require('is-running')

// ///////////////////////////////////////

const Worker = function (parent, id, env) {
  this.state = null
  this.id = id
  this.env = env
  this.parent = parent
}

Worker.prototype.logPrefix = function () {
  let s = ''
  s += '[worker #' + this.id
  if (this.worker && this.worker.process) {
    s += ' (' + this.worker.process.pid + ')]: '
  } else {
    s += ']: '
  }
  return s
}

Worker.prototype.start = function () {
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

Worker.prototype.stop = function () {
  this.worker.send('stopProcess')
}

Worker.prototype.restart = function () {
  this.worker.send('restart')
}

// ///////////////////////////////////////

const ActionHeroCluster = function (args) {
  this.workers = []
  this.workersToRestart = []
  this.flapCount = 0

  this.options = this.defaults()
  for (let i in this.options) {
    if (args[i] !== null && args[i] !== undefined) {
      this.options[i] = args[i]
    }
  }

  let transports = []
  transports.push(
    new (winston.transports.File)({
      filename: this.options.logPath + '/' + this.options.logFile
    })
  )
  if (cluster.isMaster && args.silent !== true) {
    let consoleOptions = {
      colorize: true,
      timestamp: () => { return this.options.id + ' @ ' + new Date().toISOString() }
    }

    transports.push(
      new (winston.transports.Console)(consoleOptions)
    )
  }

  this.logger = new (winston.Logger)({
    levels: winston.config.syslog.levels,
    transports: transports
  })
}

ActionHeroCluster.prototype.defaults = function () {
  return {
    id: 'ActionHeroCluster',
    stopTimeout: 1000,
    expectedWorkers: os.cpus().length,
    flapWindow: 1000 * 30,
    execPath: __filename,
    pidPath: process.cwd() + '/pids',
    pidfile: 'cluster_pidfile',
    logPath: process.cwd() + '/log',
    logFile: 'cluster.log',
    workerTitlePrefix: 'actionhero-worker-',
    args: '',
    buildEnv: null
  }
}

ActionHeroCluster.prototype.log = function (message, severity) {
  this.logger.log(severity, message)
}

ActionHeroCluster.prototype.buildEnv = function (workerId) {
  if (typeof this.options.buildEnv === 'function') {
    return this.options.buildEnv.call(this, workerId)
  } else {
    return {
      title: this.options.workerTitlePrefix + workerId
    }
  }
}

ActionHeroCluster.prototype.configurePath = function (p, callback) {
  const stats = fs.lstatSync(p)
  if (stats.isDirectory() || stats.isSymbolicLink()) {
    process.nextTick(callback)
  } else {
    fs.mkdir(p, callback)
  }
}

ActionHeroCluster.prototype.writePidFile = function (callback) {
  const file = this.options.pidPath + '/' + this.options.pidfile

  if (fs.existsSync(file)) {
    const oldpid = parseInt(fs.readFileSync(file))
    if (isrunning(oldpid)) {
      return callback(new Error('actionHeroCluster already running (pid ' + oldpid + ')'))
    }
  }

  fs.writeFileSync(file, process.pid)
  process.nextTick(callback)
}

ActionHeroCluster.prototype.clearPidFile = function (callback) {
  const file = this.options.pidPath + '/' + this.options.pidfile

  if (fs.existsSync(file)) {
    const filePid = parseInt(fs.readFileSync(file))
    if (process.pid !== filePid) {
      return callback(new Error(`another process wrote this pid ${filePid}`))
    }
  }

  fs.unlinkSync(file)
  process.nextTick(callback)
}

ActionHeroCluster.prototype.start = function (callback) {
  let jobs = []

  this.log(JSON.stringify(this.options), 'debug')

  cluster.setupMaster({
    exec: this.options.execPath,
    args: this.options.args.split(' '),
    silent: true
  })

  process.on('SIGINT', () => {
    this.log('Signal: SIGINT', 'info')
    this.stop(process.exit)
  })

  process.on('SIGTERM', () => {
    this.log('Signal: SIGTERM', 'info')
    this.stop(process.exit)
  })

  process.on('SIGUSR2', () => {
    this.log('Signal: SIGUSR2', 'info')
    this.log('swap out new workers one-by-one', 'info')
    this.workers.forEach((worker) => {
      this.workersToRestart.push(worker.id)
    })
    this.work()
  })

  process.on('SIGHUP', () => {
    this.log('Signal: SIGHUP', 'info')
    this.log('reload all workers now', 'info')
    this.workers.forEach(function (worker) {
      worker.restart()
    })
  })

  process.on('SIGTTIN', () => {
    this.log('Signal: SIGTTIN', 'info')
    this.log('add a worker', 'info')
    this.options.expectedWorkers++
    this.work()
  })

  process.on('SIGTTOU', () => {
    this.log('Signal: SIGTTOU', 'info')
    this.log('remove a worker', 'info')
    this.options.expectedWorkers--
    if (this.options.expectedWorkers < 0) { this.options.expectedWorkers = 0 }
    this.work()
  })

  if (process.platform === 'win32' && !process.env.IISNODE_VERSION) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.on('SIGINT', () => {
      process.emit('SIGINT')
    })
  }

  jobs.push((done) => {
    this.log(' - STARTING CLUSTER -', 'notice')
    this.log('pid: ' + process.pid, 'notice')
    process.nextTick(done)
  })

  jobs.push((done) => {
    if (this.flapTimer) { clearInterval(this.flapTimer) }
    this.flapTimer = setInterval(() => {
      if (this.flapCount > (this.options.expectedWorkers * 2)) {
        this.log('CLUSTER IS FLAPPING (' + this.flapCount + ' crashes in ' + this.options.flapWindow + 'ms). Stopping', 'emerg')
        this.stop(process.exit)
      } else {
        this.flapCount = 0
      }
    }, this.options.flapWindow)

    done()
  })

  jobs.push((done) => { this.configurePath(this.options.logPath, done) })
  jobs.push((done) => { this.configurePath(this.options.pidPath, done) })
  jobs.push((done) => { this.writePidFile(done) })

  async.series(jobs, (error) => {
    if (error) {
      this.log(error, 'error')
      process.exit(1)
    } else {
      this.work()
      if (typeof callback === 'function') { callback() }
    }
  })
}

ActionHeroCluster.prototype.stop = function (callback) {
  if (this.workers.length === 0) {
    this.log('all workers stopped', 'notice')
    this.clearPidFile((error) => {
      if (error) { throw error }
      callback()
    })
  } else {
    this.log(this.workers.length + ' workers running, waiting on stop', 'info')
    setTimeout(() => { this.stop(callback) }, this.options.stopTimeout)
  }

  if (this.options.expectedWorkers > 0) {
    this.options.expectedWorkers = 0
    this.work()
  }
}

ActionHeroCluster.prototype.sortWorkers = function () {
  this.workers.sort(function (a, b) { return (a.id - b.id) })
}

ActionHeroCluster.prototype.work = function () {
  let worker
  let workerId
  this.sortWorkers()
  let stateCounts = {}

  this.workers.forEach((w) => {
    if (!stateCounts[w.state]) { stateCounts[w.state] = 0 }
    stateCounts[w.state]++
  })

  if (
      this.options.expectedWorkers < this.workers.length &&
      this.workers.length >= 1 &&
      !stateCounts.stopping &&
      !stateCounts.stopped &&
      !stateCounts.restarting
    ) {
    worker = this.workers[(this.workers.length - 1)]
    this.log('signaling worker #' + worker.id + ' to stop', 'info')
    worker.stop()
  } else if (
      (this.options.expectedWorkers > this.workers.length) &&
      !stateCounts.starting &&
      !stateCounts.restarting
    ) {
    workerId = 1
    this.workers.forEach((w) => {
      if (w.id === workerId) { workerId++ }
    })

    this.log('starting worker #' + workerId, 'info')
    let env = this.buildEnv(workerId)
    worker = new Worker(this, workerId, env)
    worker.start()
    this.workers.push(worker)
  } else if (
    this.workersToRestart.length > 0 &&
    !stateCounts.starting &&
    !stateCounts.stopping &&
    !stateCounts.stopped &&
    !stateCounts.restarting
  ) {
    workerId = this.workersToRestart.pop()
    this.workers.forEach((w) => {
      if (w.id === workerId) { w.stop() }
    })
  } else {
    if (stateCounts.started === this.workers.length) {
      this.log('cluster equilibrium state reached with ' + this.workers.length + ' workers', 'notice')
    } else if (!stateCounts.started && this.workers.length === 0) {
      this.log('0 workers in this cluster', 'warning')
    }
  }
}

// ///////////////////////////////////////

module.exports = {
  name: 'start cluster',
  description: 'start an actionhero cluster',
  example: 'actionhero start cluster --workers=[numWorkers] --workerTitlePrefix=[title] --daemon',

  inputs: {
    workers: {
      required: true,
      default: os.cpus().length,
      note: 'number of workers (defaults to # CPUs)'
    },
    title: {
      required: false,
      note: 'worker title prefix (default \'actionhero-worker-\') set `--workerTitlePrefix=hostname`, your app.id would be like `your_host_name-#`'
    },
    workerTitlePrefix: {
      required: true,
      default: 'actionhero-worker-'
    },
    daemon: {
      required: false,
      note: 'to fork and run as a new background process defaults to false'
    },
    silent: {required: false}
  },

  run: function (api, data) {
    let options = {
      execPath: path.normalize(path.join(__dirname, '/../../actionhero')),
      args: 'start',
      silent: (data.params.silent === 'true' || data.params.silent === true),
      expectedWorkers: data.params.workers,
      id: api.id,
      buildEnv: (workerId) => {
        let env = {}

        for (let k in process.env) {
          env[k] = process.env[k]
        }

        let title = data.params.workerTitlePrefix

        if (!title || title === '') {
          title = 'actionhero-worker-'
        } else if (title === 'hostname') {
          title = os.hostname() + '-'
        }

        title += workerId
        env.title = title
        env.ACTIONHERO_TITLE = title

        return env
      }
    }

    const ahc = new ActionHeroCluster(options)
    ahc.start()
  }
}
