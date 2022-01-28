import { Input } from "./input";
import { Action } from "../classes/action";
import { Task } from "../classes/task";
import { CLI } from "../classes/cli";

export interface Inputs {
  [key: string]: Input;
}

export type CLIParamsFrom<A extends CLI> = {
  [Input in keyof A["inputs"]]: A["inputs"][Input]["variadic"] extends true
    ? A["inputs"][Input]["formatter"] extends (...args: any[]) => any
      ? ReturnType<A["inputs"][Input]["formatter"]>[]
      : string[]
    : A["inputs"][Input]["formatter"] extends (...args: any[]) => any
    ? ReturnType<A["inputs"][Input]["formatter"]>
    : string;
};

export type OtherParamsFrom<A extends Action | Task> = {
  [Input in keyof A["inputs"]]: A["inputs"][Input]["formatter"] extends (
    ...args: any[]
  ) => any
    ? ReturnType<A["inputs"][Input]["formatter"]>
    : string;
};

export type ParamsFrom<T extends Action | Task | CLI> = T extends CLI
  ? CLIParamsFrom<T>
  : T extends Action
  ? OtherParamsFrom<T>
  : T extends Task
  ? OtherParamsFrom<T>
  : never;
