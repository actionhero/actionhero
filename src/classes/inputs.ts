import { Input } from "./input";
import { Action } from "../classes/action";
import { Task } from "../classes/task";
import { CLI } from "../classes/cli";

export interface Inputs {
  [key: string]: Input;
}

type FormatterOrString<I extends (Action | Task | CLI)["inputs"][string]> =
  I["formatter"] extends (...args: any[]) => any
    ? ReturnType<I["formatter"]>
    : string;

type Variadic = { variadic: true };

export type ParamsFrom<A extends Action | Task | CLI> = {
  [Input in keyof A["inputs"]]: A["inputs"][Input] extends Variadic
    ? FormatterOrString<A["inputs"][Input]>[]
    : FormatterOrString<A["inputs"][Input]>;
};
