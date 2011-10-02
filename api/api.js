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
api.expressServer = require('express')
api.app = api.expressServer.createServer();
api.app.use(api.expressServer.cookieParser());
api.configData = JSON.parse(api.fs.readFileSync('config.json','utf8')); 

api.utils = require("./utils.js").utils;
api.log = require("./logger.js").log;
api.build_response = require("./response.js").build_response; 

// ensure the logging directory exists
try { api.fs.mkdirSync(api.configData.logFolder, "777") } catch(e) {}; 
api.log("*** Server Started @ " + api.utils.sqlDateTime() + " @ port " + api.configData.serverPort + " ***");
api.app.listen(api.configData.serverPort);

////////////////////////////////////////////////////////////////////////////
// DB setup

////////////////////////////////////////////////////////////////////////////
// postVariable config and load
api.postVariables = api.configData.postVariables || [];

////////////////////////////////////////////////////////////////////////////
// populate actions
api.actions = {};
api.fs.readdirSync("./actions").forEach( function(file) {
	var actionName = file.split(".")[0];
	api.actions[actionName] = require("./actions/" + file)[actionName];
	api.log("action loaded: " + actionName);
});

////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)
if (api.configData.cronProcess)
{
	api.processCron = require("./cron.js").processCron;
	api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
	api.log("cron interval set to process evey " + api.configData.cronTimeInterval + "ms");
}

////////////////////////////////////////////////////////////////////////////
// Request Processing
api.app.get('/', function(req, res, next){
	console.log(req.cookies);
	api.timer = {};
	api.timer.startTime = new Date().getTime();
	
	//params & cookies
	api.params = {};
	api.postVariables.forEach(function(postVar){
		api.params[postVar] = req.param(postVar);
		if (api.params[postVar] === undefined){ api.params[postVar] = req.cookies[postVar]; }
	});
	console.log(api.params);
	
	// errors and requst state
	api.error = false;
	
	api.response = {}; // the data returned from the API
	
	// process
	api.response.random = Math.random();
	
  	res.send(api.build_response(res));
});