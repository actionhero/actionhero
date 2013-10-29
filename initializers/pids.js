var fs = require('fs');
var cluster = require('cluster');

var pids = function(api, next){
  
  api.pids = {};
  api.pids.pid = process.pid;

  if(cluster.isMaster){
    api.pids.title = "actionHero-" + api.id.replace(new RegExp(':', 'g'), '-');
  }else{
    api.pids.title = "actionHeroWorker-" + new Date().getTime();
  }

  try { fs.mkdirSync(api.configData.general.paths.pid, "777") } catch(e) {};

  api.pids.writePidFile = function(){
    fs.writeFileSync(api.configData.general.paths.pid + "/" + api.pids.title, api.pids.pid.toString(), 'ascii');
  }

  api.pids.clearPidFile = function(){
    fs.unlinkSync(api.configData.general.paths.pid + "/" + api.pids.title);
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
