import { Queue, Scheduler, MultiWorker, ParsedJob } from "node-resque";
import { api, config, log, utils, Initializer } from "../index";
import { ActionHeroLogLevel } from "../modules/log";

export interface ResqueApi {
  connectionDetails: {
    [key: string]: any;
  };
  queue?: Queue;
  scheduler?: Scheduler;
  multiWorker?: MultiWorker;
  startQueue?: ResqueInitializer["startQueue"];
  stopQueue?: ResqueInitializer["stopQueue"];
  startScheduler?: ResqueInitializer["startScheduler"];
  stopScheduler?: ResqueInitializer["stopScheduler"];
  startMultiWorker?: ResqueInitializer["startMultiWorker"];
  stopMultiWorker?: ResqueInitializer["stopMultiWorker"];
}

/**
 * The node-resque workers and scheduler which process tasks.
 * see https://github.com/actionhero/node-resque
 */
export class ResqueInitializer extends Initializer {
  constructor() {
    super();
    this.name = "resque";
    this.loadPriority = 600;
    this.startPriority = 950;
    this.stopPriority = 100;
  }

  startQueue = async () => {
    api.resque.queue = new Queue(
      { connection: api.resque.connectionDetails },
      api.tasks.jobs
    );

    api.resque.queue.on("error", (error) => {
      log(error.toString(), "error", "[api.resque.queue]");
    });

    await api.resque.queue.connect();
  };

  stopQueue = () => {
    if (api.resque.queue) {
      return api.resque.queue.end();
    }
  };

  startScheduler = async () => {
    if (config.get<boolean>("tasks", "scheduler") === true) {
      api.resque.scheduler = new Scheduler({
        connection: api.resque.connectionDetails,
        timeout: config.get<number>("tasks", "timeout"),
        stuckWorkerTimeout: config.get<number>("tasks", "stuckWorkerTimeout"),
        retryStuckJobs: config.get<boolean>("tasks", "retryStuckJobs"),
      });

      api.resque.scheduler.on("error", (error) => {
        log(error.toString(), "error", "[api.resque.scheduler]");
      });

      await api.resque.scheduler.connect();
      api.resque.scheduler.on("start", () => {
        log(
          "resque scheduler started",
          config.get<ActionHeroLogLevel>("tasks", "schedulerLogging", "start")
        );
      });
      api.resque.scheduler.on("end", () => {
        log(
          "resque scheduler ended",
          config.get<ActionHeroLogLevel>("tasks", "schedulerLogging", "end")
        );
      });
      api.resque.scheduler.on("poll", () => {
        log(
          "resque scheduler polling",
          config.get<ActionHeroLogLevel>("tasks", "schedulerLogging", "poll")
        );
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
  };

  stopScheduler = async () => {
    if (api.resque.scheduler) {
      return api.resque.scheduler.end();
    }
  };

  startMultiWorker = async () => {
    api.resque.multiWorker = new MultiWorker(
      {
        connection: api.resque.connectionDetails,
        queues: Array.isArray(config.get("tasks", "queues"))
          ? config.get("tasks", "queues")
          : await config.get("tasks", "queues"),
        timeout: config.get<number>("tasks", "timeout"),
        checkTimeout: config.get<number>("tasks", "checkTimeout"),
        minTaskProcessors: config.get<number>("tasks", "minTaskProcessors"),
        maxTaskProcessors: config.get<number>("tasks", "maxTaskProcessors"),
        maxEventLoopDelay: config.get<number>("tasks", "maxEventLoopDelay"),
      },
      api.tasks.jobs
    );

    // normal worker emitters
    api.resque.multiWorker.on("start", (workerId) => {
      log(
        "[ worker ] started",
        config.get<ActionHeroLogLevel>("tasks", "workerLogging", "start"),
        {
          workerId,
        }
      );
    });
    api.resque.multiWorker.on("end", (workerId) => {
      log(
        "[ worker ] ended",
        config.get<ActionHeroLogLevel>("tasks", "workerLogging", "end"),
        {
          workerId,
        }
      );
    });
    api.resque.multiWorker.on("cleaning_worker", (workerId, worker, pid) => {
      log(
        `[ worker ] cleaning old worker ${worker}, (${pid})`,
        config.get<ActionHeroLogLevel>(
          "tasks",
          "workerLogging",
          "cleaning_worker"
        )
      );
    });
    api.resque.multiWorker.on("poll", (workerId, queue) => {
      log(
        `[ worker ] polling ${queue}`,
        config.get<ActionHeroLogLevel>("tasks", "workerLogging", "poll"),
        {
          workerId,
        }
      );
    });
    api.resque.multiWorker.on("job", (workerId, queue, job: ParsedJob) => {
      log(
        `[ worker ] working job ${queue}`,
        config.get<ActionHeroLogLevel>("tasks", "workerLogging", "job"),
        {
          workerId,
          class: job.class,
          queue: job.queue,
          args: JSON.stringify(utils.filterObjectForLogging(job.args[0])),
        }
      );
    });
    api.resque.multiWorker.on(
      "reEnqueue",
      (workerId, queue, job: ParsedJob, plugin) => {
        log(
          "[ worker ] reEnqueue task",
          config.get<ActionHeroLogLevel>("tasks", "workerLogging", "reEnqueue"),
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
      log(
        "[ worker ] paused",
        config.get<ActionHeroLogLevel>("tasks", "workerLogging", "pause"),
        {
          workerId,
        }
      );
    });

    api.resque.multiWorker.on("failure", (workerId, queue, job, failure) => {
      api.exceptionHandlers.task(failure, queue, job, workerId);
    });
    api.resque.multiWorker.on("error", (error, workerId, queue, job) => {
      api.exceptionHandlers.task(error, queue, job, workerId);
    });

    api.resque.multiWorker.on(
      "success",
      (workerId, queue, job: ParsedJob, result, duration) => {
        const payload = {
          workerId,
          class: job.class,
          queue: job.queue,
          args: JSON.stringify(utils.filterObjectForLogging(job.args[0])),
          result,
          duration,
        };

        log(
          "[ worker ] task success",
          config.get<ActionHeroLogLevel>("tasks", "workerLogging", "success"),
          payload
        );
      }
    );

    // multiWorker emitters
    api.resque.multiWorker.on("multiWorkerAction", (verb, delay) => {
      log(
        `[ multiworker ] checked for worker status: ${verb} (event loop delay: ${delay}ms)`,
        config.get<ActionHeroLogLevel>(
          "tasks",
          "workerLogging",
          "multiWorkerAction"
        )
      );
    });

    if (config.get<number>("tasks", "minTaskProcessors") > 0) {
      api.resque.multiWorker.start();
    }
  };

  stopMultiWorker = async () => {
    if (
      api.resque.multiWorker &&
      config.get<number>("tasks", "minTaskProcessors") > 0
    ) {
      return api.resque.multiWorker.stop();
    }
  };

  async initialize() {
    api.resque = {
      queue: null,
      multiWorker: null,
      scheduler: null,
      connectionDetails: Object.assign(
        {},
        config.get("tasks", "connectionOptions", "tasks"),
        {
          redis: api.redis.clients.tasks,
          pkg:
            api.redis.clients.tasks?.constructor?.name === "RedisMock"
              ? "ioredis-mock"
              : "ioredis",
        }
      ),
      startQueue: this.startQueue,
      stopQueue: this.stopQueue,
      startScheduler: this.startScheduler,
      stopScheduler: this.stopScheduler,
      startMultiWorker: this.startMultiWorker,
      stopMultiWorker: this.stopMultiWorker,
    };
  }

  async start() {
    if (
      config.get<number>("tasks", "minTaskProcessors") === 0 &&
      config.get<number>("tasks", "maxTaskProcessors") > 0
    ) {
      config.data.tasks.minTaskProcessors = 1;
    }

    await api.resque.startScheduler();
    await api.resque.startMultiWorker();
  }

  async stop() {
    await api.resque.stopScheduler();
    await api.resque.stopMultiWorker();
    await api.resque.stopQueue();
  }
}
