var fs = require('fs');

var task = {};

/////////////////////////////////////////////////////////////////////
// metadata
task.name = "cleanLogFiles";
task.description = "I will clean (delete) all log files if they get to big";
task.scope = "all";
task.frequency = 60000;

/////////////////////////////////////////////////////////////////////
// functional
task.run = function(api, params, next){
  fs.readdirSync(api.configData.logFolder).forEach( function(file) {
    file = api.configData.log.logFolder + "/" + file;
    fs.exists(file, function (exists){
      if(exists){
        size = fs.statSync(file).size;
        if(size >= api.configData.general.maxLogFileSize)
        {
          api.log(file + " is larger than " + api.configData.general.maxLogFileSize + " bytes.  Deleting.", "yellow");
          fs.unlinkSync(file);
        }
      }
    });
  });
  
  next(true, null);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
