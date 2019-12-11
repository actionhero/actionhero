import { CLI } from "../../../../src/index";

export class Version extends CLI {
  constructor() {
    super();
    this.name = "hello";
    this.description = "I say hello";
  }

  async run() {
    console.log("hello");
    return true;
  }
}
