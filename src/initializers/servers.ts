import * as path from "path";
import * as glob from "glob";
import { api, Initializer } from "../index";

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

  async initialize() {
    api.servers = {
      servers: {}
    };

    const serverFolders = [path.resolve(path.join(__dirname, "..", "servers"))];

    api.config.general.paths.server.forEach(p => {
      p = path.resolve(p);
      if (serverFolders.indexOf(p) < 0) {
        serverFolders.push(p);
      }
    });

    for (const i in serverFolders) {
      const p = serverFolders[i];
      let files = glob.sync(path.join(p, `**/*${api.ext}`));

      for (const pluginName in api.config.plugins) {
        if (api.config.plugins[pluginName].servers !== false) {
          const pluginPath = api.config.plugins[pluginName].path;
          files = files.concat(
            glob.sync(path.join(pluginPath, "servers", `**/*${api.ext}`))
          );
        }
      }

      files = api.utils.ensureNoTsHeaderFiles(files);

      for (const j in files) {
        const filename = files[j];
        const ExportedClasses = require(filename);

        if (Object.keys(ExportedClasses).length > 1) {
          throw new Error(
            `server file ${filename} exports more than one server`
          );
        }

        const server = new ExportedClasses[Object.keys(ExportedClasses)[0]]();
        server.config = api.config.servers[server.type]; // shorthand access
        if (server.config && server.config.enabled === true) {
          await server.initialize();

          if (api.servers.servers[server.type]) {
            api.log(
              `an existing server with the same type \`${server.type}\` will be overridden by the file ${filename}`,
              "warning"
            );
          }

          api.servers.servers[server.type] = server;
          api.log(`Initialized server: ${server.type}`, "debug");
        }

        api.watchFileAndAct(filename, () => {
          api.log(
            `*** Rebooting due to server (${server.type}) change ***`,
            "info"
          );
          api.commands.restart();
        });
      }
    }
  }

  async start() {
    const serverNames = Object.keys(api.servers.servers);
    for (const i in serverNames) {
      const serverName = serverNames[i];
      const server = api.servers.servers[serverName];
      if (server && server.config.enabled === true) {
        let message = "";
        message += `Starting server: \`${serverName}\``;
        if (api.config.servers[serverName].bindIP) {
          message += ` @ ${api.config.servers[serverName].bindIP}`;
        }
        if (api.config.servers[serverName].port) {
          message += `:${api.config.servers[serverName].port}`;
        }
        api.log(message, "notice");
        await server.start();
        api.log(`Server started: ${serverName}`, "debug");
      }
    }
  }

  async stop() {
    const serverNames = Object.keys(api.servers.servers);
    for (const i in serverNames) {
      const serverName = serverNames[i];
      const server = api.servers.servers[serverName];
      if ((server && server.config.enabled === true) || !server) {
        api.log(`Stopping server: ${serverName}`, "notice");
        await server.stop();
        server.removeAllListeners();
        api.log(`Server stopped: ${serverName}`, "debug");
      }
    }
  }
}
