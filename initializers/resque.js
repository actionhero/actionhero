'use strict'

const NR = require('node-resque')

module.exports = {
  startPriority: 200,
  stopPriority: 100,
  loadPriority: 600,
  initialize: function (api) {
    const resqueOverrides = api.config.tasks.resque_overrides

    api.resque = {
      verbose: false,
      queue: null,
      multiWorker: null,
      scheduler: null,
      connectionDetails: {redis: api.redis.clients.tasks},

      startQueue: async () => {
        let Queue = NR.queue
        if (resqueOverrides && resqueOverrides.queue) { Queue = resqueOverrides.queue }
        this.queue = new Queue({connection: this.connectionDetails}, api.tasks.jobs)

        this.queue.on('error', (error) => {
          api.log(error, 'error', '[api.resque.queue]')
        })

        await new Promise((resolve, reject) => {
          this.queue.connect((error) => {
            if (error) { return reject(error) }
            return resolve()
          })
        })
      },

      stopQueue: async () => {
        if (api.resque.queue) {
          await new Promise((resolve, reject) => {
            api.resque.queue.end((error) => {
              if (error) { return reject(error) }
              return resolve()
            })
          })
        }
      },

      startScheduler: async () => {
        let Scheduler = NR.scheduler
        if (resqueOverrides && resqueOverrides.scheduler) { Scheduler = resqueOverrides.scheduler }
        if (api.config.tasks.scheduler === true) {
          this.schedulerLogging = api.config.tasks.schedulerLogging
          this.scheduler = new Scheduler({connection: this.connectionDetails, timeout: api.config.tasks.timeout})

          this.scheduler.on('error', (error) => {
            api.log(error, 'error', '[api.resque.scheduler]')
          })

          await new Promise((resolve) => {
            this.scheduler.connect(() => {
              this.scheduler.on('start', () => { api.log('resque scheduler started', this.schedulerLogging.start) })
              this.scheduler.on('end', () => { api.log('resque scheduler ended', this.schedulerLogging.end) })
              this.scheduler.on('poll', () => { api.log('resque scheduler polling', this.schedulerLogging.poll) })
              this.scheduler.on('working_timestamp', (timestamp) => { api.log(`resque scheduler working timestamp ${timestamp}`, this.schedulerLogging.working_timestamp) })
              this.scheduler.on('transferred_job', (timestamp, job) => { api.log(`resque scheduler enqueuing job ${timestamp}`, this.schedulerLogging.transferred_job, job) })
              this.scheduler.on('master', (state) => { api.log('This node is now the Resque scheduler master') })

              this.scheduler.start()
              resolve()
            })
          })
        }
      },

      stopScheduler: async () => {
        if (this.scheduler) {
          await new Promise((resolve) => {
            this.scheduler.end(() => {
              return resolve()
            })
          })
        }
      },

      startMultiWorker: async () => {
        let MultiWorker = NR.multiWorker
        if (resqueOverrides && resqueOverrides.multiWorker) { MultiWorker = resqueOverrides.multiWorker }
        this.workerLogging = api.config.tasks.workerLogging
        this.schedulerLogging = api.config.tasks.schedulerLogging

        this.multiWorker = new MultiWorker({
          connection: api.resque.connectionDetails,
          queues: api.config.tasks.queues,
          timeout: api.config.tasks.timeout,
          checkTimeout: api.config.tasks.checkTimeout,
          minTaskProcessors: api.config.tasks.minTaskProcessors,
          maxTaskProcessors: api.config.tasks.maxTaskProcessors,
          maxEventLoopDelay: api.config.tasks.maxEventLoopDelay,
          toDisconnectProcessors: api.config.tasks.toDisconnectProcessors
        }, api.tasks.jobs)

        // normal worker emitters
        this.multiWorker.on('start', (workerId) => { api.log('[ worker ] started', this.workerLogging.start, {workerId: workerId}) })
        this.multiWorker.on('end', (workerId) => { api.log('[ worker ] ended', this.workerLogging.end, {workerId: workerId}) })
        this.multiWorker.on('cleaning_worker', (workerId, worker, pid) => { api.log(`[ worker ] cleaning old worker ${worker}, (${pid})`, this.workerLogging.cleaning_worker) })
        this.multiWorker.on('poll', (workerId, queue) => { api.log(`[ worker ] polling ${queue}`, this.workerLogging.poll, {workerId: workerId}) })
        this.multiWorker.on('job', (workerId, queue, job) => { api.log(`[ worker ] working job ${queue}`, this.workerLogging.job, {workerId: workerId, job: {class: job['class'], queue: job.queue}}) })
        this.multiWorker.on('reEnqueue', (workerId, queue, job, plugin) => { api.log('[ worker ] reEnqueue job', this.workerLogging.reEnqueue, {workerId: workerId, plugin: plugin, job: {class: job['class'], queue: job.queue}}) })
        this.multiWorker.on('success', (workerId, queue, job, result) => { api.log(`[ worker ] job success ${queue}`, this.workerLogging.success, {workerId: workerId, job: {class: job['class'], queue: job.queue}, result: result}) })
        this.multiWorker.on('pause', (workerId) => { api.log('[ worker ] paused', this.workerLogging.pause, {workerId: workerId}) })

        this.multiWorker.on('failure', (workerId, queue, job, failure) => { api.exceptionHandlers.task(failure, queue, job, workerId) })
        this.multiWorker.on('error', (workerId, queue, job, error) => { api.exceptionHandlers.task(error, queue, job, workerId) })

        // multiWorker emitters
        this.multiWorker.on('internalError', (error) => { api.log(error, this.workerLogging.internalError) })
        this.multiWorker.on('multiWorkerAction', (verb, delay) => { api.log(`[ multiworker ] checked for worker status: ${verb} (event loop delay: ${delay}ms)`, this.workerLogging.multiWorkerAction) })

        if (api.config.tasks.minTaskProcessors > 0) {
          await new Promise((resolve) => {
            this.multiWorker.start(() => {
              return resolve()
            })
          })
        }
      },

      stopMultiWorker: async () => {
        if (this.multiWorker && api.config.tasks.minTaskProcessors > 0) {
          await new Promise((resolve) => {
            this.multiWorker.stop(() => {
              return resolve()
            })
          })
        }
      }
    }
  },

  start: async (api) => {
    if (api.config.tasks.minTaskProcessors === 0 && api.config.tasks.maxTaskProcessors > 0) {
      api.config.tasks.minTaskProcessors = 1
    }

    await api.resque.startQueue()
    await api.resque.startScheduler()
    await api.resque.startMultiWorker()
  },

  stop: async (api) => {
    api.resque.stopScheduler()
    api.resque.stopMultiWorker()
    api.resque.stopQueue()
  }
}
