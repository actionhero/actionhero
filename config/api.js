'use strict'

const path = require('path')

exports.default = {
  general: (api) => {
    const packageJSON = require(api.projectRoot + path.sep + 'package.json')

    return {
      apiVersion: packageJSON.version,
      serverName: packageJSON.name,
      // id can be set here, or it will be generated dynamically.
      //  Be sure that every server you run has a unique ID (which will happen when generated dynamically)
      //  id: 'myActionHeroServer',
      // A unique token to your application that servers will use to authenticate to each other
      serverToken: 'change-me',
      // the redis prefix for actionhero's cache objects
      cachePrefix: 'actionhero:cache:',
      // the redis prefix for actionhero's cache/lock objects
      lockPrefix: 'actionhero:lock:',
      // how long will a lock last before it exipres (ms)?
      lockDuration: 1000 * 10, // 10 seconds
      // Watch for changes in actions, configs, initializers, servers and tasks; and reload/restart them on the fly
      developmentMode: true,
      // When developmentMode is active, actionhero tries to swap actions and tasks in-memory for their updated version
      // (without restarting the whole application). If you're having trouble with unwanted side effects after in-memory
      // reloading, then set this to true to force an application restart on change.
      // Changes to configs/initializers/servers while in developmentMode will force an application restart in any case.
      developmentModeForceRestart: false,
      // How many pending actions can a single connection be working on
      simultaneousActions: 5,
      // allow connections to be created without remoteIp and remotePort (they will be set to 0)
      enforceConnectionProperties: true,
      // disables the whitelisting of client params
      disableParamScrubbing: false,
      // params you would like hidden from any logs
      filteredParams: [],
      // values that signify missing params
      missingParamChecks: [null, '', undefined],
      // The default filetype to server when a user requests a directory
      directoryFileType: 'index.html',
      // What log-level should we use for file requests?
      fileRequestLogLevel: 'info',
      // The default priority level given to middleware of all types (action, connection, say, and task)
      defaultMiddlewarePriority: 100,
      // Which channel to use on redis pub/sub for RPC communication
      channel: 'actionhero',
      // How long to wait for an RPC call before considering it a failure
      rpcTimeout: 5000,
      // should CLI methods and help include internal ActionHero CLI methods?
      cliIncludeInternal: true,
      // configuration for your actionhero project structure
      paths: {
        action: [path.join(process.cwd(), 'actions')],
        task: [path.join(process.cwd(), 'tasks')],
        public: [path.join(process.cwd(), 'public')],
        pid: [path.join(process.cwd(), 'pids')],
        log: [path.join(process.cwd(), 'log')],
        server: [path.join(process.cwd(), 'servers')],
        cli: [path.join(process.cwd(), 'bin')],
        initializer: [path.join(process.cwd(), 'initializers')],
        plugin: [path.join(process.cwd(), 'node_modules')],
        locale: [path.join(process.cwd(), 'locales')],
        test: [path.join(process.cwd(), '__tests__')]
      },
      // hash containing chat rooms you wish to be created at server boot
      startingChatRooms: {
        // format is {roomName: {authKey, authValue}}
        // 'secureRoom': {authorized: true},
      }
    }
  }
}

exports.test = {
  general: (api) => {
    return {
      id: `test-server-${process.env.JEST_WORKER_ID || 0}`,
      serverToken: `serverToken-${process.env.JEST_WORKER_ID || 0}`,
      developmentMode: true,
      startingChatRooms: {
        defaultRoom: {},
        otherRoom: {}
      },
      paths: {
        locale: [
          path.join(__dirname, '..', 'locales')
        ]
      },
      rpcTimeout: 3000
    }
  }
}

exports.production = {
  general: (api) => {
    return {
      fileRequestLogLevel: 'debug',
      developmentMode: false
    }
  }
}
