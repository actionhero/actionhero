////////////////////////////////////////////////////////////////////////////
// Web Request Processing

var initWebServer = function(api, next)
{
	if(api.configData.httpServer.enable != true && api.configData.httpsServer.enable != true){
		next();
	}else{
		api.webServer = {};
		api.webServer.numberOfLocalWebRequests = 0;
		
		////////////////////////////////////////////////////////////////////////////
		// server
		if(api.configData.httpServer.enable == true){
			api.webServer.webApp = api.http.createServer(function (req, res) {
				handleRequest(req, res);
			});
		}
		
		if(api.configData.httpsServer.enable == true){
			var key = api.fs.readFileSync(api.configData.httpsServer.keyFile);
			var cert = api.fs.readFileSync(api.configData.httpsServer.certFile);
			api.webServer.secureWebApp = api.https.createServer({key: key, cert: cert}, function (req, res) {
				handleRequest(req, res);
			});
		}
		
		function handleRequest(req, res){
			api.stats.incrament(api, "numberOfWebRequests");
			api.webServer.numberOfLocalWebRequests++;
			
			var connection = {};

			connection.type = "web";
			connection.timer = {};
			connection.timer.startTime = new Date().getTime();
			connection.req = req;
			connection.res = res;
			connection.params = {}; 
			connection.method = req.method;
			connection.response = {}; // the data returned from the API
			connection.error = false; 	// errors and requst state
			connection.remoteIP = connection.req.connection.remoteAddress;
			connection.responseHeaders = {
				'Content-Type': "application/json",
				"X-Powered-By": api.configData.general.serverName
			};
	                
			if(typeof(api.configData.commonWeb.httpHeaders) != 'undefined'){
				for(var i in api.configData.commonWeb.httpHeaders){
					connection.responseHeaders[i] = api.configData.commonWeb.httpHeaders[i];
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
			connection.requestMode = api.configData.commonWeb.rootEndpointType; // api or file
			connection.directModeAccess = false;
			if(pathParts.length > 0){
				if(pathParts[1] == api.configData.commonWeb.urlPathForActions){ 
					connection.requestMode = api.configData.commonWeb.urlPathForActions; 
					connection.directModeAccess = true;
				}
				else if(pathParts[1] == api.configData.commonWeb.urlPathForFiles){ 
					connection.requestMode = api.configData.commonWeb.urlPathForFiles; 
					connection.directModeAccess = true;
				}
			}
			
			if(connection.requestMode == api.configData.commonWeb.urlPathForActions){
				// parse GET (URL) variables
				fillParamsFromWebRequest(api, connection, parsedURL.query);
				if(connection.params.action === undefined){ 
					if(connection.directModeAccess == true){ connection.params.action = pathParts[2]; }
					else{ connection.params.action = pathParts[1]; }
				}
			
				// parse POST variables
				if (connection.req.method.toLowerCase() == 'post') {
					if(connection.req.headers['content-type'] == null && connection.req.headers['Content-Type'] == null){
						// if no form content-type, treat like GET
						fillParamsFromWebRequest(api, connection, parsedURL.query);
						if(connection.params.action === undefined){ 
							if(connection.directModeAccess == true){ connection.params.action = pathParts[2]; }
							else{ connection.params.action = pathParts[1]; }
						}
						process.nextTick(function() { api.processAction(api, connection, null, api.webServer.respondToWebClient); });
					}else{
						var form = new api.formidable.IncomingForm();
					    form.parse(connection.req, function(err, fields, files) {
							if(err){
								api.log(err, "red");
								connection.error = "There was an error processign this form."
								process.nextTick(function() { api.processAction(api, connection, null, api.webServer.respondToWebClient); });
							}else{
						  		fillParamsFromWebRequest(api, connection, files);
						  		fillParamsFromWebRequest(api, connection, fields);
						  		process.nextTick(function() { api.processAction(api, connection, null, api.webServer.respondToWebClient); });
							}
					    });
					}
				}else{
					process.nextTick(function() { api.processAction(api, connection, null, api.webServer.respondToWebClient); });
				}
			}
			
			if(connection.requestMode == api.configData.commonWeb.urlPathForFiles){
				fillParamsFromWebRequest(api, connection, parsedURL.query);
				connection.params.action = "file";
				process.nextTick(function() { api.processAction(api, connection, null, api.webServer.respondToWebClient); });
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
			connection.response.serverInformation.serverName = api.configData.general.serverName;
			connection.response.serverInformation.apiVersion = api.configData.general.apiVersion;
					
			// requestorInformation
			connection.response.requestorInformation = {};
			connection.response.requestorInformation.remoteAddress = connection.remoteIP;
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
				if(api.configData.log.logRequests){
					if(connection.req.headers.host == null){ connection.req.headers.host = "localhost"; }
					var full_url = connection.req.headers.host + connection.req.url;
					if(connection.action != null && connection.action != "file"){
						api.logJSON({
							label: "action @ web",
							to: connection.remoteIP,
							action: connection.action,
							request: full_url,
							params: JSON.stringify(connection.params),
							duration: connection.response.serverInformation.requestDuration
						});
					}
				}
			});
		};
		
		////////////////////////////////////////////////////////////////////////////
		// Go servers!
		var serversToStart = 0;

		if(api.configData.httpServer.enable){
			api.webServer.webApp.on("error", function(e){
				api.log("Cannot start web server @ " + api.configData.httpServer.bindIP + ":" + api.configData.webServerPort + "; Exiting.", ["red", "bold"]);
				api.log(e, "red");
				process.exit();
			});
			serversToStart++;
			api.webServer.webApp.listen(api.configData.httpServer.port, api.configData.httpServer.bindIP, function(){
				api.log("http server listening on " + api.configData.httpServer.bindIP + ":" + api.configData.httpServer.port, "green");
				serversToStart--;
				if(serversToStart == 0){ next(); }
			});
		}
		
		if(api.configData.httpsServer.enable){
			api.webServer.secureWebApp.on("error", function(e){
				api.log("Cannot start secure web server @ " + api.configData.httpsServer.bindIP + ":" + api.configData.secureWebServer.port + "; Exiting.", ["red", "bold"]);
				api.log(e, "red");
				process.exit();
			});
			serversToStart++;
			api.webServer.secureWebApp.listen(api.configData.httpsServer.port, api.configData.httpsServer.bindIP, function(){
				api.log("https server listening on " + api.configData.httpsServer.bindIP + ":" + api.configData.httpsServer.port, "green");
				serversToStart--;
				if(serversToStart == 0){ next(); }
			});
		}
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebServer = initWebServer;