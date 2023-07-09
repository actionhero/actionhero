/**
 *swap out d.ts files for the JS versions when running with ts-node
 * also filter out *.test. and *.spec. js|ts files
 */
export function ensureNoTsHeaderOrSpecFiles(
  files: Array<string>,
): Array<string> {
  return files.filter((f) => {
    if (f.match(/.*\.d\.ts$/)) {
      return false;
    }

    if (f.match(/.*\.(?:spec|test)\.[tj]s$/)) {
      return false;
    }

    return true;
  });
}
