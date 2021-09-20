import {
  action,
  Process,
  api,
  Connection,
  ActionProcessor,
} from "./../../src/index";

const actionhero = new Process();

describe("Modules", () => {
  describe("action", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("actions can be called in-line", async () => {
      const response = await action.run("randomNumber");
      expect(response.randomNumber).toBeGreaterThanOrEqual(0);
      expect(response.stringRandomNumber).toMatch(/Your random number is/);
    });

    test("in-line actions can accept params", async () => {
      const response = await action.run("cacheTest", null, {
        key: "testKey",
        value: "testValue",
      });
      expect(response.cacheTestResults.saveResp).toBe(true);
      expect(response.cacheTestResults.deleteResp).toBe(true);
    });

    test("in-line actions will fail when required params are missing", async () => {
      await expect(action.run("cacheTest")).rejects.toThrow(
        /key is a required parameter for this action/
      );
    });

    describe("middleware", () => {
      afterEach(() => {
        api.actions.middleware = {};
        api.actions.globalMiddleware = [];
      });

      test("in-line actions run middleware", async () => {
        action.addMiddleware({
          name: "test middleware",
          global: true,
          preProcessor: (data: ActionProcessor<any>) => {
            data.response._preProcessorNote = "note";
          },
        });

        const response = await action.run("randomNumber");
        expect(response.randomNumber).toBeGreaterThanOrEqual(0);
        expect(response._preProcessorNote).toBe("note");
      });

      test("throwing in middleware halts in-line actions", async () => {
        action.addMiddleware({
          name: "test middleware",
          global: true,
          preProcessor: () => {
            throw new Error("nope");
          },
        });

        await expect(action.run("randomNumber")).rejects.toThrow(/nope/);
      });
    });

    describe("connectionProperties", () => {
      afterEach(() => {
        api.actions.middleware = {};
        api.actions.globalMiddleware = [];
      });

      test("connection properties can be assigned", async () => {
        action.addMiddleware({
          name: "test middleware",
          global: true,
          preProcessor: ({ connection }: { connection: Connection }) => {
            if (!connection?.session?.userId) throw new Error("not logged in");
          },
        });

        await expect(action.run("randomNumber")).rejects.toThrow(
          /not logged in/
        );

        const response = await action.run("randomNumber", null, null, {
          session: { userId: 123 },
        });
        expect(response.randomNumber).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
