import * as fs from "fs";
import * as path from "path";
import * as Mime from "mime";
import { api, config, log, Initializer } from "../index";
import { Connection } from "./../classes/connection";
import { PluginConfig } from "../classes/config";

export interface StaticFileApi {
  searchLocations: Array<string>;
  get?: StaticFileInitializer["get"];
  sendFile?: StaticFileInitializer["sendFile"];
  searchPath?: StaticFileInitializer["searchPath"];
  checkExistence?: StaticFileInitializer["checkExistence"];
  sendFileNotFound?: StaticFileInitializer["sendFileNotFound"];
  logRequest?: StaticFileInitializer["logRequest"];
  fileLogger?: StaticFileInitializer["fileLogger"];
}

/**
 * Contains helpers for returning flies to connections.
 */
export class StaticFileInitializer extends Initializer {
  constructor() {
    super();
    this.name = "staticFile";
    this.loadPriority = 510;
  }

  /**
   * For a connection with `connection.params.file` set, return a file if we can find it, or a not-found message.
   * `searchLocations` will be checked in the following order: first paths in this project, then plugins.
   * This can be used in Actions to return files to clients.  If done, set `data.toRender = false` within the action.
   * return is of the form: {connection, error, fileStream, mime, length}
   */
  get = async (
    connection: Connection,
    counter: number = 0
  ): Promise<
    | {
        connection: Connection;
        error: any;
        mime: string;
        length: any;
      }
    | {
        connection: Connection;
        fileStream: fs.ReadStream;
        mime: string;
        length: any;
        lastModified: number;
      }
  > => {
    let file: string;
    if (!connection.params.file || !api.staticFile.searchPath(counter)) {
      return api.staticFile.sendFileNotFound(
        connection,
        await config.errors.fileNotProvided(connection)
      );
    }

    if (!path.isAbsolute(connection.params.file)) {
      file = path.normalize(
        path.join(api.staticFile.searchPath(counter), connection.params.file)
      );
    } else {
      file = connection.params.file;
    }

    if (
      file.indexOf(path.normalize(api.staticFile.searchPath(counter))) !== 0
    ) {
      return api.staticFile.get(connection, counter + 1);
    } else {
      const { exists, truePath } = await api.staticFile.checkExistence(file);
      if (exists) {
        return api.staticFile.sendFile(truePath, connection);
      } else {
        return api.staticFile.get(connection, counter + 1);
      }
    }
  };

  searchPath = (counter: number = 0) => {
    if (
      api.staticFile.searchLocations.length === 0 ||
      counter >= api.staticFile.searchLocations.length
    ) {
      return null;
    } else {
      return api.staticFile.searchLocations[counter];
    }
  };

  sendFile = async (file: string, connection: Connection) => {
    let lastModified: number;

    try {
      const stats = await asyncStats(file);
      const mime = Mime.getType(file);
      const length = stats.size;
      const start = new Date().getTime();
      lastModified = stats.mtime;

      const fileStream = fs.createReadStream(file);
      api.staticFile.fileLogger(fileStream, connection, start, file, length);

      await new Promise((resolve) => {
        fileStream.on("open", () => {
          resolve(null);
        });
      });

      return { connection, fileStream, mime, length, lastModified };
    } catch (error) {
      return api.staticFile.sendFileNotFound(
        connection,
        await config.errors.fileReadError(connection, error)
      );
    }
  };

  fileLogger = (
    fileStream: any,
    connection: Connection,
    start: number,
    file: string,
    length: number
  ) => {
    fileStream.on("end", () => {
      const duration = new Date().getTime() - start;
      api.staticFile.logRequest(file, connection, length, duration, true);
    });

    fileStream.on("error", (error: Error) => {
      throw error;
    });
  };

  sendFileNotFound = async (connection: Connection, errorMessage: string) => {
    connection.error = new Error(errorMessage);
    api.staticFile.logRequest("{not found}", connection, null, null, false);
    const response = await config.errors.fileNotFound(connection);
    return {
      connection,
      error: response,
      mime: "text/html",
      length: response.length,
    };
  };

  checkExistence = async (
    file: string
  ): Promise<{ exists: boolean; truePath: string }> => {
    try {
      const stats = await asyncStats(file);

      if (stats.isDirectory()) {
        const indexPath = file + "/" + config.general.directoryFileType;
        return api.staticFile.checkExistence(indexPath);
      }

      if (stats.isSymbolicLink()) {
        let truePath = await asyncReadLink(file);
        truePath = path.normalize(truePath);
        return api.staticFile.checkExistence(truePath);
      }

      if (stats.isFile()) {
        return { exists: true, truePath: file };
      }

      return { exists: false, truePath: file };
    } catch (error) {
      return { exists: false, truePath: file };
    }
  };

  logRequest = (
    file: string,
    connection: Connection,
    length: number,
    duration: number,
    success: boolean
  ) => {
    log(`[ file @ ${connection.type} ]`, config.general.fileRequestLogLevel, {
      to: connection.remoteIP,
      file: file,
      requestedFile: connection.params.file,
      size: length,
      duration: duration,
      success: success,
    });
  };

  async initialize() {
    api.staticFile = {
      searchLocations: [],
      get: this.get,
      searchPath: this.searchPath,
      sendFile: this.sendFile,
      fileLogger: this.fileLogger,
      sendFileNotFound: this.sendFileNotFound,
      checkExistence: this.checkExistence,
      logRequest: this.logRequest,
    };

    // load in the explicit public paths first
    if (config.get("general", "paths")) {
      config.general.paths.public.forEach(function (p: string) {
        api.staticFile.searchLocations.push(path.normalize(p));
      });
    }

    // source the public directories from plugins
    for (const [_, plugin] of Object.entries(config.plugins as PluginConfig)) {
      const pluginPublicPath = path.join(plugin.path, "public");
      if (
        fs.existsSync(pluginPublicPath) &&
        api.staticFile.searchLocations.indexOf(pluginPublicPath) < 0
      ) {
        api.staticFile.searchLocations.push(pluginPublicPath);
      }
    }

    log(
      "static files will be served from these directories",
      "debug",
      api.staticFile.searchLocations
    );
  }
}

async function asyncStats(file: string): Promise<{ [key: string]: any }> {
  return new Promise((resolve, reject) => {
    fs.stat(file, (error, stats) => {
      if (error) {
        return reject(error);
      }
      return resolve(stats);
    });
  });
}

async function asyncReadLink(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readlink(file, (error, linkString) => {
      if (error) {
        return reject(error);
      }
      return resolve(linkString);
    });
  });
}
