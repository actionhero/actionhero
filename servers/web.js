var url                 = require('url');
var qs                  = require('qs');
var fs                  = require('fs');
var path                = require('path');
var zlib                = require('zlib');
var formidable          = require('formidable');
var browser_fingerprint = require('browser_fingerprint');
var Mime                = require('mime');
var uuid                = require('node-uuid');

var initialize = function(api, options, next){

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
    throw new Error('api.config.servers.web.rootEndpointType can only be \'api\' or \'file\'');
  }

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server.start = function(next){
    if(options.secure === false){
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
      if(bootAttempts < api.config.servers.web.bootAttempts){
        server.log('cannot boot web server; trying again [' + String(e) + ']', 'error');
        if(bootAttempts === 1){ cleanSocket(options.bindIP, options.port); }
        setTimeout(function(){
          server.log('attempting to boot again..')
          server.server.listen(options.port, options.bindIP);
        }, 1000)
      }else{
        return next(new Error('cannot start web server @ ' + options.bindIP + ':' + options.port + ' => ' + e.message));
      }
    });

    server.server.listen(options.port, options.bindIP, function(){
      chmodSocket(options.bindIP, options.port);
      next();
    });
  }

  server.stop = function(next){
    server.server.close();
    process.nextTick(function(){
      next();
    });
  }

  server.sendMessage = function(connection, message){
    var stringResponse = '';
    if(connection.rawConnection.method !== 'HEAD'){
      stringResponse = String(message);
    }
    
    cleanHeaders(connection);
    var headers = connection.rawConnection.responseHeaders;
    var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);

    server.sendWithCompression(connection, responseHttpCode, headers, stringResponse);
  }

  server.sendFile = function(connection, error, fileStream, mime, length, lastModified){
    var foundExpires = false;
    var foundCacheControl = false;
    var ifModifiedSince;
    var reqHeaders;
    connection.rawConnection.responseHeaders.forEach(function(pair){
      if( pair[0].toLowerCase() === 'expires' )      { foundExpires = true; }
      if( pair[0].toLowerCase() === 'cache-control' ){ foundCacheControl = true; }
    })

    reqHeaders = connection.rawConnection.req.headers;
    if(reqHeaders['if-modified-since']){ifModifiedSince = new Date(reqHeaders['if-modified-since'])}

    connection.rawConnection.responseHeaders.push(['Content-Type', mime]);
    if(foundExpires === false)      { connection.rawConnection.responseHeaders.push(['Expires', new Date(new Date().getTime() + api.config.servers.web.flatFileCacheDuration * 1000).toUTCString()]); }
    if(foundCacheControl === false) { connection.rawConnection.responseHeaders.push(['Cache-Control', 'max-age=' + api.config.servers.web.flatFileCacheDuration + ', must-revalidate, public']); }

    connection.rawConnection.responseHeaders.push(['Last-Modified',new Date(lastModified)]);
    cleanHeaders(connection);
    var headers = connection.rawConnection.responseHeaders;
    if(error){ connection.rawConnection.responseHttpCode = 404 }
    if(ifModifiedSince && lastModified <= ifModifiedSince){connection.rawConnection.responseHttpCode = 304}
    var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
    if(error){
      server.sendWithCompression(connection, responseHttpCode, headers, String(error));
    }
    else if(responseHttpCode !== 304){
      server.sendWithCompression(connection, responseHttpCode, headers, null, fileStream, length);
    } else {
      connection.rawConnection.res.writeHead(responseHttpCode, headers);
      connection.rawConnection.res.end();
      connection.destroy();
    }
  };

  server.sendWithCompression = function(connection, responseHttpCode, headers, stringResponse, fileStream, fileLength){
    var acceptEncoding = connection.rawConnection.req.headers['accept-encoding'];
    var compressor, stringEncoder;
    if(!acceptEncoding){ acceptEncoding = ''; }

    // Note: this is not a conformant accept-encoding parser.
    // https://nodejs.org/api/zlib.html#zlib_zlib_createinflate_options
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    if(api.config.servers.web.compress === true){
      if(acceptEncoding.match(/\bdeflate\b/)) {
        headers.push(['Content-Encoding', 'deflate']);
        compressor = zlib.createDeflate();
        stringEncoder = zlib.deflate;
      }else if(acceptEncoding.match(/\bgzip\b/)){
        headers.push(['Content-Encoding', 'gzip']);
        compressor = zlib.createGzip();
        stringEncoder = zlib.gzip;
      }
    }

    // note: the 'end' event may not fire on some OSes; finish will
    connection.rawConnection.res.on('finish', function(){ 
      connection.destroy(); 
    });

    if(fileStream){
      if(compressor){
        // headers.push(['Content-Length', fileLength]); // TODO
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        fileStream.pipe(compressor).pipe(connection.rawConnection.res);
      }else{
        headers.push(['Content-Length', fileLength]);
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        fileStream.pipe(connection.rawConnection.res);
      }
    }else{
      if(stringEncoder){
        stringEncoder(stringResponse, function(error, zippedString){
          headers.push(['Content-Length', zippedString.length]);
          connection.rawConnection.res.writeHead(responseHttpCode, headers);
          connection.rawConnection.res.end(zippedString);
        });
      }else{
        headers.push(['Content-Length', Buffer.byteLength(stringResponse)]);
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        connection.rawConnection.res.end(stringResponse);
      }
    }
  };

  server.goodbye = function(connection){
    // disconnect handlers
  };

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){
    determineRequestParams(connection, function(requestMode){
      if(requestMode === 'api'){
        server.processAction(connection);
      } else if(requestMode === 'file'){
        server.processFile(connection);
      } else if(requestMode === 'options'){
        respondToOptions(connection);
      } else if(requestMode === 'trace'){
        respondToTrace(connection);
      }
    });
  });

  server.on('actionComplete', function(data){
    completeResponse(data);
  });

  /////////////
  // HELPERS //
  /////////////

  var handleRequest = function(req, res){
    browser_fingerprint.fingerprint(req, api.config.servers.web.fingerprintOptions, function(fingerprint, elementHash, cookieHash){
      var responseHeaders = []
      var cookies =  api.utils.parseCookies(req);
      var responseHttpCode = 200;
      var method = req.method.toUpperCase();
      var parsedURL = url.parse(req.url, true);
      var i;
      for(i in cookieHash){
        responseHeaders.push([i, cookieHash[i]]);
      }

      // https://github.com/evantahler/actionhero/issues/189
      responseHeaders.push(['Content-Type', 'application/json; charset=utf-8']);

      for(i in api.config.servers.web.httpHeaders){
        responseHeaders.push([i, api.config.servers.web.httpHeaders[i]]);
      }

      var remoteIP = req.connection.remoteAddress;
      var remotePort = req.connection.remotePort;

      // helpers for unix socket bindings with no forward
      if(!remoteIP && !remotePort){
        remoteIP   = '0.0.0.0';
        remotePort = '0';
      }

      if(req.headers['x-forwarded-for']){
        var parts;
        var forwardedIp = req.headers['x-forwarded-for'].split(',')[0];
        if(forwardedIp.indexOf('.') >= 0 || (forwardedIp.indexOf('.') < 0 && forwardedIp.indexOf(':') < 0)){
          // IPv4
          forwardedIp = forwardedIp.replace('::ffff:',''); // remove any IPv6 information, ie: '::ffff:127.0.0.1'
          parts = forwardedIp.split(':');
          if(parts[0]){ remoteIP = parts[0]; }
          if(parts[1]){ remotePort = parts[1]; }
        }else{
          // IPv6
          parts = api.utils.parseIPv6URI(forwardedIp);
          if(parts.host){ remoteIP = parts.host; }
          if(parts.port){ remotePort = parts.port; }
        }

        if(req.headers['x-forwarded-port']){
          remotePort = req.headers['x-forwarded-port'];
        }
      }

      server.buildConnection({
      // will emit 'connection'
        rawConnection: {
          req: req,
          res: res,
          params: {},
          method: method,
          cookies: cookies,
          responseHeaders: responseHeaders,
          responseHttpCode: responseHttpCode,
          parsedURL: parsedURL
        },
        id: fingerprint + '-' + uuid.v4(),
        fingerprint: fingerprint,
        remoteAddress: remoteIP,
        remotePort: remotePort
      });
    });
  }

  var completeResponse = function(data){
    if(data.toRender === true){
      if(api.config.servers.web.metadataOptions.serverInformation){
        var stopTime = new Date().getTime();
        data.response.serverInformation = {
          serverName:      api.config.general.serverName,
          apiVersion:      api.config.general.apiVersion,
          requestDuration: (stopTime - data.connection.connectedAt),
          currentTime:     stopTime
        };
      }

      if(api.config.servers.web.metadataOptions.requesterInformation){
        data.response.requesterInformation = buildRequesterInformation(data.connection);
      }

      if(data.response.error){
        if(api.config.servers.web.returnErrorCodes === true && data.connection.rawConnection.responseHttpCode === 200){
          if(data.actionStatus === 'unknown_action'){
            data.connection.rawConnection.responseHttpCode = 404;
          }else if(data.actionStatus === 'missing_params'){
            data.connection.rawConnection.responseHttpCode = 422;
          }else if(data.actionStatus === 'server_error'){
            data.connection.rawConnection.responseHttpCode = 500;
          }else{
            data.connection.rawConnection.responseHttpCode = 400;
          }
        }
      }

      if(
          !data.response.error &&
          data.action &&
          data.params.apiVersion &&
          api.actions.actions[data.params.action][data.params.apiVersion].matchExtensionMimeType === true &&
          data.connection.extension
        ){
          data.connection.rawConnection.responseHeaders.push(['Content-Type', Mime.lookup(data.connection.extension)]);
      }

      if(data.response.error){
        data.response.error = api.config.errors.serializers.servers.web(data.response.error);
      }

      var stringResponse = '';

      if( extractHeader(data.connection, 'Content-Type').match(/json/) ){
        stringResponse = JSON.stringify(data.response, null, api.config.servers.web.padding);
        if(data.params.callback){
          data.connection.rawConnection.responseHeaders.push(['Content-Type', 'application/javascript']);
          stringResponse = data.connection.params.callback + '(' + stringResponse + ');';
        }
      }else{
        stringResponse = data.response;
      }

      server.sendMessage(data.connection, stringResponse);
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
    if(!api.config.servers.web.httpHeaders['Access-Control-Allow-Methods'] && !extractHeader(connection, 'Access-Control-Allow-Methods')){
      var methods = 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE';
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Methods', methods]);
    }
    if(!api.config.servers.web.httpHeaders['Access-Control-Allow-Origin'] && !extractHeader(connection, 'Access-Control-Allow-Origin')){
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
    // determine file or api request
    var requestMode = api.config.servers.web.rootEndpointType;
    var pathname = connection.rawConnection.parsedURL.pathname
    var pathParts = pathname.split('/');
    var matcherLength, i;
    while(pathParts[0] === ''){ pathParts.shift(); }
    if(pathParts[pathParts.length - 1] === ''){ pathParts.pop(); }

    if(pathParts[0] && pathParts[0] === api.config.servers.web.urlPathForActions){
      requestMode = 'api';
      pathParts.shift();
    }else if(pathParts[0] && pathParts[0] === api.config.servers.web.urlPathForFiles){
      requestMode = 'file'
      pathParts.shift();
    }else if(pathParts[0] && pathname.indexOf(api.config.servers.web.urlPathForActions) === 0 ){
      requestMode = 'api';
      matcherLength = api.config.servers.web.urlPathForActions.split('/').length;
      for(i = 0; i < (matcherLength - 1); i++){ pathParts.shift(); }
    }else if(pathParts[0] && pathname.indexOf(api.config.servers.web.urlPathForFiles) === 0 ){
      requestMode = 'file'
      matcherLength = api.config.servers.web.urlPathForFiles.split('/').length;
      for(i = 0; i < (matcherLength - 1); i++){ pathParts.shift(); }
    }

    var extensionParts = connection.rawConnection.parsedURL.pathname.split('.');
    if (extensionParts.length > 1){
      connection.extension = extensionParts[(extensionParts.length - 1)];
    }

    // OPTIONS
    if(connection.rawConnection.method === 'OPTIONS'){
      requestMode = 'options';
      callback(requestMode);
    }

    // API
    else if(requestMode === 'api'){
      if(connection.rawConnection.method === 'TRACE'){ requestMode = 'trace'; }
      var search = connection.rawConnection.parsedURL.search.slice(1);
      fillParamsFromWebRequest(connection, qs.parse(search, api.config.servers.web.queryParseOptions));
      connection.rawConnection.params.query = connection.rawConnection.parsedURL.query;
      if(
          connection.rawConnection.method !== 'GET' &&
          connection.rawConnection.method !== 'HEAD' &&
          (
            connection.rawConnection.req.headers['content-type'] ||
            connection.rawConnection.req.headers['Content-Type']
          )
      ){
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
          if(api.config.servers.web.queryRouting !== true){ connection.params.action = null; }
          api.routes.processRoute(connection, pathParts);
          callback(requestMode);
        });
      }else{
        if(api.config.servers.web.queryRouting !== true){ connection.params.action = null; }
        api.routes.processRoute(connection, pathParts);
        callback(requestMode);
      }
    }

    // FILE

    else if(requestMode === 'file'){
      if(!connection.params.file){
        connection.params.file = pathParts.join(path.sep);
      }
      if(connection.params.file === '' || connection.params.file[connection.params.file.length - 1] === '/'){
        connection.params.file = connection.params.file + api.config.general.directoryFileType;
      }
      callback(requestMode);
    }

  }

  var fillParamsFromWebRequest = function(connection, varsHash){
    // helper for JSON posts
    var collapsedVarsHash = api.utils.collapseObjectToArray(varsHash);
    if(collapsedVarsHash !== false){
      varsHash = {payload: collapsedVarsHash} // post was an array, lets call it "payload"
    }

    for(var v in varsHash){
      connection.params[v] = varsHash[v];
    }
  }

  var buildRequesterInformation = function(connection){
    var requesterInformation = {
      id: connection.id,
      fingerprint: connection.fingerprint,
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
      } else if(connection.rawConnection.method === 'HEAD' && key === 'Transfer-Encoding'){
        // ignore, we can't send this header for HEAD requests
      } else {
        foundHeaders.push(key.toLowerCase());
        cleanedHeaders.push([key, value]);
      }
    }
    connection.rawConnection.responseHeaders = cleanedHeaders;
  }

  var cleanSocket = function(bindIP, port){
    if(!bindIP && port.indexOf('/') >= 0){
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
    if(!options.bindIP && options.port.indexOf('/') >= 0){
      fs.chmodSync(port, 0777);
    }
  }

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initialize = initialize;
