var api = api = api || {}; // the api namespace.  Everything uses this.
////////////////////////////////////////////////////////////////////////////
// Global Includes

api.sys = require("sys"),
api.http = require("http"),
api.url = require("url"),
api.path = require("path"),
api.fs = require("fs");

////////////////////////////////////////////////////////////////////////////
// Init
api.app = require('express').createServer();
api.configData = JSON.parse(api.fs.readFileSync('config.json','utf8')); 

api.utils = require("./utils.js").utils;
api.log = require("./logger.js").log;
api.build_response = require("./response.js").build_response; 

// ensure the logging directory exists
try { api.fs.mkdirSync(api.configData.logFolder, "777") } catch(e) {}; 
api.log("*** Server Started @ " + api.utils.sqlDateTime() + " @ port " + api.configData.serverPort + " ***");
api.app.listen(api.configData.serverPort);

////////////////////////////////////////////////////////////////////////////
// Request Processing
api.app.get('/', function(req, res, next){
	api.timer = {};
	api.timer.startTime = new Date().getTime();
	
	api.response = {}; // the data returned from the API
	api.response.random = Math.random();
	
  	res.send(api.build_response());
});