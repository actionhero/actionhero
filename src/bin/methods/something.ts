import { ParamsFrom, CLIParamsFrom } from "../../classes/inputs";
import { api, env, CLI } from "./../../index";

export class SomethingCLI extends CLI {
  name = "something";
  description =
    "Start an interactive REPL session with the api object in-scope";
  inputs = {
    test: {
      variadic: false,
      validator: (p: string) => {
        if (p.includes("."))
          throw new Error(`${p} isnt valid because periods are bad`);
      },
      formatter: (p: string) => {
        return p.replace(/\-/g, ".");
      },
    },
  };

  async run({ params }: { params: ParamsFrom<SomethingCLI> }) {
    console.log("hi there", params);

    const func = (val: string) => true;

    // const val: string = params.test;
    // return func(val);
    return func(params.test);
    return true;

    return Promise.resolve(true);
  }
}
