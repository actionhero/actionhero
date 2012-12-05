////////////////////////////////////////////////////////////////////////////
// Web Request Processing

var initWebServer = function(api, next)
{
	if(api.configData.httpServer.enable != true){
		next();
	}else{
		api.webServer = {};
		api.webServer.numberOfLocalWebRequests = 0;
		api.webServer.roomCookieKey = "__room";
		api.webServer.clientClearTimers = [];
		if(api.redis.enable != true){ api.webServer.webChatMessages = {}; }
		
		////////////////////////////////////////////////////////////////////////////
		// server
		if(api.configData.httpServer.secure == false){
			api.webServer.server = api.http.createServer(function (req, res) {
				api.webServer.handleRequest(req, res);
			});
		}else{
			var key = api.fs.readFileSync(api.configData.httpServer.keyFile);
			var cert = api.fs.readFileSync(api.configData.httpServer.certFile);
			api.webServer.server = api.https.createServer({key: key, cert: cert}, function (req, res) {
				api.webServer.handleRequest(req, res);
			});
		}

		api.webServer.handleRequest = function(req, res){
			api.stats.increment(api, "numberOfWebRequests");
			api.webServer.numberOfLocalWebRequests++;

			api.bf.fingerprint(req, api.configData.commonWeb.fingerprintOptions, function(fingerprint, elementHash, cookieHash){
				var responseHeaders = [];
				for(var i in cookieHash){
					responseHeaders.push([i, cookieHash[i]]);
				}
				responseHeaders.push(['Content-Type', "application/json"]);
				responseHeaders.push(['X-Powered-By', api.configData.general.serverName]);
				var connection = {
					id: fingerprint,
					params: {},
					timer: { startTime: new Date().getTime() },
					req: req,
					res: res,
					method: req.method,
					responseHeaders: responseHeaders,
					responseHttpCode: 200,
					cookies: api.utils.parseCookies(req),
				}

				if(connection.cookies[api.webServer.roomCookieKey] != null){
					connection.room = connection.cookies[api.webServer.roomCookieKey];
				}
				api.utils.setupConnection(api, connection, "web", req.connection.remotePort, req.connection.remoteAddress);

				if(typeof(api.configData.commonWeb.httpHeaders) != 'undefined'){
					for(var i in api.configData.commonWeb.httpHeaders){
						connection.responseHeaders.push([i, api.configData.commonWeb.httpHeaders[i]]);
					}
				}
		                
				if(connection.req.headers['x-forwarded-for'] != null){
					var IPs = connection.req.headers['x-forwarded-for'].split(",");
					connection.remoteIP = IPs[0];	
				}
				
				// determine API or FILE
				connection.parsedURL = api.url.parse(connection.req.url, true);
				var pathParts = connection.parsedURL.pathname.split("/");
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
					fillParamsFromWebRequest(api, connection, connection.parsedURL.query);
					if(connection.params.action === undefined){ 
						connection.actionSetBy = "url";
						if(connection.directModeAccess == true){ connection.params.action = pathParts[2]; }
						else{ connection.params.action = pathParts[1]; }
					}else{
						connection.actionSetBy = "queryParam";
					}
				
					// parse POST variables
					if (connection.req.method.toLowerCase() == 'post') {
						if(connection.req.headers['content-type'] == null && connection.req.headers['Content-Type'] == null){
							// if no form content-type, treat like GET
							fillParamsFromWebRequest(api, connection, connection.parsedURL.query);
							if(connection.params.action === undefined){ 
								connection.actionSetBy = "url";
								if(connection.directModeAccess == true){ connection.params.action = pathParts[2]; }
								else{ connection.params.action = pathParts[1]; }
							}
							process.nextTick(function() { api.processAction(api, connection, null, api.webServer.respondToWebClient); });
						}else{
							var form = new api.formidable.IncomingForm();
						    form.parse(connection.req, function(err, fields, files) {
								if(err){
									api.log(err, "red");
									connection.error = new Error("There was an error processign this form.");
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
					fillParamsFromWebRequest(api, connection, connection.parsedURL.query);
					connection.params.action = "file";
					process.nextTick(function() { api.processAction(api, connection, null, api.webServer.respondToWebClient); });
				}	
			});
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
		api.webServer.respondToWebClient = function(connection, toRender){
			connection.response = connection.response || {};
						
			// serverInformation information
			connection.response.serverInformation = {};
			connection.response.serverInformation.serverName = api.configData.general.serverName;
			connection.response.serverInformation.apiVersion = api.configData.general.apiVersion;
					
			// requestorInformation
			connection.response.requestorInformation = {};
			connection.response.requestorInformation.id = connection.public.id;
			connection.response.requestorInformation.remoteAddress = connection.remoteIP;
			connection.response.requestorInformation.receivedParams = {};
			for(var k in connection.params){
				connection.response.requestorInformation.receivedParams[k] = connection.params[k] ;
			};
					
			// request timer
			connection.timer.stopTime = new Date().getTime();
			connection.response.serverInformation.requestDuration = connection.timer.stopTime - connection.timer.startTime;
			connection.response.serverInformation.currentTime = connection.timer.stopTime;
						
			// errors
			if(connection.error != null){
				connection.response.error = String(connection.error); 
				if(api.configData.commonWeb.returnErrorCodes == true && connection.responseHttpCode == 200){
					connection.responseHttpCode = 400;
				}
			}
			
			process.nextTick(function() {
				if(toRender != false){
					var stringResponse = "";
					if(typeof connection.params.outputType == "string"){
						if(connection.params.outputType.toLowerCase() == "xml"){
							stringResponse = api.data2xml()('XML', connection.response);
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
					api.webServer.cleanHeaders(api, connection);
					connection.res.writeHead(parseInt(connection.responseHttpCode), connection.responseHeaders);
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
				if(api.configData.commonWeb.httpClientMessageTTL == null){
					api.utils.destroyConnection(api, connection);
					if(api.redis.enable != true){ delete api.webServer.webChatMessages[connection.public.id]; }
				}else{
					// if enabled, persist the connection object for message queueing
					if(api.webServer.clientClearTimers[connection.public.id] != null){
						clearTimeout(api.webServer.clientClearTimers[connection.public.id]);
					}
					api.webServer.clientClearTimers[connection.public.id] = setTimeout(function(connection){
						api.utils.destroyConnection(api, connection);
						delete api.webServer.clientClearTimers[connection.public.id];
						if(api.redis.enable != true){ delete api.webServer.webChatMessages[connection.public.id]; }
					}, api.configData.commonWeb.httpClientMessageTTL, connection);
				}
			});
		};

		api.webServer.stopTimers = function(api){
			for(var i in api.webServer.clientClearTimers){ 
				clearTimeout(api.webServer.clientClearTimers[i]); 
			}
		}

		api.webServer._teardown = function(api, next){
			api.webServer.stopTimers(api);
			if(api.configData.webSockets.enable != true){
				api.webServer.server.close();
			}
			next();
		}

		////////////////////////////////////////////////////////////////////////////
		// Helpers to ensure uniqueness on response headers
		api.webServer.cleanHeaders = function(api, connection){
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

		////////////////////////////////////////////////////////////////////////////
		// Helpers to expand chat functionality to http(s) clients

		api.webServer.storeWebChatMessage = function(api, connection, messagePayload, next){
			if(api.redis.enable === true){
				var rediskey = 'actionHero:webMessages:' + connection.public.id;
				api.redis.client.rpush(rediskey, JSON.stringify(messagePayload), function(){
					api.redis.client.pexpire(rediskey, api.configData.commonWeb.httpClientMessageTTL, function(){
						if(typeof next == "function"){ next(); }
					});
				});
			}else{
				// add message
				if(api.webServer.webChatMessages[connection.public.id] == null){ api.webServer.webChatMessages[connection.public.id] = []; }
				var store = api.webServer.webChatMessages[connection.public.id];
				store.push({
					messagePayload: messagePayload,
					expiresAt: new Date().getTime() + api.configData.commonWeb.httpClientMessageTTL, 
				});
				if(typeof next == "function"){ next(); }
			}
		}

		api.webServer.changeChatRoom = function(api, connection, next){
			if(connection.params.room != null){
				connection.room = connection.params.room;
				api.chatRoom.roomRemoveMember(api, connection, function(err, wasRemoved){
					api.chatRoom.roomAddMember(api, connection, function(err, wasAdded){
						connection.responseHeaders.push(['Set-Cookie', api.webServer.roomCookieKey + "=" + connection.params.room]);
						connection.response.room = connection.room;
						if(typeof next == "function"){ next() };
					});
				});
			}else{
				connection.error = new Error("room is required to use the roomChange method");
				if(typeof next == "function"){ next() };
			}
		}

		api.webServer.getWebChatMessage = function(api, connection, next){
			if(api.redis.enable === true){
				var rediskey = 'actionHero:webMessages:' + connection.public.id;
				api.redis.client.lpop(rediskey, function(err, message){
					if(message != null){
						var parsedMessage = JSON.parse(message);
						if(parsedMessage == []){ parsedMessage = null; }
						next(null, parsedMessage);
					}else{
						next(null, null);
					}
				});
			}else{
				var store = api.webServer.webChatMessages[connection.public.id];
				if(store == null){
					next(null, null);
				}else{
					var message = store.splice(0,1);
					next(null, message);
				}
			}
		}
		
		////////////////////////////////////////////////////////////////////////////
		// Go server!
		api.webServer.server.on("error", function(e){
			api.log("Cannot start web server @ " + api.configData.httpServer.bindIP + ":" + api.configData.httpServer.port + "; Exiting.", ["red", "bold"]);
			api.log(e, "red");
			process.exit();
		});
		api.webServer.server.listen(api.configData.httpServer.port, api.configData.httpServer.bindIP, function(){
			api.webServer.server.addListener("connection",function(stream) { stream.setTimeout(10000); });
			api.log("web server listening on " + api.configData.httpServer.bindIP + ":" + api.configData.httpServer.port, "green");
			next();
		});

	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebServer = initWebServer;