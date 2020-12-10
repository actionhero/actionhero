import { Process, specHelper } from "./../../src/index";
import { UnwrapPromise } from "../..";
import { Status } from "../../src/actions/status";

type ActionResponse = UnwrapPromise<typeof Status.prototype.run>;
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
      const {
        id,
        problems,
        name,
        //@ts-ignore
        error,
      }: ActionResponse = await specHelper.runAction("status");
      expect(error).toBeUndefined();
      expect(problems).toHaveLength(0);
      expect(id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`);
      expect(name).toEqual("actionhero");
    });
  });
});
