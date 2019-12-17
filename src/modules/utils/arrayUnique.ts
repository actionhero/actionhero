/**
 * Return only the unique values in an Array.
 */
export function arrayUnique(arr: Array<any>): Array<any> {
  const a = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) {
        j = ++i;
      }
    }
    a.push(arr[i]);
  }
  return a;
}
