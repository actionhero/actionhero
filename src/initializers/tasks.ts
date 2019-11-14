import * as glob from "glob";
import * as path from "path";
import { Plugin } from "node-resque";
import { api, Initializer } from "../index";

/**
 * An exmaple middleware
 * ```js
 * const middleware = {
 *   name: 'timer',
 *   global: true,
 *   priority: 90,
 *   preProcessor: async function () {
 *     const worker = this.worker
 *     worker.startTime = process.hrtime()
 *   },
 *   postProcessor: async function () {
 *     const worker = this.worker
 *     const elapsed = process.hrtime(worker.startTime)
 *     const seconds = elapsed[0]
 *     const millis = elapsed[1] / 1000000
 *     api.log(worker.job.class + ' done in ' + seconds + ' s and ' + millis + ' ms.', 'info')
 *   },
 *   preEnqueue: async function () {
 *     const arg = this.args[0]
 *     return (arg === 'ok') // returing `false` will prevent the task from enqueing
 *   },
 *   postEnqueue: async function () {
 *     api.log("Task successfully enqueued!")
 *   }
 * }
 * api.tasks.addMiddleware(middleware)
```
 */
export interface TaskMiddleware {
  /**Unique name for the middleware. */
  name: string;
  /**Is this middleware applied to all tasks? */
  global: boolean;
  /**Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`. */
  priority?: number;
  /**Called berore the task runs.  Has access to all params, before sanitizartion.  Can modify the data object for use in tasks. */
  preProcessor?: Function;
  /**Called after the task runs.*/
  postProcessor?: Function;
  /**Called before a task using this middleware is enqueud. */
  preEnqueue?: Function;
  /**Called after a task using this middleware is enqueud. */
  postEnqueue?: Function;
}

/**
 * Tools for enquing and inspecting the task sytem (delayed jobs).
 */
export class Tasks extends Initializer {
  constructor() {
    super();
    this.name = "tasks";
    this.loadPriority = 699;
    this.startPriority = 900;
  }

  async initialize() {
    api.tasks = {
      tasks: {},
      jobs: {},
      middleware: {},
      globalMiddleware: []
    };

    api.tasks.loadFile = (fullFilePath: string, reload: boolean = false) => {
      api.watchFileAndAct(fullFilePath, async () => {
        if (!api.config.general.developmentModeForceRestart) {
          // reload by updating in-memory copy of our task
          api.tasks.loadFile(fullFilePath, true);
        } else {
          api.log(
            `*** Rebooting due to task change (${fullFilePath}) ***`,
            "info"
          );
          await api.commands.restart();
        }
      });

      let task;
      let collection = require(fullFilePath);
      for (const i in collection) {
        const TaskClass = collection[i];
        task = new TaskClass();
        task.validate();

        if (api.tasks.tasks[task.name] && !reload) {
          api.log(
            `an existing task with the same name \`${task.name}\` will be overridden by the file ${fullFilePath}`,
            "warning"
          );
        }

        api.tasks.tasks[task.name] = task;
        api.tasks.jobs[task.name] = api.tasks.jobWrapper(task.name);
        api.log(
          `task ${reload ? "(re)" : ""} loaded: ${task.name}, ${fullFilePath}`,
          reload ? "info" : "debug"
        );
      }
    };

    /**
     * @private
     */
    api.tasks.jobWrapper = (taskName: string) => {
      const task = api.tasks.tasks[taskName];

      const middleware = task.middleware || [];
      const plugins = task.plugins || [];
      const pluginOptions = task.pluginOptions || [];

      if (task.frequency > 0) {
        if (plugins.indexOf("JobLock") < 0) {
          plugins.push("JobLock");
        }
        if (plugins.indexOf("QueueLock") < 0) {
          plugins.push("QueueLock");
        }
        if (plugins.indexOf("DelayQueueLock") < 0) {
          plugins.push("DelayQueueLock");
        }
      }

      // load middleware into plugins
      const processMiddleware = m => {
        if (api.tasks.middleware[m]) {
          //@ts-ignore
          class NodeResquePlugin extends Plugin {
            constructor(...args) {
              //@ts-ignore
              super(...args);
              if (api.tasks.middleware[m].preProcessor) {
                this.beforePerform = api.tasks.middleware[m].preProcessor;
              }
              if (api.tasks.middleware[m].postProcessor) {
                this.afterPerform = api.tasks.middleware[m].postProcessor;
              }
              if (api.tasks.middleware[m].preEnqueue) {
                this.beforeEnqueue = api.tasks.middleware[m].preEnqueue;
              }
              if (api.tasks.middleware[m].postEnqueue) {
                this.afterEnqueue = api.tasks.middleware[m].postEnqueue;
              }
            }
          }

          plugins.push(NodeResquePlugin);
        }
      };

      api.tasks.globalMiddleware.forEach(processMiddleware);
      middleware.forEach(processMiddleware);

      return {
        plugins: plugins,
        pluginOptions: pluginOptions,
        perform: async function() {
          const combinedArgs = [].concat(Array.prototype.slice.call(arguments));
          combinedArgs.push(this);
          let response = null;
          try {
            response = await task.run.apply(task, combinedArgs);
            await api.tasks.enqueueRecurrentTask(taskName);
          } catch (error) {
            if (task.frequency > 0 && task.reEnqueuePeriodicTaskIfException) {
              await api.tasks.enqueueRecurrentTask(taskName);
            }
            throw error;
          }
          return response;
        }
      };
    };

    /**
     * Enqueue a task to be performed in the background.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.enqueue = async (
      taskName: string,
      params: object = {},
      queue: string = api.tasks.tasks[taskName].queue
    ) => {
      return api.resque.queue.enqueue(queue, taskName, params);
    };

    /**
     * Enqueue a task to be performed in the background, at a certain time in the future.
     * Will throw an error if redis cannot be reached.
     *
     * Inputs:
     * * taskName: The name of the task.
     * * params: Params to pass to the task.
     * * queue: (Optional) Which queue/priority to run this instance of the task on.
     */
    api.tasks.enqueueAt = async (
      timestamp: number,
      taskName: string,
      params: object = {},
      queue: string = api.tasks.tasks[taskName].queue
    ) => {
      return api.resque.queue.enqueueAt(timestamp, queue, taskName, params);
    };

    /**
     * Enqueue a task to be performed in the background, at a certain number of ms from now.
     * Will throw an error if redis cannot be reached.
     *
     * Inputs:
     * * timestamp: At what time the task is able to be run.  Does not gaurentee that the task will be run at this time. (in ms)
     * * taskName: The name of the task.
     * * params: Params to pass to the task.
     * * queue: (Optional) Which queue/priority to run this instance of the task on.
     */
    api.tasks.enqueueIn = async (
      time: number,
      taskName: string,
      params: object = {},
      queue: string = api.tasks.tasks[taskName].queue
    ) => {
      return api.resque.queue.enqueueIn(time, queue, taskName, params);
    };

    /**
     * Delete a previously enqueued task, which hasn't been run yet, from a queue.
     * Will throw an error if redis cannot be reached.
     *
     * Inputs:
     * * q: Which queue/priority is the task stored on?
     * * taskName: The name of the job, likley to be the same name as a tak.
     * * args: The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.  It is best to read job properties first via `api.tasks.queued` or similar method.
     * * count: Of the jobs that match q, taskName, and args, up to what position should we delete? (Default 0; this command is 0-indexed)
     */
    api.tasks.del = async (
      q: string,
      taskName: string,
      args: object | Array<any>,
      count: number
    ) => {
      return api.resque.queue.del(q, taskName, args, count);
    };

    /**
     * Delete all previously enqueued tasks, which haven't been run yet, from all possible delayed timestamps.
     * Will throw an error if redis cannot be reached.
     *
     * Inputs:
     * * q: Which queue/priority is to run on?
     * * taskName: The name of the job, likley to be the same name as a tak.
     * * args  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing. It is best to read job properties first via `api.tasks.delayedAt` or similar method.
     */
    api.tasks.delDelayed = async (
      q: string,
      taskName: string,
      args: object | Array<any>
    ) => {
      return api.resque.queue.delDelayed(q, taskName, args);
    };

    /**
     * Return the timestamps a task is scheduled for.
     * Will throw an error if redis cannot be reached.
     *
     * Inputs:
     * * q: Which queue/priority is to run on?
     * * taskName: The name of the job, likley to be the same name as a tak.
     * * args: The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.  It is best to read job properties first via `api.tasks.delayedAt` or similar method.
     * @return {Promise<Array>}    Returns an array of timestamps.
     */
    api.tasks.scheduledAt = async (
      q: string,
      taskName: string,
      args: object | Array<any>
    ): Promise<Array<number>> => {
      return api.resque.queue.scheduledAt(q, taskName, args);
    };

    /**
     * Return all resque stats for this namespace (how jobs failed, jobs succeded, etc)
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.stats = async () => {
      return api.resque.queue.stats();
    };

    /**
     * Retrieve the details of jobs enqueued on a certain queue between start and stop (0-indexed)
     * Will throw an error if redis cannot be reached.
     *
     * Inputs:
     * * q      The name of the queue.
     * * start  The index of the first job to return.
     * * stop   The index of the last job to return.
     */
    api.tasks.queued = async (
      q: string,
      start: number,
      stop: number
    ): Promise<Array<object>> => {
      return api.resque.queue.queued(q, start, stop);
    };

    /**
     * Delete a queue in redis, and all jobs stored on it.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.delQueue = async (q: string) => {
      return api.resque.queue.delQueue(q);
    };

    /**
     * Return any locks, as created by resque plugins or task middleware, in this redis namespace.
     * Will contain locks with keys like `resque:lock:{job}` and `resque:workerslock:{workerId}`
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.locks = async (): Promise<Object> => {
      return api.resque.queue.locks();
    };

    /**
     * Delete a lock on a job or worker.  Locks can be found via `api.tasks.locks`
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.delLock = async (lock: string) => {
      return api.resque.queue.delLock(lock);
    };

    /**
     * List all timestamps for which tasks are enqueued in the future, via `api.tasks.enqueueIn` or `api.tasks.enqueueAt`
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.timestamps = async (): Promise<Array<number>> => {
      return api.resque.queue.timestamps();
    };

    /**
     * Return all jobs which have been enqueued to run at a certain timestamp.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.delayedAt = async (timestamp: number): Promise<Array<object>> => {
      return api.resque.queue.delayedAt(timestamp);
    };

    /**
     * Retrun all delayed jobs, orginized by the timetsamp at where they are to run at.
     * Note: This is a very slow command.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.allDelayed = async (): Promise<Array<object>> => {
      return api.resque.queue.allDelayed();
    };

    /**
     * Retrun all workers registered by all members of this cluster.
     * Note: MultiWorker processors each register as a unique worker.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.workers = async (): Promise<Object> => {
      return api.resque.queue.workers();
    };

    /**
     * What is a given worker working on?  If the worker is idle, 'started' will be returned.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.workingOn = async (
      workerName: string,
      queues: string
    ): Promise<object> => {
      return api.resque.queue.workingOn(workerName, queues);
    };

    /**
     * Return all workers and what job they might be working on.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.allWorkingOn = async (): Promise<object> => {
      return api.resque.queue.allWorkingOn();
    };

    /**
     * How many jobs are in the failed queue.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.failedCount = async (): Promise<number> => {
      return api.resque.queue.failedCount();
    };

    /**
     * Retrieve the details of failed jobs between start and stop (0-indexed).
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.failed = async (
      start: number,
      stop: number
    ): Promise<Array<object>> => {
      return api.resque.queue.failed(start, stop);
    };

    /**
     * Remove a specific job from the failed queue.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.removeFailed = async (failedJob: object) => {
      return api.resque.queue.removeFailed(failedJob);
    };

    /**
     * Remove a specific job from the failed queue, and retry it by placing it back into its original queue.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.retryAndRemoveFailed = async (failedJob: object) => {
      return api.resque.queue.retryAndRemoveFailed(failedJob);
    };

    /**
     * If a worker process crashes, it will leave its state in redis as "working".
     * You can remove workers from redis you know to be over, by specificing an age which would make them too old to exist.
     * This method will remove the data created by a 'stuck' worker and move the payload to the error queue.
     * However, it will not actually remove any processes which may be running.  A job *may* be running that you have removed.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.cleanOldWorkers = async (age: number): Promise<object> => {
      return api.resque.queue.cleanOldWorkers(age);
    };

    /**
     * Ensures that a task which has a frequency is either running, or already enqueued.
     * This is run automatically at boot for all tasks which have a frequency, via `api.tasks.enqueueAllRecurrentTasks`.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.enqueueRecurrentTask = async (taskName: string) => {
      const task = api.tasks.tasks[taskName];

      if (task.frequency > 0) {
        await api.tasks.del(task.queue, taskName);
        await api.tasks.delDelayed(task.queue, taskName);
        await api.tasks.enqueueIn(task.frequency, taskName);
        api.log(
          `re-enqueued recurrent job ${taskName}`,
          api.config.tasks.schedulerLogging.reEnqueue
        );
      }
    };

    /**
     * This is run automatically at boot for all tasks which have a frequency, calling `api.tasks.enqueueRecurrentTask`
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.enqueueAllRecurrentTasks = async () => {
      const jobs = [];
      const loadedTasks = [];

      Object.keys(api.tasks.tasks).forEach(taskName => {
        const task = api.tasks.tasks[taskName];
        if (task.frequency > 0) {
          jobs.push(async () => {
            const toRun = await api.tasks.enqueue(taskName);
            if (toRun === true) {
              api.log(
                `enqueuing periodic task: ${taskName}`,
                api.config.tasks.schedulerLogging.enqueue
              );
              loadedTasks.push(taskName);
            }
          });
        }
      });

      await api.utils.asyncWaterfall(jobs);
      return loadedTasks;
    };

    /**
     * Stop a task with a frequency by removing it from all possible queues.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.stopRecurrentTask = async (taskName: string): Promise<number> => {
      // find the jobs in either the normal queue or delayed queues
      const task = api.tasks.tasks[taskName];
      if (task.frequency > 0) {
        let removedCount = 0;
        const count = await api.tasks.del(task.queue, task.name, {}, 1);
        removedCount = removedCount + count;
        const timestamps = await api.tasks.delDelayed(
          task.queue,
          task.name,
          {}
        );
        removedCount = removedCount + timestamps.length;
        return removedCount;
      }
    };

    /**
     * Return wholistic details about the task system, including failures, queues, and workers.
     * Will throw an error if redis cannot be reached.
     */
    api.tasks.details = async (): Promise<object> => {
      const details = { queues: {}, workers: {}, stats: null };

      details.workers = await api.tasks.allWorkingOn();
      details.stats = await api.tasks.stats();
      const queues = await api.resque.queue.queues();

      for (const i in queues) {
        const queue = queues[i];
        const length = await api.resque.queue.length(queue);
        details.queues[queue] = { length: length };
      }

      return details;
    };

    api.tasks.loadTasks = reload => {
      api.config.general.paths.task.forEach(p => {
        glob.sync(path.join(p, "**", "**/*(*.js|*.ts)")).forEach(f => {
          api.tasks.loadFile(f, reload);
        });
      });

      for (const pluginName in api.config.plugins) {
        if (api.config.plugins[pluginName].tasks !== false) {
          const pluginPath = api.config.plugins[pluginName].path;
          glob
            .sync(path.join(pluginPath, "tasks", "**", "**/*(*.js|*.ts)"))
            .forEach(f => {
              api.tasks.loadFile(f, reload);
            });
        }
      }
    };

    api.tasks.addMiddleware = (middleware: TaskMiddleware) => {
      if (!middleware.name) {
        throw new Error("middleware.name is required");
      }
      if (!middleware.priority) {
        middleware.priority = api.config.general.defaultMiddlewarePriority;
      }
      middleware.priority = Number(middleware.priority);
      api.tasks.middleware[middleware.name] = middleware;
      if (middleware.global === true) {
        api.tasks.globalMiddleware.push(middleware.name);
        api.utils.sortGlobalMiddleware(
          api.tasks.globalMiddleware,
          api.tasks.middleware
        );
      }
      api.tasks.loadTasks(true);
    };

    api.tasks.loadTasks(false);
  }

  async start() {
    if (api.config.redis.enabled === false) {
      return;
    }

    if (api.config.tasks.scheduler === true) {
      await api.tasks.enqueueAllRecurrentTasks();
    }
  }
}
