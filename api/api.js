////////////////////////////////////////////////////////////////////////////
// DAVE API Framweork in node.js
// Evan Tahler @ Fall 2011

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
// Periodic Tasks (fixed timer events)
if (api.configData.cronProcess)
{
	api.processCron = require("./cron.js").processCron;
	api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
	api.log("cron interval set to process evey " + api.configData.cronTimeInterval + "ms");
}

////////////////////////////////////////////////////////////////////////////
// params which will be considered

////////////////////////////////////////////////////////////////////////////
// populate actions

////////////////////////////////////////////////////////////////////////////
// DB setup

////////////////////////////////////////////////////////////////////////////
// Request Processing
api.app.get('/', function(req, res, next){
	api.timer = {};
	api.timer.startTime = new Date().getTime();
	
	// errors and requst state
	api.error = false;
	
	api.response = {}; // the data returned from the API
	
	// process
	api.response.random = Math.random();
	
  	res.send(api.build_response(res));
});