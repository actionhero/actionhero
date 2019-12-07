/**
 Compare the first n elements of an array with another, longer array
*/
export function arrayStartingMatch(a: Array<any>, b: Array<any>): boolean {
  if (a.length === 0) {
    return false;
  }
  if (b.length === 0) {
    return false;
  }

  let matching = true;
  let i = 0;
  while (i < a.length) {
    if (a[i] !== b[i]) {
      matching = false;
    }
    i++;
  }
  return matching;
}
