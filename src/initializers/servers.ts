import * as path from "path";
import * as glob from "glob";
import {
  api,
  log,
  utils,
  watchFileAndAct,
  Initializer,
  Server,
  typescript
} from "../index";

export interface ServersApi {
  servers: {
    [key: string]: Server;
  };
}

/**
 * Manages the servers in this ActionHero instance.
 */
export class Servers extends Initializer {
  constructor() {
    super();
    this.name = "servers";
    this.loadPriority = 599;
    this.startPriority = 900;
    this.stopPriority = 100;
  }

  async initialize(config) {
    api.servers = {
      servers: {}
    };

    const serverFolders = [path.resolve(path.join(__dirname, "..", "servers"))];

    config.general.paths.server.forEach(p => {
      p = path.resolve(p);
      if (serverFolders.indexOf(p) < 0) {
        serverFolders.push(p);
      }
    });

    for (const i in serverFolders) {
      const p = serverFolders[i];
      let files = glob.sync(path.join(p, "**", "**/*(*.js|*.ts)"));

      for (const pluginName in config.plugins) {
        if (config.plugins[pluginName].servers !== false) {
          const pluginPath = config.plugins[pluginName].path;
          // old style at the root of the project
          files = files.concat(
            glob.sync(path.join(pluginPath, "servers", "**", "**/*(*.js|*.ts)"))
          );

          // dist files if running in JS mode
          if (!typescript) {
            files = files.concat(
              glob.sync(path.join(pluginPath, "dist", "servers", "**", "*.js"))
            );
          }

          // src files if running in TS mode
          if (typescript) {
            files = files.concat(
              glob.sync(path.join(pluginPath, "src", "servers", "**", "*.ts"))
            );
          }
        }
      }

      files = utils.ensureNoTsHeaderFiles(files);

      for (const j in files) {
        const filename = files[j];
        const ExportedClasses = require(filename);

        if (Object.keys(ExportedClasses).length > 1) {
          throw new Error(
            `server file ${filename} exports more than one server`
          );
        }

        const server = new ExportedClasses[Object.keys(ExportedClasses)[0]]();
        server.config = config.servers[server.type]; // shorthand access
        if (server.config && server.config.enabled === true) {
          await server.initialize();

          if (api.servers.servers[server.type]) {
            log(
              `an existing server with the same type \`${server.type}\` will be overridden by the file ${filename}`,
              "warning"
            );
          }

          api.servers.servers[server.type] = server;
          log(`Initialized server: ${server.type}`, "debug");
        }

        watchFileAndAct(filename, () => {
          log(
            `*** Rebooting due to server (${server.type}) change ***`,
            "info"
          );
          api.commands.restart();
        });
      }
    }
  }

  async start(config) {
    const serverNames = Object.keys(api.servers.servers);
    for (const i in serverNames) {
      const serverName = serverNames[i];
      const server = api.servers.servers[serverName];
      if (server && server.config.enabled === true) {
        let message = "";
        message += `Starting server: \`${serverName}\``;
        if (config.servers[serverName].bindIP) {
          message += ` @ ${config.servers[serverName].bindIP}`;
        }
        if (config.servers[serverName].port) {
          message += `:${config.servers[serverName].port}`;
        }
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
