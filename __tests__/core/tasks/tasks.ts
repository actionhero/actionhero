import {
  Process,
  Task,
  utils,
  config,
  task,
  specHelper
} from "../../../src/index";

const actionhero = new Process();
let api;

let taskOutput = [];
const queue = "testQueue";

describe("Core: Tasks", () => {
  beforeAll(async () => {
    api = await actionhero.start();

    api.resque.multiWorker.options.minTaskProcessors = 1;
    api.resque.multiWorker.options.maxTaskProcessors = 1;
    api.resque.multiWorker.options.connection.redis.setMaxListeners(100);

    class RegularTask extends Task {
      constructor() {
        super();
        this.name = "regular";
        this.description = "task: regular";
        this.queue = queue;
        this.frequency = 0;
      }

      run(params) {
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

      async run(params) {
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

      async run(params) {
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

    config.tasks.queues = [];

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

  test("validates tasks", () => {
    api.tasks.tasks.regularTask.validate();
  });

  test("a bad task definition causes an exception", () => {
    class BadTask extends Task {
      constructor() {
        super();
        // this.name = 'noName'
        this.description = "no name";
        this.queue = queue;
        this.frequency = 0;
      }

      async run(params) {}
    }

    const task = new BadTask();

    try {
      task.validate();
      throw new Error("should not get here");
    } catch (error) {
      expect(error.toString()).toMatch(/name is required for this task/);
    }
  });

  // test('will clear crashed workers when booting') // TODO

  test("setup worked", () => {
    expect(Object.keys(api.tasks.tasks)).toHaveLength(3 + 1);
  });

  test("all queues should start empty", async () => {
    const length = await api.resque.queue.length();
    expect(length).toEqual(0);
  });

  test("can run a task manually", async () => {
    const response = await specHelper.runTask("regularTask", {
      word: "theWord"
    });
    expect(response).toEqual("theWord");
    expect(taskOutput[0]).toEqual("theWord");
  });

  test("can run a task fully", async () => {
    const response = await specHelper.runFullTask("regularTask", {
      word: "theWord"
    });
    expect(response).toEqual("theWord");
    expect(taskOutput[0]).toEqual("theWord");
  });

  test("it can detect that a task was enqueued to run now", async () => {
    await task.enqueue("regularTask", { word: "testing" });
    const found = await specHelper.findEnqueuedTasks("regularTask");
    expect(found.length).toEqual(1);
    expect(found[0].args[0].word).toEqual("testing");
    expect(found[0].timestamp).toBeNull();
  });

  test("it can detect that a task was enqueued to run in the future", async () => {
    await task.enqueueIn(1000, "regularTask", { word: "testing" });
    const found = await specHelper.findEnqueuedTasks("regularTask");
    expect(found.length).toEqual(1);
    expect(found[0].args[0].word).toEqual("testing");
    expect(found[0].timestamp).toBeGreaterThan(1);
  });

  test("can call task methods inside the run", async () => {
    class TaskWithMethod extends Task {
      constructor() {
        super();
        this.name = "taskWithMethod";
        this.description = "task with additional methods to execute in run";
        this.queue = queue;
      }

      async stepOne() {
        await utils.sleep(100);
        taskOutput.push("one");
      }

      stepTwo() {
        taskOutput.push("two");
      }

      async run() {
        await this.stepOne();
        this.stepTwo();
        taskOutput.push("tree");
      }
    }
    api.tasks.tasks.taskWithMethod = new TaskWithMethod();
    api.tasks.jobs.taskWithMethod = api.tasks.jobWrapper("taskWithMethod");
    await specHelper.runFullTask("taskWithMethod", {});
    expect(taskOutput).toHaveLength(3);
    expect(taskOutput[0]).toEqual("one");
    expect(taskOutput[1]).toEqual("two");
    expect(taskOutput[2]).toEqual("tree");
  });

  test("no delayed tasks should be scheduled", async () => {
    const timestamps = await api.resque.queue.scheduledAt(
      queue,
      "periodicTask",
      {}
    );
    expect(timestamps).toHaveLength(0);
  });

  test("all periodic tasks can be enqueued at boot", async () => {
    await task.enqueueAllRecurrentTasks();
    const length = await api.resque.queue.length(queue);
    expect(length).toEqual(1);
  });

  test("re-enqueuing a periodic task should not enqueue it again", async () => {
    const tryOne = await task.enqueue("periodicTask", null);
    const tryTwo = await task.enqueue("periodicTask", null);
    const length = await api.resque.queue.length(queue);
    expect(tryOne).toEqual(true);
    expect(tryTwo).toEqual(false);
    expect(length).toEqual(1);
  });

  test("can add a normal job", async () => {
    await task.enqueue("regularTask", { word: "first" });
    const length = await api.resque.queue.length(queue);
    expect(length).toEqual(1);
  });

  test("can add a delayed job", async () => {
    const time = new Date().getTime() + 1000;
    await task.enqueueAt(time, "regularTask", { word: "first" });
    const timestamps = await api.resque.queue.scheduledAt(
      queue,
      "regularTask",
      { word: "first" }
    );
    expect(timestamps).toHaveLength(1);

    const completeTime = Math.floor(time / 1000);
    expect(Number(timestamps[0])).toBeGreaterThanOrEqual(completeTime);
    expect(Number(timestamps[0])).toBeLessThan(completeTime + 2);
  });

  test("can see enqueued timestamps & see jobs within those timestamps (single + batch)", async () => {
    const time = new Date().getTime() + 1000;
    const roundedTime = Math.round(time / 1000) * 1000;

    await task.enqueueAt(time, "regularTask", { word: "first" });
    const timestamps = await task.timestamps();
    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]).toEqual(roundedTime);

    const { tasks } = await task.delayedAt(roundedTime);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].class).toEqual("regularTask");

    const allTasks = await task.allDelayed();
    expect(Object.keys(allTasks)).toHaveLength(1);
    expect(Object.keys(allTasks)[0]).toEqual(String(roundedTime));
    expect(allTasks[roundedTime][0].class).toEqual("regularTask");
  });

  test("I can remove an enqueued job", async () => {
    await task.enqueue("regularTask", { word: "first" });
    const length = await api.resque.queue.length(queue);
    expect(length).toEqual(1);

    const count = await task.del(queue, "regularTask", { word: "first" });
    expect(count).toEqual(1);

    const lengthAgain = await api.resque.queue.length();
    expect(lengthAgain).toEqual(0);
  });

  test("I can remove a delayed job", async () => {
    await task.enqueueIn(1000, "regularTask", { word: "first" });
    const timestamps = await api.resque.queue.scheduledAt(
      queue,
      "regularTask",
      { word: "first" }
    );
    expect(timestamps).toHaveLength(1);

    const timestampsDeleted = await task.delDelayed(queue, "regularTask", {
      word: "first"
    });
    expect(timestampsDeleted).toHaveLength(1);
    expect(timestampsDeleted).toEqual(timestamps);

    const timestampsDeletedAgain = await task.delDelayed(queue, "regularTask", {
      word: "first"
    });
    expect(timestampsDeletedAgain).toHaveLength(0);
  });

  test("I can remove and stop a recurring task", async () => {
    // enqueue the delayed job 2x, one in each type of queue
    await task.enqueue("periodicTask", null);
    await task.enqueueIn(1000, "periodicTask", null);

    const count = await task.stopRecurrentTask("periodicTask");
    expect(count).toEqual(2);
  });

  describe("middleware", () => {
    describe("enqueue modification", () => {
      beforeAll(async () => {
        const middleware = {
          name: "test-middleware",
          priority: 1000,
          global: false,
          preEnqueue: () => {
            throw new Error("You cannot enqueue me!");
          }
        };

        task.addMiddleware(middleware);

        api.tasks.tasks.middlewareTask = {
          name: "middlewareTask",
          description: "middlewaretask",
          queue: "default",
          frequency: 0,
          middleware: ["test-middleware"],
          run: (params, worker) => {
            throw new Error("Should never get here");
          }
        };

        api.tasks.jobs.middlewareTask = api.tasks.jobWrapper("middlewareTask");
      });

      afterAll(async () => {
        api.tasks.globalMiddleware = [];
        delete api.tasks.jobs.middlewareTask;
      });

      test("can modify the behavior of enqueue with middleware.preEnqueue", async () => {
        try {
          await task.enqueue("middlewareTask", {});
        } catch (error) {
          expect(error.toString()).toEqual("Error: You cannot enqueue me!");
        }
      });
    });

    describe("Pre and Post processing", () => {
      beforeAll(() => {
        const middleware = {
          name: "test-middleware",
          priority: 1000,
          global: false,
          preProcessor: function() {
            const params = this.args[0];

            if (params.stop === true) {
              return false;
            }
            if (params.throw === true) {
              throw new Error("thown!");
            }

            params.test = true;
            if (!this.worker.result) {
              this.worker.result = {};
            }
            this.worker.result.pre = true;
            return true;
          },
          postProcessor: function() {
            this.worker.result.post = true;
            return true;
          }
        };

        task.addMiddleware(middleware);

        api.tasks.tasks.middlewareTask = {
          name: "middlewareTask",
          description: "middlewaretask",
          queue: "default",
          frequency: 0,
          middleware: ["test-middleware"],
          run: function(params, worker) {
            expect(params.test).toEqual(true);
            const result = worker.result;
            result.run = true;
            return result;
          }
        };

        api.tasks.jobs.middlewareTask = api.tasks.jobWrapper("middlewareTask");
      });

      afterAll(() => {
        api.tasks.globalMiddleware = [];
        delete api.tasks.jobs.middlewareTask;
      });

      test("can modify parameters before a task and modify result after task completion", async () => {
        const result = await specHelper.runFullTask("middlewareTask", {
          foo: "bar"
        });
        expect(result.run).toEqual(true);
        expect(result.pre).toEqual(true);
        expect(result.post).toEqual(true);
      });

      test("can prevent the running of a task with error", async () => {
        try {
          await specHelper.runFullTask("middlewareTask", { throw: true });
        } catch (error) {
          expect(error.toString()).toEqual("Error: thown!");
        }
      });

      test("can prevent the running of a task with return value", async () => {
        const result = await specHelper.runFullTask("middlewareTask", {
          stop: true
        });
        expect(result).toBeUndefined();
      });
    });
  });

  describe("details view in a working system", () => {
    test("can use api.tasks.details to learn about the system", async () => {
      config.tasks.queues = ["*"];

      await task.enqueue("slowTask", { a: 1 });
      api.resque.multiWorker.start();

      await utils.sleep(2000);

      const details = await task.details();

      expect(Object.keys(details.queues)).toEqual(["testQueue"]);
      expect(details.queues.testQueue).toHaveLength(0);
      expect(Object.keys(details.workers)).toHaveLength(1);
      const workerName = Object.keys(details.workers)[0];
      expect(details.workers[workerName].queue).toEqual("testQueue");
      expect(details.workers[workerName].payload.args).toEqual([{ a: 1 }]);
      expect(details.workers[workerName].payload.class).toEqual("slowTask");

      await api.resque.multiWorker.stop();
    }, 10000);
  });
});
