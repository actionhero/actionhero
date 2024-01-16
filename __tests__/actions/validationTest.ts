import { Process, specHelper } from "./../../src/index";
import { ValidationTest } from "../../src/actions/validationTest";

describe("Action: validationTest", () => {
  const actionhero = new Process();
  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  test("fails with no params", async () => {
    const { error } = await specHelper.runAction<ValidationTest>(
      "validationTest",
      {},
    );
    expect(error).toEqual(
      "Error: string is a required parameter for this action",
    );
  });

  test("fails with a number", async () => {
    const { error } = await specHelper.runAction<ValidationTest>(
      "validationTest",
      {
        string: 87,
      },
    );
    expect(error).toEqual(
      'Error: Input for parameter "string" failed validation!',
    );
  });

  test("fails with generalized validation error message", async () => {
    const { error } = await specHelper.runAction<ValidationTest>(
      "validationTest",
      {
        string: "hello",
        number: "invalid number",
      },
    );
    expect(error).toEqual("Error: Param number is not a valid number!");
  });

  test("fails with generalized formatter error message", async () => {
    const { error } = await specHelper.runAction<ValidationTest>(
      "validationTest",
      {
        string: "hello",
        number: 123,
      },
    );
    expect(error).toEqual("Error: Failed formatting number correctly!");
  });

  test("works with a string", async () => {
    const { string } = await specHelper.runAction<ValidationTest>(
      "validationTest",
      {
        string: "hello",
        ValidationTest,
      },
    );
    expect(string).toEqual("hello");
  });
});
