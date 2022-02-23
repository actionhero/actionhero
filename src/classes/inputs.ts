import { Input } from "./input";
import { Action } from "../classes/action";
import { Task } from "../classes/task";
import { CLI } from "../classes/cli";

export interface Inputs {
  [key: string]: Input;
}
type ActionheroWithParams = Action | Task | CLI;

type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];
type FormatterOrString<I extends Input> = I["formatter"] extends (
  ...args: any[]
) => any
  ? ReturnType<I["formatter"]>
  : string;
type RequiredParamsKeys<A extends ActionheroWithParams> = KeysOfType<
  A["inputs"],
  Required
>;

type Variadic = { variadic: true };
type Required = Readonly<{ required: true }> | { required: true };

type RequestRequiredParamsKeys<A extends ActionheroWithParams> = KeysOfType<
  A["inputs"],
  RequestRequired
>;
type RequestRequired =
  | Readonly<{ required: true; inPath?: false }>
  | { required: true; inPath?: false };

type ParamsExtractor<A extends ActionheroWithParams> = {
  [Input in keyof A["inputs"]]: A["inputs"][Input] extends Variadic
    ? FormatterOrString<A["inputs"][Input]>[]
    : FormatterOrString<A["inputs"][Input]>;
};

export type ParamsFrom<A extends ActionheroWithParams> = Pick<
  ParamsExtractor<A>,
  RequiredParamsKeys<A>
> &
  Partial<ParamsExtractor<A>>;

export type RequestParamsFrom<A extends ActionheroWithParams> = Pick<
  ParamsExtractor<A>,
  RequestRequiredParamsKeys<A>
> &
  Partial<ParamsExtractor<A>>;
