import { Process, specHelper } from "./../../src/index";
import { Status } from "../../src/actions/status";

describe("Action: status", () => {
  const actionhero = new Process();
  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  test("returns node status", async () => {
    const { id, problems, name, error } = await specHelper.runAction<Status>(
      "status"
    );
    expect(error).toBeUndefined();
    expect(problems).toHaveLength(0);
    expect(id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`);
    expect(name).toEqual("actionhero");
  });
});
