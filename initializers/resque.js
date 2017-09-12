'use strict'

const NodeResque = require('node-resque')

module.exports = {
  startPriority: 200,
  stopPriority: 100,
  loadPriority: 600,
  initialize: function (api) {
    if (api.config.redis === false) { return }

    const resqueOverrides = api.config.tasks.resque_overrides

    api.resque = {
      verbose: false,
      queue: null,
      multiWorker: null,
      scheduler: null,
      connectionDetails: {redis: api.redis.clients.tasks},

      startQueue: async () => {
        let Queue = NodeResque.Queue
        if (resqueOverrides && resqueOverrides.queue) { Queue = resqueOverrides.queue }
        api.resque.queue = new Queue({connection: api.resque.connectionDetails}, api.tasks.jobs)

        api.resque.queue.on('error', (error) => {
          api.log(error, 'error', '[api.resque.queue]')
        })

        await api.resque.queue.connect()
      },

      stopQueue: async () => {
        if (api.resque.queue) {
          await api.resque.queue.end()
        }
      },

      startScheduler: async () => {
        let Scheduler = NodeResque.Scheduler
        if (resqueOverrides && resqueOverrides.scheduler) { Scheduler = resqueOverrides.scheduler }
        if (api.config.tasks.scheduler === true) {
          api.resque.schedulerLogging = api.config.tasks.schedulerLogging
          api.resque.scheduler = new Scheduler({connection: api.resque.connectionDetails, timeout: api.config.tasks.timeout})

          api.resque.scheduler.on('error', (error) => {
            api.log(error, 'error', '[api.resque.scheduler]')
          })

          await api.resque.scheduler.connect()
          api.resque.scheduler.on('start', () => { api.log('resque scheduler started', api.resque.schedulerLogging.start) })
          api.resque.scheduler.on('end', () => { api.log('resque scheduler ended', api.resque.schedulerLogging.end) })
          api.resque.scheduler.on('poll', () => { api.log('resque scheduler polling', api.resque.schedulerLogging.poll) })
          api.resque.scheduler.on('working_timestamp', (timestamp) => { api.log(`resque scheduler working timestamp ${timestamp}`, api.resque.schedulerLogging.working_timestamp) })
          api.resque.scheduler.on('transferred_job', (timestamp, job) => { api.log(`resque scheduler enqueuing job ${timestamp}`, api.resque.schedulerLogging.transferred_job, job) })
          api.resque.scheduler.on('master', (state) => { api.log('This node is now the Resque scheduler master') })

          api.resque.scheduler.start()
        }
      },

      stopScheduler: async () => {
        if (api.resque.scheduler) {
          await api.resque.scheduler.end()
        }
      },

      startMultiWorker: async () => {
        let MultiWorker = NodeResque.MultiWorker
        if (resqueOverrides && resqueOverrides.multiWorker) { MultiWorker = resqueOverrides.multiWorker }
        api.resque.workerLogging = api.config.tasks.workerLogging
        api.resque.schedulerLogging = api.config.tasks.schedulerLogging

        api.resque.multiWorker = new MultiWorker({
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
        api.resque.multiWorker.on('start', (workerId) => { api.log('[ worker ] started', api.resque.workerLogging.start, {workerId: workerId}) })
        api.resque.multiWorker.on('end', (workerId) => { api.log('[ worker ] ended', api.resque.workerLogging.end, {workerId: workerId}) })
        api.resque.multiWorker.on('cleaning_worker', (workerId, worker, pid) => { api.log(`[ worker ] cleaning old worker ${worker}, (${pid})`, api.resque.workerLogging.cleaning_worker) })
        api.resque.multiWorker.on('poll', (workerId, queue) => { api.log(`[ worker ] polling ${queue}`, api.resque.workerLogging.poll, {workerId: workerId}) })
        api.resque.multiWorker.on('job', (workerId, queue, job) => { api.log(`[ worker ] working job ${queue}`, api.resque.workerLogging.job, {workerId: workerId, job: {class: job['class'], queue: job.queue}}) })
        api.resque.multiWorker.on('reEnqueue', (workerId, queue, job, plugin) => { api.log('[ worker ] reEnqueue job', api.resque.workerLogging.reEnqueue, {workerId: workerId, plugin: plugin, job: {class: job['class'], queue: job.queue}}) })
        api.resque.multiWorker.on('success', (workerId, queue, job, result) => { api.log(`[ worker ] job success ${queue}`, api.resque.workerLogging.success, {workerId: workerId, job: {class: job['class'], queue: job.queue}, result: result}) })
        api.resque.multiWorker.on('pause', (workerId) => { api.log('[ worker ] paused', api.resque.workerLogging.pause, {workerId: workerId}) })

        api.resque.multiWorker.on('failure', (workerId, queue, job, failure) => { api.exceptionHandlers.task(failure, queue, job, workerId) })
        api.resque.multiWorker.on('error', (error, workerId, queue, job) => { api.exceptionHandlers.task(error, queue, job, workerId) })

        // multiWorker emitters
        api.resque.multiWorker.on('internalError', (error) => { api.log(error, api.resque.workerLogging.internalError) })
        api.resque.multiWorker.on('multiWorkerAction', (verb, delay) => { api.log(`[ multiworker ] checked for worker status: ${verb} (event loop delay: ${delay}ms)`, api.resque.workerLogging.multiWorkerAction) })

        if (api.config.tasks.minTaskProcessors > 0) {
          await api.resque.multiWorker.start()
        }
      },

      stopMultiWorker: async () => {
        if (api.resque.multiWorker && api.config.tasks.minTaskProcessors > 0) {
          await api.resque.multiWorker.stop()
        }
      }
    }
  },

  start: async (api) => {
    if (api.config.redis.enabled === false) { return }

    if (api.config.tasks.minTaskProcessors === 0 && api.config.tasks.maxTaskProcessors > 0) {
      api.config.tasks.minTaskProcessors = 1
    }

    await api.resque.startQueue()
    await api.resque.startScheduler()
    await api.resque.startMultiWorker()
  },

  stop: async (api) => {
    if (api.config.redis.enabled === false) { return }

    api.resque.stopScheduler()
    api.resque.stopMultiWorker()
    api.resque.stopQueue()
  }
}
