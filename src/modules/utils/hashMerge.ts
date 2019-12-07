import { isPlainObject } from "./isPlainObject";

/**
 * Recursively merge 2 Objects together.  Will resolve functions if they are present, unless the parent Object has the property `_toExpand = false`.
 * ActionHero uses this internally to construct and resolve the config.
 * Matching keys in B override A.
 */
export function hashMerge(
  a: object,
  b: object,
  arg?: object
): { [key: string]: any } {
  const c = {};
  let i: string;
  let response: object;

  for (i in a) {
    if (isPlainObject(a[i])) {
      // can't be added into above condition, or empty objects will overwrite and not merge
      // also make sure empty objects are created
      c[i] = Object.keys(a[i]).length > 0 ? hashMerge(c[i], a[i], arg) : {};
    } else {
      if (typeof a[i] === "function") {
        response = a[i](arg);
        if (isPlainObject(response)) {
          c[i] = hashMerge(c[i], response, arg);
        } else {
          c[i] = response;
        }
      } else {
        // don't create first term if it is undefined or null
        if (a[i] === undefined || a[i] === null) {
        } else c[i] = a[i];
      }
    }
  }
  for (i in b) {
    if (isPlainObject(b[i])) {
      // can't be added into above condition, or empty objects will overwrite and not merge
      if (Object.keys(b[i]).length > 0) c[i] = hashMerge(c[i], b[i], arg);
      // make sure empty objects are only created, when no key exists yet
      else if (!(i in c)) c[i] = {};
    } else {
      if (typeof b[i] === "function") {
        response = b[i](arg);
        if (isPlainObject(response)) {
          c[i] = hashMerge(c[i], response, arg);
        } else {
          c[i] = response;
        }
      } else {
        // ignore second term if it is undefined
        if (b[i] === undefined) {
        } else if (b[i] == null && i in c)
          // delete second term/key if value is null and it already exists
          delete c[i];
        // normal assignments for everything else
        else c[i] = b[i];
      }
    }
  }
  return c;
}
