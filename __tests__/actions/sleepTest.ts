import { Process, specHelper } from "./../../src/index";
import { UnwrapPromise } from "../..";
import { SleepTest } from "../../src/actions/sleepTest";

type ActionResponse = UnwrapPromise<typeof SleepTest.prototype.run>;
const actionhero = new Process();

describe("Action", () => {
  describe("sleepTest", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("will return data from an async action", async () => {
      const { sleepDuration }: ActionResponse = await specHelper.runAction(
        "sleepTest"
      );
      expect(sleepDuration).toEqual(1000);
    });

    test("can change sleepDuration", async () => {
      const { sleepDuration }: ActionResponse = await specHelper.runAction(
        "sleepTest",
        {
          sleepDuration: 100,
        }
      );
      expect(sleepDuration).toEqual(100);
    });
  });
});
