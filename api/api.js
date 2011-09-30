var api = api = api || {}; // the main namespace for future methods

////////////////////////////////////////////////////////////////////////////
// Includes

api.sys = require("sys"),
api.http = require("http"),
api.url = require("url"),
api.path = require("path"),
api.fs = require("fs");

////////////////////////////////////////////////////////////////////////////
// Init
var app = require('express').createServer();
api.configData = JSON.parse(api.fs.readFileSync('config.json','utf8')); 

////////////////////////////////////////////////////////////////////////////
// Required functions
api.utils = require("./utils.js").utils; // api.log() method
api.log = require("./logger.js").log; // api.log() method
try { api.fs.mkdirSync(api.configData.logFolder, "777") } catch(e) {} // ensure the logging directory exists

console.log("Server Started");
app.listen(api.configData.serverPort);

app.get('/', function(req, res){
  res.send(build_resp());
});



function build_resp()
{
	var resp = "";
	resp = resp + "Hello World!\r\n";
	resp = resp + Math.random();
	api.log("!");
	
	return resp; 
}