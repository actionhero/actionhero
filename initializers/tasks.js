'use strict'

const NodeResque = require('node-resque')

module.exports = {
  startPriority: 900,
  loadPriority: 699,
  initialize: (api) => {
    api.tasks = {
      tasks: {},
      jobs: {},
      middleware: {},
      globalMiddleware: []
    }

    api.tasks.loadFile = (fullFilePath, reload) => {
      if (!reload) { reload = false }

      api.watchFileAndAct(fullFilePath, () => {
        api.tasks.loadFile(fullFilePath, true)
      })

      let task
      let collection = require(fullFilePath)
      if (typeof collection === 'function') { collection = [collection] }
      for (let i in collection) {
        const TaskClass = collection[i]
        task = new TaskClass()
        task.validate()
        api.tasks.tasks[task.name] = task
        api.tasks.jobs[task.name] = api.tasks.jobWrapper(task.name)
        api.log(`task ${(reload ? '(re)' : '')} loaded: ${task.name}, ${fullFilePath}`, 'debug')
      }
    }

    api.tasks.jobWrapper = (taskName) => {
      const task = api.tasks.tasks[taskName]

      let middleware = task.middleware || []
      let plugins = task.plugins || []
      let pluginOptions = task.pluginOptions || []

      if (task.frequency > 0) {
        if (plugins.indexOf('JobLock') < 0) { plugins.push('JobLock') }
        if (plugins.indexOf('QueueLock') < 0) { plugins.push('QueueLock') }
        if (plugins.indexOf('DelayQueueLock') < 0) { plugins.push('DelayQueueLock') }
      }

      // load middleware into plugins
      const processMiddleware = (m) => {
        if (api.tasks.middleware[m]) {
          class Plugin extends NodeResque.Plugin {}
          if (api.tasks.middleware[m].preProcessor) { Plugin.prototype.beforePerform = api.tasks.middleware[m].preProcessor }
          if (api.tasks.middleware[m].postProcessor) { Plugin.prototype.afterPerform = api.tasks.middleware[m].postProcessor }
          if (api.tasks.middleware[m].preEnqueue) { Plugin.prototype.beforeEnqueue = api.tasks.middleware[m].preEnqueue }
          if (api.tasks.middleware[m].postEnqueue) { Plugin.prototype.afterEnqueue = api.tasks.middleware[m].postEnqueue }
          plugins.push(Plugin)
        }
      }

      api.tasks.globalMiddleware.forEach(processMiddleware)
      middleware.forEach(processMiddleware)

      return {
        plugins: plugins,
        pluginOptions: pluginOptions,
        perform: async function () {
          let combinedArgs = [api].concat(Array.prototype.slice.call(arguments))
          let response = await api.tasks.tasks[taskName].run.apply(this, combinedArgs)
          await api.tasks.enqueueRecurrentJob(taskName)
          return response
        }
      }
    }

    api.tasks.enqueue = async (taskName, params, queue) => {
      if (!params) { params = {} }
      if (!queue) { queue = api.tasks.tasks[taskName].queue }
      return api.resque.queue.enqueue(queue, taskName, params)
    }

    api.tasks.enqueueAt = async (timestamp, taskName, params, queue) => {
      if (!params) { params = {} }
      if (!queue) { queue = api.tasks.tasks[taskName].queue }
      return api.resque.queue.enqueueAt(timestamp, queue, taskName, params)
    }

    api.tasks.enqueueIn = async (time, taskName, params, queue) => {
      if (!params) { params = {} }
      if (!queue) { queue = api.tasks.tasks[taskName].queue }
      return api.resque.queue.enqueueIn(time, queue, taskName, params)
    }

    api.tasks.del = async (q, taskName, args, count) => {
      return api.resque.queue.del(q, taskName, args, count)
    }

    api.tasks.delDelayed = async (q, taskName, args) => {
      return api.resque.queue.delDelayed(q, taskName, args)
    }

    api.tasks.scheduledAt = async (q, taskName, args) => {
      return api.resque.queue.scheduledAt(q, taskName, args)
    }

    api.tasks.stats = async () => {
      return api.resque.queue.stats()
    }

    api.tasks.queued = async (q, start, stop) => {
      return api.resque.queue.queued(q, start, stop)
    }

    api.tasks.delQueue = async (q) => {
      return api.resque.queue.delQueue(q)
    }

    api.tasks.locks = async () => {
      return api.resque.queue.locks()
    }

    api.tasks.delLock = async (lock) => {
      return api.resque.queue.delLock(lock)
    }

    api.tasks.timestamps = async () => {
      return api.resque.queue.timestamps()
    }

    api.tasks.delayedAt = async (timestamp) => {
      return api.resque.queue.delayedAt(timestamp)
    }

    api.tasks.allDelayed = async (callback) => {
      return api.resque.queue.allDelayed()
    }

    api.tasks.workers = async (callback) => {
      return api.resque.queue.workers()
    }

    api.tasks.workingOn = async (workerName, queues) => {
      return api.resque.queue.workingOn(workerName, queues)
    }

    api.tasks.allWorkingOn = async () => {
      return api.resque.queue.allWorkingOn()
    }

    api.tasks.failedCount = async () => {
      return api.resque.queue.failedCount()
    }

    api.tasks.failed = async (start, stop) => {
      return api.resque.queue.failed(start, stop)
    }

    api.tasks.removeFailed = async (failedJob) => {
      return api.resque.queue.removeFailed(failedJob)
    }

    api.tasks.retryAndRemoveFailed = async (failedJob) => {
      return api.resque.queue.retryAndRemoveFailed(failedJob)
    }

    api.tasks.cleanOldWorkers = async (age) => {
      return api.resque.queue.cleanOldWorkers(age)
    }

    api.tasks.enqueueRecurrentJob = async (taskName) => {
      const task = api.tasks.tasks[taskName]

      if (task.frequency > 0) {
        await api.tasks.del(task.queue, taskName)
        await api.tasks.delDelayed(task.queue, taskName)
        await api.tasks.enqueueIn(task.frequency, taskName)
        api.log(`re-enqueued recurrent job ${taskName}`, api.config.tasks.schedulerLogging.reEnqueue)
      }
    }

    api.tasks.enqueueAllRecurrentJobs = async () => {
      let jobs = []
      let loadedTasks = []

      Object.keys(api.tasks.tasks).forEach((taskName) => {
        const task = api.tasks.tasks[taskName]
        if (task.frequency > 0) {
          jobs.push(async () => {
            let toRun = await api.tasks.enqueue(taskName)
            if (toRun === true) {
              api.log(`enqueuing periodic task: ${taskName}`, api.config.tasks.schedulerLogging.enqueue)
              loadedTasks.push(taskName)
            }
          })
        }
      })

      await api.utils.asyncWaterfall(jobs)
      return loadedTasks
    }

    api.tasks.stopRecurrentJob = async (taskName) => {
      // find the jobs in either the normal queue or delayed queues
      const task = api.tasks.tasks[taskName]
      if (task.frequency > 0) {
        let removedCount = 0
        let count = await api.tasks.del(task.queue, task.name, {}, 1)
        removedCount = removedCount + count
        let timestamps = await api.tasks.delDelayed(task.queue, task.name, {})
        removedCount = removedCount + timestamps.length
        return removedCount
      }
    }

    api.tasks.details = async () => {
      let details = {'queues': {}, 'workers': {}}

      details.workers = await api.tasks.allWorkingOn()
      details.stats = await api.tasks.stats()
      let queues = await api.resque.queue.queues()

      for (let i in queues) {
        let queue = queues[i]
        let length = await api.resque.queue.length(queue)
        details.queues[queue] = { length: length }
      }

      return details
    }

    api.tasks.loadTasks = (reload) => {
      api.config.general.paths.task.forEach((p) => {
        api.utils.recursiveDirectoryGlob(p).forEach((f) => {
          api.tasks.loadFile(f, reload)
        })
      })
    }

    api.tasks.addMiddleware = (middleware) => {
      if (!middleware.name) { throw new Error('middleware.name is required') }
      if (!middleware.priority) { middleware.priority = api.config.general.defaultMiddlewarePriority }
      middleware.priority = Number(middleware.priority)
      api.tasks.middleware[middleware.name] = middleware
      if (middleware.global === true) {
        api.tasks.globalMiddleware.push(middleware.name)
        api.utils.sortGlobalMiddleware(api.tasks.globalMiddleware, api.tasks.middleware)
      }
      api.tasks.loadTasks(true)
    }

    api.tasks.loadTasks(false)
  },

  start: async (api) => {
    if (api.config.redis.enabled === false) { return }

    if (api.config.tasks.scheduler === true) {
      await api.tasks.enqueueAllRecurrentJobs()
    }
  }
}
