var fs = require('fs');
var path = require('path');
var Mime = require('mime');

var staticFile = function(api, next){

  api.staticFile = {

    path: function(connection){
      return api.config.general.paths.public[0];
    },

    // connection.params.file should be set
    // callback is of the form: callback(connection, error, fileStream, mime, length)
    get: function(connection, callback){
      var self = this;
      if(connection.params.file == null){
        self.sendFileNotFound(connection, api.config.errors.fileNotProvided(), callback);
      } else {
        var file = path.normalize(api.staticFile.path(connection) + '/' + connection.params.file);
        if(file.indexOf(path.normalize(api.staticFile.path(connection))) != 0){
          self.sendFileNotFound(connection, api.config.errors.fileInvalidPath(), callback);
        } else {
          self.checkExistence(file, function(exists, truePath){
            if(exists){
              self.sendFile(truePath, connection, callback);
            } else {
              self.sendFileNotFound(connection, api.config.errors.fileNotFound(), callback);
            }
          });
        }
      }
    },

    sendFile: function(file, connection, callback){
      var self = this;
      fs.stat(file, function(err, stats){
        if(err){
          self.sendFileNotFound(connection, api.config.errors.fileReadError(String(err)) , callback);
        } else {
          var mime = Mime.lookup(file);
          var length = stats.size;
          var fileStream = fs.createReadStream(file);
          var start = new Date().getTime();
          fileStream.on('close', function(){
            api.stats.increment('staticFiles:filesSent');
            var duration = new Date().getTime() - start;
            self.logRequest(file, connection, length, duration, true);
          });
          fileStream.on('error', function(err){
            api.log(err)
          });
          callback(connection, null, fileStream, mime, length);
        }
      });
    },

    sendFileNotFound: function(connection, errorMessage, callback){
      var self = this;
      api.stats.increment('staticFiles:failedFileRequests');
      connection.error = new Error(errorMessage);
      self.logRequest('{404: not found}', connection, null, null, false);
      callback(connection, api.config.errors.fileNotFound(), null, 'text/html', api.config.errors.fileNotFound().length);
    },

    checkExistence: function(file, callback){
      var self = this;
      fs.stat(file, function(err, stats){
        if(err != null){
          callback(false, file);
        } else {
          if(stats.isDirectory()){
            var indexPath = file + '/' + api.config.general.directoryFileType;
            api.staticFile.checkExistence(indexPath, callback);
          } else if(stats.isSymbolicLink()){
            fs.readLink(file, function(err, truePath){
              if(err != null){
                callback(false, file);
              } else {
                var truePath = path.normalize(truePath);
                api.staticFile.checkExistence(truePath, callback);
              }
            });
          } else if(stats.isFile()){
            callback(true, file);
          } else {
            callback(false, file);
          }
        }
      });
    },

    logRequest: function(file, connection, length, duration, success){
      api.log('[ file @ ' + connection.type + ' ]', 'debug', {
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
