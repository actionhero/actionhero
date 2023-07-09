import { Process, specHelper } from "./../../src/index";
import { SleepTest } from "../../src/actions/sleepTest";

describe("Action: sleepTest", () => {
  const actionhero = new Process();
  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  test("will return data from an async action", async () => {
    const { sleepDuration } = await specHelper.runAction<SleepTest>(
      "sleepTest",
    );
    expect(sleepDuration).toEqual(1000);
  });

  test("can change sleepDuration", async () => {
    const { sleepDuration } = await specHelper.runAction<SleepTest>(
      "sleepTest",
      {
        sleepDuration: 100,
      },
    );
    expect(sleepDuration).toEqual(100);
  });
});
