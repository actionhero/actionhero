export interface Input {
  default?: any;
  required?: boolean;
  formatter?: InputFormatter | InputFormatter[];
  validator?: InputValidator | InputValidator[];
  schema?: {
    [key: string]: any;
  };
}

export type InputFormatter = (i: unknown) => any;
export type InputValidator = (i: unknown) => boolean | string; // string is an error case
