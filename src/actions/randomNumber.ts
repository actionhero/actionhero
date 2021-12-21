import { Action } from "./../index";

export class RandomNumber extends Action {
  name = "randomNumber";
  description = "I am an API method which will generate a random number";
  outputExample = {
    randomNumber: 0.123,
    stringRandomNumber: "Your random number is 0.123",
  };

  async run() {
    const randomNumber = Math.random();
    const stringRandomNumber = `Your random number is ${randomNumber}`;

    return { randomNumber, stringRandomNumber };
  }
}
