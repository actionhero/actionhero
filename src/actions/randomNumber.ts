import { Action } from "./../index";

export class RandomNumber extends Action {
  constructor() {
    super();
    this.name = "randomNumber";
    this.description = "I am an API method which will generate a random number";
    this.outputExample = { randomNumber: 0.123 };
  }

  async run({ connection }) {
    const randomNumber = Math.random();
    const stringRandomNumber: string = connection.localize([
      "Your random number is {{randomNumber}}",
      // @ts-ignore
      { randomNumber },
    ]);

    return { randomNumber, stringRandomNumber };
  }
}
