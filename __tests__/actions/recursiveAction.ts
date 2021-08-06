import { Process, specHelper } from "./../../src/index";
import { RecursiveAction } from "../../src/actions/recursiveAction";

describe("Action: recursiveAction", () => {
  const actionhero = new Process();
  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  test("merges its own response with the randomNumber response", async () => {
    const response = await specHelper.runAction<RecursiveAction>(
      "recursiveAction"
    );
    expect(response.local).toEqual(true);
    expect(response.randomNumber).toBeGreaterThanOrEqual(0);
    expect(response.stringRandomNumber).toMatch(/Your random number is/);
  });
});
