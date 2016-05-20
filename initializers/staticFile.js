'use strict';

var fs = require('fs');
var path = require('path');
var Mime = require('mime');

module.exports = {
  loadPriority:  510,
  initialize: function(api, next){

    api.staticFile = {

      searchLoactions: [],

      searchPath: function(connection, counter){
        if(!counter){ counter = 0; }
        if(api.staticFile.searchLoactions.length === 0 || counter >= api.staticFile.searchLoactions.length){
          return null;
        }else{
          return api.staticFile.searchLoactions[counter];
        }
      },

      // connection.params.file should be set
      // callback is of the form: callback(connection, error, fileStream, mime, length)
      get: function(connection, callback, counter){
        var self = this;
        if(!counter){ counter = 0; }
        if(!connection.params.file || !api.staticFile.searchPath(connection, counter)){
          self.sendFileNotFound(connection, api.config.errors.fileNotProvided(connection), callback);
        }else{
          var file;
          if(!path.isAbsolute(connection.params.file)){
            file = path.normalize(api.staticFile.searchPath(connection, counter) + '/' + connection.params.file);
          }else{
            file = connection.params.file;
          }

          if(file.indexOf(path.normalize(api.staticFile.searchPath(connection, counter))) !== 0){
            api.staticFile.get(connection, callback, counter + 1);
          }else{
            self.checkExistence(file, function(exists, truePath){
              if(exists){
                self.sendFile(truePath, connection, callback);
              }else{
                api.staticFile.get(connection, callback, counter + 1);
              }
            });
          }
        }
      },

      sendFile: function(file, connection, callback){
        var self = this;
        var lastModified;
        fs.stat(file, function(error, stats){
          if(error){
            self.sendFileNotFound(connection, api.config.errors.fileReadError(connection, String(error)), callback);
          }else{
            var mime = Mime.lookup(file);
            var length = stats.size;
            var fileStream = fs.createReadStream(file);
            var start = new Date().getTime();
            lastModified = stats.mtime;
            fileStream.on('end', function(){
              var duration = new Date().getTime() - start;
              self.logRequest(file, connection, length, duration, true);
            });
            fileStream.on('error', function(error){
              api.log(error);
            });
            fileStream.on('open', function(){
              callback(connection, null, fileStream, mime, length, lastModified);
            });
          }
        });
      },

      sendFileNotFound: function(connection, errorMessage, callback){
        var self = this;
        connection.error = new Error(errorMessage);
        self.logRequest('{404: not found}', connection, null, null, false);
        callback(connection, api.config.errors.fileNotFound(connection), null, 'text/html', api.config.errors.fileNotFound(connection).length);
      },

      checkExistence: function(file, callback){
        fs.stat(file, function(error, stats){
          if(error){
            callback(false, file);
          }else{
            if(stats.isDirectory()){
              var indexPath = file + '/' + api.config.general.directoryFileType;
              api.staticFile.checkExistence(indexPath, callback);
            }else if(stats.isSymbolicLink()){
              fs.readLink(file, function(error, truePath){
                if(error){
                  callback(false, file);
                }else{
                  truePath = path.normalize(truePath);
                  api.staticFile.checkExistence(truePath, callback);
                }
              });
            }else if(stats.isFile()){
              callback(true, file);
            }else{
              callback(false, file);
            }
          }
        });
      },

      logRequest: function(file, connection, length, duration, success){
        api.log(['[ file @ %s ]', connection.type], 'debug', {
          to: connection.remoteIP,
          file: file,
          size: length,
          duration: duration,
          success: success
        });
      }

    };

    // load in the explicit public paths first
    if(api.config.general.paths !== undefined){
      api.config.general.paths['public'].forEach(function(p){
        api.staticFile.searchLoactions.push(path.normalize(p));
      });
    }

    // source the .linked paths from plugins
    if(api.config.general.paths !== undefined){
      api.config.general.paths['public'].forEach(function(p){
        var pluginPath = p + path.sep + 'plugins';
        if(fs.existsSync(pluginPath)){
          fs.readdirSync(pluginPath).forEach(function(file){
            var parts = file.split('.');
            var name = parts[0];
            if(parts[(parts.length - 1)] === 'link' && fs.readFileSync(pluginPath + path.sep + file).toString() === 'public'){
              api.config.general.paths.plugin.forEach(function(potentialPluginPath){
                potentialPluginPath = path.normalize(potentialPluginPath + path.sep + name + path.sep + 'public');
                if(fs.existsSync(potentialPluginPath) && api.staticFile.searchLoactions.indexOf(potentialPluginPath) < 0){
                  api.staticFile.searchLoactions.push(potentialPluginPath);
                }
              });
            }
          });
        }
      });
    }

    api.log('Static files will be served from these directories', 'debug', api.staticFile.searchLoactions);
    next();
  }
};
