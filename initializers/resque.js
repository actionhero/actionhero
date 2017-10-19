'use strict'

const NodeResque = require('node-resque')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * The node-resque workers and scheduler which process tasks.
 * @see https://github.com/taskrabbit/node-resque
 *
 * @namespace api.resque
 * @property {Object} queue - The Node Resque `queue`.  Used to enqueue tasks and read properties from Redis.
 * @property {Object} multiWorker - The Node Resque `Multi Worker`.  Runs tasks.
 * @property {Object} scheduler - The Node Resque `scheduler`.  Checks on delaed tasks.
 * @property {Object} connectionDetails - Connection oprions (from `api.redis.clients.tasks`).
 * @extends ActionHero.Initializer
 */
module.exports = class Resque extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'resque'
    this.loadPriority = 600
    this.startPriority = 200
    this.stopPriority = 100
  }

  initialize () {
    if (api.config.redis.enabled === false) { return }

    const resqueOverrides = api.config.tasks.resque_overrides

    api.resque = {
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
          return api.resque.queue.end()
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
          return api.resque.scheduler.end()
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
        api.resque.multiWorker.on('start', (workerId) => { api.log('[ worker ] started', api.resque.workerLogging.start, {workerId}) })
        api.resque.multiWorker.on('end', (workerId) => { api.log('[ worker ] ended', api.resque.workerLogging.end, {workerId}) })
        api.resque.multiWorker.on('cleaning_worker', (workerId, worker, pid) => { api.log(`[ worker ] cleaning old worker ${worker}, (${pid})`, api.resque.workerLogging.cleaning_worker) })
        api.resque.multiWorker.on('poll', (workerId, queue) => { api.log(`[ worker ] polling ${queue}`, api.resque.workerLogging.poll, {workerId}) })
        api.resque.multiWorker.on('job', (workerId, queue, job) => { api.log(`[ worker ] working job ${queue}`, api.resque.workerLogging.job, {workerId, job: {class: job['class'], queue: job.queue}}) })
        api.resque.multiWorker.on('reEnqueue', (workerId, queue, job, plugin) => { api.log('[ worker ] reEnqueue job', api.resque.workerLogging.reEnqueue, {workerId, plugin: plugin, job: {class: job['class'], queue: job.queue}}) })
        api.resque.multiWorker.on('pause', (workerId) => { api.log('[ worker ] paused', api.resque.workerLogging.pause, {workerId}) })

        api.resque.multiWorker.on('failure', (workerId, queue, job, failure) => { api.exceptionHandlers.task(failure, queue, job, workerId) })
        api.resque.multiWorker.on('error', (error, workerId, queue, job) => { api.exceptionHandlers.task(error, queue, job, workerId) })

        api.resque.multiWorker.on('success', (workerId, queue, job, result) => {
          let payload = {
            workerId,
            job: {
              class: job['class'],
              queue: job.queue
            }
          }

          if (result !== null && result !== undefined) { payload.result = result }
          api.log(`[ worker ] job success ${queue}`, api.resque.workerLogging.success, payload)
        })

        // multiWorker emitters
        api.resque.multiWorker.on('internalError', (error) => { api.log(error, api.resque.workerLogging.internalError) })
        api.resque.multiWorker.on('multiWorkerAction', (verb, delay) => { api.log(`[ multiworker ] checked for worker status: ${verb} (event loop delay: ${delay}ms)`, api.resque.workerLogging.multiWorkerAction) })

        if (api.config.tasks.minTaskProcessors > 0) {
          api.resque.multiWorker.start()
        }
      },

      stopMultiWorker: async () => {
        if (api.resque.multiWorker && api.config.tasks.minTaskProcessors > 0) {
          return api.resque.multiWorker.stop()
        }
      }
    }
  }

  async start () {
    if (api.config.redis.enabled === false) { return }

    if (api.config.tasks.minTaskProcessors === 0 && api.config.tasks.maxTaskProcessors > 0) {
      api.config.tasks.minTaskProcessors = 1
    }

    await api.resque.startQueue()
    await api.resque.startScheduler()
    await api.resque.startMultiWorker()
  }

  async stop () {
    if (api.config.redis.enabled === false) { return }

    await api.resque.stopScheduler()
    await api.resque.stopMultiWorker()
    await api.resque.stopQueue()
  }
}
