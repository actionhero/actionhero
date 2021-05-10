import * as MockIORedis from "ioredis-mock";
import {
  api,
  cache,
  chatRoom,
  Process,
  specHelper,
  utils,
  Task,
  task,
} from "./../../src/index";

jest.mock("./../../src/config/redis.ts", () => ({
  __esModule: true,
  test: {
    redis: () => {
      const baseRedis = new MockIORedis();
      return {
        _toExpand: false,
        scanCount: 1000,
        client: {
          konstructor: () => baseRedis,
          args: [],
          buildNew: false,
        },
        subscriber: {
          konstructor: () => baseRedis.createConnectedClient(),
          args: [],
          buildNew: false,
        },
        tasks: {
          konstructor: () => baseRedis.createConnectedClient(),
          args: [],
          buildNew: false,
        },
      };
    },
  },
}));

jest.mock("./../../src/config/tasks.ts", () => ({
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

const actionhero = new Process();

describe("with ioredis-mock", () => {
  beforeAll(async () => {
    process.env.AUTOMATIC_ROUTES = "get";
    await actionhero.start();
    await api.redis.clients.client.flushdb();
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  test("basic redis operations work and data is shared between the connections", async () => {
    await api.redis.clients.client.set("__test", "abc");
    expect(await api.redis.clients.client.get("__test")).toBe("abc");
    expect(await api.redis.clients.tasks.get("__test")).toBe("abc");
  });

  test("redis pub-sub works between connections", async () => {
    let message: string;
    api.redis.clients.subscriber.subscribe("test-channel");
    const subscription = api.redis.clients.subscriber.on(
      "message",
      (channel, m) => {
        if (channel === "test-channel") message = m;
      }
    );

    await api.redis.clients.client.publish("test-channel", "hello");
    await utils.sleep(10);
    expect(message).toBe("hello");

    api.redis.clients.subscriber.unsubscribe("test-channel");
  });

  test("chat works", async () => {
    await chatRoom.add("defaultRoom");
    const client1 = await specHelper.buildConnection();
    const client2 = await specHelper.buildConnection();
    client1.verbs("roomAdd", "defaultRoom");
    client2.verbs("roomAdd", "defaultRoom");

    await utils.sleep(10);
    await client1.verbs("say", ["defaultRoom", "Hi"]);
    await utils.sleep(10);

    const { message, room, from } =
      client2.messages[client2.messages.length - 1];

    expect(message).toEqual("Hi");
    expect(room).toEqual("defaultRoom");
    expect(from).toEqual(client1.id);
  });

  test("cache works", async () => {
    await cache.save("testKey", { test: "value" });
    const { key, value } = await cache.load("testKey");
    expect(key).toBe("testKey");
    expect(value).toEqual({ test: "value" });
  });

  describe("tasks", () => {
    let taskOutput = [];

    beforeAll(async () => {
      class RegularTask extends Task {
        constructor() {
          super();
          this.name = "regular";
          this.description = "task: regular";
          this.queue = "testQueue";
          this.frequency = 0;
        }

        run(params) {
          taskOutput.push(params.word);
          return params.word;
        }
      }

      api.tasks.tasks.regularTask = new RegularTask();
      api.tasks.jobs.regularTask = api.tasks.jobWrapper("regularTask");
    });

    beforeEach(() => {
      taskOutput = [];
    });

    afterAll(async () => {
      delete api.tasks.tasks.regularTask;
      delete api.tasks.jobs.regularTask;
    });

    test("tasks work inline (quick)", async () => {
      const response = await specHelper.runTask("regularTask", {
        word: "test",
      });
      expect(response).toBe("test");
      expect(taskOutput).toEqual(["test"]);
    });

    test("tasks work inline (full)", async () => {
      const response = await specHelper.runFullTask("regularTask", {
        word: "test",
      });
      expect(response).toBe("test");
      expect(taskOutput).toEqual(["test"]);
    });

    test("workers and scheduler work", async () => {
      await task.enqueueIn(1, "regularTask", { word: "test-full" });

      const jobs = await task.allDelayed();
      const times = Object.keys(jobs);
      expect(jobs[times[0]][0]).toEqual({
        args: [{ word: "test-full" }],
        class: "regularTask",
        queue: "testQueue",
      });

      await utils.sleep(1500);
      expect(taskOutput).toEqual(["test-full"]);
    }, 10000);
  });
});
