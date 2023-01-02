import { CLI, ParamsFrom } from "./../../src/index";

export class HelloCliTest extends CLI {
  name = "hello";
  description = "I work";
  inputs = {
    name: {
      required: false,
      requiredValue: true,
      default: "World",
    },
    title: {
      letter: "t",
      required: true,
      default: "Dr.",
      formatter: (val: string) => {
        return `${val}.`;
      },
      validator: (val: string) => {
        const parts = val.split(".");
        if (parts.length > 2) throw new Error("too many periods");
      },
    },
    countries: {
      variadic: true as true,
      formatter: (val: string) => `${val}!`,
      validator: (val: string) => {
        if (val.length > 0 && val[0].toUpperCase() !== val[0])
          throw new Error("country not capitalized");
      },
    },
  };

  async run({ params }: { params: Partial<ParamsFrom<HelloCliTest>> }) {
    const sayHello = (title: string, name: string, countries: string[]) =>
      console.log(
        `Hello, ${title} ${name} ${countries ? `(${countries.join(" ")})` : ""}`
      );
    sayHello(params.title!, params.name!, params.countries!);
    return true;
  }
}
