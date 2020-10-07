// from https://www.jpwilliams.dev/how-to-unpack-the-return-type-of-a-promise-in-typescript

export type UnwrapPromise<T> = T extends Promise<infer U>
  ? U
  : T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : T;
