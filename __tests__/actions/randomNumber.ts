import { Process, specHelper } from "./../../src/index";
import { RandomNumber } from "../../src/actions/randomNumber";

describe("Action: randomNumber", () => {
  const RunMethod = RandomNumber.prototype.run;
  const actionhero = new Process();

  beforeAll(async () => {
    await actionhero.start();
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  let firstNumber = null;

  test("generates random numbers", async () => {
    const { randomNumber } = await specHelper.runAction<typeof RunMethod>(
      "randomNumber"
    );
    expect(randomNumber).toBeGreaterThan(0);
    expect(randomNumber).toBeLessThan(1);
    firstNumber = randomNumber;
  });

  test("is unique / random", async () => {
    const { randomNumber } = await specHelper.runAction<typeof RunMethod>(
      "randomNumber"
    );
    expect(randomNumber).toBeGreaterThan(0);
    expect(randomNumber).toBeLessThan(1);
    expect(randomNumber).not.toEqual(firstNumber);
  });
});
