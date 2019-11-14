import { api, Action } from "./../index";

export class ValidationTest extends Action {
  constructor() {
    super();
    this.name = "validationTest";
    this.description = "I will test action input validators.";
    this.inputs = {
      string: {
        required: true,
        validator: param => {
          return typeof param === "string";
        }
      }
    };
    this.outputExample = {
      string: "imAString!"
    };
  }

  async run({ params, response }) {
    response.string = params.string;
  }
}
