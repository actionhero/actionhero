// actionHero Config File
// For use in version 3.0.0 or greater

var configData = {}

/////////////////////////
// General Information //
/////////////////////////

configData.apiVersion = "3.0.0";
configData.serverName = "actionHero API";
// The welcome message seen by TCP and webSocket clients upon connection
configData.socketServerWelcomeMessage = "Hello! Welcome to the actionHero api";
// The location of this package relative to your project
configData.apiBaseDir = "./node_modules/actionHero/";
configData.flatFileDirectory = "./node_modules/actionHero/public/",
configData.flatFileNotFoundMessage = "Sorry, that file is not found :(",
configData.flatFileIndexPageNotFoundMessage = "Sorry, there is no index page for this folder :(",
// the chatRoom that TCP and webSocket clients are joined to when the connect
configData.defaultSocketRoom = "defaultRoom",
// defaultLimit & defaultOffset are useful for limiting the length of response lists.  
// These params will always be appended to any request as "limit" and "offest" unless set by the client
configData.defaultLimit = 100; 
configData.defaultOffset = 0;

/////////////
// logging //
/////////////

configData.log = {
	"logging" : true,
	"logFolder" : "./log/",
	"logFile" : "api.log",
	// Should we log the actual requests coming in (and their params)?
	"logRequests" : true,
}

///////////
// Redis //
///////////

configData.redis = {
	"enable": true,
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
};

/////////////////
// HTTP Server //
/////////////////

configData.httpServer = {
	"enable": true,
	"port": 8080,
	""
};

//////////////////
// HTTPS Server //
//////////////////

configData.httpsServer = {
	"enable": true,
	"port": 4443,
	"keyFile": "./certs/server-key.pem",
	"certFile": "./certs/server-cert.pem"
};

////////////////
// TCP Server //
////////////////

configData.tcpServer = {
	"enable": true,
	"port": 5000
};

/////////////////
// Web Sockets //
/////////////////

configData.webSockets = {
	"enable": true,
	// which web interface to bind the websockets to (http or https)
	"bind" : "http"
};

//////////////////////////////////

exports.configData = configData