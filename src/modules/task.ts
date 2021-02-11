import { api, config, utils, log } from "./../index";
import { Task, TaskInputs } from "./../classes/task";

export namespace task {
  /**
 * An example middleware
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
 *     log(worker.job.class + ' done in ' + seconds + ' s and ' + millis + ' ms.', 'info')
 *   },
 *   preEnqueue: async function () {
 *     const arg = this.args[0]
 *     return (arg === 'ok') // returning `false` will prevent the task from enqueueing
 *   },
 *   postEnqueue: async function () {
 *     log("Task successfully enqueued!")
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
    /**Called berore the task runs.  Has access to all params, before sanitization.  Can modify the data object for use in tasks. */
    preProcessor?: Function;
    /**Called after the task runs.*/
    postProcessor?: Function;
    /**Called before a task using this middleware is enqueued. */
    preEnqueue?: Function;
    /**Called after a task using this middleware is enqueued. */
    postEnqueue?: Function;
  }

  /**
   * Enqueue a task to be performed in the background.
   * Will throw an error if redis cannot be reached.
   */
  export async function enqueue(
    taskName: string,
    inputs: TaskInputs,
    queue: string = api.tasks.tasks[taskName].queue
  ) {
    await validateInput(taskName, inputs);
    return api.resque.queue.enqueue(queue, taskName, [inputs]);
  }

  /**
   * Enqueue a task to be performed in the background, at a certain time in the future.
   * Will throw an error if redis cannot be reached.
   *
   * Inputs:
   * * taskName: The name of the task.
   * * inputs: inputs to pass to the task.
   * * queue: (Optional) Which queue/priority to run this instance of the task on.
   * * suppressDuplicateTaskError: (optional) Suppress errors when the same task with the same arguments are double-enqueued for the same time
   */
  export async function enqueueAt(
    timestamp: number,
    taskName: string,
    inputs: TaskInputs,
    queue: string = api.tasks.tasks[taskName].queue,
    suppressDuplicateTaskError = false
  ) {
    await validateInput(taskName, inputs);
    return api.resque.queue.enqueueAt(
      timestamp,
      queue,
      taskName,
      [inputs],
      suppressDuplicateTaskError
    );
  }

  /**
   * Enqueue a task to be performed in the background, at a certain number of ms from now.
   * Will throw an error if redis cannot be reached.
   *
   * Inputs:
   * * timestamp: At what time the task is able to be run.  Does not guarantee that the task will be run at this time. (in ms)
   * * taskName: The name of the task.
   * * inputs: inputs to pass to the task.
   * * queue: (Optional) Which queue/priority to run this instance of the task on.
   * * suppressDuplicateTaskError: (optional) Suppress errors when the same task with the same arguments are double-enqueued for the same time
   */
  export async function enqueueIn(
    time: number,
    taskName: string,
    inputs: TaskInputs,
    queue: string = api.tasks.tasks[taskName].queue,
    suppressDuplicateTaskError = false
  ) {
    await validateInput(taskName, inputs);
    return api.resque.queue.enqueueIn(
      time,
      queue,
      taskName,
      [inputs],
      suppressDuplicateTaskError
    );
  }

  /**
   * Delete a previously enqueued task, which hasn't been run yet, from a queue.
   * Will throw an error if redis cannot be reached.
   *
   * Inputs:
   * * q: Which queue/priority is the task stored on?
   * * taskName: The name of the job, likely to be the same name as a tak.
   * * args: The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.  It is best to read job properties first via `api.tasks.queued` or similar method.
   * * count: Of the jobs that match q, taskName, and args, up to what position should we delete? (Default 0; this command is 0-indexed)
   */
  export async function del(
    q: string,
    taskName: string,
    args?: TaskInputs,
    count?: number
  ) {
    return api.resque.queue.del(q, taskName, [args], count);
  }

  /**
   * Delete all previously enqueued tasks, which haven't been run yet, from all possible delayed timestamps.
   * Will throw an error if redis cannot be reached.
   *
   * Inputs:
   * * q: Which queue/priority is to run on?
   * * taskName: The name of the job, likely to be the same name as a tak.
   * * inputs  The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing. It is best to read job properties first via `api.tasks.delayedAt` or similar method.
   */
  export async function delDelayed(
    q: string,
    taskName: string,
    inputs?: TaskInputs
  ) {
    return api.resque.queue.delDelayed(q, taskName, [inputs]);
  }

  /**
   * Return the timestamps a task is scheduled for.
   * Will throw an error if redis cannot be reached.
   *
   * Inputs:
   * * q: Which queue/priority is to run on?
   * * taskName: The name of the job, likely to be the same name as a tak.
   * * inputs: The arguments of the job.  Note, arguments passed to a Task initially may be modified when enqueuing.  It is best to read job properties first via `api.tasks.delayedAt` or similar method.
   */
  export async function scheduledAt(
    q: string,
    taskName: string,
    inputs: TaskInputs
  ): Promise<Array<number>> {
    return api.resque.queue.scheduledAt(q, taskName, [inputs]);
  }

  /**
   * Return all resque stats for this namespace (how jobs failed, jobs succeeded, etc)
   * Will throw an error if redis cannot be reached.
   */
  export async function stats() {
    return api.resque.queue.stats();
  }

  /**
   * Retrieve the details of jobs enqueued on a certain queue between start and stop (0-indexed)
   * Will throw an error if redis cannot be reached.
   *
   * Inputs:
   * * q      The name of the queue.
   * * start  The index of the first job to return.
   * * stop   The index of the last job to return.
   */
  export async function queued(
    q: string,
    start: number,
    stop: number
  ): Promise<Array<TaskInputs>> {
    return api.resque.queue.queued(q, start, stop);
  }

  /**
   * Delete a queue in redis, and all jobs stored on it.
   * Will throw an error if redis cannot be reached.
   */
  export async function delQueue(q: string) {
    return api.resque.queue.delQueue(q);
  }

  /**
   * Return any locks, as created by resque plugins or task middleware, in this redis namespace.
   * Will contain locks with keys like `resque:lock:{job}` and `resque:workerslock:{workerId}`
   * Will throw an error if redis cannot be reached.
   */
  export async function locks(): Promise<Object> {
    return api.resque.queue.locks();
  }

  /**
   * Delete a lock on a job or worker.  Locks can be found via `api.tasks.locks`
   * Will throw an error if redis cannot be reached.
   */
  export async function delLock(lock: string) {
    return api.resque.queue.delLock(lock);
  }

  /**
   * List all timestamps for which tasks are enqueued in the future, via `api.tasks.enqueueIn` or `api.tasks.enqueueAt`
   * Will throw an error if redis cannot be reached.
   */
  export async function timestamps(): Promise<Array<number>> {
    return api.resque.queue.timestamps();
  }

  /**
   * Return all jobs which have been enqueued to run at a certain timestamp.
   * Will throw an error if redis cannot be reached.
   */
  export async function delayedAt(timestamp: number): Promise<any> {
    return api.resque.queue.delayedAt(timestamp);
  }

  /**
   * Return all delayed jobs, organized by the timestamp at where they are to run at.
   * Note: This is a very slow command.
   * Will throw an error if redis cannot be reached.
   */
  export async function allDelayed(): Promise<{ [timestamp: string]: any[] }> {
    return api.resque.queue.allDelayed();
  }

  /**
   * Return all workers registered by all members of this cluster.
   * Note: MultiWorker processors each register as a unique worker.
   * Will throw an error if redis cannot be reached.
   */
  export async function workers(): Promise<Object> {
    return api.resque.queue.workers();
  }

  /**
   * What is a given worker working on?  If the worker is idle, 'started' will be returned.
   * Will throw an error if redis cannot be reached.
   */
  export async function workingOn(
    workerName: string,
    queues: string
  ): Promise<any> {
    return api.resque.queue.workingOn(workerName, queues);
  }

  /**
   * Return all workers and what job they might be working on.
   * Will throw an error if redis cannot be reached.
   */
  export async function allWorkingOn(): Promise<object> {
    return api.resque.queue.allWorkingOn();
  }

  /**
   * How many jobs are in the failed queue.
   * Will throw an error if redis cannot be reached.
   */
  export async function failedCount(): Promise<number> {
    return api.resque.queue.failedCount();
  }

  /**
   * Retrieve the details of failed jobs between start and stop (0-indexed).
   * Will throw an error if redis cannot be reached.
   */
  export async function failed(
    start: number,
    stop: number
  ): Promise<Array<object>> {
    return api.resque.queue.failed(start, stop);
  }

  /**
   * Remove a specific job from the failed queue.
   * Will throw an error if redis cannot be reached.
   */
  export async function removeFailed(failedJob) {
    return api.resque.queue.removeFailed(failedJob);
  }

  /**
   * Remove a specific job from the failed queue, and retry it by placing it back into its original queue.
   * Will throw an error if redis cannot be reached.
   */
  export async function retryAndRemoveFailed(failedJob) {
    return api.resque.queue.retryAndRemoveFailed(failedJob);
  }

  /**
   * If a worker process crashes, it will leave its state in redis as "working".
   * You can remove workers from redis you know to be over, by specificizing an age which would make them too old to exist.
   * This method will remove the data created by a 'stuck' worker and move the payload to the error queue.
   * However, it will not actually remove any processes which may be running.  A job *may* be running that you have removed.
   * Will throw an error if redis cannot be reached.
   */
  export async function cleanOldWorkers(age: number): Promise<object> {
    return api.resque.queue.cleanOldWorkers(age);
  }

  /**
   * Ensures that a task which has a frequency is either running, or already enqueued.
   * This is run automatically at boot for all tasks which have a frequency, via `api.tasks.enqueueAllRecurrentTasks`.
   * Will throw an error if redis cannot be reached.
   */
  export async function enqueueRecurrentTask(taskName: string) {
    const thisTask = api.tasks.tasks[taskName];

    if (thisTask.frequency > 0) {
      await task.del(thisTask.queue, taskName);
      await task.delDelayed(thisTask.queue, taskName);
      await task.enqueueIn(thisTask.frequency, taskName, {}, undefined, true);
      log(
        `re-enqueued recurrent job ${taskName}`,
        config.tasks.schedulerLogging.reEnqueue
      );
    }
  }

  /**
   * This is run automatically at boot for all tasks which have a frequency, calling `api.tasks.enqueueRecurrentTask`
   * Will throw an error if redis cannot be reached.
   */
  export async function enqueueAllRecurrentTasks() {
    const jobs = [];
    const enqueuedTasks: string[] = [];

    Object.keys(api.tasks.tasks).forEach((taskName) => {
      const thisTask = api.tasks.tasks[taskName];
      if (thisTask.frequency > 0) {
        jobs.push(async () => {
          try {
            const toRun = await task.enqueue(taskName, {});
            if (toRun === true) {
              log(
                `enqueuing periodic task: ${taskName}`,
                config.tasks.schedulerLogging.enqueue
              );
              enqueuedTasks.push(taskName);
            }
          } catch (error) {
            checkForRepeatRecurringTaskEnqueue(taskName, error);
          }
        });
      }
    });

    await utils.asyncWaterfall(jobs);
    return enqueuedTasks;
  }

  /**
   * Stop a task with a frequency by removing it from all possible queues.
   * Will throw an error if redis cannot be reached.
   */
  export async function stopRecurrentTask(taskName: string): Promise<number> {
    // find the jobs in either the normal queue or delayed queues
    const thisTask = api.tasks.tasks[taskName];
    if (thisTask.frequency > 0) {
      let removedCount = 0;
      const count = await task.del(thisTask.queue, thisTask.name, null, 1);
      removedCount = removedCount + count;
      const timestamps = await task.delDelayed(
        thisTask.queue,
        thisTask.name,
        null
      );
      removedCount = removedCount + timestamps.length;
      return removedCount;
    }
  }

  /**
   * Return wholistic details about the task system, including failures, queues, and workers.
   * Will throw an error if redis cannot be reached.
   */
  export async function details() {
    const details: {
      queues: { [key: string]: any };
      workers: { [key: string]: any };
      stats: { [key: string]: any };
      leader: string;
    } = { queues: {}, workers: {}, stats: null, leader: null };

    details.workers = await task.allWorkingOn();
    details.stats = await task.stats();
    const queues = await api.resque.queue.queues();

    for (const i in queues) {
      const queue = queues[i];
      const length = await api.resque.queue.length(queue);
      details.queues[queue] = { length: length };
    }

    details.leader = await api.resque.queue.leader();

    return details;
  }

  export async function addMiddleware(middleware: TaskMiddleware) {
    if (!middleware.name) {
      throw new Error("middleware.name is required");
    }
    if (!middleware.priority) {
      middleware.priority = config.general.defaultMiddlewarePriority;
    }
    middleware.priority = Number(middleware.priority);
    api.tasks.middleware[middleware.name] = middleware;
    if (middleware.global === true) {
      api.tasks.globalMiddleware.push(middleware.name);
      utils.sortGlobalMiddleware(
        api.tasks.globalMiddleware,
        api.tasks.middleware
      );
    }
    await api.tasks.loadTasks(true);
  }

  async function validateInput(taskName: string, inputs: TaskInputs) {
    const task: Task = api.tasks.tasks[taskName];

    if (!task) {
      throw new Error(`task ${taskName} not found`);
    }

    for (const key in task.inputs) {
      // default
      if (inputs[key] === undefined && task.inputs[key].default !== undefined) {
        if (typeof task.inputs[key].default === "function") {
          inputs[key] = await task.inputs[key].default.call(
            api,
            inputs[key],
            this
          );
        } else {
          inputs[key] = task.inputs[key].default;
        }
      }

      // validator
      if (
        inputs[key] !== undefined &&
        task.inputs[key].validator !== undefined
      ) {
        let validatorResponse;
        if (typeof task.inputs[key].validator === "function") {
          // allowed to throw too
          const method = task.inputs[key].validator as Function;
          validatorResponse = await method.call(api, inputs[key], this);
        } else {
          const method = this.prepareStringMethod(task.inputs[key].validator);
          validatorResponse = await method.call(api, inputs[key], this);
        }

        // validator function returned nothing; assume param is OK
        if (validatorResponse === null || validatorResponse === undefined) {
          // ok
        }

        // validator returned something that was not `true`
        else if (validatorResponse !== true) {
          if (validatorResponse === false) {
            throw new Error(
              `${inputs[key]} is not a valid value for ${key} in task ${taskName}`
            );
          } else {
            throw new Error(validatorResponse);
          }
        }
      }

      // required
      if (task.inputs[key].required === true) {
        if (config.general.missingParamChecks.indexOf(inputs[key]) >= 0) {
          throw new Error(`${key} is a required input for task ${taskName}`);
        }
      }
    }
  }

  function checkForRepeatRecurringTaskEnqueue(taskName, error: Error) {
    if (error.toString().match(/already enqueued at this time/)) {
      // this is OK, the job was enqueued by another process as this method was running
      log(
        `not enqueuing periodic task ${taskName} - error.toString()`,
        "warning"
      );
    } else {
      throw error;
    }
  }
}
