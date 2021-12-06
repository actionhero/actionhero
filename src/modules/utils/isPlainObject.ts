/**
 * Is the JS Object passed in truly just an object?
 */
export function isPlainObject(o: any) {
  const safeTypes = [
    Boolean,
    Number,
    String,
    Function,
    Array,
    Date,
    RegExp,
    Buffer,
  ];
  const safeInstances = ["boolean", "number", "string", "function"];
  const expandPreventMatchKey = "_toExpand"; // set `_toExpand = false` within an object if you don't want to expand it
  let i;

  if (!o) {
    return false;
  }
  if (o instanceof Object === false) {
    return false;
  }
  for (i in safeTypes) {
    if (o instanceof safeTypes[i]) {
      return false;
    }
  }
  for (i in safeInstances) {
    if (typeof o === safeInstances[i]) {
      return false;
    }
  }
  if (o[expandPreventMatchKey] === false) {
    return false;
  }

  try {
    // sometimes objects cannot be successfully stringified (https://github.com/node-formidable/formidable/pull/796)
    return o.toString() === "[object Object]";
  } catch (error) {
    return true;
  }
}
