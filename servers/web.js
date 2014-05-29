var url = require('url');
var fs = require('fs');
var formidable = require('formidable');
var browser_fingerprint = require('browser_fingerprint');
var Mime = require('mime');

var web = function(api, options, next){

  //////////
  // INIT //
  //////////

  var type = 'web'
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

  if(['api', 'file'].indexOf(api.config.servers.web.rootEndpointType) < 0){
    server.log('api.config.servers.web.rootEndpointType can only be \'api\' or \'file\'', 'emerg');
    process.exit();
  }
  if(api.config.servers.web.flatFileCacheDuration == null){
    api.config.servers.web.flatFileCacheDuration = 0;
  }
  if(api.config.servers.web.directoryFileType == null){
    api.config.servers.web.directoryFileType = 'index.html';
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
    } else {
      var https = require('https');
      server.server = https.createServer(api.config.servers.web.serverOptions, function(req, res){
        handleRequest(req, res);
      });
    }

    var bootAttempts = 0
    server.server.on('error', function(e){
      bootAttempts++;
      if(bootAttempts < 5){
        server.log('cannot boot web server; trying again [' + String(e) + ']', 'error');
        if(bootAttempts === 1){ cleanSocket(options.bindIP, options.port); }
        setTimeout(function(){
          server.log('attempting to boot again..')
          server.server.listen(options.port, options.bindIP);
        }, 1000)
      }else{
        server.log('cannot start web server @ ' + options.bindIP + ':' + options.port + '; exiting.', 'emerg');
        server.log(e, 'error');
        process.exit(1);
      }
    });

    server.server.listen(options.port, options.bindIP, function(){
      chmodSocket(options.bindIP, options.port);
      next(server);
    });
  }

  server._stop = function(next){
    server.server.close();
    process.nextTick(function(){
      next();
    });
  }

  server.sendMessage = function(connection, message){
    var stringResponse = '';
    if(connection.rawConnection.req.method.toUpperCase() != 'HEAD'){
      stringResponse = String(message);
    }
    connection.rawConnection.responseHeaders.push(['Content-Length', Buffer.byteLength(stringResponse, 'utf8')]);
    cleanHeaders(connection);
    var headers = connection.rawConnection.responseHeaders;
    var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
    connection.rawConnection.res.writeHead(responseHttpCode, headers);
    connection.rawConnection.res.end(stringResponse);
    connection.destroy();
  }

  server.sendFile = function(connection, error, fileStream, mime, length){
    connection.rawConnection.responseHeaders.push(['Content-Type', mime]);
    connection.rawConnection.responseHeaders.push(['Content-Length', length]); // Don't send both content-length and transfer-encoding
    // connection.rawConnection.responseHeaders.push(['Transfer-Encoding', 'Chunked'])
    connection.rawConnection.responseHeaders.push(['Expires', new Date(new Date().getTime() + api.config.servers.web.flatFileCacheDuration * 1000).toUTCString()]);
    connection.rawConnection.responseHeaders.push(['Cache-Control', 'max-age=' + api.config.servers.web.flatFileCacheDuration + ', must-revalidate']);
    cleanHeaders(connection);
    var headers = connection.rawConnection.responseHeaders;
    if(error != null){ connection.rawConnection.responseHttpCode = 404 }
    var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
    connection.rawConnection.res.writeHead(responseHttpCode, headers);
    if(error != null){
      connection.rawConnection.res.end(String(error));
      connection.destroy();
    } else {
      fileStream.pipe(connection.rawConnection.res);
      fileStream.on('end', function(){
        connection.destroy();
      });
    }
  };

  server.goodbye = function(connection){
    // disconnect handlers
  }

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){
    determineRequestParams(connection, function(requestMode){
      if(requestMode == 'api'){
        server.processAction(connection);
      } else if(requestMode == 'file'){
        server.processFile(connection);
      } else if(requestMode == 'options'){
        respondToOptions(connection);
      } else if(requestMode == 'trace'){
        respondToTrace(connection);
      }
    });
  });

  server.on('actionComplete', function(connection, toRender, messageCount){
    completeResponse(connection, toRender, messageCount);
  });

  /////////////
  // HELPERS //
  /////////////

  var handleRequest = function(req, res){
    browser_fingerprint.fingerprint(req, api.config.servers.web.fingerprintOptions, function(fingerprint, elementHash, cookieHash){
      var responseHeaders = []
      var cookies =  api.utils.parseCookies(req);
      var responseHttpCode = 200;
      var method = req.method;
      var parsedURL = url.parse(req.url, true);
      var i;
      for(i in cookieHash){
        responseHeaders.push([i, cookieHash[i]]);
      }

      // https://github.com/evantahler/actionhero/issues/189
      responseHeaders.push(['Content-Type', 'application/json; charset=utf-8']);

      if(typeof(api.config.servers.web.httpHeaders) != null){
        for(i in api.config.servers.web.httpHeaders){
          responseHeaders.push([i, api.config.servers.web.httpHeaders[i]]);
        }
      }

      var remoteIP = req.connection.remoteAddress;
      var remotePort = req.connection.remotePort;

      // helpers for unix socket bindings with no forward
      if(remoteIP == null && remotePort == null){
        remoteIP   = '0.0.0.0';
        remotePort = '0';
      }

      if(req.headers['x-forwarded-for'] != null){
        var forwardedIp = req.headers['x-forwarded-for'].split(",")[0];
        if(forwardedIp.indexOf(".") >= 0 || (forwardedIp.indexOf(".") < 0 && forwardedIp.indexOf(":") < 0)){
          // IPv4
          forwardedIp = forwardedIp.replace('::ffff:',''); // remove any IPv6 information, ie: '::ffff:127.0.0.1'
          var parts = forwardedIp.split(":");
          if(parts[0] != null){ remoteIP = parts[0]; }
          if(parts[1] != null){ remotePort = parts[1]; }
        }else{
          // IPv6
          var parts = api.utils.parseIPv6URI(forwardedIp);
          if(parts['host'] != null){ remoteIP = parts['host']; }
          if(parts['port'] != null){ remotePort = parts['port']; }
        }

        if(req.headers['x-forwarded-port'] != null){
          remotePort = req.headers['x-forwarded-port'];
        }
      }

      server.buildConnection({
      // will emit 'connection'
        rawConnection: {
          fingerprint: fingerprint,
          req: req,
          res: res,
          method: method,
          cookies: cookies,
          responseHeaders: responseHeaders,
          responseHttpCode: responseHttpCode,
          parsedURL: parsedURL
        },
        id: fingerprint + '-' + api.utils.randomString(16),
        remoteAddress: remoteIP,
        remotePort: remotePort
      });
    });
  }

  var completeResponse = function(connection, toRender, messageCount){
    if(toRender === true){
      if(api.config.servers.web.metadataOptions.serverInformation){
        var stopTime = new Date().getTime();
        connection.response.serverInformation = {
          serverName:      api.config.general.serverName,
          apiVersion:      api.config.general.apiVersion,
          requestDuration: (stopTime - connection.connectedAt),
          currentTime:     stopTime
        };
      }

      if(api.config.servers.web.metadataOptions.requesterInformation){
        connection.response.requesterInformation = buildRequesterInformation(connection);
      }

      if(connection.response.error != null){
        if(shouldSendDocumentation(connection)){
          connection.response.documentation = api.documentation.documentation;
          delete connection.error;
          delete connection.response.error;
        }else if(api.config.servers.web.returnErrorCodes == true && connection.rawConnection.responseHttpCode == 200){
          if(connection.actionStatus == 'unknown_action'){
            connection.rawConnection.responseHttpCode = 404;
          }else if(connection.actionStatus === 'missing_params'){
            connection.rawConnection.responseHttpCode = 422;
          }else if(connection.actionStatus === 'server_error'){
            connection.rawConnection.responseHttpCode = 500;
          }else{
            connection.rawConnection.responseHttpCode = 400;
          }
        }
      }

      if(connection.response.error == null &&
         connection.action != null &&
         connection.params.apiVersion != null &&
         api.actions.actions[connection.action][connection.params.apiVersion].matchExtensionMimeType === true &&
         connection.extension != null
        ){
        if(connection.extension != null){ 
          connection.rawConnection.responseHeaders.push(['Content-Type', Mime.lookup(connection.extension)]);
        }
      }

      var stringResponse = '';

      if( extractHeader(connection, 'Content-Type').match(/json/) ){
        stringResponse = JSON.stringify(connection.response, null, api.config.servers.web.padding);
        if(connection.params.callback != null){
          connection.rawConnection.responseHeaders.push(['Content-Type', 'application/javascript']);
          stringResponse = connection.params.callback + '(' + stringResponse + ');';
        }
      }else{
        stringResponse = connection.response;
      }

      server.sendMessage(connection, stringResponse);
    }
  }

  var extractHeader = function(connection, match){
    var i = connection.rawConnection.responseHeaders.length - 1
    while(i >= 0){
      if(connection.rawConnection.responseHeaders[i][0].toLowerCase() === match.toLowerCase()){
        return connection.rawConnection.responseHeaders[i][1];
      }
      i--;
    }
    return null;
  }

  var respondToOptions = function(connection){
    if(api.config.servers.web.httpHeaders['Access-Control-Allow-Methods'] == null && extractHeader(connection, 'Access-Control-Allow-Methods') == null){
      var methods = 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE';
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Methods', methods]);
    }
    if(api.config.servers.web.httpHeaders['Access-Control-Allow-Origin'] == null && extractHeader(connection, 'Access-Control-Allow-Origin') == null){
      var origin = '*';
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Origin', origin]);
    }
    server.sendMessage(connection, '');
  }

  var respondToTrace= function(connection){
    var data = buildRequesterInformation(connection);
    var stringResponse = JSON.stringify(data, null, api.config.servers.web.padding);
    server.sendMessage(connection, stringResponse);
  }

  var determineRequestParams = function(connection, callback){
    var requestMode = api.config.servers.web.rootEndpointType; // api or public
    var pathParts = connection.rawConnection.parsedURL.pathname.split('/');
    var apiPathParts = connection.rawConnection.parsedURL.pathname.split('/');
    var filePathParts = connection.rawConnection.parsedURL.pathname.split('/');
    var extensionParts = connection.rawConnection.parsedURL.pathname.split('.');
    connection.rawConnection.params = {};

    if (extensionParts.length > 1){
      connection.extension = extensionParts[(extensionParts.length - 1)];
    }
    filePathParts.shift();
    apiPathParts.shift();
    var i;
    if(pathParts.length > 0){
      if(pathParts[1] == api.config.servers.web.urlPathForActions){
        requestMode = 'api';
        apiPathParts.shift();
      } else if(pathParts[1] == api.config.servers.web.urlPathForFiles || connection.rawConnection.parsedURL.pathname.indexOf(api.config.servers.web.urlPathForFiles) === 0){
        requestMode = 'file';
        filePathParts.shift();
        i = 1;
        while(i < api.config.servers.web.urlPathForFiles.split('/').length - 1){
          filePathParts.shift();
          i++;
        }
      }
    }
    
    fillParamsFromWebRequest(connection, connection.rawConnection.parsedURL.query); // GET, PUT, and DELETE params
    connection.rawConnection.params.query = connection.rawConnection.parsedURL.query;
    
    if(requestMode == 'api'){
      var httpMethod = connection.rawConnection.req.method.toUpperCase();
      if(httpMethod == 'OPTIONS'){
        requestMode = 'options'
        callback(requestMode);
      }else if(httpMethod == 'GET' || httpMethod == 'HEAD'){
        api.routes.processRoute(connection);
        if(connection.params['action'] == null){ connection.params['action'] = apiPathParts[0]; }
        callback(requestMode);
      } else { // POST/DELETE/PUT params
        if(httpMethod == 'TRACE'){ requestMode = 'trace'; }
        if(connection.rawConnection.req.headers['content-type'] == null && connection.rawConnection.req.headers['Content-Type'] == null){
          // not a legal post; bad headers
          api.routes.processRoute(connection);
          if(connection.params['action'] == null){ connection.params['action'] = apiPathParts[0]; }
          callback(requestMode);
        } else {
          connection.rawConnection.form = new formidable.IncomingForm();
          for(i in api.config.servers.web.formOptions){
            connection.rawConnection.form[i] = api.config.servers.web.formOptions[i];
          }
          connection.rawConnection.form.parse(connection.rawConnection.req, function(err, fields, files) {
            if(err){
              server.log('error processing form: ' + String(err), 'error');
              connection.error = new Error('There was an error processing this form.');
            } else {
              connection.rawConnection.params.body = fields;
              connection.rawConnection.params.files = files;
              fillParamsFromWebRequest(connection, files);
              fillParamsFromWebRequest(connection, fields);
            }
            api.routes.processRoute(connection);
            if(connection.params['action'] == null){ connection.params['action'] = apiPathParts[0]; }
            callback(requestMode);
          });
        }
      }
    } else {
      if(connection.params['file'] == null){
        connection.params['file'] = filePathParts.join('/');
        if(connection.params['file'] == '' || connection.params['file'][connection.params['file'].length - 1] == '/'){
          connection.params['file'] = connection.params['file'] + api.config.servers.web.directoryFileType;
        }
      }
      callback(requestMode);
    }
  }

  var fillParamsFromWebRequest = function(connection, varsHash){
    // helper for JSON posts
    var collapsedVarsHash = api.utils.collapseObjectToArray(varsHash);
    if(collapsedVarsHash !== false){
      varsHash = {payload: collapsedVarsHash} // post was an array, lets call it "payload"
    }else if(api.utils.hashLength(varsHash) == 1){
      var key = Object.keys(varsHash)[0];
    }

    for(var v in varsHash){
      connection.params[v] = varsHash[v];
    };
  }

  var shouldSendDocumentation = function(connection){
    if(connection.action != '{no action}'){ return false }
    if(connection.rawConnection.req.method.toUpperCase() != 'GET'){ return false }
    var params = api.utils.objClone(connection.params);
    delete params.action;
    delete params[''];
    return (api.utils.hashLength(params) === 0);
  }

  var buildRequesterInformation = function(connection){
    var requesterInformation = {
      id: connection.id,
      fingerprint: connection.rawConnection.fingerprint,
      remoteIP: connection.remoteIP,
      receivedParams: {}
    };

    for(var p in connection.params){
      if(api.config.general.disableParamScrubbing === true || api.params.postVariables.indexOf(p) >= 0){
        requesterInformation.receivedParams[p] = connection.params[p];
      }
    }

    return requesterInformation;
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
      } else if(connection.rawConnection.req.method.toUpperCase() == 'HEAD' && key == 'Transfer-Encoding'){
        // ignore, we can't send this header for HEAD requests
      } else {
        foundHeaders.push(key.toLowerCase());
        cleanedHeaders.push([key, value]);
      }
    }
    connection.rawConnection.responseHeaders = cleanedHeaders;
  }

  var cleanSocket = function(bindIP, port){
    if(bindIP == null && port.indexOf("/") >= 0){ 
      fs.unlink(port, function(err){
        if(err){
          server.log('cannot remove stale socket @' + port + ' : ' + err);
        }else{
          server.log('removed stale unix socket @ ' + port);
        }
      });
    } 
  }

  var chmodSocket = function(bindIP, port){
    if(options.bindIP == null && options.port.indexOf("/") >= 0){ 
      fs.chmodSync(port, 0777); 
    } 
  }

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.web = web;
