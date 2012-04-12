////////////////////////////////////////////////////////////////////////////
// Web Request Processing

var initWebServer = function(api, next)
{
	api.webServer = {};
	api.webServer.numberOfWebRequests = 0;
	
	////////////////////////////////////////////////////////////////////////////
	// server
	api.webServer.webApp = api.http.createServer(function (req, res) {
		handleRequest(req, res);
	});
	
	if(api.configData.secureWebServer == null){
		api.configData.secureWebServer = { enable: false }
	}
	if(api.configData.secureWebServer.enable){
		var key = api.fs.readFileSync(api.configData.secureWebServer.keyFile);
		var cert = api.fs.readFileSync(api.configData.secureWebServer.certFile);
		api.webServer.secureWebApp = api.https.createServer({key: key, cert: cert}, function (req, res) {
			handleRequest(req, res);
		});
	}
	
	function handleRequest(req, res){
		api.webServer.numberOfWebRequests = api.webServer.numberOfWebRequests + 1;
		
		var connection = {};
			
		connection.type = "web";
		connection.timer = {};
		connection.timer.startTime = new Date().getTime();
		connection.req = req;
		connection.res = res;
		connection.params = {}; 
		connection.response = {}; // the data returned from the API
		connection.error = false; 	// errors and requst state
		connection.remoteIP = connection.req.connection.remoteAddress;
		connection.responseHeaders = {
			'Content-Type': "application/json",
			"X-Powered-By": api.configData.serverName
		};
                
                if(typeof(api.configData.httpHeaders) != 'undefined'){
                    for(var i in api.configData.httpHeaders){
                        connection.responseHeaders[i] = api.configData.httpHeaders[i];
                    }
                }
                
		connection.responseHttpCode = 200;
		if(connection.req.headers['x-forwarded-for'] != null)
		{
			var IPs = connection.req.headers['x-forwarded-for'].split(",");
			connection.remoteIP = IPs[0];	
		}
		
		// determine API or FILE
		var parsedURL = api.url.parse(connection.req.url, true);
		var pathParts = parsedURL.pathname.split("/");
		connection.requestMode = api.configData.rootEndpointType; // api or file
		connection.directModeAccess = false;
		if(pathParts.length > 0){
			if(pathParts[1] == api.configData.urlPathForActions){ 
				connection.requestMode = "api"; 
				connection.directModeAccess = true;
			}
			else if(pathParts[1] == api.configData.urlPathForFiles){ 
				connection.requestMode = "file"; 
				connection.directModeAccess = true;
			}
		}
		
		if(connection.requestMode == "api"){
			// parse GET (URL) variables
			fillParamsFromWebRequest(api, connection, parsedURL.query);
			if(connection.params.action === undefined){ 
				if(connection.directModeAccess == true){ connection.params.action = pathParts[2]; }
				else{ connection.params.action = pathParts[1]; }
			}
		
			// parse POST variables
			if (connection.req.method.toLowerCase() == 'post') {
				if(connection.req.headers['content-type'] == null && connection.req.headers['Content-Type'] == null){
					connection.error = "content-type is a required header for processing this form.";
					process.nextTick(function() { api.processAction(api, connection, api.webServer.respondToWebClient); });
				}else{
					var form = new api.formidable.IncomingForm();
				    form.parse(connection.req, function(err, fields, files) {
						if(err){
							api.log(err, "red");
							connection.error = "There was an error processign this form."
							process.nextTick(function() { api.processAction(api, connection, api.webServer.respondToWebClient); });
						}else{
					  		fillParamsFromWebRequest(api, connection, files);
					  		fillParamsFromWebRequest(api, connection, fields);
					  		process.nextTick(function() { api.processAction(api, connection, api.webServer.respondToWebClient); });
						}
				    });
				}
			}else{
				process.nextTick(function() { api.processAction(api, connection, api.webServer.respondToWebClient); });
			}
		}
		
		if(connection.requestMode == "file"){
			fillParamsFromWebRequest(api, connection, parsedURL.query);
			connection.params.action = "file";
			process.nextTick(function() { api.processAction(api, connection, api.webServer.respondToWebClient); });
		}
		
	}
	
	var fillParamsFromWebRequest = function(api, connection, varsHash){
		api.postVariables.forEach(function(postVar){
			if(varsHash[postVar] !== undefined && varsHash[postVar] != null){ 
				connection.params[postVar] = varsHash[postVar]; 
			}
		});
	}
	
	////////////////////////////////////////////////////////////////////////////
	// Response Prety-maker
	api.webServer.respondToWebClient = function(connection, cont){
		connection.response = connection.response || {};
					
		// serverInformation information
		connection.response.serverInformation = {};
		connection.response.serverInformation.serverName = api.configData.serverName;
		connection.response.serverInformation.apiVersion = api.configData.apiVersion;
				
		// requestorInformation
		connection.response.requestorInformation = {};
		connection.response.requestorInformation.remoteAddress = connection.remoteIP;
		if(connection.requestCounter != null){ connection.response.requestorInformation.RequestsRemaining = api.configData.apiRequestLimitPerHour - connection.requestCounter; }
		connection.response.requestorInformation.recievedParams = {};
		for(var k in connection.params){
			connection.response.requestorInformation.recievedParams[k] = connection.params[k] ;
		};
				
		// request timer
		connection.timer.stopTime = new Date().getTime();
		connection.response.serverInformation.requestDuration = connection.timer.stopTime - connection.timer.startTime;
		connection.response.serverInformation.currentTime = connection.timer.stopTime;
					
		// errors
		if(connection.error == false){ connection.response.error = "OK"; }
		else{ connection.response.error = connection.error; }
		
		process.nextTick(function() {
			if(cont != false){
				var stringResponse = "";
				if(typeof connection.params.outputType == "string"){
					if(connection.params.outputType.toLowerCase() == "xml"){
						stringResponse = api.data2xml('XML', connection.response);
					}else{
						stringResponse = JSON.stringify(connection.response);	
					}
				}else{
					stringResponse = JSON.stringify(connection.response);
				}
			
				if(connection.params.callback != null){
					connection.responseHeaders['Content-Type'] = "application/javascript";
					stringResponse = connection.params.callback + "(" + stringResponse + ");";
				}
			
				connection.res.writeHead(connection.responseHttpCode, connection.responseHeaders);
				connection.res.end(stringResponse);
			}
			if(api.configData.logRequests){api.log(" > web request from " + connection.remoteIP + " | responded in : " + connection.response.serverInformation.requestDuration + "ms", "grey");}
		});
	};
	
	////////////////////////////////////////////////////////////////////////////
	// Go server!
	api.webServer.webApp.on("error", function(e){
		api.log("Cannot start web server @ port " + api.configData.webServerPort + "; Exiting.", ["red", "bold"]);
		api.log(e, "red");
		process.exit();
	});
	
	if(api.configData.secureWebServer.enable){
		api.webServer.secureWebApp.on("error", function(e){
			api.log("Cannot start secure web server @ port " + api.configData.secureWebServer.port + "; Exiting.", ["red", "bold"]);
			api.log(e, "red");
			process.exit();
		});
	}
	
	api.webServer.webApp.listen(api.configData.webServerPort, "0.0.0.0", function(){
		if(api.configData.secureWebServer.enable){
			api.webServer.secureWebApp.listen(api.configData.secureWebServer.port, "0.0.0.0", function(){
				next();
			});
		}else{
			next();
		}
	});
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebServer = initWebServer;