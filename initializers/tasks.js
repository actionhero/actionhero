'use strict'

module.exports = {
  startPriority: 900,
  loadPriority: 699,
  initialize: function (api) {
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
        let self = this
        return {
          'plugins': plugins,
          'pluginOptions': pluginOptions,
          'perform': function () {
            let args = Array.prototype.slice.call(arguments)
            let cb = args.pop()
            if (args.length === 0) {
              args.push({}) // empty params array
            }
            args.push((error, resp) => {
              self.enqueueRecurrentJob(taskName, () => {
                cb(error, resp)
              })
            })
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

      enqueue: async (taskName, params, queue) => {
        if (!params) { params = {} }
        if (!queue) { queue = this.tasks[taskName].queue }

        return new Promise((resolve, reject) => {
          api.resque.queue.enqueue(queue, taskName, params, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      enqueueAt: async (timestamp, taskName, params, queue) => {
        if (!params) { params = {} }
        if (!queue) { queue = this.tasks[taskName].queue }

        return new Promise((resolve, reject) => {
          api.resque.queue.enqueueAt(timestamp, queue, taskName, params, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      enqueueIn: async (time, taskName, params, queue) => {
        if (!params) { params = {} }
        if (!queue) { queue = this.tasks[taskName].queue }

        return new Promise((resolve, reject) => {
          api.resque.queue.enqueueIn(time, queue, taskName, params, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      del: async (q, taskName, args, count) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.del(q, taskName, args, count, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      delDelayed: async (q, taskName, args) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.delDelayed(q, taskName, args, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      scheduledAt: async (q, taskName, args) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.scheduledAt(q, taskName, args, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      stats: async () => {
        return new Promise((resolve, reject) => {
          api.resque.queue.stats((error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      queued: async (q, start, stop) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.queued(q, start, stop, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      delQueue: async (q) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.delQueue(q, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      locks: async () => {
        return new Promise((resolve, reject) => {
          api.resque.queue.locks((error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      delLock: async (lock) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.delLock(lock, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      timestamps: async () => {
        return new Promise((resolve, reject) => {
          api.resque.queue.timestamps((error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      delayedAt: async (timestamp) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.delayedAt(timestamp, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      allDelayed: async (callback) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.allDelayed((error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      workers: async (callback) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.workers((error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      workingOn: async (workerName, queues) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.workingOn(workerName, queues, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      allWorkingOn: async () => {
        return new Promise((resolve, reject) => {
          api.resque.queue.allWorkingOn((error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      failedCount: async () => {
        return new Promise((resolve, reject) => {
          api.resque.queue.failedCount((error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      failed: async (start, stop) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.failed(start, stop, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      removeFailed: async (failedJob) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.removeFailed(failedJob, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      retryAndRemoveFailed: async (failedJob) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.retryAndRemoveFailed(failedJob, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      cleanOldWorkers: async (age) => {
        return new Promise((resolve, reject) => {
          api.resque.queue.cleanOldWorkers(age, (error, response) => {
            if (error) { return reject(error) }
            resolve(response)
          })
        })
      },

      enqueueRecurrentJob: async (taskName) => {
        const task = this.tasks[taskName]

        if (task.frequency > 0) {
          await this.del(task.queue, taskName, {})
          await this.delDelayed(task.queue, taskName, {})
          await this.enqueueIn(task.frequency, taskName)
          api.log(`re-enqueued recurrent job ${taskName}`, api.config.tasks.schedulerLogging.reEnqueue)
        }
      },

      enqueueAllRecurrentJobs: async () => {
        let jobs = []
        let loadedTasks = []

        Object.keys(this.tasks).forEach((taskName) => {
          const task = this.tasks[taskName]
          if (task.frequency > 0) {
            jobs.push(async () => {
              let toRun = await this.enqueue(taskName)
              if (toRun === true) {
                api.log(`enqueuing periodic task: ${taskName}`, api.config.tasks.schedulerLogging.enqueue)
                loadedTasks.push(taskName)
              }
            })
          }
        })

        await api.utiles.asyncWaterfall(jobs)
        return loadedTasks
      },

      stopRecurrentJob: async (taskName) => {
        // find the jobs in either the normal queue or delayed queues
        const task = this.tasks[taskName]
        if (task.frequency > 0) {
          let removedCount = 0
          let count = await this.del(task.queue, task.name, {}, 1)
          removedCount = removedCount + count
          let timestamps = await this.delDelayed(task.queue, task.name, {})
          removedCount = removedCount + timestamps.length
          return removedCount
        }
      },

      details: async () => {
        let details = {'queues': {}, 'workers': {}}

        details.workers = await api.tasks.allWorkingOn()
        details.stats = await api.tasks.stats()
        let queues = await api.resque.queue.queues()
        queues.forEach(async (queue) => {
          let length = await api.resque.queue.length(queue)
          details.queues[queue] = { length: length }
        })

        return details
      }
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
  },

  start: async (api) => {
    if (api.config.tasks.scheduler === true) {
      await api.tasks.enqueueAllRecurrentJobs()
    }
  }
}
