import * as glob from "glob";

export function safeGlobSync(match: string, args: glob.GlobOptions = {}): string[] {
  const isWindows = process.platform === "win32";
  return glob.sync(match, { ...args, windowsPathsNoEscape: isWindows, withFileTypes: false }) as string[];
}
