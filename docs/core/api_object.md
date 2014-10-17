---
layout: docs
title: Documentation - The API Object
---

# The API Object

By now you will have noticed that most sections of actionhero are initilized with access to the `api` object.  The `api` object is the top-level container/namespace for all of actionhero's data and methods.  We use the `api` object to avoide polluting any global namespaces.  The api object is availalbe to all parts of actionhero to share data and state.  Feel free to modify or add too the api object as you see fit, but be mindful of the data it already contains.  

Collections that you are reccomended not leave unmodifeid are un-expanded `[Object]`s and/or commented out.

{% highlight javascript %}

{ 
    // Top Level State Variables
    running: true,
    initialized: true,
    shuttingDown: false,
    bootTime: 1403066471765
    project_root: '/Users/evantahler/Dropbox/Projects/actionhero',
    env: 'development',
    id: '127.0.0.1',

    // Regarding the boot process
    _self: { 
        initializers: { 
        // hash of project and core initilizers, like "cache"
        },
        api: [Circular],
        startingParams: {},
        // _starters: [] 
    },

    // commands to control server state
    commands:{ 
        initialize: [Function],
        start: [Function],
        stop: [Function],
        restart: [Function] 
    },
    // _startingParams: [Object],        
    configLoader: { _start: [Function] },

    // Logger
    log: [Function],
  
    // Utils
    // https://github.com/evantahler/actionhero/blob/master/initializers/utils.js
    utils:{ 
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
        recursiveDirectoryGlob: [Function],
        objClone: [Function],
        collapseObjectToArray: [Function],
        getExternalIPAddress: [Function],
        parseCookies: [Function],
        parseIPv6URI: [Function] 
    },
  
    // Development Mode
    watchedFiles:[ ],
    watchFileAndAct: [Function],
    unWatchAllFiles: [Function],

    // Loaded in from /config/*
    config: { 
        general: [Object],
        errors:  [Object],
        redis:   [Object],
        servers: { 
            socket: [Object], 
            web: [Object], 
            websocket: [Object] },
        stats: [Object],
        tasks: [Object] 
    },

    stats: {
        // timer: null,
        // pendingIncrements: {},
        // _start: [Function],
        // _stop: [Function],
        increment: [Function],
        // writeIncrements: [Function],
        get: [Function],
        getAll: [Function] 
    },                   
  
    redis: {
        // clusterCallbaks: [Object],         
        // clusterCallbakTimeouts: [Object],  
        // subsciptionHandlers: [Object],     
        // _start: [Function],                
        // _stop: [Function],                 
        // initialize: [Function],            
        subscribe: [Function],        // have actionhero subscribe to a redis channel
        publish: [Function],          // publish to actionhero's channel
        doCluster: [Function],        // call a remote method
        // respondCluster: [Function],   
        client: [Object],             // the redis client to do most everything
        subscriber: [Object],         // the redis client to subscribe to pub/sub
    },

    cache: { 
        // sweeperTimer: null,
        // sweeperTimeout: 60000,
        redisPrefix: 'actionhero:cache:',  // read from config
        // _start: [Function],
        // keys: [Function],
        size: [Function],
        clear: [Function],
        dumpWrite: [Function],
        dumpRead: [Function],
        load: [Function],
        destroy: [Function],
        save: [Function] 
    },

    connections: { 
        // createCallbacks: {}, 
        // destroyCallbacks: {},
        allowedVerbs: [ 
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
        connections: {}, // the collection of all active connections to this server, by ID
        // _start: [Function],
        // _stop: [Function],
        apply: [Function],
        // applyCatch: [Function],
        addCreateCallback: [Function],
        addDestroyCallback: [Function] 
    },
    connection: [Function],

    actions: { 
        actions: [Object] // collection of actions for this server
        versions: [Object], // collection of actionVersions
        // preProcessors: {},
        // postProcessors: {},
        addPreProcessor: [Function],
        addPostProcessor: [Function],
        // validateAction: [Function],
        // loadFile: [Function] 
    },

    staticFile: {
        // path: [Function],
        get: [Function],
        // sendFile: [Function],
        // sendFileNotFound: [Function],
        checkExistence: [Function],
        // logRequest: [Function] 
    },

    chatRoom: {
        // keys: { 
        //     rooms: 'actionhero:chatRoom:rooms',
        //     members: 'actionhero:chatRoom:members:',
        //     auth: 'actionhero:chatRoom:auth' 
        // },
        // messageChannel: '/actionhero/chat/chat',
        // _start: [Function],
        // _stop: [Function],
        // broadcast: [Function],
        // incomingMessage: [Function],
        add: [Function],
        destroy: [Function],
        exists: [Function],
        setAuthenticationPattern: [Function],
        roomStatus: [Function],
        authorize: [Function],
        reAuthenticate: [Function],
        addMember: [Function],
        removeMember: [Function],
        // announceMember: [Function] 
    },

    resque: { 
        // queue: [Object],
        workers: [],
        // scheduler: null,
        // connectionDetails: [Object],
        // _start: [Function],
        // _stop: [Function],
        // startQueue: [Function],
        startScheduler: [Function],
        stopScheduler: [Function],
        startWorkers: [Function],
        stopWorkers: [Function] 
    },

    tasks: { 
        tasks: {},
        // jobs: {},
        // _start: [Function],
        // loadFile: [Function],
        // jobWrapper: [Function],
        // validateTask: [Function],
        enqueue: [Function],
        enqueueAt: [Function],
        enqueueIn: [Function],
        del: [Function],
        delDelayed: [Function],
        enqueueRecurrentJob: [Function],
        enqueueAllRecurrentJobs: [Function],
        stopRecurrentJob: [Function],
        details: [Function] 
    },

    routes: { 
        routes: { get: [], post: [], put: [], patch: [], delete: [] },
        // routesFile: '/Users/evantahler/Dropbox/Projects/actionhero/routes.js',
        // processRoute: [Function],
        // matchURL: [Function],
        // loadRoutes: [Function] 
    },

    servers: { 
        servers: [ web: [Object], websocket: [Object] ],
        // _start: [Function],
        // _stop: [Function] 
    },

    // genericServer: [Object],
  
    // documentation: [Object]

    // actionProcessor: [Function],

    // params: [Function],

    // logger: [Object],                 

    // exceptionHandlers: [Object],  

    // pids: [Object], 
}

{% endhighlight %}
