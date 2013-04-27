var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var formidable = require('formidable');
var data2xml = require('data2xml');
var browser_fingerprint = require('browser_fingerprint');

var webServer = function(api, next){

  if(api.configData.httpServer.enable != true){
    next();
  }else{
    api.webServer = {};
    api.webServer.roomCookieKey = "__room";
    api.webServer.clientClearTimers = [];

    if(["api", "public"].indexOf(api.configData.commonWeb.rootEndpointType) < 0){
      throw new Error('api.configData.commonWeb.rootEndpointType can only be "api" or "public"');
    }

    api.webServer._start = function(api, next){ 
      api.webServer.server.on("error", function(e){
        api.log("Cannot start web server @ " + api.configData.httpServer.bindIP + ":" + api.configData.httpServer.port + "; Exiting.", "emerg");
        api.log(e, "error");
        process.exit();
      });
      api.webServer.server.listen(api.configData.httpServer.port, api.configData.httpServer.bindIP, function(){
        api.webServer.server.addListener("connection",function(stream) { stream.setTimeout(10000); });
        api.log("web server listening on " + api.configData.httpServer.bindIP + ":" + api.configData.httpServer.port, "notice");
        next();
      });
    }

    api.webServer._teardown = function(api, next){
      api.webServer.stopTimers(api);      
      api.webServer.server.close();
      next();
    }
    
    ////////////////////////////////////////////////////////////////////////////
    // server
    if(api.configData.httpServer.secure == false){
      api.webServer.server = http.createServer(function (req, res) {
        api.webServer.handleRequest(req, res);
      });
    }else{
      var key = fs.readFileSync(api.configData.httpServer.keyFile);
      var cert = fs.readFileSync(api.configData.httpServer.certFile);
      api.webServer.server = https.createServer({key: key, cert: cert}, function (req, res) {
        api.webServer.handleRequest(req, res);
      });
    }

    api.webServer.decorateConnection = function(connection, cookieHash){
      var responseHeaders = [];
      for(var i in cookieHash){
        responseHeaders.push([i, cookieHash[i]]);
      }
      responseHeaders.push(['Content-Type', "application/json"]);
      responseHeaders.push(['X-Powered-By', api.configData.general.serverName]);

      connection.responseHeaders = responseHeaders;
      connection.method = connection.rawConnection.req.method;
      connection.cookies =  api.utils.parseCookies(connection.rawConnection.req);
      connection.responseHttpCode = 200;

      connection.sendMessage = function(message){
        // stub
      }
    }

    api.webServer.handleRequest = function(req, res){
      browser_fingerprint.fingerprint(req, api.configData.commonWeb.fingerprintOptions, function(fingerprint, elementHash, cookieHash){
        var connection = new api.connection({
          type: 'web', 
          id: fingerprint,
          remotePort: req.connection.remotePort, 
          remoteIP: req.connection.remoteAddress, 
          rawConnection: {
            req: req,
            res: res
          }
        });
        api.webServer.decorateConnection(connection, cookieHash);

        if(connection.cookies[api.webServer.roomCookieKey] != null){
          connection.room = connection.cookies[api.webServer.roomCookieKey];
        }

        if(typeof(api.configData.commonWeb.httpHeaders) != 'undefined'){
          for(var i in api.configData.commonWeb.httpHeaders){
            connection.responseHeaders.push([i, api.configData.commonWeb.httpHeaders[i]]);
          }
        }
                    
        if(connection.rawConnection.req.headers['x-forwarded-for'] != null){
          var IPs = connection.rawConnection.req.headers['x-forwarded-for'].split(",");
          connection.remoteIP = IPs[0]; 
        }
        
        // determine API or FILE
        connection.parsedURL = url.parse(connection.rawConnection.req.url, true);
        var pathParts = connection.parsedURL.pathname.split("/");
        connection.requestMode = api.configData.commonWeb.rootEndpointType; // api or public
        connection.directModeAccess = false;
        if(pathParts.length > 0){
          if(pathParts[1] == api.configData.commonWeb.urlPathForActions){ 
            connection.requestMode = 'api'; 
            connection.directModeAccess = true;
          }
          else if(pathParts[1] == api.configData.commonWeb.urlPathForFiles){ 
            connection.requestMode = 'public'; 
            connection.directModeAccess = true;
          }
        }
        
        if(connection.requestMode == 'api'){
          // parse GET (URL) variables
          api.webServer.fillParamsFromWebRequest(connection, connection.parsedURL.query);
          if(connection.params.action === undefined){ 
            connection.actionSetBy = "url";
            if(connection.directModeAccess == true){ 
              connection.params.action = connection.parsedURL.pathname.substring(5); 
            } else { 
              connection.params.action = connection.parsedURL.pathname.substring(1); 
            }
            if (connection.params.action[connection.params.action.length-1] == '/'){
              connection.params.action = connection.params.action.slice(0, -1);
            }
          }else{
            connection.actionSetBy = "queryParam";
          }

          // parse POST variables
          if (connection.rawConnection.req.method.toLowerCase() == 'post') {
            if(connection.rawConnection.req.headers['content-type'] == null && connection.rawConnection.req.headers['Content-Type'] == null){
              // if no form content-type, treat like GET
              api.webServer.fillParamsFromWebRequest(connection, connection.parsedURL.query);
              if(connection.params.action === undefined){ 
                connection.actionSetBy = "url";
                if(connection.directModeAccess == true){ connection.params.action = pathParts[2]; }
                else{ connection.params.action = pathParts[1]; }
              }
              api.routes.processRoute(connection);
              var actionProcessor = new api.actionProcessor({connection: connection, callback: api.webServer.respondToWebClient});
              actionProcessor.processAction();
            }else{
              var form = new formidable.IncomingForm();
              for(var i in api.configData.commonWeb.formOptions){
                form[i] = api.configData.commonWeb.formOptions[i];
              }
              form.parse(connection.rawConnection.req, function(err, fields, files) {
                if(err){
                  api.log(err, "error");
                  connection.error = new Error("There was an error processing this form.");
                }else{
                  api.webServer.fillParamsFromWebRequest(connection, files);
                  api.webServer.fillParamsFromWebRequest(connection, fields);
                }
                process.nextTick(function() { 
                  api.routes.processRoute(connection);
                  var actionProcessor = new api.actionProcessor({connection: connection, callback: api.webServer.respondToWebClient});
                  actionProcessor.processAction();
                });
              });
            }
          }else{
            api.routes.processRoute(connection);
            var actionProcessor = new api.actionProcessor({connection: connection, callback: api.webServer.respondToWebClient});
            actionProcessor.processAction();
          }
        }
        
        else if(connection.requestMode == 'public'){
          api.webServer.fillParamsFromWebRequest(connection, connection.parsedURL.query);
          process.nextTick(function(){ api.fileServer.deliver(connection); })
        } 
      });
    }
    
    api.webServer.fillParamsFromWebRequest = function(connection, varsHash){
      api.params.postVariables.forEach(function(postVar){
        if(varsHash[postVar] !== undefined && varsHash[postVar] != null){ 
          connection.params[postVar] = varsHash[postVar]; 
        }
      });
    }
    
    ////////////////////////////////////////////////////////////////////////////
    // Response Prety-maker
    api.webServer.respondToWebClient = function(connection, toRender, messageCount){
  
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
        if(api.configData.commonWeb.returnErrorCodes == true && connection.responseHttpCode == 200){
          if(connection.action == "{no action}" || String(connection.error).indexOf("is not a known action.") > 0){
            connection.responseHttpCode = 404;
          }else{
            connection.responseHttpCode = 400;
          }
        }
      }
      
      if(toRender != false){
        var stringResponse = "";
        if(typeof connection.params.outputType == "string"){
          if(connection.params.outputType.toLowerCase() == "xml"){
            stringResponse = data2xml()('XML', connection.response);
          }else{
            stringResponse = JSON.stringify(connection.response); 
          }
        }else{
          stringResponse = JSON.stringify(connection.response);
        }
      
        if(connection.params.callback != null){
          connection.responseHeaders.push(['Content-Type', "application/javascript"]);
          stringResponse = connection.params.callback + "(" + stringResponse + ");";
        }
        api.webServer.cleanHeaders(connection);
        connection.rawConnection.res.writeHead(parseInt(connection.responseHttpCode), connection.responseHeaders);
        connection.rawConnection.res.end(stringResponse);
      }

      connection.destroy();
    };

    api.webServer.stopTimers = function(api){
      for(var i in api.webServer.clientClearTimers){ 
        clearTimeout(api.webServer.clientClearTimers[i]); 
      }
    }

    api.webServer.cleanHeaders = function(connection){
      var originalHeaders = connection.responseHeaders.reverse();
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
      connection.responseHeaders = cleanedHeaders;
    }

    next();
  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.webServer = webServer;
