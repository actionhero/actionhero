import * as fs from "fs";
import * as path from "path";

/**
 * Check if a directory exists.
 */
export function dirExists(dir: string): boolean {
  try {
    const stats = fs.lstatSync(dir);
    return stats.isDirectory() || stats.isSymbolicLink();
  } catch (e) {
    return false;
  }
}

/**
 * Check if a file exists.
 */
export function fileExists(file: string): boolean {
  try {
    const stats = fs.lstatSync(file);
    return stats.isFile() || stats.isSymbolicLink();
  } catch (e) {
    return false;
  }
}

/**
 * Create a directory, only if it doesn't exist yet.
 * Throws an error if the directory already exists, or encounters a filesystem problem.
 */
export function createDirSafely(dir: string): string {
  if (dirExists(dir)) {
    const error = new Error(
      `directory '${path.normalize(dir)}' already exists`
    );
    // @ts-ignore
    error.code = "EEXIST";
    throw error;
  } else {
    fs.mkdirSync(path.normalize(dir), "0766");
    return `created directory '${path.normalize(dir)}'`;
  }
}

/**
 * Create a file, only if it doesn't exist yet.
 * Throws an error if the file already exists, or encounters a filesystem problem.
 */
export function createFileSafely(
  file: string,
  data: string,
  overwrite: boolean = false
): string {
  if (fileExists(file) && !overwrite) {
    const error = new Error(`file '${path.normalize(file)}' already exists`);
    // @ts-ignore
    error.code = "EEXIST";
    throw error;
  } else {
    let message = `wrote file '${path.normalize(file)}'`;
    if (overwrite && fileExists(file)) {
      message = ` - overwritten file '${path.normalize(file)}'`;
    }
    fs.writeFileSync(path.normalize(file), data);
    return message;
  }
}

/**
 * Create an ActionHero LinkFile, only if it doesn't exist yet.
 * Throws an error if the file already exists, or encounters a filesystem problem.
 */
export function createLinkfileSafely(filePath: string, type: string): string {
  if (fileExists(filePath)) {
    const error = new Error(`link file '${filePath}' already exists`);
    // @ts-ignore
    error.code = "EEXIST";
    throw error;
  } else {
    fs.writeFileSync(filePath, type);
    return `creating linkfile '${filePath}'`;
  }
}

/**
 * Remove an ActionHero LinkFile, only if it exists.
 * Throws an error if the file does not exist, or encounters a filesystem problem.
 */
export function removeLinkfileSafely(filePath: string): string {
  if (!fileExists(filePath)) {
    const error = new Error(`link file '${filePath}' doesn't exist`);
    // @ts-ignore
    error.code = "ENOEXIST";
    throw error;
  } else {
    fs.unlinkSync(filePath);
    return `removing linkfile '${filePath}'`;
  }
}

/**
 * Create a system symbolic link.
 * Throws an error if it encounters a filesystem problem.
 */
export function createSymlinkSafely(
  destination: string,
  source: string
): string {
  if (dirExists(destination)) {
    const error = new Error(`symbolic link '${destination}' already exists`);
    // @ts-ignore
    error.code = "EEXIST";
    throw error;
  } else {
    fs.symlinkSync(source, destination, "dir");
    return `creating symbolic link '${destination}' => '${source}'`;
  }
}
