var fs = require('fs');
var cluster = require('cluster');

var pids = function(api, next){

  api.pids = {};
  api.pids.pid = process.pid;
  api.pids.path = api.config.general.paths.pid[0]; // it would be silly to have more than one pid

  api.pids.sanitizeId = function(){
    var pidfile = api.id;
    pidfile = pidfile.replace(new RegExp(':', 'g'), '-');
    pidfile = pidfile.replace(new RegExp(' ', 'g'), '_');
    pidfile = pidfile.replace(new RegExp('\r', 'g'), '');
    pidfile = pidfile.replace(new RegExp('\n', 'g'), '');

    return pidfile;
  }

  if(cluster.isMaster){
    api.pids.title = 'actionhero-' + api.pids.sanitizeId();
  } else {
    api.pids.title = api.pids.sanitizeId();
  }

  try { fs.mkdirSync(api.pids.path) } catch(e) {}

  api.pids.writePidFile = function(){
    fs.writeFileSync(api.pids.path + '/' + api.pids.title, api.pids.pid.toString(), 'ascii');
  }

  api.pids.clearPidFile = function(){
    try {
      fs.unlinkSync(api.pids.path + '/' + api.pids.title);
    } catch(e){
      api.log('unable to remove pidfile', 'error');
    }
  }

  api.pids._start = function(api, next){
    api.pids.writePidFile();
    api.log('pid: ' + process.pid, 'notice');
    next();
  }

  //

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.pids = pids;
