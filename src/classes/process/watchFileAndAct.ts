import * as path from "path";
import * as fs from "fs";
import { config } from "./../../modules/config";

const RELOAD_DELAY = 2000;
const watchedFiles = {};

// reloading changed files in development mode
export function watchFileAndAct(file: string, handler: Function) {
  file = path.normalize(file);

  if (!fs.existsSync(file)) {
    throw new Error(file + " does not exist, and cannot be watched");
  }

  if (config.general.developmentMode === true && !watchedFiles[file]) {
    const watcher = fs.watch(file, { persistent: false }, eventType => {
      const stats = fs.statSync(file);
      const delta = stats.mtimeMs - watchedFiles[file].stats.mtimeMs;
      if (
        config.general.developmentMode === true &&
        eventType === "change" &&
        delta >= RELOAD_DELAY
      ) {
        watchedFiles[file].stats = stats;

        let cleanPath = file;
        if (process.platform === "win32") {
          cleanPath = file.replace(/\//g, "\\");
        }

        delete require.cache[require.resolve(cleanPath)];
        handler(file);
      }
    });

    watchedFiles[file] = { watcher, stats: fs.statSync(file) };
  }
}

export function unWatchAllFiles() {
  for (const file in watchedFiles) {
    watchedFiles[file].watcher.close();
    delete watchedFiles[file];
  }
}
