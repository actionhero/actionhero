export interface Input {
  default?: any;
  required?: boolean;
  formatter?: Function | string[];
  validator?: Function | string[];
  schema?: {
    [key: string]: any;
  };
}
