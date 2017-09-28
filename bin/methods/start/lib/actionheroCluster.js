'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const {promisify} = require('util')
const cluster = require('cluster')
const readline = require('readline')
const winston = require('winston')
const isrunning = require('is-running')
const ClusterWorker = require(path.join(__dirname, 'clusterWorker.js'))

module.exports = class ActionHeroCluster {
  constructor (args) {
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

  defaults () {
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

  log (message, severity) {
    this.logger.log(severity, message)
  }

  buildEnv (workerId) {
    if (typeof this.options.buildEnv === 'function') {
      return this.options.buildEnv.call(this, workerId)
    } else {
      return {
        title: this.options.workerTitlePrefix + workerId
      }
    }
  }

  async configurePath (p) {
    const stats = fs.lstatSync(p)
    if (stats.isDirectory() || stats.isSymbolicLink()) {
      return true
    } else {
      await promisify(fs.mkdir)(p)
    }
  }

  writePidFile () {
    const file = this.options.pidPath + '/' + this.options.pidfile

    if (fs.existsSync(file)) {
      const oldpid = parseInt(fs.readFileSync(file))
      if (isrunning(oldpid)) {
        throw new Error('actionHeroCluster already running (pid ' + oldpid + ')')
      }
    }

    fs.writeFileSync(file, process.pid)
  }

  clearPidFile () {
    const file = this.options.pidPath + '/' + this.options.pidfile

    if (fs.existsSync(file)) {
      const filePid = parseInt(fs.readFileSync(file))
      if (process.pid !== filePid) {
        throw new Error(`another process wrote this pid ${filePid}`)
      }
    }

    fs.unlinkSync(file)
  }

  async start () {
    this.log(JSON.stringify(this.options), 'debug')

    cluster.setupMaster({
      exec: this.options.execPath,
      args: this.options.args.split(' '),
      silent: true
    })

    process.on('SIGINT', async () => {
      this.log('Signal: SIGINT', 'info')
      await this.stop()
    })

    process.on('SIGTERM', async () => {
      this.log('Signal: SIGTERM', 'info')
      await this.stop()
    })

    process.on('SIGUSR2', async () => {
      this.log('Signal: SIGUSR2', 'info')
      this.log('swap out new workers one-by-one', 'info')
      this.workers.forEach((worker) => { this.workersToRestart.push(worker.id) })
      await this.work()
    })

    process.on('SIGHUP', async () => {
      this.log('Signal: SIGHUP', 'info')
      this.log('reload all workers now', 'info')
      this.workers.forEach(async (worker) => {
        await worker.restart()
      })
    })

    process.on('SIGTTIN', async () => {
      this.log('Signal: SIGTTIN', 'info')
      this.log('add a worker', 'info')
      this.options.expectedWorkers++
      await this.work()
    })

    process.on('SIGTTOU', async () => {
      this.log('Signal: SIGTTOU', 'info')
      this.log('remove a worker', 'info')
      this.options.expectedWorkers--
      if (this.options.expectedWorkers < 0) { this.options.expectedWorkers = 0 }
      await this.work()
    })

    if (process.platform === 'win32' && !process.env.IISNODE_VERSION) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.on('SIGINT', () => { process.emit('SIGINT') })
    }

    this.log(' - STARTING CLUSTER -', 'notice')
    this.log('pid: ' + process.pid, 'notice')

    if (this.flapTimer) { clearInterval(this.flapTimer) }

    this.flapTimer = setInterval(async () => {
      if (this.flapCount > (this.options.expectedWorkers * 2)) {
        this.log('CLUSTER IS FLAPPING (' + this.flapCount + ' crashes in ' + this.options.flapWindow + 'ms). Stopping', 'emerg')
        await this.stop()
        process.exit(1)
      } else {
        this.flapCount = 0
      }
    }, this.options.flapWindow)

    await this.configurePath(this.options.logPath)
    await this.configurePath(this.options.pidPath)
    await this.writePidFile()
    await this.work()
  }

  async stop () {
    if (this.workers.length === 0) {
      this.log('all workers stopped', 'notice')
      await this.clearPidFile()
      await promisify(setTimeout)(100)
      process.exit()
    }

    if (this.options.expectedWorkers > 0) {
      this.options.expectedWorkers = 0
      await this.work()
    }

    if (this.workers.length > 0) {
      this.log(this.workers.length + ' workers running, waiting on stop', 'info')
      await promisify(setTimeout)(this.options.stopTimeout)
      this.stop()
    }
  }

  sortWorkers () {
    this.workers.sort((a, b) => { return (a.id - b.id) })
  }

  work () {
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
      worker = new ClusterWorker(this, workerId, env)
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
      } else if (!stateCounts.started && this.workers.length === 0 && this.options.expectedWorkers > 0) {
        this.log('0 workers in this cluster', 'warning')
      }
    }
  }
}
