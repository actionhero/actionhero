'use strict'

const async = require('async')

/**
 * Tools for enquing and inspecting the task sytem (delayed jobs).
 *
 * @namespace api.tasks
 * @property {Object} tasks - The tasks defined on this server.
 * @property {Object} jobs - The tasks defined on this server, converted into Node Resque jobs.
 * @property {Object} middleware - Available Task Middleware.
 * @property {Array} globalMiddleware - Array of global middleware modules.
 */

module.exports = {
  startPriority: 900,
  loadPriority: 699,
  initialize: function (api, next) {
    api.tasks = {

      tasks: {},
      jobs: {},
      middleware: {},
      globalMiddleware: [],

      loadFile: function (fullFilePath, reload) {
        if (!reload) { reload = false }

        const loadMessage = function (loadedTaskName) {
          api.log(`task ${(reload ? '(re)' : '')} loaded: ${loadedTaskName}, ${fullFilePath}`, 'debug')
        }

        api.watchFileAndAct(fullFilePath, () => {
          this.loadFile(fullFilePath, true)
        })

        let task
        try {
          const collection = require(fullFilePath)
          for (let i in collection) {
            task = collection[i]
            api.tasks.tasks[task.name] = task
            this.validateTask(api.tasks.tasks[task.name])
            api.tasks.jobs[task.name] = this.jobWrapper(task.name)
            loadMessage(task.name)
          }
        } catch (error) {
          api.exceptionHandlers.loader(fullFilePath, error)
          delete api.tasks.tasks[task.name]
          delete api.tasks.jobs[task.name]
        }
      },

      jobWrapper: function (taskName) {
        const task = api.tasks.tasks[taskName]

        let middleware = task.middleware || []
        let plugins = task.plugins || []
        let pluginOptions = task.pluginOptions || []

        if (task.frequency > 0) {
          if (plugins.indexOf('jobLock') < 0) { plugins.push('jobLock') }
          if (plugins.indexOf('queueLock') < 0) { plugins.push('queueLock') }
          if (plugins.indexOf('delayQueueLock') < 0) { plugins.push('delayQueueLock') }
        }

        // load middleware into plugins
        const processMiddleware = (m) => {
          if (api.tasks.middleware[m]) { // Ignore middleware until it has been loaded.
            const plugin = function (worker, func, queue, job, args, options) {
              this.name = m
              this.worker = worker
              this.queue = queue
              this.func = func
              this.job = job
              this.args = args
              this.options = options
              this.api = api

              if (this.worker.queueObject) {
                this.queueObject = this.worker.queueObject
              } else {
                this.queueObject = this.worker
              }
            }

            if (api.tasks.middleware[m].preProcessor) { plugin.prototype.before_perform = api.tasks.middleware[m].preProcessor }
            if (api.tasks.middleware[m].postProcessor) { plugin.prototype.after_perform = api.tasks.middleware[m].postProcessor }
            if (api.tasks.middleware[m].preEnqueue) { plugin.prototype.before_enqueue = api.tasks.middleware[m].preEnqueue }
            if (api.tasks.middleware[m].postEnqueue) { plugin.prototype.after_enqueue = api.tasks.middleware[m].postEnqueue }

            plugins.push(plugin)
          }
        }

        api.tasks.globalMiddleware.forEach(processMiddleware)
        middleware.forEach(processMiddleware)

        // TODO: solve scope issues here
        var self = this
        return {
          'plugins': plugins,
          'pluginOptions': pluginOptions,
          'perform': function () {
            var args = Array.prototype.slice.call(arguments)
            var cb = args.pop()
            if (args.length === 0) {
              args.push({}) // empty params array
            }
            args.push(
              function (error, resp) {
                self.enqueueRecurrentJob(taskName, function () {
                  cb(error, resp)
                })
              }
            )
            args.splice(0, 0, api)
            api.tasks.tasks[taskName].run.apply(this, args)
          }
        }
      },

      validateTask: function (task) {
        const fail = (msg) => {
          api.log(msg, 'emerg')
        }

        if (typeof task.name !== 'string' || task.name.length < 1) {
          fail('a task is missing \'task.name\'')
          return false
        } else if (typeof task.description !== 'string' || task.description.length < 1) {
          fail('Task ' + task.name + ' is missing \'task.description\'')
          return false
        } else if (typeof task.frequency !== 'number') {
          fail('Task ' + task.name + ' has no frequency')
          return false
        } else if (typeof task.queue !== 'string') {
          fail('Task ' + task.name + ' has no queue')
          return false
        } else if (typeof task.run !== 'function') {
          fail('Task ' + task.name + ' has no run method')
          return false
        } else {
          return true
        }
      },

      /**
       * Enqueue a task to be performed in the background.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {String}  taskName The name of the task.
       * @param  {Object}  params   Params to pass to the task.
       * @param  {string}  queue    (Optional) Which queue/priority to run this instance of the task on.
       * @param  {booleanCallback} callback The callback that handles the response.
       */
      enqueue: function (taskName, params, queue, callback) {
        if (typeof queue === 'function' && callback === undefined) {
          callback = queue; queue = this.tasks[taskName].queue
        } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
          callback = params; queue = this.tasks[taskName].queue; params = {}
        }
        api.resque.queue.enqueue(queue, taskName, params, callback)
      },

      /**
       * Enqueue a task to be performed in the background, at a certain time in the future.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {Number}  timestamp At what time the task is able to be run.  Does not gaurentee that the task will be run at this time. (in ms)
       * @param  {String}  taskName  The name of the task.
       * @param  {Object}  params    Params to pass to the task.
       * @param  {string}  queue     (Optional) Which queue/priority to run this instance of the task on.
       * @param  {booleanCallback} callback The callback that handles the response.
       */
      enqueueAt: function (timestamp, taskName, params, queue, callback) {
        if (typeof queue === 'function' && callback === undefined) {
          callback = queue; queue = this.tasks[taskName].queue
        } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
          callback = params; queue = this.tasks[taskName].queue; params = {}
        }
        api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback)
      },

      /**
       * Enqueue a task to be performed in the background, at a certain number of ms from now.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {Number}  time     How long from now should we wait until it is OK to run this task? (in ms)
       * @param  {String}  taskName The name of the task.
       * @param  {Object}  params   Params to pass to the task.
       * @param  {string}  queue    (Optional) Which queue/priority to run this instance of the task on.
       * @param  {booleanCallback} callback The callback that handles the response.
       */
      enqueueIn: function (time, taskName, params, queue, callback) {
        if (typeof queue === 'function' && callback === undefined) {
          callback = queue; queue = this.tasks[taskName].queue
        } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
          callback = params; queue = this.tasks[taskName].queue; params = {}
        }
        api.resque.queue.enqueueIn(time, queue, taskName, params, callback)
      },

      /**
       * Delete a previously enqueued task, which hasn't been run yet, from a queue.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  q          Which queue/priority is the task stored on?
       * @param  {string}  taskName   The name of the job, likley to be the same name as a tak.
       * @param  {Object|Array} args  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.
       *                              It is best to read job properties first via `api.tasks.queued` or similar method.
       * @param  {Number}  count      Of the jobs that match q, taskName, and args, up to what position should we delete? (Default 0; this command is 0-indexed)
       * @param  {booleanCallback} callback The callback that handles the response.
       */
      del: function (q, taskName, args, count, callback) {
        api.resque.queue.del(q, taskName, args, count, callback)
      },

      /**
       * Delete all previously enqueued tasks, which haven't been run yet, from all possible delayed timestamps.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  q          Which queue/priority is to run on?
       * @param  {string}  taskName   The name of the job, likley to be the same name as a tak.
       * @param  {Object|Array} args  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.
       *                              It is best to read job properties first via `api.tasks.delayedAt` or similar method.
       * @param  {booleanCallback} callback The callback that handles the response.
       */
      delDelayed: function (q, taskName, args, callback) {
        api.resque.queue.delDelayed(q, taskName, args, callback)
      },

      /**
       * Return the timestamps a task is scheduled for.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  q          Which queue/priority is to run on?
       * @param  {string}  taskName   The name of the job, likley to be the same name as a tak.
       * @param  {Object|Array} args  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.
       *                              It is best to read job properties first via `api.tasks.delayedAt` or similar method.
       * @param {arrayCallback} callback  The callback that handles the response.
       */
      scheduledAt: function (q, taskName, args, callback) {
        api.resque.queue.scheduledAt(q, taskName, args, callback)
      },

      /**
       * This callback is invoked with an Array of timestamps.
       * @callback arrayCallback
       * @param {Error} error An error reaching redis or null.
       * @param {Array} timestamps An array of timestamps.
       */

       /**
       * Return all resque stats for this namespace (how jobs failed, jobs succeded, etc)
       * Will throw an error if redis cannot be reached.
       *
       * @return {Promise<Object>} (varies on your redis instance)
       * @param {statsCallback} callback The callback that handles the response.
       */
      stats: function (callback) {
        api.resque.queue.stats(callback)
      },

      /**
       * This callback is invoked with information from your Resque deployment.
       * @callback statsCallback
       * @param {Error} error An error reaching redis or null.
       * @param {Object} stats The stats from your Resque deployment.
       */

       /**
       * Retrieve the details of jobs enqueued on a certain queue between start and stop (0-indexed)
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  q      The name of the queue.
       * @param  {Number}  start  The index of the first job to return.
       * @param  {Number}  stop   The index of the last job to return.
       * @param  {jobsCallback} callback  The callback that handles the response.
       */
      queued: function (q, start, stop, callback) {
        api.resque.queue.queued(q, start, stop, callback)
      },

      /**
       * This callback is invoked with an object containing details of jobs.
       * @callback jobsCallback
       * @param {Error} error An error or null.
       * @param {Object} jobs An object with details about jobs.
       */

      /**
       * Delete a queue in redis, and all jobs stored on it.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  q The name of the queue.
       * @param {simpleCallback} callback The callback that handles the response.
       */
      delQueue: function (q, callback) {
        api.resque.queue.delQueue(q, callback)
      },

      /**
       * Return any locks, as created by resque plugins or task middleware, in this redis namespace.
       * Will contain locks with keys like `resque:lock:{job}` and `resque:workerslock:{workerId}`
       * Will throw an error if redis cannot be reached.
       *
       * @param {locksCallback} callback The callback to handle the response.
       */
      locks: function (callback) {
        api.resque.queue.locks(callback)
      },

      /**
       * This callback is invoked with Locks, orginzed by type.
       * @callback locksCallback
       * @param {Error} error An error or null.
       * @param {Object} locks Locks, orginzed by type.
       */

       /**
       * Delete a lock on a job or worker.  Locks can be found via `api.tasks.locks`
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  lock The name of the lock.
       * @param  {simpleCallback}
       * @see api.tasks.locks
       */
      delLock: function (lock, callback) {
        api.resque.queue.delLock(lock, callback)
      },

      /**
       * List all timestamps for which tasks are enqueued in the future, via `api.tasks.enqueueIn` or `api.tasks.enqueueAt`.
       * Note: These timestamps will be in unix timestamps, not javascript MS timestamps.
       * Will throw an error if redis cannot be reached.
       *
       * @param {arrayCallback} callback A callback to handle the response.
       * @see api.tasks.enqueueIn
       * @see api.tasks.enqueueAt
       */
      timestamps: function (callback) {
        api.resque.queue.timestamps(callback)
      },

      /**
       * Return all jobs which have been enqueued to run at a certain timestamp.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {Number}  timestamp The timestamp to return jobs from.  Note: timestamp will be a unix timestamp, not javascript MS timestamp.
       * @param  {jobsCallback}  callback A callback to handle the response.
       */
      delayedAt: function (timestamp, callback) {
        api.resque.queue.delayedAt(timestamp, callback)
      },

      /**
       * Retrun all delayed jobs, orginized by the timetsamp at where they are to run at.
       * Note: This is a very slow command.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {jobsCallback}  callback A callback to handle the response.
       */
      allDelayed: function (callback) {
        api.resque.queue.allDelayed(callback)
      },

      /**
       * Retrun all workers registered by all members of this cluster.
       * Note: MultiWorker processors each register as a unique worker.
       * Will throw an error if redis cannot be reached.
       *
       * @param {workersCallbac} callback The callback to handle the response.
       */
      workers: function (callback) {
        api.resque.queue.workers(callback)
      },

      /**
       * This callback is invoked with information about the workers
       * in a cluster.
       * @callback workersCallback
       * @param {Error} error An error or null.
       * @param {Object} workers Information about the workers.
       */

      /**
       * What is a given worker working on?  If the worker is idle, 'started' will be returned.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  workerName The worker base name, usually a function of the PID.
       * @param  {string}  queues     The queues the worker is assigned to work.
       * @param  {workerStatusCallback} callback The callback to handle the response.
       */
      workingOn: function (workerName, queues, callback) {
        api.resque.queue.workingOn(workerName, queues, callback)
      },

      /**
       * This callback is invoked with that status of a worker.
       * @callback workerStatusCallback
       * @param {Error} error An error or null.
       * @param {Object|string} status A worker's status or 'started' if the worker is idle.
       */

      /**
       * Return all workers and what job they might be working on.
       * Will throw an error if redis cannot be reached.
       *
       * @param {allWorkerStatusCallback} callback The callback to handle the response.
       */
      allWorkingOn: function (callback) {
        api.resque.queue.allWorkingOn(callback)
      },

      /**
       * This callback is invoked with an Object, with worker names as keys,
       * containing the job they are working on. If the worker is idle,
       * 'started' will be returned.
       * @callback allWorkerStatusCallback
       * @param {Error} error An error or null.
       * @param {Object} workerStatus An Object with all workers' statuses.
       */

      /**
       * How many jobs are in the failed queue.
       * Will throw an error if redis cannot be reached.
       *
       * @param {numberCallback} callback A callback to handle the response.
       */
      failedCount: function (callback) {
        api.resque.queue.failedCount(callback)
      },

      /**
       * Retrieve the details of failed jobs between start and stop (0-indexed).
       * Will throw an error if redis cannot be reached.
       *
       * @param  {Number}  start  The index of the first job to return.
       * @param  {Number}  stop   The index of the last job to return.
       * @param  {jobsCallback} callback A callback to handle the response.
       */
      failed: function (start, stop, callback) {
        api.resque.queue.failed(start, stop, callback)
      },

      /**
       * Remove a specific job from the failed queue.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {Object}  failedJob The failed job, as defined by `api.tasks.failed`
       * @param  {simpleCallback} callback A callback to handle the response.
       * @see api.tasks.failed
       */
      removeFailed: function (failedJob, callback) {
        api.resque.queue.removeFailed(failedJob, callback)
      },

      /**
       * Remove a specific job from the failed queue, and retry it by placing it back into its original queue.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {Object}  failedJob The failed job, as defined by `api.tasks.failed`
       * @param  {simpleCallback} callback A callback to handle the response.
       * @see api.tasks.failed
       */
      retryAndRemoveFailed: function (failedJob, callback) {
        api.resque.queue.retryAndRemoveFailed(failedJob, callback)
      },

      /**
       * If a worker process crashes, it will leave its state in redis as "working".
       * You can remove workers from redis you know to be over, by specificing an age which would make them too old to exist.
       * This method will remove the data created by a 'stuck' worker and move the payload to the error queue.
       * However, it will not actually remove any processes which may be running.  A job *may* be running that you have removed.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {Number}  age The age of workers you know to be over, in seconds.
       * @param  {allWorkerStatusCallback} callback The callback to handle the response.
       */
      cleanOldWorkers: function (age, callback) {
        api.resque.queue.cleanOldWorkers(age, callback)
      },

      /**
       * Ensures that a task which has a frequency is either running, or already enqueued.
       * This is run automatically at boot for all tasks which have a frequency, via `api.tasks.enqueueAllRecurrentTasks`.
       * Will throw an error if redis cannot be reached.
       *
       * @param  {string}  taskName The name of the task.
       * @param  {simpleCallback} callback A callback to handle the response.
       * @see api.tasks.enqueueAllRecurrentTasks
       */
      enqueueRecurrentJob: function (taskName, callback) {
        const task = this.tasks[taskName]

        if (task.frequency <= 0) {
          callback()
        } else {
          this.del(task.queue, taskName, {}, () => {
            this.delDelayed(task.queue, taskName, {}, () => {
              this.enqueueIn(task.frequency, taskName, () => {
                api.log(`re-enqueued recurrent job ${taskName}`, api.config.tasks.schedulerLogging.reEnqueue)
                callback()
              })
            })
          })
        }
      },

      /**
       * This is run automatically at boot for all tasks which have a frequency, calling `api.tasks.enqueueRecurrentTask`
       * Will throw an error if redis cannot be reached.
       *
       * @param  {simpleCallback} callback A callback to handle the response.
       * @see api.tasks.enqueueRecurrentTask
       */
      enqueueAllRecurrentJobs: function (callback) {
        let jobs = []
        let loadedTasks = []

        Object.keys(this.tasks).forEach((taskName) => {
          const task = this.tasks[taskName]
          if (task.frequency > 0) {
            jobs.push((done) => {
              this.enqueue(taskName, (error, toRun) => {
                if (error) { return done(error) }
                if (toRun === true) {
                  api.log(`enqueuing periodic task: ${taskName}`, api.config.tasks.schedulerLogging.enqueue)
                  loadedTasks.push(taskName)
                }
                return done()
              })
            })
          }
        })

        async.series(jobs, function (error) {
          if (error) { return callback(error) }
          return callback(null, loadedTasks)
        })
      },

      /**
       * Stop a task with a frequency by removing it from all possible queues.
       * Will throw an error if redis cannot be reached.
       *
       * @async
       * @param  {string}  taskName The name of the task.
       * @param  {numberCallback}  callback A callback to handle the response.
       */
      stopRecurrentJob: function (taskName, callback) {
        // find the jobs in either the normal queue or delayed queues
        const task = this.tasks[taskName]
        if (task.frequency <= 0) {
          callback()
        } else {
          let removedCount = 0
          this.del(task.queue, task.name, {}, 1, (error, count) => {
            if (error) { return callback(error) }
            removedCount = removedCount + count
            this.delDelayed(task.queue, task.name, {}, (error, timestamps) => {
              removedCount = removedCount + timestamps.length
              callback(error, removedCount)
            })
          })
        }
      },

      /**
       * Return wholistic details about the task system, including failures, queues, and workers.
       * Will throw an error if redis cannot be reached.
       *
       * @param {resqueDetailCallback} callback A callback to handle the response.
       */
      details: function (callback) {
        let details = {'queues': {}, 'workers': {}}
        let jobs = []

        jobs.push((done) => {
          api.tasks.allWorkingOn((error, workers) => {
            if (error) { return done(error) }
            details.workers = workers
            return done()
          })
        })

        jobs.push((done) => {
          api.tasks.stats((error, stats) => {
            if (error) { return done(error) }
            details.stats = stats
            return done()
          })
        })

        jobs.push((done) => {
          api.resque.queue.queues((error, queues) => {
            if (error) { return done(error) }
            let queueJobs = []

            queues.forEach((queue) => {
              queueJobs.push((qdone) => {
                api.resque.queue.length(queue, (error, length) => {
                  if (error) { return qdone(error) }
                  details.queues[queue] = { length: length }
                  return qdone()
                })
              })
            })

            async.parallel(queueJobs, done)
          })
        })

        async.parallel(jobs, (error) => {
          return callback(error, details)
        })
      }

      /**
       * This callback is invoked with details about the Resque task system.
       * @callback resqueDetailCallback
       * @param {Error} error An error or null.
       * @param {Object} detials Details about the resque task system.
       */

    }

    function loadTasks (reload) {
      api.config.general.paths.task.forEach((p) => {
        api.utils.recursiveDirectoryGlob(p).forEach((f) => {
          api.tasks.loadFile(f, reload)
        })
      })
    }

    api.tasks.addMiddleware = function (middleware) {
      if (!middleware.name) { throw new Error('middleware.name is required') }
      if (!middleware.priority) { middleware.priority = api.config.general.defaultMiddlewarePriority }
      middleware.priority = Number(middleware.priority)
      api.tasks.middleware[middleware.name] = middleware
      if (middleware.global === true) {
        api.tasks.globalMiddleware.push(middleware.name)
        api.utils.sortGlobalMiddleware(api.tasks.globalMiddleware, api.tasks.middleware)
      }
      loadTasks(true)
    }

    loadTasks(false)

    next()
  },

  start: function (api, next) {
    if (api.config.tasks.scheduler === true) {
      api.tasks.enqueueAllRecurrentJobs((error) => {
        next(error)
      })
    } else {
      next()
    }
  }
}
