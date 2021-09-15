export function missing(t: any) {
  if (t === null) return true;
  if (t === undefined) return true;
  if (t === "") return true;
  return false;
}
