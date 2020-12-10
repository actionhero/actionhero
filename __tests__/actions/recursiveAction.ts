import { Process, specHelper } from "./../../src/index";
import { UnwrapPromise } from "../..";
import { RecursiveAction } from "../../src/actions/recursiveAction";

type ActionResponse = UnwrapPromise<typeof RecursiveAction.prototype.run>;

const actionhero = new Process();

describe("Action", () => {
  describe("recursiveAction", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("merges its own response with the randomNumber response", async () => {
      const response: ActionResponse = await specHelper.runAction(
        "recursiveAction"
      );
      expect(response.local).toEqual(true);
      expect(response.randomNumber).toBeGreaterThanOrEqual(0);
      expect(response.stringRandomNumber).toMatch(/Your random number is/);
    });
  });
});
