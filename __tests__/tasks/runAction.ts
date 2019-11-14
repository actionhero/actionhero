import { Process } from "./../../src/index";

const actionhero = new Process();
let api;

describe("Test: RunAction", () => {
  beforeAll(async () => {
    api = await actionhero.start();
  });
  afterAll(async () => {
    await actionhero.stop();
  });

  test("can run the task manually", async () => {
    const { randomNumber } = await api.specHelper.runTask("runAction", {
      action: "randomNumber"
    });
    expect(randomNumber).toBeGreaterThanOrEqual(0);
    expect(randomNumber).toBeLessThan(1);
  });
});
