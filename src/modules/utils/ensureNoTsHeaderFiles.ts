/**
 *swap out d.ts files for the JS versions when running with ts-node
 */
export function ensureNoTsHeaderFiles(files: Array<string>): Array<string> {
  return files.filter(f => {
    if (f.match(/.*\.d\.ts$/)) {
      return false;
    } else {
      return true;
    }
  });
}
