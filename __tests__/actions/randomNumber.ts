import { Process } from "./../../src/index";

const actionhero = new Process();
let api;

describe("Action", () => {
  describe("randomNumber", () => {
    beforeAll(async () => {
      api = await actionhero.start();
    });
    afterAll(async () => {
      await actionhero.stop();
    });

    let firstNumber = null;

    test("generates random numbers", async () => {
      const { randomNumber } = await api.specHelper.runAction("randomNumber");
      expect(randomNumber).toBeGreaterThan(0);
      expect(randomNumber).toBeLessThan(1);
      firstNumber = randomNumber;
    });

    test("is unique / random", async () => {
      const { randomNumber } = await api.specHelper.runAction("randomNumber");
      expect(randomNumber).toBeGreaterThan(0);
      expect(randomNumber).toBeLessThan(1);
      expect(randomNumber).not.toEqual(firstNumber);
    });
  });
});
