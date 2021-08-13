import { missing } from "../modules/utils/missing";

export interface ConfigNamespaceData {
  [key: string]:
    | number
    | string
    | boolean
    | number[]
    | string[]
    | boolean[]
    | ConfigNamespaceData;
}

export class Config {
  data: { [namespace: string]: ConfigNamespaceData };

  constructor() {
    this.data = {};
  }

  set(namespace: string, data: ConfigNamespaceData) {
    this.data[namespace] = data;
  }

  get<T>(namespace: string, ...args: string[]) {
    let data = this.data[namespace];
    for (const k of args) {
      if (
        data !== undefined &&
        data !== null &&
        data[k] &&
        typeof data[k] === "object"
      )
        data = data[k] as ConfigNamespaceData;
      else {
        throw new Error(
          `config not found for \`${namespace}.${args ? args.join(".") : ""}\``
        );
      }
    }

    return data as undefined as T;
  }
}

/**
 * A loader class to set Actionhero config
 */
export abstract class ConfigLoader {
  /**The load order of this Config Section */
  configPriority: number;

  constructor() {
    if (missing(this.configPriority)) this.configPriority = 1000;
  }

  /**
   * The run method of a Config Section is to append additional information to the config object by returning the object that will be applied to the namespace.
   *
   * ```ts
   * import {setConfig} from 'actionhero'
   * ```
   */
  abstract run(): Promise<any>;

  validate?() {
    if (!this.run) {
      throw new Error("run method is required for this config section");
    }
  }
}

export type PluginConfigRecord = {
  path: string;
  actions?: boolean;
  tasks?: boolean;
  initializers?: boolean;
  servers?: boolean;
  public?: boolean;
  cli?: boolean;
};

export type PluginConfig = { [name: string]: PluginConfigRecord };
