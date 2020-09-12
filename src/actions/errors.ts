import { Action } from "./../index"

export class TestError extends Action {
  constructor() {
    super();
    this.name = "testErr";
    this.description = "I am an API method which will generate a random number";
    this.outputExample = { randomNumber: 0.123 };
  }

  async run({ connection, response }) {
    throw new Error("some internal error");
  }
}

export class TestAppError extends Action {
  constructor() {
    super();
    this.name = "testAppErr";
    this.description = "I am an API method which will generate a random number";
    this.outputExample = { randomNumber: 0.123 };
  }

  async run({ connection, response }) {
    const err = new Error("some app error");
    err.name = "AppError";
    // @ts-ignore
    err.appCode = "100500";
    throw err;
  }
}
