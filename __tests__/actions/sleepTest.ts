import { Process } from "./../../src/index";

const actionhero = new Process();
let api;

describe("Action", () => {
  describe("sleepTest", () => {
    beforeAll(async () => {
      api = await actionhero.start();
    });
    afterAll(async () => {
      await actionhero.stop();
    });

    test("will return data from an async action", async () => {
      const { sleepDuration } = await api.specHelper.runAction("sleepTest");
      expect(sleepDuration).toEqual(1000);
    });

    test("can change sleepDuration", async () => {
      const { sleepDuration } = await api.specHelper.runAction("sleepTest", {
        sleepDuration: 100
      });
      expect(sleepDuration).toEqual(100);
    });
  });
});
