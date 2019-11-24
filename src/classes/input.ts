export interface Input {
  default?: any;
  required?: boolean;
  formatter?: Function | null;
  validator?: Function | null;
  schema?: {
    [key: string]: any;
  };
}
