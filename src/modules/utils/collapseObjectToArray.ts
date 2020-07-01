/**
 * Collapses an Object with numerical keys (like `arguments` in a function) to an Array
 */
export function collapseObjectToArray(obj: object): Array<any> | boolean {
  try {
    const keys = Object.keys(obj);
    if (keys.length < 1) {
      return false;
    }
    if (keys[0] !== "0") {
      return false;
    }
    if (keys[keys.length - 1] !== String(keys.length - 1)) {
      return false;
    }

    const arr = [];
    for (const i in keys) {
      const key = keys[i];
      if (String(parseInt(key)) !== key) {
        return false;
      } else {
        arr.push(obj[key]);
      }
    }

    return arr;
  } catch (e) {
    return false;
  }
}
