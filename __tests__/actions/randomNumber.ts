import { Process, specHelper } from "./../../src/index";
import { RandomNumber } from "../../src/actions/randomNumber";

describe("Action: randomNumber", () => {
  const actionhero = new Process();
  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  let firstNumber: number;

  test("generates random numbers", async () => {
    const { randomNumber } = await specHelper.runAction<RandomNumber>(
      "randomNumber",
    );
    expect(randomNumber).toBeGreaterThan(0);
    expect(randomNumber).toBeLessThan(1);
    firstNumber = randomNumber;
  });

  test("is unique / random", async () => {
    const { randomNumber } = await specHelper.runAction<RandomNumber>(
      "randomNumber",
    );
    expect(randomNumber).toBeGreaterThan(0);
    expect(randomNumber).toBeLessThan(1);
    expect(randomNumber).not.toEqual(firstNumber);
  });
});
