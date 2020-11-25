import { Queue, Scheduler, MultiWorker, JobEmit } from "node-resque";
import { api, log, config, Initializer } from "../index";

export interface ResqueApi {
  connectionDetails: {
    [key: string]: any;
  };
  queue?: Queue;
  scheduler?: Scheduler;
  multiWorker?: MultiWorker;
  startQueue?: Function;
  stopQueue?: Function;
  startScheduler?: Function;
  stopScheduler?: Function;
  startMultiWorker?: Function;
  stopMultiWorker?: Function;
  workerLogging?: any;
  schedulerLogging?: any;
}

/**
 * The node-resque workers and scheduler which process tasks.
 * see https://github.com/actionhero/node-resque
 */
export class Resque extends Initializer {
  constructor() {
    super();
    this.name = "resque";
    this.loadPriority = 600;
    this.startPriority = 950;
    this.stopPriority = 100;
  }

  filterTaskParams(params: { [key: string]: any }) {
    const filteredParams = Object.assign({}, params);
    for (const key in params) {
      if (config.general.filteredParams.indexOf(key) >= 0) {
        filteredParams[key] = "[FILTERED]";
      }
    }

    return filteredParams;
  }

  async initialize(config) {
    const resqueOverrides = config.tasks.resque_overrides;

    api.resque = {
      queue: null,
      multiWorker: null,
      scheduler: null,
      connectionDetails: Object.assign(
        {},
        config.tasks.connectionOptions.tasks,
        {
          redis: api.redis.clients.tasks,
          pkg:
            api.redis.clients.tasks?.constructor?.name === "RedisMock"
              ? "ioredis-mock"
              : "ioredis",
        }
      ),

      startQueue: async () => {
        let ActionheroQueue = Queue;
        if (resqueOverrides && resqueOverrides.queue) {
          ActionheroQueue = resqueOverrides.queue;
        }
        api.resque.queue = new ActionheroQueue(
          { connection: api.resque.connectionDetails },
          api.tasks.jobs
        );

        api.resque.queue.on("error", (error) => {
          log(error.toString(), "error", "[api.resque.queue]");
        });

        await api.resque.queue.connect();
      },

      stopQueue: async () => {
        if (api.resque.queue) {
          return api.resque.queue.end();
        }
      },

      startScheduler: async () => {
        let ActionheroScheduler = Scheduler;
        if (resqueOverrides && resqueOverrides.scheduler) {
          ActionheroScheduler = resqueOverrides.scheduler;
        }
        if (config.tasks.scheduler === true) {
          api.resque.schedulerLogging = config.tasks.schedulerLogging;
          api.resque.scheduler = new ActionheroScheduler({
            connection: api.resque.connectionDetails,
            timeout: config.tasks.timeout,
            stuckWorkerTimeout: config.tasks.stuckWorkerTimeout,
            retryStuckJobs: config.tasks.retryStuckJobs,
          });

          api.resque.scheduler.on("error", (error) => {
            log(error.toString(), "error", "[api.resque.scheduler]");
          });

          await api.resque.scheduler.connect();
          api.resque.scheduler.on("start", () => {
            log("resque scheduler started", api.resque.schedulerLogging.start);
          });
          api.resque.scheduler.on("end", () => {
            log("resque scheduler ended", api.resque.schedulerLogging.end);
          });
          api.resque.scheduler.on("poll", () => {
            log("resque scheduler polling", api.resque.schedulerLogging.poll);
          });
          api.resque.scheduler.on("leader", () => {
            log("This node is now the Resque scheduler leader", "notice");
          });
          api.resque.scheduler.on(
            "cleanStuckWorker",
            (workerName, errorPayload, delta) => {
              log("cleaned stuck worker", "warning", {
                workerName,
                errorPayload,
                delta,
              });
            }
          );

          api.resque.scheduler.start();
        }
      },

      stopScheduler: async () => {
        if (api.resque.scheduler) {
          return api.resque.scheduler.end();
        }
      },

      startMultiWorker: async () => {
        let ActionheroMultiWorker = MultiWorker;
        if (resqueOverrides && resqueOverrides.multiWorker) {
          ActionheroMultiWorker = resqueOverrides.multiWorker;
        }
        api.resque.workerLogging = config.tasks.workerLogging;
        api.resque.schedulerLogging = config.tasks.schedulerLogging;

        api.resque.multiWorker = new ActionheroMultiWorker(
          {
            connection: api.resque.connectionDetails,
            queues: Array.isArray(config.tasks.queues)
              ? config.tasks.queues
              : await config.tasks.queues(),
            timeout: config.tasks.timeout,
            checkTimeout: config.tasks.checkTimeout,
            minTaskProcessors: config.tasks.minTaskProcessors,
            maxTaskProcessors: config.tasks.maxTaskProcessors,
            maxEventLoopDelay: config.tasks.maxEventLoopDelay,
          },
          api.tasks.jobs
        );

        // normal worker emitters
        api.resque.multiWorker.on("start", (workerId) => {
          log("[ worker ] started", api.resque.workerLogging.start, {
            workerId,
          });
        });
        api.resque.multiWorker.on("end", (workerId) => {
          log("[ worker ] ended", api.resque.workerLogging.end, {
            workerId,
          });
        });
        api.resque.multiWorker.on(
          "cleaning_worker",
          (workerId, worker, pid) => {
            log(
              `[ worker ] cleaning old worker ${worker}, (${pid})`,
              api.resque.workerLogging.cleaning_worker
            );
          }
        );
        api.resque.multiWorker.on("poll", (workerId, queue) => {
          log(`[ worker ] polling ${queue}`, api.resque.workerLogging.poll, {
            workerId,
          });
        });
        api.resque.multiWorker.on("job", (workerId, queue, job: JobEmit) => {
          log(`[ worker ] working job ${queue}`, api.resque.workerLogging.job, {
            workerId,
            class: job.class,
            queue: job.queue,
            args: JSON.stringify(this.filterTaskParams(job.args[0])),
          });
        });
        api.resque.multiWorker.on(
          "reEnqueue",
          (workerId, queue, job: JobEmit, plugin) => {
            log(
              "[ worker ] reEnqueue task",
              api.resque.workerLogging.reEnqueue,
              {
                workerId,
                plugin: JSON.stringify(plugin),
                class: job.class,
                queue: job.queue,
              }
            );
          }
        );
        api.resque.multiWorker.on("pause", (workerId) => {
          log("[ worker ] paused", api.resque.workerLogging.pause, {
            workerId,
          });
        });

        api.resque.multiWorker.on(
          "failure",
          (workerId, queue, job, failure) => {
            api.exceptionHandlers.task(failure, queue, job, workerId);
          }
        );
        api.resque.multiWorker.on("error", (error, workerId, queue, job) => {
          api.exceptionHandlers.task(error, queue, job, workerId);
        });

        api.resque.multiWorker.on(
          "success",
          (workerId, queue, job: JobEmit, result, duration) => {
            const payload = {
              workerId,
              class: job.class,
              queue: job.queue,
              args: JSON.stringify(this.filterTaskParams(job.args[0])),
              result,
              duration,
            };

            log(
              "[ worker ] task success",
              api.resque.workerLogging.success,
              payload
            );
          }
        );

        // multiWorker emitters
        api.resque.multiWorker.on("multiWorkerAction", (verb, delay) => {
          log(
            `[ multiworker ] checked for worker status: ${verb} (event loop delay: ${delay}ms)`,
            api.resque.workerLogging.multiWorkerAction
          );
        });

        if (config.tasks.minTaskProcessors > 0) {
          api.resque.multiWorker.start();
        }
      },

      stopMultiWorker: async () => {
        if (api.resque.multiWorker && config.tasks.minTaskProcessors > 0) {
          return api.resque.multiWorker.stop();
        }
      },
    };
  }

  async start(config) {
    if (
      config.tasks.minTaskProcessors === 0 &&
      config.tasks.maxTaskProcessors > 0
    ) {
      config.tasks.minTaskProcessors = 1;
    }

    await api.resque.startScheduler();
    await api.resque.startMultiWorker();
  }

  async stop(config) {
    await api.resque.stopScheduler();
    await api.resque.stopMultiWorker();
    await api.resque.stopQueue();
  }
}
