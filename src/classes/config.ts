export interface ActionheroConfigInterface {
  [key: string]: any;
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
