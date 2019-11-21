import { Process, specHelper } from "./../../src/index";

const actionhero = new Process();

describe("Test: RunAction", () => {
  beforeAll(async () => {
    await actionhero.start();
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  test("can run the task manually", async () => {
    const { randomNumber } = await specHelper.runTask("runAction", {
      action: "randomNumber"
    });
    expect(randomNumber).toBeGreaterThanOrEqual(0);
    expect(randomNumber).toBeLessThan(1);
  });
});
