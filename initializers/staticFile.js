var fs = require('fs');
var path = require('path');
var Mime = require('mime');

module.exports = {
  loadPriority:  510,
  initialize: function(api, next){

    api.staticFile = {

      path: function(connection, counter){
        if(!counter){ counter = 0; }
        if(api.config.general.paths === undefined || api.config.general.paths.public.length === 0 || counter >= api.config.general.paths.public.length){
          return null;
        }else{
          return api.config.general.paths.public[counter];
        }
      },

      // connection.params.file should be set
      // callback is of the form: callback(connection, error, fileStream, mime, length)
      get: function(connection, callback, counter){
        var self = this;
        if(!counter){ counter = 0; }
        if(!connection.params.file || !api.staticFile.path(connection, counter) ){
          self.sendFileNotFound(connection, api.config.errors.fileNotProvided(), callback);
        } else {
          var file = path.normalize(api.staticFile.path(connection, counter) + '/' + connection.params.file);
          if(file.indexOf(path.normalize(api.staticFile.path(connection, counter))) !== 0){
            api.staticFile.get(connection, callback, counter + 1);
          } else {
            self.checkExistence(file, function(exists, truePath){
              if(exists){
                self.sendFile(truePath, connection, callback);
              } else {
                api.staticFile.get(connection, callback, counter + 1);
              }
            });
          }
        }
      },

      sendFile: function(file, connection, callback){
        var self = this;
        var lastModified;
        fs.stat(file, function(err, stats){
          if(err){
            self.sendFileNotFound(connection, api.config.errors.fileReadError(String(err)) , callback);
          } else {
            var mime = Mime.lookup(file);
            var length = stats.size;
            var fileStream = fs.createReadStream(file);
            var start = new Date().getTime();
            lastModified=stats.mtime;
            fileStream.on('close', function(){
              var duration = new Date().getTime() - start;
              self.logRequest(file, connection, length, duration, true);
            });
            fileStream.on('error', function(err){
              api.log(err)
            });
            callback(connection, null, fileStream, mime, length, lastModified);
          }
        });
      },

      sendFileNotFound: function(connection, errorMessage, callback){
        var self = this;
        connection.error = new Error(errorMessage);
        self.logRequest('{404: not found}', connection, null, null, false);
        callback(connection, api.config.errors.fileNotFound(), null, 'text/html', api.config.errors.fileNotFound().length);
      },

      checkExistence: function(file, callback){
        fs.stat(file, function(err, stats){
          if(err){
            callback(false, file);
          } else {
            if(stats.isDirectory()){
              var indexPath = file + '/' + api.config.general.directoryFileType;
              api.staticFile.checkExistence(indexPath, callback);
            } else if(stats.isSymbolicLink()){
              fs.readLink(file, function(err, truePath){
                if(err){
                  callback(false, file);
                } else {
                  truePath = path.normalize(truePath);
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
}