import { Process, specHelper } from "./../../src/index";

const actionhero = new Process();

describe("Action", () => {
  describe("randomNumber", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    let firstNumber = null;

    test("generates random numbers", async () => {
      const { randomNumber } = await specHelper.runAction("randomNumber");
      expect(randomNumber).toBeGreaterThan(0);
      expect(randomNumber).toBeLessThan(1);
      firstNumber = randomNumber;
    });

    test("is unique / random", async () => {
      const { randomNumber } = await specHelper.runAction("randomNumber");
      expect(randomNumber).toBeGreaterThan(0);
      expect(randomNumber).toBeLessThan(1);
      expect(randomNumber).not.toEqual(firstNumber);
    });
  });
});
