var fs = require('fs');
var path = require('path');
var Mime = require('mime');

var staticFile = function(api, next){

  api.staticFile = {

    // connection.params.file should be set
    // callback is of the form: callback(connection, error, fileStream, mime, length)
    get: function(connection, callback){
      var self = this;
      if(connection.params.file == null){
        self.sendFileNotFound(connection, 'file is a required param to send a file', callback);
      } else {
	
		var file = path.join(api.config.general.paths.public,
			(connection.rawConnection.req.headers.host in api.config.general.domains)?
			api.config.general.domains[connection.rawConnection.req.headers.host]:'',
			connection.params.file);

     	if(file.indexOf(path.normalize(file)) != 0){
          self.sendFileNotFound(connection, 'that is not a valid file path', callback);
        } else {
          self.checkExistence(file, function(exists){
            if(exists){
              self.sendFile(file, connection, callback);
            } else {
              self.sendFileNotFound(connection, 'file not found', callback);
            }
          });
        }
      }
    },

    sendFile: function(file, connection, callback){
      var self = this;
      fs.stat(file, function(err, stats){
        if(err){
          self.sendFileNotFound(connection, 'error reading file: ' + String(err), callback);
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
      callback(connection, api.config.general.flatFileNotFoundMessage, null, 'text/html', api.config.general.flatFileNotFoundMessage.length);
    },

    checkExistence: function(file, callback){
      var self = this;
      fs.stat(file, function(err, stats){
        if(err != null){
          callback(false);
        } else {
          if(stats.isDirectory()){
            // default file should have been appended by server
            callback(false);
          } else if(stats.isSymbolicLink()){
            fs.readLink(file, function(err, truePath){
              if(err != null){
                callback(false);
              } else {
                truePath = path.normalize(truePath);
                api.fileServer.checkExistence(truePath, callback);
              }
            });
          } else if(stats.isFile()){
            callback(true);
          } else {
            callback(false);
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
