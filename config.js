// actionHero Config File
// I will be loded into api.configData

var fs = require('fs');
var cluster = require('cluster');

var configData = {};

/////////////////////////
// General Information //
/////////////////////////

configData.general = {
  apiVersion: "0.0.1",
  serverName: "actionHero API",
  // id: "myActionHeroServer",                                    // id can be set here, or it will be generated dynamically.  Be sure that every server you run has a unique ID (which will happen when genrated dynamically)
  serverToken: "change-me",                                       // A unique token to your application that servers will use to authenticate to each other
  welcomeMessage : "Hello! Welcome to the actionHero api",        // The welcome message seen by TCP and webSocket clients upon connection
  flatFileNotFoundMessage: "Sorry, that file is not found :(",    // The body message to accompany 404 (file not found) errors regading flat files
  serverErrorMessage: "The server experienced an internal error", // The message to accompany 500 errors (internal server errors)
  defaultChatRoom: "defaultRoom",                                 // The chatRoom that TCP and webSocket clients are joined to when the connect
  defaultLimit: 100,                                              // defaultLimit & defaultOffset are useful for limiting the length of response lists. 
  defaultOffset: 0,
  workers : 5,                                                    // The number of internal "workers" (timers) this node will have.
  developmentMode: false,                                         // Watch for changes in actions and tasks, and reload/restart them on the fly
  simultaneousActions: 5,                                         // How many pending actions can a single connection be working on 
  paths: {                                                        // configuration for your actionHero project structure
    "action":      __dirname + "/actions",
    "task":        __dirname + "/tasks",
    "public":      __dirname + "/public",
    "pid":         __dirname + "/pids",
    "log":         __dirname + "/log",
    "server":      __dirname + "/servers",
    "initializer": __dirname + "/initializers",
  }
};

/////////////
// logging //
/////////////

configData.logger = {
  transports: []
};

// console logger
if(cluster.isMaster){
  configData.logger.transports.push(function(api, winston){
    return new (winston.transports.Console)({
      colorize: true,
      level: "debug",
      timestamp: api.utils.sqlDateTime
    });
  });
}

// file logger
try{
  fs.mkdirSync("./log");
} catch(e) {
  if(e.code != "EEXIST"){ console.log(e); process.exit(); }
}
configData.logger.transports.push(function(api, winston) {
  return new (winston.transports.File)({
    filename: configData.general.paths.log + "/" + api.pids.title + '.log',
    level: "info",
    timestamp: true
  });
});

///////////
// Redis //
///////////

configData.redis = {
  fake: true,
  host: "127.0.0.1",
  port: 6379,
  password: null,
  options: null,
  DB: 0,
};

//////////
// FAYE //
//////////

configData.faye = {
  mount: "/faye",
  timeout: 45,
  ping: null,
};

/////////////
// SERVERS //
/////////////

// uncomment the section to enable the server

configData.servers = {
  "web" : {
    secure: false,                       // HTTP or HTTPS?
    serverOptions: {},                   // Passed to https.createServer if secure=ture. Should contain SSL certificates
    port: 8080,                          // Port or Socket
    bindIP: "0.0.0.0",                   // Which IP to listen on (use 0.0.0.0 for all)
    httpHeaders : {},                    // Any additional headers you want actionHero to respond with
    urlPathForActions : "api",           // Route that actions will be served from; secondary route against this route will be treated as actions, IE: /api/?action=test == /api/test/
    urlPathForFiles : "public",          // Route that static files will be served from; path (relitive to your project root) to server static content from
    rootEndpointType : "api",            // When visiting the root URL, should visitors see "api" or "file"? Visitors can always visit /api and /public as normal
    directoryFileType : "index.html",    // The default filetype to server when a user requests a directory
    flatFileCacheDuration : 60,          // The header which will be returned for all flat file served from /public; defined in seconds
    fingerprintOptions : {               // Settings for determining the id of an http(s) requset (browser-fingerprint)
      cookieKey: "sessionID",
      toSetCookie: true,
      onlyStaticElements: false
    },
    formOptions: {                       // Options to be applied to incomming file uplaods. More options and details at https://github.com/felixge/node-formidable
      uploadDir: "/tmp",
      keepExtensions: false,
      maxFieldsSize: 1024 * 1024 * 100
    },
    returnErrorCodes: false              // When true, returnErrorCodes will modify the response header for http(s) clients if connection.error is not null. You can also set connection.responseHttpCode to specify a code per request.
  },
  // "socket" : {
  //   secure: false,                        // TCP or TLS?
  //   serverOptions: {},                    // passed to tls.createServer if secure=ture. Should contain SSL certificates
  //   port: 5000,                           // Port or Socket
  //   bindIP: "0.0.0.0",                    // which IP to listen on (use 0.0.0.0 for all)
  // },
  // "websocket" : {
  // },
};

//////////////////////////////////

exports.configData = configData;
