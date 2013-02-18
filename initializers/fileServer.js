var url = require('url');
var fs = require('fs');
var path = require('path');
var mime = require('mime');

var fileServer = function(api, next){

  api.fileServer = {}

  if(api.configData.commonWeb.flatFileCacheDuration == null){
    api.configData.commonWeb.flatFileCacheDuration = 0;
  }
  if(api.configData.commonWeb.directoryFileType == null){
    api.configData.commonWeb.directoryFileType = "index.html";
  }

  api.fileServer.deliver = function(connection, next){
    var fileName = "";

    // determine the filename
    if((connection.params.fileName == null || typeof connection.params.fileName == "undefined") && connection.type == "web"){
      var parsedURL = url.parse(connection.rawConnection.req.url);
      var parts = parsedURL.pathname.split("/");
      parts.shift();
      if (connection.directModeAccess == true){ parts.shift(); }
      if (connection.requestMode == "api"){ parts.shift(); }
      for (var i in parts){
        if (fileName != ""){ fileName += "/"; }
        fileName += parts[i];
      }
    }else{
      api.params.requiredParamChecker(connection, ["fileName"]);
      if(connection.error === null){ fileName = connection.params.fileName; }
    }

    fileName = path.normalize(api.configData.general.flatFileDirectory  + "/" + fileName);
    api.fileServer.checkPublic(fileName, connection, next);  
  };

  api.fileServer.checkPublic = function(fileName, connection, next){
    if(fileName.indexOf(path.normalize(api.configData.general.flatFileDirectory)) === 0 && connection.error == null){
      api.fileServer.checkExistance(fileName, connection, next);
    }else{
      api.fileServer.sendFileNotFound(connection, next);
    }
  }

  api.fileServer.checkExistance = function(fileName, connection, next){
    fs.stat(fileName, function(err, stats){
      if(err != null){
        api.fileServer.sendFileNotFound(connection, next);
      }else{
        if(stats.isDirectory()){
          fileName += "/";
          var indexPage = path.normalize(fileName + api.configData.commonWeb.directoryFileType);
          api.fileServer.checkExistance(indexPage, connection, next);
        }else if(stats.isSymbolicLink()){
          fs.readLink(fileName, function(err, truePath){
            if(err != null){
              api.fileServer.sendFileNotFound(connection, next);
            }else{
              truePath = path.normalize(truePath);
              api.fileServer.checkExistance(truePath, connection, next);
            }
          });
        }else if(stats.isFile()){
          api.fileServer.sendFile(fileName, connection, next);
        }else{
          api.fileServer.sendFileNotFound(connection, next);
        }
      }
    });
  }

  api.fileServer.sendFile = function(file, connection, next){
    api.stats.increment("fileServer:filesSent");
    var fileSize = 0;
    var fileStream = fs.createReadStream(file, {
      'flags': 'r'
    }).addListener( "data", function(chunk) {
      fileSize = fileSize + chunk.length;
    }).addListener( "close",function() {
      api.fileServer.logRequest(file, connection, fileSize, true);
      process.nextTick(function() { next(connection, false); });
    });

    if(connection.type == "web"){
      connection.responseHeaders.push(['Content-Type', mime.lookup(file)]);
      connection.responseHeaders.push(['Expires', new Date(new Date().getTime() + api.configData.commonWeb.flatFileCacheDuration * 1000).toUTCString()]);
      connection.responseHeaders.push(['Cache-Control', "max-age=" + api.configData.commonWeb.flatFileCacheDuration + ", must-revalidate"]);
      api.webServer.cleanHeaders(connection);
      connection.rawConnection.res.writeHead(200, connection.responseHeaders);
      fileStream.pipe(connection.rawConnection.res, {end: true});
    }else{
      try { 
        fileStream.pipe(connection._original_connection, {end: false});
        connection._original_connection.write("\r\n"); 
      }catch(e){
        try{
          fileStream.pipe(connection, {end: false});
          connection.write("\r\n"); 
        }catch(e){
          api.log(e, "error");
        }
      }
    }
  }

  api.fileServer.sendFileNotFound = function(connection, next){
    api.stats.increment("fileServer:failedFileRequests");
    if(connection.type == "web"){
      connection.responseHeaders.push(['Content-Type', 'text/html']);
      api.webServer.cleanHeaders(connection);
      connection.rawConnection.res.writeHead(404, connection.responseHeaders);
      connection.rawConnection.res.end(api.configData.general.flatFileNotFoundMessage);
      next(connection, false);
    }else{
      if(connection.error === null){
        connection.error = new Error("The file, "+connection.params.fileName+", is not found.");
      }
      api.fileServer.logRequest('{404: not found}', connection, null, false);
      next(connection, true);
    }
  }

  api.fileServer.logRequest = function(file, connection, length, success){
    var full_url = null;
    var duration = null;
    var type = connection.type;
    if(connection.type == "web" && connection.rawConnection.req.headers != null){
      full_url = connection.rawConnection.req.headers.host + connection.rawConnection.req.url
      duration = new Date().getTime() - connection.connectedAt;
    }else{
      full_url = connection.params.fileName;
      duration = new Date().getTime() - connection.connectedAt;
    }
    api.log("[ file @ " + type + " ]", 'debug', {
      to: connection.remoteIP,
      file: file,
      request: full_url,
      size: length,
      duration: duration,
      success: success
    });
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.fileServer = fileServer;
