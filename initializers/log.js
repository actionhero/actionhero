var fs = require('fs');
var path = require('path');
var colors = require('colors');
var cluster = require('cluster');

var log = function(api, next){
  
  try { fs.mkdirSync(api.configData.log.logFolder, "777") } catch(e) {}; 

  api.logger = {};
  
  api.logger.colorize = function(inner_message, styles){
    // styles is an array of styles
    if (styles == null){styles = ["white"];}
    if (typeof styles == "string"){styles = [styles];}
    for(var i in styles){
      if(colors[styles[i]] != null){
        inner_message = colors[styles[i]](inner_message);
      }
    }
    return inner_message;
  }
  
  api.log = function(original_message, styles){ 
    if(api.configData != null && api.configData.log.logging == true)
    {
      if(api.utils != undefined){
        var time_string = api.utils.sqlDateTime();
      }else{
        var time_string = "!";
      }
      if(cluster.isWorker){
        time_string += " [" + process.pid + "]";
      }
      var console_message = colors.grey(time_string) + colors.grey(" | ");
      console_message += api.logger.colorize(original_message, styles);
      console.log(console_message);
      var file_message = time_string + " | " + original_message;
      if (api.logWriter == null){
        api.logWriter = fs.createWriteStream((path.join(api.configData.log.logFolder, api.pids.title + ".log")), {flags:"a"});
      }
      process.nextTick(function() { 
        try{
          api.logWriter.write(file_message + "\r\n");
        }catch(e){
          console.log(" !!! Error writing to log file: " + e);
        }
      });
    }
  };

  api.logJSON = function(J, color){
    var str = "";
    if(J.label != null){
      str += "[" + J.label + "] ";
      delete J.label;
    }
    var need_bar = false;
    for (var i in J){
      if(need_bar == true){
        str += " | "
      }
      str += i + ": " + J[i];
      need_bar = true;
    }
    api.log(str, color);
  }
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.log = log;
