import { CLI } from "../../../../src/index";

export class Hello extends CLI {
  constructor() {
    super();
    this.name = "hello";
    this.description = "I say hello";
    this.inputs={
      name: {
        required: true,
        description: 'Who we are greeting',
        letter: 'g',
        default: 'Actionhero'
    }
    }
  }

  async run({params}) {
    console.log(`Hello, ${params.name}`);
    return true;
  }
}
