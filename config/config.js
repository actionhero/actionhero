// actionHero Config File
// I will be loaded into api.config

var fs = require('fs');
var cluster = require('cluster');

var config = {};

/////////////////////////
// General Information //
/////////////////////////

config.general = {
  apiVersion: '0.0.1',
  serverName: 'actionHero API',
  // id can be set here, or it will be generated dynamically.
  //  Be sure that every server you run has a unique ID (which will happen when generated dynamically)
//  id: 'myActionHeroServer',
  // A unique token to your application that servers will use to authenticate to each other
  serverToken: 'change-me',
  // The welcome message seen by TCP and webSocket clients upon connection
  welcomeMessage: 'Hello! Welcome to the actionHero api',
  // The body message to accompany 404 (file not found) errors regarding flat files
  flatFileNotFoundMessage: 'Sorry, that file is not found :(',
  // The message to accompany 500 errors (internal server errors)
  serverErrorMessage: 'The server experienced an internal error',
  // defaultLimit & defaultOffset are useful for limiting the length of response lists. 
  defaultLimit: 100,
  defaultOffset: 0,
  // Watch for changes in actions and tasks, and reload/restart them on the fly
  developmentMode: true,
  // How many pending actions can a single connection be working on 
  simultaneousActions: 5,
  // configuration for your actionHero project structure
  paths: {
    'action':      __dirname + '/../actions',
    'task':        __dirname + '/../tasks',
    'public':      __dirname + '/../public',
    'pid':         __dirname + '/../pids',
    'log':         __dirname + '/../log',
    'server':      __dirname + '/../servers',
    'initializer': __dirname + '/../initializers'
  },
  // hash containing chat rooms you wish to be created at server boot 
  startingChatRooms: {
    // format is {roomName: {authKey, authValue}}
    //'secureRoom': {authorized: true},
    'defaultRoom': {}
  }
};

/////////////
// logging //
/////////////

config.logger = {
  transports: []
};

// console logger
if(cluster.isMaster){
  config.logger.transports.push(function(api, winston){
    return new (winston.transports.Console)({
      colorize: true,
      level: 'debug',
      timestamp: api.utils.sqlDateTime
    });
  });
}

// file logger
try{
  fs.mkdirSync('./log');
} catch(e) {
  if(e.code != 'EEXIST'){ console.log(e); process.exit(); }
}
config.logger.transports.push(function(api, winston) {
  return new (winston.transports.File)({
    filename: config.general.paths.log + '/' + api.pids.title + '.log',
    level: 'info',
    timestamp: true
  });
});

///////////
// Stats //
///////////

config.stats = {
  // how often should the server write its stats to redis?
  writeFrequency: 1000,
  // what redis key(s) [hash] should be used to store stats?
  //  provide no key if you do not want to store stats
  keys: [
    'actionHero:stats'
  ]
}

///////////
// Redis //
///////////

config.redis = {
  fake: true,
  host: '127.0.0.1',
  port: 6379,
  password: null,
  options: null,
  database: 0
};

//////////
// FAYE //
//////////

config.faye = {
  // faye's URL mountpoint.  Be sure to not overlap with an action or route
  mount: '/faye',
  // idle timeout for clients
  timeout: 45,
  // should clients ping the server?
  ping: null,
  // What redis server should we connect to for faye?
  redis: config.redis,
  // redis prefix for faye keys
  namespace: 'faye:'
};

///////////
// TASKS //
///////////

// see https://github.com/taskrabbit/node-resque for more information / options
config.tasks = {
  // Should this node run a scheduler to promote delayed tasks?
  scheduler: false,
  // what queues should the workers work and how many to spawn?
  //  ['*'] is one worker working the * queue
  //  ['high,low'] is one worker working 2 queues
  queues: [],
  // how long to sleep between jobs / scheduler checks
  timeout: 5000,
  // What redis server should we connect to for tasks / delayed jobs?
  redis: config.redis
}

/////////////
// SERVERS //
/////////////

// uncomment the section to enable the server

config.servers = {
  'web' : {
    // HTTP or HTTPS?
    secure: false,
    // Passed to https.createServer if secure=true. Should contain SSL certificates
    serverOptions: {},
    // Port or Socket
    port: 8080,
    // Which IP to listen on (use '0.0.0.0' for all; '::' for all on ipv4 and ipv6)
    bindIP: '0.0.0.0',
    // Any additional headers you want actionHero to respond with
    httpHeaders : {
      'Access-Control-Allow-Origin' : '*',
      'Access-Control-Allow-Methods': 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    // Route that actions will be served from; secondary route against this route will be treated as actions,
    //  IE: /api/?action=test == /api/test/
    urlPathForActions : 'api',
    // Route that static files will be served from;
    //  path (relative to your project root) to serve static content from
    urlPathForFiles : 'public',
    // When visiting the root URL, should visitors see 'api' or 'file'?
    //  Visitors can always visit /api and /public as normal
    rootEndpointType : 'file',
    // The default filetype to server when a user requests a directory
    directoryFileType : 'index.html',
    // The header which will be returned for all flat file served from /public; defined in seconds
    flatFileCacheDuration : 60,
    // Settings for determining the id of an http(s) request (browser-fingerprint)
    fingerprintOptions : {
      cookieKey: 'sessionID',
      toSetCookie: true,
      onlyStaticElements: false
    },
    // Options to be applied to incoming file uploads.
    //  More options and details at https://github.com/felixge/node-formidable
    formOptions: {
      uploadDir: '/tmp',
      keepExtensions: false,
      maxFieldsSize: 1024 * 1024 * 100
    },
    // Options to configure metadata in responses
    metadataOptions: {
      serverInformation: true,
      requesterInformation: true
    },
    // When true, returnErrorCodes will modify the response header for http(s) clients if connection.error is not null.
    //  You can also set connection.rawConnection.responseHttpCode to specify a code per request.
    returnErrorCodes: false
  },
  'websocket' : {
  },
  // 'socket' : {
  //   // TCP or TLS?
  //   secure: false,
  //   // passed to tls.createServer if secure=true. Should contain SSL certificates
  //   serverOptions: {},
  //   // Port or Socket
  //   port: 5000,
  //   // which IP to listen on (use 0.0.0.0 for all)
  //   bindIP: '0.0.0.0'
  // },
};

//////////////////////////////////

exports.config = config;
