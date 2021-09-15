export interface Input {
  default?: any;
  required?: boolean;
  formatter?: Function | string[] | Function[];
  validator?: Function | string[] | Function[];
  schema?: {
    [key: string]: any;
  };
}
