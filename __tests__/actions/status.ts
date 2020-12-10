import { Process, specHelper } from "./../../src/index";
import { Status } from "../../src/actions/status";

const RunMethod = Status.prototype.run;
const actionhero = new Process();

describe("Action", () => {
  describe("status", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("returns node status", async () => {
      const { id, problems, name, error } = await specHelper.runAction<
        typeof RunMethod
      >("status");
      expect(error).toBeUndefined();
      expect(problems).toHaveLength(0);
      expect(id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`);
      expect(name).toEqual("actionhero");
    });
  });
});
