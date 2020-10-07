import { Action } from "./../index";

export class ValidationTest extends Action {
  constructor() {
    super();
    this.name = "validationTest";
    this.description = "I will test action input validators.";
    this.inputs = {
      string: {
        required: true,
        validator: (param) => {
          return typeof param === "string";
        },
      },
    };
    this.outputExample = {
      string: "imAString!",
    };
  }

  async run({ params }: { params: { string: string } }) {
    return { string: params.string };
  }
}
