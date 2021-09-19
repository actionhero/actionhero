jest.mock("./../../src/config/tasks.ts", () => ({
  __esModule: true,
  test: {
    tasks: () => {
      return {
        _toExpand: false,
        scheduler: true,
        queues: ["*"],
        workerLogging: {
          failure: "error", // task failure
          success: "info", // task success
          start: "info",
          end: "info",
          cleaning_worker: "info",
          poll: "debug",
          job: "debug",
          pause: "debug",
          internalError: "error",
          multiWorkerAction: "debug",
        },
        schedulerLogging: {
          start: "info",
          end: "info",
          poll: "debug",
          enqueue: "debug",
          reEnqueue: "debug",
          working_timestamp: "debug",
          transferred_job: "debug",
        },
        timeout: 500,
        minTaskProcessors: 1,
        maxTaskProcessors: 1,
        checkTimeout: 500,
        maxEventLoopDelay: 5,
        stuckWorkerTimeout: 1000 * 60 * 60,
        resque_overrides: {},
        connectionOptions: {
          tasks: {},
        },
      };
    },
  },
}));

import * as path from "path";
import * as fs from "fs";
import { api, Process, utils } from "../../src";

const testTaskPath = path.join(__dirname, "./../../src/tasks/test-task.ts");
fs.writeFileSync(
  testTaskPath,
  `
import {Task} from './../index'

export default class MyTask extends Task {
  constructor() {
    super();
    this.name = "test-task";
    this.description = "a test";
    this.frequency = 1;
    this.queue = "default";
    this.middleware = [];
  }

  async run() {
    process.env.DID_TASK_RUN = "yes";
  }
}
`
);

describe("task integration tests", () => {
  beforeAll(() => {
    process.env.DID_TASK_RUN = "no";
  });

  test("the variable started as no", () => {
    expect(process.env.DID_TASK_RUN).toBe("no");
  });

  describe("with a running server", () => {
    let actionhero: Process;

    beforeAll(async () => {
      actionhero = new Process();
      await actionhero.start();
      await api.redis.clients.client.set("resque:stat:processed", 0);
    });

    afterAll(async () => {
      await actionhero.stop();
      fs.unlinkSync(testTaskPath);
    });

    test("the periodic task should have started", async () => {
      const getCount = async () => {
        return parseInt(
          await api.redis.clients.client.get("resque:stat:processed")
        );
      };

      while ((await getCount()) < 1) await utils.sleep(100);

      expect(await getCount()).toBeGreaterThan(0);
      expect(process.env.DID_TASK_RUN).toBe("yes");
    });
  });
});
