import { Action } from "./../index";

export class ValidationTest extends Action {
  name = "validationTest";
  description = "I will test action input validators.";
  inputs = {
    string: {
      required: true as true,
      validator: (param: string) => {
        return typeof param === "string";
      },
    },
    number: {
      required: false,
      formatter: (param: string, name: string) => {
        if (parseInt(param) == 123) {
          throw new Error(`Failed formatting ${name} correctly!`);
        }
        return parseInt(param);
      },
      validator: (param: number, name: string) => {
        if (typeof param === "number") {
          throw new Error(`Param ${name} is not a valid number!`);
        }
      },
    },
  };
  outputExample = {
    string: "imAString!",
    number: 2,
  };

  async run({ params }: { params: { string: string; number: number } }) {
    return { string: params.string, number: params.number };
  }
}
