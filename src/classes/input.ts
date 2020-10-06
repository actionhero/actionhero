export interface Input {
  default?: any;
  required?: boolean;
  formatter?: Function | string[];
  validator?: Function | string[];
  type?: string;
  schema?: {
    [key: string]: any;
  };
}
