import * as fs from "fs";
import * as path from "path";

export function sourceRelativeLinkPath(
  linkfile: string,
  pluginPaths: Array<string>
): string | boolean {
  const type = fs.readFileSync(linkfile).toString();
  const pathParts = linkfile.split(path.sep);
  const name = pathParts[pathParts.length - 1].split(".")[0];
  const pathsToTry = pluginPaths.slice(0);
  let pluginRoot;

  pathsToTry.forEach(pluginPath => {
    const pluginPathAttempt = path.normalize(pluginPath + path.sep + name);
    try {
      const stats = fs.lstatSync(pluginPathAttempt);
      if (!pluginRoot && (stats.isDirectory() || stats.isSymbolicLink())) {
        pluginRoot = pluginPathAttempt;
      }
    } catch (e) {}
  });

  if (!pluginRoot) {
    return false;
  }
  const pluginSection = path.normalize(pluginRoot + path.sep + type);
  return pluginSection;
}
