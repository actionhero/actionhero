var initPids = function(api, next){
  api.pids = {};
  api.pids.pid = process.pid;

  if(api.configData.general.pidFileFirectory == null){
    api.configData.general.pidFileFirectory = process.cwd() + "/pids/";
  }

  if(api.argv["title"] != null){
    api.pids.title = api.argv["title"];
  }else if(process.env["title"] != null){
    api.pids.title = process.env["title"];
  }else if(api.cluster.isMaster){
    api.pids.title = "actionHero-" + api.id.replace(new RegExp(':', 'g'), '-');
  }else{
    api.pids.title = "actionHeroWorker-" + new Date().getTime();
  }

  try { api.fs.mkdirSync(api.configData.general.pidFileFirectory, "777") } catch(e) {};

  api.pids.setTitle = function(){
    process.title = api.pids.title;
  }

  api.pids.writePidFile = function(){
    api.fs.writeFileSync(api.configData.general.pidFileFirectory + api.pids.title, api.pids.pid.toString(), 'ascii');
  }

  api.pids.clearPidFile = function(){
    api.fs.unlinkSync(api.configData.general.pidFileFirectory + api.pids.title);
  }

  //

  api.pids.setTitle()
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initPids = initPids;
