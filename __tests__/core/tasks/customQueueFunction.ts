import { api, Process, utils, config } from "./../../../src/index";

const actionhero = new Process();
let taskOutput = [];
const queue = "testQueue";

jest.mock("./../../../src/config/tasks.ts", () => ({
  __esModule: true,
  test: {
    tasks: () => {
      return {
        _toExpand: false,

        scheduler: false,
        queues: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return ["queueA", "queueB"];
        },
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
  describe("custom queues function", () => {
    beforeAll(async () => {
      await actionhero.start();
      api.resque.multiWorker.options.connection.redis.setMaxListeners(100);
    });

    afterAll(async () => {
      config.tasks.queues = [];

      api.resque.multiWorker.options.minTaskProcessors = 0;
      api.resque.multiWorker.options.maxTaskProcessors = 0;

      await actionhero.stop();
    });

    beforeEach(async () => {
      taskOutput = [];
      await api.resque.queue.connection.redis.flushdb();
    });

    test("normal tasks work", async () => {
      api.resque.multiWorker.start();
      await utils.sleep(2000);

      expect(api.resque.multiWorker.workers[0].queues).toEqual([
        "queueA",
        "queueB",
      ]);
      await api.resque.multiWorker.stop();
    });
  });
});
