import { Process, specHelper } from "./../../src/index";

const actionhero = new Process();

describe("Test: RunAction", () => {
  beforeAll(async () => {
    await actionhero.start();
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  test("can run the task without params", async () => {
    const { randomNumber } = await specHelper.runTask("runAction", {
      action: "randomNumber",
    });
    expect(randomNumber).toBeGreaterThanOrEqual(0);
    expect(randomNumber).toBeLessThan(1);
  });

  test("can run the task with params", async () => {
    const { cacheTestResults } = await specHelper.runTask("runAction", {
      action: "cacheTest",
      params: { key: "testKey", value: "testValue" },
    });
    expect(cacheTestResults.saveResp).toBe(true);
    expect(cacheTestResults.deleteResp).toBe(true);
  });

  test("will throw with errors", async () => {
    await expect(
      specHelper.runTask("runAction", {
        action: "cacheTest",
      })
    ).rejects.toThrow(/key is a required parameter for this action/);
  });
});
