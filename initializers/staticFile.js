var fs = require('fs');
var path = require('path');
var mime = require('mime');

var staticFile = function(api, next){

  api.staticFile = {

    // connection.params.file should be set
    get: function(connection, callback){
      var self = this;
      if(connection.params.file == null){
        self.sendFileNotFound(connection, "file is a required param to send a file", callback);
      }else{
        var file = path.normalize(api.configData.general.flatFileDirectory + "/" + connection.params.file);
        if(file.indexOf(path.normalize(api.configData.general.flatFileDirectory)) != 0){
          self.sendFileNotFound(connection, "that is not a valid file path", callback);
        }else{
          self.checkExistance(file, function(exists){
            if(exists){
              self.sendFile(file, connection,callback);
            }else{
              self.sendFileNotFound(connection, "file not found", callback);
            }
          });
        }
      }
    },

    sendFile: function(file, connection, callback){
      // TODO: Bring back generic pipe/stream for file reading; setting in RAM is wasteful 
      var self = this;
      fs.readFile(file, 'utf8', function(err, data){
        if(err){
          self.sendFileNotFound(connection, "error reading file: " + String(err), callback);
        }else{
          api.stats.increment("staticFiles:filesSent");
          var fileMime = mime.lookup(file);
          var length = data.length;
          self.logRequest(file, connection, length, true);
          callback(connection, data, fileMime, length);
        }
      });
    },

    sendFileNotFound: function(connection, errorMessage, callback){
      var self = this;
      api.stats.increment("staticFiles:failedFileRequests");
      connection.error = new Error(errorMessage);
      self.logRequest('{404: not found}', connection, null, false);
      callback(connection, api.configData.general.flatFileNotFoundMessage, 'text/html'. null);
    },

    checkExistance: function(file, callback){
      var self = this;
      fs.stat(file, function(err, stats){
        if(err != null){
          callback(false);
        }else{
          if(stats.isDirectory()){
            callback(false); // default file should have been appeneded by server
          }else if(stats.isSymbolicLink()){
            fs.readLink(fileName, function(err, truePath){
              if(err != null){
                callback(false);
              }else{
                truePath = path.normalize(truePath);
                api.fileServer.checkExistance(truePath, callback);
              }
            });
          }else if(stats.isFile()){
            callback(true);
          }else{
            callback(false);
          }
        }
      });
    },

    logRequest: function(file, connection, length, success){
      var duration = new Date().getTime() - connection.connectedAt;
      api.log("[ file @ " + connection.type + " ]", 'debug', {
        to: connection.remoteIP,
        file: file,
        size: length,
        duration: duration,
        success: success
      });
    }

  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.staticFile = staticFile;
