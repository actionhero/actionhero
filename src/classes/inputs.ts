import { Input } from "./input";
import { Action } from "../classes/action";
import { Task } from "../classes/task";
import { CLI } from "../classes/cli";

export interface Inputs {
  [key: string]: Input;
}

export type ParamsFrom<A extends Action | Task | CLI> = A extends CLI
  ? {
      [Input in keyof A["inputs"]]: A["inputs"][Input]["variadic"] extends true
        ? A["inputs"][Input]["formatter"] extends (...ags: any[]) => any
          ? ReturnType<A["inputs"][Input]["formatter"]>[]
          : string[]
        : A["inputs"][Input]["formatter"] extends (...ags: any[]) => any
        ? ReturnType<A["inputs"][Input]["formatter"]>
        : string;
    }
  : {
      [Input in keyof A["inputs"]]: A["inputs"][Input]["formatter"] extends (
        ...ags: any[]
      ) => any
        ? ReturnType<A["inputs"][Input]["formatter"]>
        : string;
    };
