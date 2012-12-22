#!/usr/bin/env node

// I am an interactive actionHero console.  
// Have fun!

repl = require("repl");
var actionHero = require(__dirname + "../../../api.js").actionHero;
var repl_context = {};

var node_versions = parseInt(process.version.split("."))
if(node_versions[0] < 1 && node_versions[1] < 8){
  throw "This REPL only works for nodeJS v0.8.0 or later. Sorry."
}

var welcome_messages = [
  "",
  "*** Starting Interactive Session ***",
  "",
  " - All decendants of the api namespace are available for exceution, modificaiton and inspection.",
  " - Try [ api.actions ] or [ api.cache.save(api, '_test', 'abc123', _cb) ] and [ api.cache.load(api, '_test', _cb) ] ",
  " - A simple callback which will print its recived data is available to you as [ _cb() ].  Try me like this [ _cb('action', 'hero') ]",
  "",
  "Have Fun!",
  ""
]

process.chdir("../../");

params = {};
params.configChanges = {
  
  "webServerPort" : 8080,
  "socketServerPort" : 5000,

  "redis" : {
    "enable": true,
    "host": "127.0.0.1",
    "port": 6379,
    "password": null,
    "options": null,
    "DB": 0
  },

  "secureWebServer" : {
    "enable": false
  },
  
  "logFile" : "repl.log",

  "flatFileDirectory" : "./public/"
}

params.initFunction = function(api, next){
  repl_context.api = api;
  // add other varaibles you might want to repl_context[] here...
  next();
}

// start the server!
actionHero.start(params, function(api){
  api.log("Boot Sucessful!");

  for(var i in welcome_messages){
    console.log(welcome_messages[i]);
  }

  function _cb(){
    console.log("");
    console.log("...");
    console.log("Callback triggered by [ " +  _cb.caller + " ] and recieved with "+arguments.length+" arguments:")
    for(var i in arguments){
      console.log("  > "+i+": "+JSON.stringify(arguments[i]));
    }
    console.log("...");
    console.log("");
  }

  repl_context._cb = _cb;

  var R = repl.start({
    prompt: "actionHero >>> ",
    input: process.stdin,
    output: process.stdout,
    useGlobal: true,
    terminal: true,  // you loose the up/down arrows, but the color spacing is fixed... 
    ignoreUndefined: true,
    useColors: true
  });

  R.context.help = "I probably should write a help message...";
  
  for(var i in repl_context){
    R.context[i] = repl_context[i];
  }
});