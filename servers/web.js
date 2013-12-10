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
  if(null === api.config.servers.web.flatFileCacheDuration){
    api.config.servers.web.flatFileCacheDuration = 0;
  }
  if(null === api.config.servers.web.directoryFileType){
    api.config.servers.web.directoryFileType = 'index.html';
  }
  
  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){
    if(false === options.secure){
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

    server.server.on('error', function(e){
      server.log('cannot start web server @ ' + options.bindIP + ':' + options.port + '; exiting.', 'emerg');
      server.log(e, 'error');
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
    var stringResponse = '';
    if('HEAD' !== connection.rawConnection.req.method.toUpperCase()){
      stringResponse = String(message);
    }
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
    connection.rawConnection.responseHeaders.push(['Expires', new Date(new Date().getTime() + api.config.servers.web.flatFileCacheDuration * 1000).toUTCString()]);
    connection.rawConnection.responseHeaders.push(['Cache-Control', 'max-age=' + api.config.servers.web.flatFileCacheDuration + ', must-revalidate']);
    cleanHeaders(connection);
    var headers = connection.rawConnection.responseHeaders;
    if(null !== error){ connection.rawConnection.responseHttpCode = 404 }
    var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
    connection.rawConnection.res.writeHead(responseHttpCode, headers);
    if(null !== error){
      connection.rawConnection.res.end(String(error));
      server.destroyConnection(connection);
    } else {
      fileStream.pipe(connection.rawConnection.res);
      fileStream.on('end', function(){
        server.destroyConnection(connection);
      });
    }
  };

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){
    determineRequestParams(connection, function(requestMode){
      if('api' === requestMode){
        server.processAction(connection);
      } else if('file' === requestMode){
        server.processFile(connection);
      } else if('options' === requestMode){
        respondToOptions(connection);
      } else if('trace' === requestMode){
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

      // https://github.com/evantahler/actionHero/issues/189
      responseHeaders.push(['Transfer-Encoding', 'Chunked']);
      // a sensible default; can be replaced
      responseHeaders.push(['Content-Type', 'application/json']);
      responseHeaders.push(['X-Powered-By', api.config.general.serverName]);

      if(null !== typeof(api.config.servers.web.httpHeaders)){
        for(i in api.config.servers.web.httpHeaders){
          responseHeaders.push([i, api.config.servers.web.httpHeaders[i]]);
        }
      }
             
      var remoteIP = req.connection.remoteAddress;
      var remotePort = req.connection.remotePort;

      if(null !== req.headers['x-forwarded-for']){
        // all IPv4 addresses have 0 colons (127.0.0.1) and IPv6 addresses can have 3 ([::ffff:127.0.0.1]) or 7 ([0:0:0:0:0:0:0:1])
        // any other number indicates the presence of an appended port
        var parts = req.headers['x-forwarded-for'].split(',')[0].split(':');
        if([1, 4, 8].indexOf(parts.length) < 0){
          remotePort = parts.pop();
        }
        remoteIP = parts.join(':');

        if(null !== req.headers['x-forwarded-port']){
          remotePort = req.headers['x-forwarded-port'];
        }
      }

      server.buildConnection({
      // will emit 'connection'
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
        remotePort: remotePort
      });
    });
  }

  var completeResponse = function(connection, toRender, messageCount){
    if(true === toRender){
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

      if(null !== connection.response.error){
        if(shouldSendDocumentation(connection)){
          connection.response.documentation = api.documentation.documentation;
          delete connection.error;
          delete connection.response.error;
        } else if(true === api.config.servers.web.returnErrorCodes && 200 === connection.rawConnection.responseHttpCode){
          if('{no action}' === connection.action || String(connection.error).indexOf('is not a known action or that is not a valid apiVersion.') > 0){
            connection.rawConnection.responseHttpCode = 404;
          } else if(String(connection.error).indexOf('is a required parameter for this action') > 0){
            connection.rawConnection.responseHttpCode = 422;
          } else if(String(connection.error).indexOf('none of the required params for this action were provided') > 0){
            connection.rawConnection.responseHttpCode = 422;
          } else if('Error: ' + String(connection.response.error) === api.config.general.serverErrorMessage){
            connection.rawConnection.responseHttpCode = 500;
          } else {
            connection.rawConnection.responseHttpCode = 400;
          }
        }
      }

      var stringResponse = JSON.stringify(connection.response, null, 2);
      if(null === connection.response.error &&
         null !== connection.action &&
         null !== connection.params.apiVersion &&
         true === api.actions.actions[connection.action][connection.params.apiVersion].matchExtensionMimeType
        ){
        connection.rawConnection.responseHeaders.push(['Content-Type', Mime.lookup(connection.extension)]);
      }
      if(null !== connection.params.callback){
        connection.rawConnection.responseHeaders.push(['Content-Type', 'application/javascript']);
        stringResponse = connection.params.callback + '(' + stringResponse + ');';
      }

      server.sendMessage(connection, stringResponse);
    }
  }

  var respondToOptions = function(connection){
    if(null === api.config.servers.web.httpHeaders['Access-Control-Allow-Methods']){
      var methods = 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE';
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Methods', methods]);
    }
    if(null === api.config.servers.web.httpHeaders['Access-Control-Allow-Origin']){
      var origin = '*';
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Origin', origin]);
    }
    server.sendMessage(connection, '');
  }

  var respondToTrace= function(connection){
    var data = buildRequesterInformation(connection);
    var stringResponse = JSON.stringify(data, null, 2);
    server.sendMessage(connection, stringResponse);
  }

  var determineRequestParams = function(connection, callback){
    var requestMode = api.config.servers.web.rootEndpointType; // api or public
    var pathParts = connection.rawConnection.parsedURL.pathname.split('/');
    var apiPathParts = connection.rawConnection.parsedURL.pathname.split('/');
    var filePathParts = connection.rawConnection.parsedURL.pathname.split('/');
    var extensionParts = connection.rawConnection.parsedURL.pathname.split('.');
    if (extensionParts.length > 1){
      connection.extension = extensionParts[(extensionParts.length - 1)];
    }
    filePathParts.shift();
    apiPathParts.shift();
    var i;
    if(pathParts.length > 0){
      if(api.config.servers.web.urlPathForActions === pathParts[1]){
        requestMode = 'api';
        apiPathParts.shift();
      } else if(api.config.servers.web.urlPathForFiles === pathParts[1] || 0 === connection.rawConnection.parsedURL.pathname.indexOf(api.config.servers.web.urlPathForFiles)){
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
    if('api' === requestMode){
      var httpMethod = connection.rawConnection.req.method.toUpperCase();
      if('OPTIONS' === httpMethod){
        requestMode = 'options'
        callback(requestMode);
      } else if('GET' === httpMethod || 'HEAD' === httpMethod){
        api.routes.processRoute(connection);
        if(null === connection.params['action']){ connection.params['action'] = apiPathParts[0] }
        callback(requestMode);
      } else { // POST/DELETE/PUT params
        if('TRACE' === httpMethod){ requestMode = 'trace' }
        if(null === connection.rawConnection.req.headers['content-type'] && null === connection.rawConnection.req.headers['Content-Type']){
          // not a legal post; bad headers
          api.routes.processRoute(connection);
          if(null === connection.params['action']){ connection.params['action'] = apiPathParts[0] }
          callback(requestMode);
        } else {
          var form = new formidable.IncomingForm();
          for(i in api.config.servers.web.formOptions){
            form[i] = api.config.servers.web.formOptions[i];
          }
          form.parse(connection.rawConnection.req, function(err, fields, files){
            if(err){
              server.log('error processing form: ' + String(err), 'error');
              connection.error = new Error('There was an error processing this form.');
            } else {
              fillParamsFromWebRequest(connection, files);
              fillParamsFromWebRequest(connection, fields);
            }
            api.routes.processRoute(connection);
            if(null === connection.params['action']){ connection.params['action'] = apiPathParts[0] }
            callback(requestMode);
          });
        }
      }
    } else {
      if(null === connection.params['file']){
        connection.params['file'] = filePathParts.join('/');
        if('' === connection.params['file'] || '/' === connection.params['file'][connection.params['file'].length - 1]){
          connection.params['file'] = api.config.servers.web.directoryFileType;
        }
      }
      callback(requestMode);
    }
  }

  var fillParamsFromWebRequest = function(connection, varsHash){
    api.params.postVariables.forEach(function(postVar){
      if('undefined' !== typeof varsHash[postVar] && null !== varsHash[postVar]){
        connection.params[postVar] = varsHash[postVar];
      }
    });
  }

  var shouldSendDocumentation = function(connection){
    if('{no action}' !== connection.action){ return false }
    if('GET' !== connection.rawConnection.req.method.toUpperCase()){ return false }
    var params = api.utils.objClone(connection.params);
    delete params.action;
    delete params.limit;
    delete params.offset;
    return (api.utils.hashLength(params) === 0);
  }

  var buildRequesterInformation = function(connection){
    var requesterInformation = {
      id: connection.id,
      remoteIP: connection.remoteIP,
      receivedParams: {}
    };
    for(var k in connection.params){
      requesterInformation.receivedParams[k] = connection.params[k];
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
      } else if('HEAD' === connection.rawConnection.req.method.toUpperCase() && 'Transfer-Encoding' === key){
        // ignore, we can't send this header for HEAD requests
      } else {
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
