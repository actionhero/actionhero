export interface Input {
  default: any;
  formatter: Function | null;
  validator: Function | null;
  schema: {
    [key: string]: any;
  };
}
