import { Action } from "./../index";

export class ValidationTest extends Action {
  name = "validationTest";
  description = "I will test action input validators.";
  inputs = {
    string: {
      required: true,
      validator: (param: string) => {
        return typeof param === "string";
      },
    },
  };
  outputExample = {
    string: "imAString!",
  };

  async run({ params }: { params: { string: string } }) {
    return { string: params.string };
  }
}
