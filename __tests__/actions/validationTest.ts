import { Process, specHelper } from "./../../src/index";
import { UnwrapPromise } from "../..";
import { ValidationTest } from "../../src/actions/validationTest";

type ActionResponse = UnwrapPromise<typeof ValidationTest.prototype.run>;
const actionhero = new Process();

describe("Action", () => {
  describe("validationTest", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("fails with no params", async () => {
      const { error } = await specHelper.runAction("validationTest", {});
      expect(error).toEqual(
        "Error: string is a required parameter for this action"
      );
    });

    test("fails with a number", async () => {
      const { error } = await specHelper.runAction("validationTest", {
        string: 87,
      });
      expect(error).toEqual(
        'Error: Input for parameter "string" failed validation!'
      );
    });

    test("works with a string", async () => {
      const { string }: ActionResponse = await specHelper.runAction(
        "validationTest",
        {
          string: "hello",
        }
      );
      expect(string).toEqual("hello");
    });
  });
});
