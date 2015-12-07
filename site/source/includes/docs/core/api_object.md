# The API Object

```javascript
var api = { 
  // STATE VARIABLES //
  running: true,
  initialized: true,
  shuttingDown: false,

  // METADATA //
  bootTime: 1421016104943,
  env: 'development',
  id: '10.0.1.5',
  actionheroVersion: '10.0.0',
  projectRoot: '/Users/evantahler/Dropbox/Projects/actionhero',
  _startingParams: { configChanges: { general: [] } },

  // DEVELOPER MODE //
  watchedFiles: [],
  watchFileAndAct: [Function],
  unWatchAllFiles: [Function],
  loadConfigDirectory: [Function],

  // SERVER COMMAND AND CONTROL // 
  commands:{ 
    initialize: [Function],
    start:      [Function],
    stop:       [Function],
    restart:    [Function] 
  },

  // COMAND AND CONTROL //
  _self:{ 
    initializers: {},
    startingParams: { configChanges: [] },

     // arrays containing init/stop/start methods 
     configInitializers: [],
     loadInitializers:   [],
     startInitializers:  [],
     stopInitializers:   [] 
   },
  
  // INITIALZER DEFAULTS //
  initializerDefaults:{ 
    load:  1000,
    start: 1000,
    stop:  1000
  },

  // UTILS //
  utils:{ 
    hashLength:             [Function],
    hashMerge:              [Function],
    isPlainObject:          [Function],
    arrayUniqueify:         [Function],
    recursiveDirectoryGlob: [Function],
    objClone:               [Function],
    collapseObjectToArray:  [Function],
    getExternalIPAddress:   [Function],
    parseCookies:           [Function],
    parseIPv6URI:           [Function] 
  },

  // CONFIG //
  config:
   { general:
      { apiVersion: '0.0.1',
        serverName: 'actionhero API',
        serverToken: 'change-me',
        welcomeMessage: 'Hello! Welcome to the actionhero api',
        cachePrefix: 'actionhero:cache:',
        lockPrefix: 'actionhero:lock:',
        lockDuration: 10000,
        developmentMode: false,
        actionDomains: true,
        simultaneousActions: 5,
        disableParamScrubbing: false,
        filteredParams: [],
        missingParamChecks: [Object],
        directoryFileType: 'index.html',
        defaultMiddlewarePriority: 100,
        paths: [Object],
        startingChatRooms: [Object],
        plugins: [] },
     errors:
      { _toExpand: false,
        serverErrorMessage: [Function],
        missingParams: [Function],
        unknownAction: [Function],
        unsupportedServerType: [Function],
        serverShuttingDown: [Function],
        tooManyPendingActions: [Function],
        doubleCallbackError: [Function],
        fileNotFound: [Function],
        fileNotProvided: [Function],
        fileInvalidPath: [Function],
        fileReadError: [Function],
        verbNotFound: [Function],
        verbNotAllowed: [Function],
        connectionRoomAndMessage: [Function],
        connectionNotInRoom: [Function],
        connectionAlreadyInRoom: [Function],
        connectionRoomHasBeenDeleted: [Function],
        connectionRoomNotExist: [Function],
        connectionRoomExists: [Function],
        connectionRoomRequired: [Function] },
     logger: { transports: [Object] },
     redis:
      { channel: 'actionhero',
        rpcTimeout: 5000,
        package: 'fakeredis' },
     routes: {},
     servers:
      { socket: [Object],
        web: [Object],
        websocket: [Object] },
     stats: { writeFrequency: 1000, keys: [Object] },
     tasks:
      { scheduler: false,
        queues: [],
        timeout: 5000,
        minTaskProcessors: 0,
        maxTaskProcessors: 0,
        checkTimeout: 500,
        maxEventLoopDelay: 5,
        toDisconnectProcessors: true,
        redis: [Object] } },

  // PIDS //
  pids:
   { pid: 26168,
     path: '/Users/evantahler/Dropbox/Projects/actionhero/pids',
     sanitizeId: [Function],
     title: 'actionhero-10.0.1.5',
     writePidFile: [Function],
     clearPidFile: [Function] },

  // LOGGER //
  logger: {},
  log: [Function],

  // EXCEPTION HANDLERS //
  exceptionHandlers:{ 
    reporters: [ [Function] ],
    report: [Function],
    loader: [Function],
    action: [Function],
    task: [Function] 
  },

  // REDIS //
  redis:{ 
    clusterCallbaks: {},
    clusterCallbakTimeouts: {},
    subscriptionHandlers:{ 
      do: [Function],
      doResponse: [Function],
      chat: [Function] 
    },
    status:{ 
      client: true,
      subscriber: true,
      subscribed: true,
      calledback: true
    },
    initialize: [Function],
    subscribe: [Function],
    publish: [Function],
    doCluster: [Function],
    respondCluster: [Function],
    client: { },
    subscriber: { },

  // CACHE //
  cache:{ 
    redisPrefix: 'actionhero:cache:',
    lockPrefix: 'actionhero:lock:',
    lockDuration: 10000,
    lockName: '10.0.1.5',
    lockRetry: 100,
    keys: [Function],
    locks: [Function],
    size: [Function],
    clear: [Function],
    dumpWrite: [Function],
    dumpRead: [Function],
    saveDumpedElement: [Function],
    load: [Function],
    destroy: [Function],
    save: [Function],
    lock: [Function],
    unlock: [Function],
    checkLock: [Function] 
  },

  // STATS //
  stats:{ 
    // timer: null,
    // pendingIncrements: {},
    increment: [Function],
    // writeIncrements: [Function],
    get: [Function],
    getAll: [Function] 
  },

  // CONNECTIONS //
  connections:{ 
    createCallbacks: {},
    destroyCallbacks: {},
    allowedVerbs:[ 
      'quit',
      'exit',
      'documentation',
      'paramAdd',
      'paramDelete',
      'paramView',
      'paramsView',
      'paramsDelete',
      'roomAdd',
      'roomLeave',
      'roomView',
      'detailsView',
      'say' 
      ],
     connections: {},
     // apply: [Function],
     // applyCatch: [Function],
     addCreateCallback: [Function],
     addDestroyCallback: [Function] 
  },
  connection: [Function], // prototype

  // ACTIONS //
  actions:{ 
    actions: {},
    preProcessors: {},
    postProcessors: {},
    addPreProcessor: [Function],
    addPostProcessor: [Function],
    // validateAction: [Function],
    // loadFile: [Function] 
  },
  actionProcessor: [Function], // prototype
  
  // PARAMS //
  params:{ 
    globalSafeParams: [
      'file',
      'apiVersion',
      'callback',
      'action' 
    ],
    // buildPostVariables: [Function],
    postVariables: [] 
   },
  
  // SERVERS //
  genericServer: {}, // prototype
  servers: {
    servers: []
  },

  // ROUTES //
  routes: { 
    routes: { 
      get: [Object],
      post: [Object],
      put: [Object],
      patch: [Object],
      delete: [Object] 
    },
     // verbs: [],
     // processRoute: [Function],
     // matchURL: [Function],
     // loadRoutes: [Function],
   },

  // STATIC FILES //
  staticFile:{ 
    // path: [Function],
    // get: [Function],
    sendFile: [Function],
    // sendFileNotFound: [Function],
    // checkExistence: [Function],
    // logRequest: [Function] 
  },

  // CHAT //
  chatRoom:{ 
    keys: { 
      rooms: 'actionhero:chatRoom:rooms',
      members: 'actionhero:chatRoom:members:' 
    },
    messageChannel: '/actionhero/chat/chat',
    joinCallbacks: {},
    leaveCallbacks: {},
    sayCallbacks: {},
    addJoinCallback: [Function],
    addLeaveCallback: [Function],
    addSayCallback: [Function],
    broadcast: [Function],
    generateMessagePayload: [Function],
    incomingMessage: [Function],
    add: [Function],
    destroy: [Function],
    exists: [Function],
    sanitizeMemberDetails: [Function],
    roomStatus: [Function],
    generateMemberDetails: [Function],
    addMember: [Function],
    removeMember: [Function],
    // handleCallbacks: [Function],
  },

  // RESQUE //
  resque: { 
    queue: {},
    multiWorker: {},
    scheduler: null,
    // connectionDetails: {},
    // startQueue: [Function],
    // startScheduler: [Function],
    // stopScheduler: [Function],
    // startMultiWorker: [Function],
    // stopMultiWorker: [Function],
  },

  // TASKS //
  tasks:{ 
    tasks: {},
    jobs:  {},
    // loadFile: [Function],
    // jobWrapper: [Function],
    // validateTask: [Function],
    enqueue: [Function],
    enqueueAt: [Function],
    enqueueIn: [Function],
    del: [Function],
    delDelayed: [Function],
    scheduledAt: [Function],
    timestamps: [Function],
    delayedAt: [Function],
    allDelayed: [Function],
    // enqueueRecurrentJob: [Function],
    // enqueueAllRecurrentJobs: [Function],
    stopRecurrentJob: [Function],
    details: [Function] },

  // DOCUMENATION // 
  doumentation: {}

};
```


By now you will have noticed that most sections of actionhero are initilized with access to the `api` object.  The `api` object is the top-level container/namespace for all of actionhero's data and methods.  We use the `api` object to avoide polluting any global namespaces.  The api object is availalbe to all parts of actionhero to share data and state.  Feel free to modify or add too the api object as you see fit, but be mindful of the data it already contains.  

Collections that you are reccomended not leave unmodifeid are un-expanded `[Object]`s and/or commented out.
