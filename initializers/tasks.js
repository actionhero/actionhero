'use strict'

const NodeResque = require('node-resque')
const glob = require('glob')
const path = require('path')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * This callback is displayed as part of the Requester class.
 * @callback ActionHero~TaskCallback
 * @param {Object} this.worker - The task worker, if this is a pre or post process step.
 * @param {Object} this.args - If this is a queue step, the arguemnts to the task
 * @param {Object} this.queue - The queue to be used / is being used.
 * @see ActionHero~TaskMiddleware
 */

/**
 * Middleware definition for Actions
 *
 * @async
 * @typedef {Object} ActionHero~TaskMiddleware
 * @property {string} name - Unique name for the middleware.
 * @property {Boolean} global - Is this middleware applied to all tasks?
 * @property {Number} priority - Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`.
 * @property {ActionHero~TaskCallback} preProcessor - Called berore the action runs.  Has access to all params, before sanitizartion.  Can modify the data object for use in actions.
 * @property {ActionHero~TaskCallback} postProcessor - Called after the action runs.
 * @property {ActionHero~TaskCallback} preEnqueue - Called before a task using this middleware is enqueud.
 * @property {ActionHero~TaskCallback} postEnqueue - Called after a task using this middleware is enqueud.
 * @see api.actions.addMiddleware
 * @example
const middleware = {
  name: 'timer',
  global: true,
  priority: 90,
  preProcessor: async () => {
    const worker = this.worker
    worker.startTime = process.hrtime()
  },
  postProcessor: async () => {
    const worker = this.worker
    const elapsed = process.hrtime(worker.startTime)
    const seconds = elapsed[0]
    const millis = elapsed[1] / 1000000
    api.log(worker.job.class + ' done in ' + seconds + ' s and ' + millis + ' ms.', 'info')
  },
  preEnqueue: async () => {
    const arg = this.args[0]
    return (arg === 'ok') // returing `false` will prevent the task from enqueing
  },
  postEnqueue: async () => {
    api.log("Task successfully enqueued!")
  }
}

api.tasks.addMiddleware(middleware)
 */

/**
 * Tools for enquing and inspecting the task sytem (delayed jobs).
 *
 * @namespace api.tasks
 * @property {Object} tasks - The tasks defined on this server.
 * @property {Object} jobs - The tasks defined on this server, converted into Node Resque jobs.
 * @property {Object} middleware - Available Task Middleware.
 * @property {Array} globalMiddleware - Array of global middleware modules.
 * @extends ActionHero.Initializer
 */
module.exports = class Tasks extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'tasks'
    this.loadPriority = 699
    this.startPriority = 900
  }

  initialize () {
    api.tasks = {
      tasks: {},
      jobs: {},
      middleware: {},
      globalMiddleware: []
    }

    /**
     * @private
     */
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

        if (api.tasks.tasks[task.name] && !reload) {
          api.log(`an existing task with the same name \`${task.name}\` will be overridden by the file ${fullFilePath}`, 'warning')
        }

        api.tasks.tasks[task.name] = task
        api.tasks.jobs[task.name] = api.tasks.jobWrapper(task.name)
        api.log(`task ${(reload ? '(re)' : '')} loaded: ${task.name}, ${fullFilePath}`, 'debug')
      }
    }

    /**
     * @private
     */
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
          let combinedArgs = [].concat(Array.prototype.slice.call(arguments))
          combinedArgs.push(this)
          let response = await task.run.apply(task, combinedArgs)
          await api.tasks.enqueueRecurrentTask(taskName)
          return response
        }
      }
    }

    /**
     * Enqueue a task to be performed in the background.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {String}  taskName The name of the task.
     * @param  {Object}  params   Params to pass to the task.
     * @param  {string}  queue    (Optional) Which queue/priority to run this instance of the task on.
     * @return {Promise<Boolean>} Did the task enqueue?
     */
    api.tasks.enqueue = async (taskName, params, queue) => {
      if (!params) { params = {} }
      if (!queue) { queue = api.tasks.tasks[taskName].queue }
      return api.resque.queue.enqueue(queue, taskName, params)
    }

    /**
     * Enqueue a task to be performed in the background, at a certain time in the future.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {Number}  timestamp At what time the task is able to be run.  Does not gaurentee that the task will be run at this time. (in ms)
     * @param  {String}  taskName  The name of the task.
     * @param  {Object}  params    Params to pass to the task.
     * @param  {string}  queue     (Optional) Which queue/priority to run this instance of the task on.
     * @return {Promise}
     */
    api.tasks.enqueueAt = async (timestamp, taskName, params, queue) => {
      if (!params) { params = {} }
      if (!queue) { queue = api.tasks.tasks[taskName].queue }
      return api.resque.queue.enqueueAt(timestamp, queue, taskName, params)
    }

    /**
     * Enqueue a task to be performed in the background, at a certain number of ms from now.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {Number}  time     How long from now should we wait until it is OK to run this task? (in ms)
     * @param  {String}  taskName The name of the task.
     * @param  {Object}  params   Params to pass to the task.
     * @param  {string}  queue    (Optional) Which queue/priority to run this instance of the task on.
     * @return {Promise}
     */
    api.tasks.enqueueIn = async (time, taskName, params, queue) => {
      if (!params) { params = {} }
      if (!queue) { queue = api.tasks.tasks[taskName].queue }
      return api.resque.queue.enqueueIn(time, queue, taskName, params)
    }

    /**
     * Delete a previously enqueued task, which hasn't been run yet, from a queue.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  q          Which queue/priority is the task stored on?
     * @param  {string}  taskName   The name of the job, likley to be the same name as a tak.
     * @param  {Object|Array} args  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.
     *                              It is best to read job properties first via `api.tasks.queued` or similar method.
     * @param  {Number}  count      Of the jobs that match q, taskName, and args, up to what position should we delete? (Default 0; this command is 0-indexed)
     * @return {Promise}
     */
    api.tasks.del = async (q, taskName, args, count) => {
      return api.resque.queue.del(q, taskName, args, count)
    }

    /**
     * Delete all previously enqueued tasks, which haven't been run yet, from all possible delayed timestamps.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  q          Which queue/priority is to run on?
     * @param  {string}  taskName   The name of the job, likley to be the same name as a tak.
     * @param  {Object|Array} args  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.
     *                              It is best to read job properties first via `api.tasks.delayedAt` or similar method.
     * @return {Promise}
     */
    api.tasks.delDelayed = async (q, taskName, args) => {
      return api.resque.queue.delDelayed(q, taskName, args)
    }

    /**
     * Return the timestamps a task is scheduled for.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  q          Which queue/priority is to run on?
     * @param  {string}  taskName   The name of the job, likley to be the same name as a tak.
     * @param  {Object|Array} args  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.
     *                              It is best to read job properties first via `api.tasks.delayedAt` or similar method.
     * @return {Promise<Array>}    Returns an array of timestamps.
     */
    api.tasks.scheduledAt = async (q, taskName, args) => {
      return api.resque.queue.scheduledAt(q, taskName, args)
    }

    /**
     * Return all resque stats for this namespace (how jobs failed, jobs succeded, etc)
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Object>} (varies on your redis instance)
     */
    api.tasks.stats = async () => {
      return api.resque.queue.stats()
    }

    /**
     * Retrieve the details of jobs enqueued on a certain queue between start and stop (0-indexed)
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  q      The name of the queue.
     * @param  {Number}  start  The index of the first job to return.
     * @param  {Number}  stop   The index of the last job to return.
     * @return {Promise<Array>} An array of the jobs enqueued.
     */
    api.tasks.queued = async (q, start, stop) => {
      return api.resque.queue.queued(q, start, stop)
    }

    /**
     * Delete a queue in redis, and all jobs stored on it.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  q The name of the queue.
     * @return {Promise}
     */
    api.tasks.delQueue = async (q) => {
      return api.resque.queue.delQueue(q)
    }

    /**
     * Return any locks, as created by resque plugins or task middleware, in this redis namespace.
     * Will contain locks with keys like `resque:lock:{job}` and `resque:workerslock:{workerId}`
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Object>} Locks, orginzed by type.
     */
    api.tasks.locks = async () => {
      return api.resque.queue.locks()
    }

    /**
     * Delete a lock on a job or worker.  Locks can be found via `api.tasks.locks`
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  lock The name of the lock.
     * @return {Promise}
     * @see api.tasks.locks
     */
    api.tasks.delLock = async (lock) => {
      return api.resque.queue.delLock(lock)
    }

    /**
     * List all timestamps for which tasks are enqueued in the future, via `api.tasks.enqueueIn` or `api.tasks.enqueueAt`
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Array>} An array of timetamps. Note: These timestamps will be in unix timestamps, not javascript MS timestamps.
     * @see api.tasks.enqueueIn
     * @see api.tasks.enqueueAt
     */
    api.tasks.timestamps = async () => {
      return api.resque.queue.timestamps()
    }

    /**
     * Return all jobs which have been enqueued to run at a certain timestamp.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {Number}  timestamp The timestamp to return jobs from.  Note: timestamp will be a unix timestamp, not javascript MS timestamp.
     * @return {Promise<Array>}    An array of jobs.
     */
    api.tasks.delayedAt = async (timestamp) => {
      return api.resque.queue.delayedAt(timestamp)
    }

    /**
     * Retrun all delayed jobs, orginized by the timetsamp at where they are to run at.
     * Note: This is a very slow command.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Object>}
     */
    api.tasks.allDelayed = async () => {
      return api.resque.queue.allDelayed()
    }

    /**
     * Retrun all workers registered by all members of this cluster.
     * Note: MultiWorker processors each register as a unique worker.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Object>}
     */
    api.tasks.workers = async () => {
      return api.resque.queue.workers()
    }

    /**
     * What is a given worker working on?  If the worker is idle, 'started' will be returned.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  workerName The worker base name, usually a function of the PID.
     * @param  {string}  queues     The queues the worker is assigned to work.
     * @return {Promise<Object>}
     */
    api.tasks.workingOn = async (workerName, queues) => {
      return api.resque.queue.workingOn(workerName, queues)
    }

    /**
     * Return all workers and what job they might be working on.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Object>} An Object, with worker names as keys, containing the job they are working on.
     *                           If the worker is idle, 'started' will be returned.
     */
    api.tasks.allWorkingOn = async () => {
      return api.resque.queue.allWorkingOn()
    }

    /**
     * How many jobs are in the failed queue.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Number>} The number of failed jobs at this moment.
     */
    api.tasks.failedCount = async () => {
      return api.resque.queue.failedCount()
    }

    /**
     * Retrieve the details of failed jobs between start and stop (0-indexed).
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {Number}  start  The index of the first job to return.
     * @param  {Number}  stop   The index of the last job to return.
     * @return {Promise<Array>} An array of the failed jobs.
     */
    api.tasks.failed = async (start, stop) => {
      return api.resque.queue.failed(start, stop)
    }

    /**
     * Remove a specific job from the failed queue.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {Object}  failedJob The failed job, as defined by `api.tasks.failed`
     * @return {Promise}
     * @see api.tasks.failed
     */
    api.tasks.removeFailed = async (failedJob) => {
      return api.resque.queue.removeFailed(failedJob)
    }

    /**
     * Remove a specific job from the failed queue, and retry it by placing it back into its original queue.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {Object}  failedJob The failed job, as defined by `api.tasks.failed`
     * @return {Promise}
     * @see api.tasks.failed
     */
    api.tasks.retryAndRemoveFailed = async (failedJob) => {
      return api.resque.queue.retryAndRemoveFailed(failedJob)
    }

    /**
     * If a worker process crashes, it will leave its state in redis as "working".
     * You can remove workers from redis you know to be over, by specificing an age which would make them too old to exist.
     * This method will remove the data created by a 'stuck' worker and move the payload to the error queue.
     * However, it will not actually remove any processes which may be running.  A job *may* be running that you have removed.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {Number}  age The age of workers you know to be over, in seconds.
     * @return {Promise<Object>} Details about workers which were removed.
     */
    api.tasks.cleanOldWorkers = async (age) => {
      return api.resque.queue.cleanOldWorkers(age)
    }

    /**
     * Ensures that a task which has a frequency is either running, or already enqueued.
     * This is run automatically at boot for all tasks which have a frequency, via `api.tasks.enqueueAllRecurrentTasks`.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  taskName The name of the task.
     * @return {Promise}
     * @see api.tasks.enqueueAllRecurrentTasks
     */
    api.tasks.enqueueRecurrentTask = async (taskName) => {
      const task = api.tasks.tasks[taskName]

      if (task.frequency > 0) {
        await api.tasks.del(task.queue, taskName)
        await api.tasks.delDelayed(task.queue, taskName)
        await api.tasks.enqueueIn(task.frequency, taskName)
        api.log(`re-enqueued recurrent job ${taskName}`, api.config.tasks.schedulerLogging.reEnqueue)
      }
    }

    /**
     * This is run automatically at boot for all tasks which have a frequency, calling `api.tasks.enqueueRecurrentTask`
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise}
     * @see api.tasks.enqueueRecurrentTask
     */
    api.tasks.enqueueAllRecurrentTasks = async () => {
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

    /**
     * Stop a task with a frequency by removing it from all possible queues.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @param  {string}  taskName The name of the task.
     * @return {Promise<Number>}  How many tasks were removed.
     */
    api.tasks.stopRecurrentTask = async (taskName) => {
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

    /**
     * Return wholistic details about the task system, including failures, queues, and workers.
     * Will throw an error if redis cannot be reached.
     *
     * @async
     * @return {Promise<Object>} Details about the task system.
     */
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
        glob.sync(path.join(p, '**', '*.js')).forEach((f) => {
          api.tasks.loadFile(f, reload)
        })
      })

      for (let pluginName in api.config.plugins) {
        if (api.config.plugins[pluginName].tasks !== false) {
          let pluginPath = api.config.plugins[pluginName].path
          glob.sync(path.join(pluginPath, 'tasks', '**', '*.js')).forEach((f) => {
            api.tasks.loadFile(f, reload)
          })
        }
      }
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
  }

  async start () {
    if (api.config.redis.enabled === false) { return }

    if (api.config.tasks.scheduler === true) {
      await api.tasks.enqueueAllRecurrentTasks()
    }
  }
}
