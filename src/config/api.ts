const path = require("path");

export const DEFAULT = {
  general: (config) => {
    const packageJSON = require("./../../package.json");

    return {
      apiVersion: packageJSON.version,
      serverName: packageJSON.name,
      // A unique token to your application that servers will use to authenticate to each other
      serverToken: "change-me",
      // the redis prefix for Actionhero cache objects
      cachePrefix: "actionhero:cache:",
      // the redis prefix for Actionhero cache/lock objects
      lockPrefix: "actionhero:lock:",
      // how long will a lock last before it expires (ms)?
      lockDuration: 1000 * 10, // 10 seconds
      // How many pending actions can a single connection be working on
      simultaneousActions: 5,
      // allow connections to be created without remoteIp and remotePort (they will be set to 0)
      enforceConnectionProperties: true,
      // disables the whitelisting of client params
      disableParamScrubbing: false,
      // params you would like hidden from any logs
      filteredParams: [],
      // values that signify missing params
      missingParamChecks: [null, "", undefined],
      // The default filetype to server when a user requests a directory
      directoryFileType: "index.html",
      // What log-level should we use for file requests?
      fileRequestLogLevel: "info",
      // The default priority level given to middleware of all types (action, connection, say, and task)
      defaultMiddlewarePriority: 100,
      // Which channel to use on redis pub/sub for RPC communication
      channel: "actionhero",
      // How long to wait for an RPC call before considering it a failure
      rpcTimeout: 5000,
      // should CLI methods and help include internal Actionhero CLI methods?
      cliIncludeInternal: true,
      // configuration for your actionhero project structure
      paths: {
        action: [path.join(__dirname, "..", "actions")],
        task: [path.join(__dirname, "..", "tasks")],
        server: [path.join(__dirname, "..", "servers")],
        cli: [path.join(__dirname, "..", "bin")],
        initializer: [path.join(__dirname, "..", "initializers")],
        public: [path.join(process.cwd(), "public")],
        pid: [path.join(process.cwd(), "pids")],
        log: [path.join(process.cwd(), "log")],
        plugin: [path.join(process.cwd(), "node_modules")],
        locale: [path.join(process.cwd(), "locales")],
        test: [path.join(process.cwd(), "__tests__")],
        // for the src and dist paths, assume we are running in compiled mode from `dist`
        src: path.join(process.cwd(), "src"),
        dist: path.join(process.cwd(), "dist"),
      },

      // hash containing chat rooms you wish to be created at server boot
      startingChatRooms: {
        // format is {roomName: {authKey, authValue}}
        // 'secureRoom': {authorized: true},
      },
    };
  },
};

export const test = {
  general: (config) => {
    return {
      serverToken: `serverToken-${process.env.JEST_WORKER_ID || 0}`,
      startingChatRooms: {
        defaultRoom: {},
        otherRoom: {},
      },
      paths: {
        locale: [path.join(process.cwd(), "locales")],
      },
      rpcTimeout: 3000,
    };
  },
};

export const production = {
  general: (config) => {
    return {
      fileRequestLogLevel: "debug",
    };
  },
};
