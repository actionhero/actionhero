var url = require('url');
var fs = require('fs');
var formidable = require('formidable');
var data2xml = require('data2xml');
var browser_fingerprint = require('browser_fingerprint');

var web = function(api, options, next){
  
  //////////
  // INIT //
  //////////

  var type = "web"
  var attributes = {
    canChat: false,
    logConnections: false,
    logExits: false,
    sendWelcomeMessage: false,
    verbs: [
      // no verbs for connections of this type, as they are to be very short-lived
    ]
  }

  var server = new api.genericServer(type, options, attributes);

  if(["api", "file"].indexOf(api.configData.servers.web.rootEndpointType) < 0){
    server.log('api.configData.servers.web.rootEndpointType can only be "api" or "file"', "emerg");
    process.exit();
  }
  if(api.configData.servers.web.flatFileCacheDuration == null){
    api.configData.servers.web.flatFileCacheDuration = 0;
  }
  if(api.configData.servers.web.directoryFileType == null){
    api.configData.servers.web.directoryFileType = "index.html";
  }
  
  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){
    if(options.secure == false){
      var http = require('http');
      server.server = http.createServer(function(req, res){
        handleRequest(req, res);
      });
    }else{
      var https = require('https');
      server.server = https.createServer(api.configData.servers.web.serverOptions, function(req, res){
        handleRequest(req, res);
      });
    }

    server.server.on("error", function(e){
      server.log("cannot start web server @ " + options.bindIP + ":" + options.port + "; exiting.", "emerg");
      server.log(e, "error");
      process.exit(1);
    });

    server.server.listen(options.port, options.bindIP, function(){
      next(server);
    });
  }

  server._teardown = function(next){
    // long-lasting connections will be terminated by process.exit from the startServer manager's timeout
    server.server.close();
    next();
  }

  server.sendMessage = function(connection, message){
    var stringResponse = String(message);
    connection.rawConnection.responseHeaders.push(['Content-Length', Buffer.byteLength(stringResponse, 'utf8')]);
    cleanHeaders(connection);
    var headers = connection.rawConnection.responseHeaders;
    var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
    connection.rawConnection.res.writeHead(responseHttpCode, headers);
    connection.rawConnection.res.end(stringResponse);
    server.destroyConnection(connection);
  }

  server.sendFile = function(connection, error, fileStream, mime, length){
    connection.rawConnection.responseHeaders.push(['Content-Type', mime]);
    connection.rawConnection.responseHeaders.push(['Content-Length', length]);
    connection.rawConnection.responseHeaders.push(['Expires', new Date(new Date().getTime() + api.configData.servers.web.flatFileCacheDuration * 1000).toUTCString()]);
    connection.rawConnection.responseHeaders.push(['Cache-Control', "max-age=" + api.configData.servers.web.flatFileCacheDuration + ", must-revalidate"]);
    cleanHeaders(connection);
    var headers = connection.rawConnection.responseHeaders;
    if(error != null){ connection.rawConnection.responseHttpCode = 404; }
    var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
    connection.rawConnection.res.writeHead(responseHttpCode, headers);
    if(error != null){
      connection.rawConnection.res.end(String(error));
      server.destroyConnection(connection);
    }else{
      fileStream.pipe(connection.rawConnection.res);
      fileStream.on("end", function(){
        server.destroyConnection(connection);
      });
    }
  };

  ////////////
  // EVENTS //
  ////////////

  server.on("connection", function(connection){
    determineRequestParams(connection, function(requestMode){
      if(requestMode == "api"){
        server.processAction(connection);
      }else{
        server.processFile(connection);
      }
    });
  });

  server.on("actionComplete", function(connection, toRender, messageCount){
    completeResponse(connection, toRender, messageCount);
  });

  /////////////
  // HELPERS //
  /////////////

  var handleRequest = function(req, res){
    browser_fingerprint.fingerprint(req, api.configData.servers.web.fingerprintOptions, function(fingerprint, elementHash, cookieHash){
      var responseHeaders = []
      var cookies =  api.utils.parseCookies(req);
      var responseHttpCode = 200;
      var method = req.method;
      var parsedURL = url.parse(req.url, true);
      for(var i in cookieHash){
        responseHeaders.push([i, cookieHash[i]]);
      }

      responseHeaders.push(['Transfer-Encoding', 'Chunked']); // https://github.com/evantahler/actionHero/issues/189
      responseHeaders.push(['Content-Type', "application/json"]); // a sensible default; can be replaced
      responseHeaders.push(['X-Powered-By', api.configData.general.serverName]);

      if(typeof(api.configData.servers.web.httpHeaders) != null){
        for(var i in api.configData.servers.web.httpHeaders){
          responseHeaders.push([i, api.configData.servers.web.httpHeaders[i]]);
        }
      }
             
      var remoteIP = req.connection.remoteAddress;
      if(req.headers['x-forwarded-for'] != null){
        var IPs = req.headers['x-forwarded-for'].split(",");
        var remoteIP = IPs[0]; 
      }

      server.buildConnection({
        rawConnection: {
          req: req, 
          res: res, 
          method: method, 
          cookies: cookies, 
          responseHeaders: responseHeaders, 
          responseHttpCode: responseHttpCode,
          parsedURL: parsedURL
        }, 
        id: fingerprint, 
        remoteAddress: remoteIP, 
        remotePort: req.connection.remotePort}
      ); // will emit "connection"
    });
  }

  var completeResponse = function(connection, toRender, messageCount){
    if(toRender === true){
      var stopTime = new Date().getTime();
      connection.response.serverInformation = {
        serverName: api.configData.general.serverName,
        apiVersion: api.configData.general.apiVersion,
        requestDuration: (stopTime - connection.connectedAt),
        currentTime: stopTime,
      };
          
      connection.response.requestorInformation = {
        id: connection.id,
        remoteIP: connection.remoteIP,
        receivedParams: {},
      };
      for(var k in connection.params){
        connection.response.requestorInformation.receivedParams[k] = connection.params[k] ;
      };
    
      if(connection.response.error != null){
        if(shouldSendDocumentation(connection)){
          connection.response.documentation = api.documentation.documentation;
          delete connection.error;
          delete connection.response.error;

        }else if(api.configData.servers.web.returnErrorCodes == true && connection.rawConnection.responseHttpCode == 200){
          if(connection.action == "{no action}" || String(connection.error).indexOf("is not a known action or that is not a valid apiVersion.") > 0){
            connection.rawConnection.responseHttpCode = 404;
          }else if(String(connection.error).indexOf("is a required parameter for this action") > 0){
            connection.rawConnection.responseHttpCode = 422;
          }else if(String(connection.error).indexOf("none of the required params for this action were provided") > 0){
            connection.rawConnection.responseHttpCode = 422;
          }else if("Error: " + String(connection.response.error) == api.configData.general.serverErrorMessage){
            connection.rawConnection.responseHttpCode = 500;
          }else{
            connection.rawConnection.responseHttpCode = 400;
          }
        }
      }
      
      var stringResponse = JSON.stringify(connection.response, null, 2); 
      if(typeof connection.params.outputType === "string"){
        if(connection.params.outputType.toLowerCase() == "xml"){
          stringResponse = data2xml()('XML', connection.response);
        }
      }
      if(connection.params.callback != null){
        connection.rawConnection.responseHeaders.push(['Content-Type', "application/javascript"]);
        stringResponse = connection.params.callback + "(" + stringResponse + ");";
      }

      server.sendMessage(connection, stringResponse);
    }
  }

  var determineRequestParams = function(connection, callback){
    var requestMode = api.configData.servers.web.rootEndpointType; // api or public
    var pathParts = connection.rawConnection.parsedURL.pathname.split("/");
    var apiPathParts = connection.rawConnection.parsedURL.pathname.split("/");
    var filePathParts = connection.rawConnection.parsedURL.pathname.split("/");
    filePathParts.shift();
    apiPathParts.shift();
    if(pathParts.length > 0){
      if(pathParts[1] == api.configData.servers.web.urlPathForActions){ 
        requestMode = 'api'; 
        apiPathParts.shift();
      }
      else if(pathParts[1] == api.configData.servers.web.urlPathForFiles || connection.rawConnection.parsedURL.pathname.indexOf(api.configData.servers.web.urlPathForFiles) === 0){ 
        requestMode = 'file'; 
        filePathParts.shift();
        var i = 1;
        while(i < api.configData.servers.web.urlPathForFiles.split("/").length - 1){
          filePathParts.shift();
          i++;
        }
      }
    }
    fillParamsFromWebRequest(connection, connection.rawConnection.parsedURL.query); // GET, PUT, and DELETE params
    if(requestMode == 'api'){
      if(connection.rawConnection.req.method.toUpperCase() != 'GET'){ // POST/DELETE/PUT params
        if(connection.rawConnection.req.headers['content-type'] == null && connection.rawConnection.req.headers['Content-Type'] == null){
          // not a legal post; bad headers
          api.routes.processRoute(connection);
          if(connection.params["action"] == null){ connection.params["action"] = apiPathParts[0]; }
          callback(requestMode);
        }else{
          var form = new formidable.IncomingForm();
          for(var i in api.configData.servers.web.formOptions){
            form[i] = api.configData.servers.web.formOptions[i];
          }
          form.parse(connection.rawConnection.req, function(err, fields, files) {
            if(err){
              server.log("error processing form: " + String(err), "error");
              connection.error = new Error("There was an error processing this form.");
            }else{
              fillParamsFromWebRequest(connection, files);
              fillParamsFromWebRequest(connection, fields);
            }
            api.routes.processRoute(connection);
            if(connection.params["action"] == null){ connection.params["action"] = apiPathParts[0]; }
            callback(requestMode);
          });
        }
      }else{
        api.routes.processRoute(connection);
        if(connection.params["action"] == null){ connection.params["action"] = apiPathParts[0]; }
        callback(requestMode);
      }
    }else{
      if(connection.params["file"] == null){
        connection.params["file"] = filePathParts.join("/");
        if (connection.params["file"] == "" || connection.params["file"][connection.params["file"].length - 1] == "/"){
          connection.params["file"] = api.configData.servers.web.directoryFileType;
        }
      }
      callback(requestMode);
    }
  }

  var fillParamsFromWebRequest = function(connection, varsHash){
    api.params.postVariables.forEach(function(postVar){
      if(varsHash[postVar] !== undefined && varsHash[postVar] != null){ 
        connection.params[postVar] = varsHash[postVar]; 
      }
    });
  }

  var shouldSendDocumentation = function(connection){
    if(connection.action != "{no action}"){ return false; }
    if(connection.rawConnection.req.method.toUpperCase() != "GET"){ return false; }
    var params = api.utils.objClone(connection.params);
    delete params.action;
    delete params.limit;
    delete params.offset;
    if(api.utils.hashLength(params) !== 0){ return false; }
    return true;
  }

  var cleanHeaders = function(connection){
    var originalHeaders = connection.rawConnection.responseHeaders.reverse();
    var foundHeaders = [];
    var cleanedHeaders = [];
    for(var i in originalHeaders){
      var key = originalHeaders[i][0];
      var value = originalHeaders[i][1];
      if(foundHeaders.indexOf(key.toLowerCase()) >= 0 && key.toLowerCase().indexOf('set-cookie') < 0 ){
        // ignore, it's a duplicate
      }else{
        foundHeaders.push(key.toLowerCase());
        cleanedHeaders.push([key, value]);
      }
    }
    connection.rawConnection.responseHeaders = cleanedHeaders;
  }

  next(server);

}

/////////////////////////////////////////////////////////////////////
// exports
exports.web = web;
