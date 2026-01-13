const get = require("lodash.get");
const set = require("lodash.set");

export const getProperty = <T = unknown, D = undefined>(
  object: unknown,
  path: string,
  defaultValue?: D,
): T | D => get(object, path, defaultValue);

export const setProperty = (
  object: unknown,
  path: string,
  value: unknown,
): unknown => set(object, path, value);
