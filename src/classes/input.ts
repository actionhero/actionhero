export interface Input {
  default?: any;
  required?: boolean;
  formatter?: Function;
  validator?: Function;
  schema?: {
    [key: string]: any;
  };
}
