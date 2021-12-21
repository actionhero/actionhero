import { Input } from "./input";
import { Action } from "../classes/action";
import { Task } from "../classes/task";

export interface Inputs {
  [key: string]: Input;
}

export type ParamsFrom<A extends Action | Task> = {
  [Input in keyof A["inputs"]]: A["inputs"][Input]["formatter"] extends (
    ...ags: any[]
  ) => any
    ? ReturnType<A["inputs"][Input]["formatter"]>
    : string;
};
