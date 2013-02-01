var fs = require('fs');
var cluster = require('cluster');
var argv = require('optimist').argv;

var pids = function(api, next){
  
  api.pids = {};
  api.pids.pid = process.pid;

  if(api.configData.general.pidFileDirectory == null){
    api.configData.general.pidFileDirectory = process.cwd() + "/pids/";
  }

  if(argv["title"] != null){
    api.pids.title = argv["title"];
  }else if(process.env["title"] != null){
    api.pids.title = process.env["title"];
  }else if(cluster.isMaster){
    api.pids.title = "actionHero-" + api.id.replace(new RegExp(':', 'g'), '-');
  }else{
    api.pids.title = "actionHeroWorker-" + new Date().getTime();
  }

  try { fs.mkdirSync(api.configData.general.pidFileDirectory, "777") } catch(e) {};

  api.pids.writePidFile = function(){
    fs.writeFileSync(api.configData.general.pidFileDirectory + api.pids.title, api.pids.pid.toString(), 'ascii');
  }

  api.pids.clearPidFile = function(){
    fs.unlinkSync(api.configData.general.pidFileDirectory + api.pids.title);
  }

  api.pids._start = function(api, next){
    api.pids.writePidFile();
    api.log("pid: " + process.pid, "notice");
    next();
  }

  //

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.pids = pids;
