import { api, Process, Task, utils, config, task } from "./../../../src/index";

const actionhero = new Process();
let taskOutput: any[] = [];
const queue = "testQueue";

jest.mock("./../../../src/config/tasks.ts", () => ({
  __esModule: true,
  test: {
    tasks: () => {
      return {
        scheduler: true,
        queues: ["*"],
        workerLogging: {},
        schedulerLogging: {},
        timeout: 100,
        checkTimeout: 50,
        minTaskProcessors: 1,
        maxTaskProcessors: 1,
        maxEventLoopDelay: 5,
        stuckWorkerTimeout: 1000 * 60 * 60,
        connectionOptions: {
          tasks: {},
        },
      };
    },
  },
}));

describe("Core: Tasks", () => {
  describe("full worker flow", () => {
    beforeAll(async () => {
      await actionhero.start();
      api.resque.multiWorker.options.connection!.redis!.setMaxListeners(100);

      class RegularTask extends Task {
        constructor() {
          super();
          this.name = "regular";
          this.description = "task: regular";
          this.queue = queue;
          this.frequency = 0;
        }

        run(params: Record<string, any>) {
          taskOutput.push(params.word);
          return params.word;
        }
      }

      class PeriodicTask extends Task {
        constructor() {
          super();
          this.name = "periodicTask";
          this.description = "task: periodicTask";
          this.queue = queue;
          this.frequency = 100;
        }

        async run() {
          taskOutput.push("periodicTask");
          return "periodicTask";
        }
      }

      class SlowTask extends Task {
        constructor() {
          super();
          this.name = "slowTask";
          this.description = "task: slowTask";
          this.queue = queue;
          this.frequency = 0;
        }

        async run() {
          await utils.sleep(5000);
          taskOutput.push("slowTask");
          return "slowTask";
        }
      }

      api.tasks.tasks.regularTask = new RegularTask();
      api.tasks.tasks.periodicTask = new PeriodicTask();
      api.tasks.tasks.slowTask = new SlowTask();

      api.tasks.jobs.regularTask = api.tasks.jobWrapper("regularTask");
      api.tasks.jobs.periodicTask = api.tasks.jobWrapper("periodicTask");
      api.tasks.jobs.slowTask = api.tasks.jobWrapper("slowTask");
    });

    afterAll(async () => {
      delete api.tasks.tasks.regularTask;
      delete api.tasks.tasks.periodicTask;
      delete api.tasks.tasks.slowTask;
      delete api.tasks.jobs.regularTask;
      delete api.tasks.jobs.periodicTask;
      delete api.tasks.jobs.slowTask;

      config.tasks!.queues = [];

      api.resque.multiWorker.options.minTaskProcessors = 0;
      api.resque.multiWorker.options.maxTaskProcessors = 0;

      await actionhero.stop();
    });

    beforeEach(async () => {
      taskOutput = [];
      await api.resque.queue.connection.redis.flushdb();
    });

    afterEach(async () => {
      await api.resque.stopScheduler();
      await api.resque.stopMultiWorker();
    });

    test("normal tasks work", async () => {
      await task.enqueue("regularTask", { word: "first" });
      config.tasks!.queues = ["*"];
      api.resque.multiWorker.start();

      await utils.sleep(500);

      expect(taskOutput[0]).toEqual("first");
      await api.resque.multiWorker.stop();
    });

    test("delayed tasks work", async () => {
      await task.enqueueIn(100, "regularTask", { word: "delayed" });

      config.tasks!.queues = ["*"];
      config.tasks!.scheduler = true;
      await api.resque.startScheduler();
      await api.resque.multiWorker.start();

      await utils.sleep(1500);
      expect(taskOutput[0]).toEqual("delayed");
      await api.resque.multiWorker.stop();
      await api.resque.stopScheduler();
    });

    test("recurrent tasks work", async () => {
      await task.enqueueRecurrentTask("periodicTask");

      config.tasks!.queues = ["*"];
      config.tasks!.scheduler = true;
      await api.resque.startScheduler();
      await api.resque.multiWorker.start();

      await utils.sleep(1500);
      expect(taskOutput[0]).toEqual("periodicTask");
      expect(taskOutput[1]).toEqual("periodicTask");
      expect(taskOutput[2]).toEqual("periodicTask");
      // the task may have run more than 3 times, we just want to ensure that it happened more than once
      await api.resque.multiWorker.stop();
      await api.resque.stopScheduler();
    });

    test("enqueuing the same task multiple times does not produce an error", async () => {
      await task.enqueueRecurrentTask("periodicTask");
      await task.enqueueRecurrentTask("periodicTask"); // does not throw
      await task.enqueueRecurrentTask("periodicTask"); // does not throw

      const taskTimes = await task.allDelayed();
      expect(Object.keys(taskTimes).length).toBe(1);
      const tasks = Object.values(taskTimes)[0];
      expect(tasks.length).toBe(1);
    });

    test("trying to run an unknown job will return a failure, but not crash the server", async () => {
      await new Promise(async (resolve) => {
        config.tasks!.queues = ["*"];

        const listener = async (
          workerId: number,
          queue: string,
          job: any,
          f: Error,
          duration: number,
        ) => {
          expect(queue).toEqual(queue);
          expect(job.class).toEqual("someCrazyTask");
          expect(job.queue).toEqual("testQueue");
          expect(String(f)).toEqual(
            'Error: No job defined for class "someCrazyTask"',
          );
          api.resque.multiWorker.removeListener("failure", listener);
          await api.resque.multiWorker.stop();
          return resolve(null);
        };

        api.resque.multiWorker.on("failure", listener);

        await api.resque.queue.enqueue(queue, "someCrazyTask");
        api.resque.multiWorker.start();
      });
    });
  });
});
