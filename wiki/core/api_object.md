---
layout: wiki
title: Wiki - The API Object
---

# The API Object

By now you will have noticed that most sections of actionhero are initilized with access to the `api` object.  The `api` object is the top-level container/namespace for all of actionhero's data and methods.  We use the `api` object to avoide polluting any global namespaces.  The api object is availalbe to all parts of actionhero to share data and state.  Feel free to modify or add too the api object as you see fit, but be mindful of the data it already contains

{% highlight javascript %}
{ 
  // information about actionhero's state
  // https://github.com/evantahler/actionhero/blob/master/actionhero.js
  running: true,
  initialized: true,
  shuttingDown: false,
  bootTime: 1393474243965,
  project_root: '/path/to/actionhero/project',
  _startingParams: {},
  env: 'development',
  id: '1.2.3.4',

  // server control commands
  // https://github.com/evantahler/actionhero/blob/master/actionhero.js
  commands: {
    initialize: [Function],
    start: [Function],
    stop: [Function],
    restart: [Function],
  }

  // config methods and collections
  // https://github.com/evantahler/actionhero/blob/master/initializers/configLoader.js
  configLoader: { _start: [Function] },
  watchedFiles:[ 
    // list of files which will reload in development mode
  ],
  watchFileAndAct: [Function],
  unWatchAllFiles: [Function],

  // api.config
  // build from your `/config`
  config: {
    // see https://github.com/evantahler/actionhero/blob/master/config/config/ for examples
  }

  // collections of boot options and loaders for actionhero 
  // https://github.com/evantahler/actionhero/blob/master/actionhero.js
  _self: { 
    initializers:{ 
      // initializer methods,
      // of the form `pids: [Function],`
    },
    api: [Circular],
    startingParams: {},
    _starters: [
     // array of initializers with `_start()` methods
     // of the form `'faye'`
    ] 
  },
  
  // pids
  // https://github.com/evantahler/actionhero/blob/master/initializers/pids.js
  pids: { 
    pid: 43025,
    sanitizeId: [Function],
    title: 'actionhero-10.0.1.33',
    writePidFile: [Function],
    clearPidFile: [Function],
    _start: [Function] 
  },

  // logger
  // https://github.com/evantahler/actionhero/blob/master/initializers/logger.js
  logger: {} // the logger/winston object
  log: [Function],

  // api.utils
  // https://github.com/evantahler/actionhero/blob/master/initializers/utils.js
  utils: { 
    sqlDateTime: [Function],
    sqlDate: [Function],
    padDateDoubleStr: [Function],
    randomString: [Function],
    hashLength: [Function],
    hashMerge: [Function],
    isPlainObject: [Function],
    arrayUniqueify: [Function],
    sleepSync: [Function],
    randomArraySort: [Function],
    inArray: [Function],
    objClone: [Function],
    collapseObjectToArray: [Function],
    getExternalIPAddress: [Function],
    parseCookies: [Function],
    parseIPv6URI: [Function] 
  },

  // Exceptions 
  // https://github.com/evantahler/actionhero/blob/master/initializers/exceptions.js
  exceptionHandlers: { 
    reporters: [], // list of exception handlers to call upon errors
    report: [Function],
    renderConnection: [Function],
    loader: [Function],
    action: [Function],
    task: [Function] 
  },
  
  // Stats
  // https://github.com/evantahler/actionhero/blob/master/initializers/stats.js
  stats:{ 
    timer: null,
    pendingIncrements: {},
    _start: [Function],
    _stop: [Function],
    increment: [Function],
    writeIncrements: [Function],
    get: [Function],
    getAll: [Function] 
  },
  
  // Redis
  // https://github.com/evantahler/actionhero/blob/master/initializers/redis.js
  redis: { 
    fake: true,
    _start: [Function],
    initialize: [Function],
    client: {} // redis client
  }
  
  // Faye (used by websocket server and node-node communication)
  // https://github.com/evantahler/actionhero/blob/master/initializers/faye.js
  faye: {
    extensions: [ [Object], [Object], [Object], [Object] ],
    connectHandlers: [ [Function] ],
    disconnectHandlers: [ [Function], [Function] ],
    _start: [Function],
    _stop: [Function],
    redis: [Function],
    clientExists: [Function],
    server: {},// faye server 
    client: {} // faye client
  },
  
  // Cache
  // https://github.com/evantahler/actionhero/blob/master/initializers/cache.js
  cache: {
    sweeperTimer: null,
    sweeperTimeout: 60000,
    redisPrefix: 'actionhero:cache:',
    _start: [Function],
    keys: [Function],
    size: [Function],
    clear: [Function],
    dumpWrite: [Function],
    dumpRead: [Function],
    load: [Function],
    destroy: [Function],
    save: [Function],
  }
  
  // Connections
  // https://github.com/evantahler/actionhero/blob/master/initializers/connections.js
  connections: {
    createCallbacks: [],  // middleware
    destroyCallbacks: [], // middleware
    allowedVerbs: [],
    connections: {}, // hash of all connections preset on this server
  }
  connection: [Function], // the prototype for a connection
  
  // Actions
  // https://github.com/evantahler/actionhero/blob/master/initializers/actions.js
  actions: {
    actions: {
      // collection of actions
      // of the form `{ actionName: { version: action} }`
    },
    versions: {
      // collection of actions' versions
      // of the form `{ actionName: { vestions: name } }`
    }
    preProcessors: [],  // middleware
    postProcessors: [], // middleware
    validateAction: [Function],
    loadDirectory: [Function],
    loadFile: [Function],
  }
  actionProcessor: [Function], // actionProcessor prototype

  // Documentation
  // https://github.com/evantahler/actionhero/blob/master/initializers/documentation.js
  documentation: {
    documentation: {}, // hash of API documentation
    build: [Function],
  }
  
  // Params
  // https://github.com/evantahler/actionhero/blob/master/initializers/params.js
  params: {
    globalSafeParams: [ 'file', 'apiVersion', 'callback', 'action' ],
    buildPostVariables: [Function],
    requiredParamChecker: [Function],
    postVariables:[], // array
  }
  
  // Static File
  // https://github.com/evantahler/actionhero/blob/master/initializers/staticFile.js
  staticFile: {
    get: [Function],
    sendFile: [Function],
    sendFileNotFound: [Function],
    checkExistence: [Function],
    logRequest: [Function],
  }
  
  // Chat
  // https://github.com/evantahler/actionhero/blob/master/initializers/chatRoom.js
  chatRoom: {
    keys: { 
      rooms: 'actionhero:chatRoom:rooms',
      members: 'actionhero:chatRoom:members:',
      auth: 'actionhero:chatRoom:auth' 
    },
    fayeChannel: '/actionhero/chat',
    _start: [Function],
    _stop: [Function],
    socketRoomBroadcast: [Function],
    incomingMessage: [Function],
    add: [Function],
    del: [Function],
    exists: [Function],
    setAuthenticationPattern: [Function],
    roomStatus: [Function],
    authorize: [Function],
    addMember: [Function],
    removeMember: [Function],
    listenToRoom: [Function],
    silenceRoom: [Function],
    announceMember: [Function],
    subscription: {}, // internal Faye subscription for room information
  }
  
  // Resque
  // https://github.com/evantahler/actionhero/blob/master/initializers/resque.js
  // https://github.com/taskrabbit/node-resque
  resque: {
    queue: { 
      options: [Object],
      jobs: [Object],
      queueObject: [Circular],
      runPlugin: [Function],
      runPlugins: [Function],
      connection: [Object] 
    },
    workers: [],
    scheduler: null,
    connectionDetails: {}, // from `/config/tasks.js`
    _start: [Function],
    _stop: [Function],
    startQueue: [Function],
    startScheduler: [Function],
    stopScheduler: [Function],
    startWorkers: [Function],
    stopWorkers: [Function] ,
  }
  
  // Tasks
  // https://github.com/evantahler/actionhero/blob/master/initializers/tasks.js
  tasks: {
    tasks: {}, // tasks; of the form `{ taskName: task}`
    jobs: {}, // resque-converted version of tasks
    _start: [Function],
    load: [Function],
    jobWrapper: [Function],
    validateTask: [Function],
    loadFolder: [Function],
    enqueue: [Function],
    enqueueAt: [Function],
    enqueueIn: [Function],
    del: [Function],
    delDelayed: [Function],
    enqueueRecurrentJob: [Function],
    enqueueAllRecurrentJobs: [Function],
    stopRecurrentJob: [Function],
    details: [Function] 
  }
  
  // Routes
  // https://github.com/evantahler/actionhero/blob/master/routes.js
  routes: {
    routes: { get: [], post: [], put: [], delete: [] }, // will be filled in from `routes.js`
    routesFile: '/path/to/routes.js',
    processRoute: [Function],
    matchURL: [Function],
    loadRoutes: [Function]
  }
  
  // Generic Server
  // https://github.com/evantahler/actionhero/blob/master/initializers/genericServer.js
  genericServer: {}, // prototype generic server
 
  // Servers
  // https://github.com/evantahler/actionhero/blob/master/initializers/servers.js
  servers:
   { servers: [ web: [Object], websocket: [Object] ], // list of all loaded servers
     _start: [Function],
     _stop: [Function] },
  
 }

{% endhighlight %}
