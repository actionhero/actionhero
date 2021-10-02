import * as path from "path";
import * as glob from "glob";
import { api, log, utils, Initializer, Server, config } from "../index";

export interface ServersApi {
  servers: {
    [key: string]: Server;
  };
}

/**
 * Manages the servers in this Actionhero instance.
 */
export class Servers extends Initializer {
  constructor() {
    super();
    this.name = "servers";
    this.loadPriority = 599;
    this.startPriority = 900;
    this.stopPriority = 100;
  }

  async initialize() {
    api.servers = {
      servers: {},
    };

    const serverFolders = [path.resolve(path.join(__dirname, "..", "servers"))];

    config.general.paths.server.forEach((p) => {
      p = path.resolve(p);
      if (serverFolders.indexOf(p) < 0) {
        serverFolders.push(p);
      }
    });

    let files = [];

    for (const i in serverFolders) {
      const p = serverFolders[i];
      files = files.concat(glob.sync(path.join(p, "**", "**/*(*.js|*.ts)")));
    }

    for (const pluginName in config.plugins) {
      if (config.plugins[pluginName].servers !== false) {
        const pluginPath = config.plugins[pluginName].path;
        // old style at the root of the project
        files = files.concat(
          glob.sync(path.join(pluginPath, "servers", "**", "*.js"))
        );

        files = files.concat(
          glob.sync(path.join(pluginPath, "dist", "servers", "**", "*.js"))
        );
      }
    }

    files = utils.ensureNoTsHeaderFiles(files);

    let server: Server;

    for (const j in files) {
      const filename = files[j];
      const ExportedClasses = await import(filename);

      const exportLen = Object.keys(ExportedClasses).length;
      // we have named exports
      if (exportLen) {
        if (exportLen > 1) {
          throw new Error(
            `server file ${filename} exports more than one server`
          );
        }

        server = new ExportedClasses[Object.keys(ExportedClasses)[0]]();
      } else {
        // there is one default export
        server = new ExportedClasses();
      }

      server.config = config.servers[server.type]; // for shorthand access
      if (server.config && server.config.enabled === true) {
        await server.initialize();

        if (api.servers.servers[server.type]) {
          log(
            `an existing server with the same type \`${server.type}\` will be overridden by the file ${filename}`,
            "crit"
          );
        }

        api.servers.servers[server.type] = server;
        log(`Initialized server: ${server.type}`, "debug");
      }
    }
  }

  async start(config) {
    const serverNames = Object.keys(api.servers.servers);
    for (const i in serverNames) {
      const serverName = serverNames[i];
      const server = api.servers.servers[serverName];
      if (server && server.config.enabled === true) {
        const message = `Starting server: \`${serverName}\` ${
          config.servers[serverName].bindIP
            ? `@ ${serverName === "web" ? "http://" : ""}${
                config.servers[serverName].bindIP
              }${
                config.servers[serverName].port
                  ? `:${config.servers[serverName].port}`
                  : ""
              }`
            : ""
        }`;
        log(message, "notice");
        await server.start();
        log(`Server started: ${serverName}`, "debug");
      }
    }
  }

  async stop() {
    const serverNames = Object.keys(api.servers.servers);
    for (const i in serverNames) {
      const serverName = serverNames[i];
      const server = api.servers.servers[serverName];
      if ((server && server.config.enabled === true) || !server) {
        log(`Stopping server: ${serverName}`, "notice");
        await server.stop();
        server.removeAllListeners();
        log(`Server stopped: ${serverName}`, "debug");
      }
    }
  }
}
