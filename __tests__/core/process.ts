import { Process, api } from "./../../src/index";

const actionhero = new Process();

describe("Core", () => {
  describe("Process", () => {
    test("a new process can be created", () => {
      expect(actionhero.initialized).toBe(false);
      expect(actionhero.started).toBe(false);
      expect(actionhero.stopped).toBe(false);
    });

    test("a new process can be initialized", async () => {
      await actionhero.initialize();
      expect(actionhero.initialized).toBe(true);
      expect(actionhero.started).toBe(false);
      expect(actionhero.stopped).toBe(false);
    });

    test("a new process can be started", async () => {
      await actionhero.start();
      expect(actionhero.initialized).toBe(true);
      expect(actionhero.started).toBe(true);
      expect(actionhero.stopped).toBe(false);
    });

    test("a new process can be stopped", async () => {
      await actionhero.stop("some reason");
      expect(actionhero.stopReasons).toEqual(["some reason"]);
      expect(actionhero.initialized).toBe(false);
      expect(actionhero.started).toBe(false);
      expect(actionhero.stopped).toBe(true);
    });

    test("the process is injected into the global API import", () => {
      actionhero["testProperty"] = { a: 1 };
      expect(api.process["testProperty"]).toEqual({ a: 1 });
    });
  });
});
