// actionHero Config File
// For use in version 3.1.0 or greater
// I will be loded into api.configData

var configData = {};

/////////////////////////
// General Information //
/////////////////////////

configData.general = {
  "apiVersion": "4.3.5",
  "serverName": "actionHero API",
  // The welcome message seen by TCP and webSocket clients upon connection
  "welcomeMessage" : "Hello! Welcome to the actionHero api",
  // The location of this package relative to your project
  "apiBaseDir": "./node_modules/actionHero/",
  // The directory which will be the root for the /public route
  "flatFileDirectory": "./public/",
  // The body message to acompany 404 (file not found) errors regading flat files
  "flatFileNotFoundMessage": "Sorry, that file is not found :(",
  // The body message to acompany 404 (file not found) errors regading directories
  "flatFileIndexPageNotFoundMessage": "Sorry, there is no index page for this folder :(",
  // The message to acompany 500 errors (internal server errors)
  "serverErrorMessage": "The server experienced an internal error",
  // the chatRoom that TCP and webSocket clients are joined to when the connect
  "defaultChatRoom": "defaultRoom",
  // defaultLimit & defaultOffset are useful for limiting the length of response lists.  
  // These params will always be appended to any request as "limit" and "offest" unless set by the client
  "defaultLimit": 100,
  "defaultOffset": 0,
  // The number of internal "workers" this node will have.
  // Remember these are logical timers (not threads) so they will block if they are computationally intense
  "workers" : 5,
  // watch for changes in actions and tasks, and reload them on the fly
  // This will not work in all operating systems [ http://nodejs.org/docs/latest/api/fs.html#fs_fs_watchfile_filename_options_listener ] 
  "developmentMode": false,
  // the location of the directory to keep pidfiles
  "pidFileDirectory": process.cwd() + "/pids/",
  // how many pending actions can a single connection be working on 
  "simultaniousActions": 5
};

/////////////
// logging //
/////////////

configData.logger = {
  transports: [
    function(api){
      return new (winston.transports.Console)({
        colorize: true, 
        level: "debug", 
        timestamp: api.utils.sqlDateTime
      });
    },
    function(api){
      var fs = require('fs');
      try{ 
        fs.mkdirSync("./log");
        console.log("created ./log directory");
      }catch(e){
        if(e.code != "EEXIST"){
          console.log(e); process.exit();
        }
      }
      return new (winston.transports.File)({
        filename: './log/' + api.pids.title + '.log',
        level: "info",
        timestamp: true
      });
    }
  ]
};

///////////
// Redis //
///////////

configData.redis = {
  "enable": false,
  "host": "127.0.0.1",
  "port": 6379,
  "password": null,
  "options": null,
  "DB": 0
};

///////////////////////////////////////
// Common HTTP & HTTPS Configuration //
///////////////////////////////////////

configData.commonWeb = {
  // Any additional headers you want actionHero to respond with
  "httpHeaders" : { },
  // route which actions will be served from
  // secondary route against this route will be treated as actions, IE: /api/?action=test == /api/test/
  "urlPathForActions" : "api",
  // route which static files will be served from
  // folder path (relitive to your project root) to server static content from
  "urlPathForFiles" : "public",
  // when visiting the root URL, should visitors see "api" or "public"?
  // visitors can always visit /api and /public as normal
  "rootEndpointType" : "api",
  // the default filetype to server when a user requests a directory
  "directoryFileType" : "index.html",
  // the header which will be returend for all flat file served from /public.  I am defiend in seconds
  "flatFileCacheDuration" : 60,
  // how often to prune pending messages for http clients.  Setting this to `null` will disable http client message queues
  "httpClientMessageTTL" : null,
  // settings for determining the id of an http(s) requset (browser-fingerprint)
  "fingerprintOptions" : {
    cookieKey: "sessionID",
    toSetCookie: true,
    onlyStaticElements: false
  },
  // options to be applied to incomming file uplaods.  
  // more options and details at https://github.com/felixge/node-formidable
  formOptions: {
    uploadDir: "/tmp",
    keepExtensions: false,
    maxFieldsSize: 1024 * 1024 * 100
  },
  // when enabled, returnErrorCodes will modify the response header for http(s) clients if connection.error is not null.
  // You can also set connection.responseHttpCode to specify a code per request.
  "returnErrorCodes": false
};

/////////////////
// Web Server //
/////////////////

configData.httpServer = {
  "enable": true,
  "secure": false,
  "port": 8080,
  "bindIP": "0.0.0.0", // which IP to listen on (use 0.0.0.0 for all)
  "keyFile": "./certs/server-key.pem", // only for secure = true
  "certFile": "./certs/server-cert.pem" // only for secure = true
};

////////////////
// TCP Server //
////////////////

configData.tcpServer = {
  "enable": false,
  "secure": false,
  "port": 5000,
  "bindIP": "0.0.0.0", // which IP to listen on (use 0.0.0.0 for all)
  "keyFile": "./certs/server-key.pem", // only for secure = true
  "certFile": "./certs/server-cert.pem" // only for secure = true
};

/////////////////
// Web Sockets //
/////////////////

configData.webSockets = {
  // You must have the web server enabled as well
  "enable": false,
  "logLevel" : 1,
  "settings" : [
    "browser client minification",
    "browser client etag",
    "browser client gzip"
  ],
  "options" : {}
};

//////////////////////////////////

exports.configData = configData;