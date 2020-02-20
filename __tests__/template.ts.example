import { Process, env, id, specHelper } from "actionhero";
const actionhero = new Process();
let api;

describe("actionhero Tests", () => {
  beforeAll(async () => {
    api = await actionhero.start();
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  test("should have booted into the test env", () => {
    expect(process.env.NODE_ENV).toEqual("test");
    expect(env).toEqual("test");
    expect(id).toBeTruthy();
  });

  test("can retrieve server uptime via the status action", async () => {
    const { uptime } = await specHelper.runAction("status");
    expect(uptime).toBeGreaterThan(0);
  });
});
