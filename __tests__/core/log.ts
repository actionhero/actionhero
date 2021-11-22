import { log, loggers, Process } from "./../../src";

const actionhero = new Process();

describe("Core", () => {
  describe("log", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("the log method should work", () => {
      log("hello");
    });

    test("the winston loggers are available via the export loggers", () => {
      expect(loggers.length).toBe(2);
    });
  });
});
