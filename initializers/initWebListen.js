////////////////////////////////////////////////////////////////////////////
// Web Request Processing

var initWebListen = function(api, next)
{
	api.webApp.listen(api.configData.webServerPort);
	api.webApp.use(api.expressServer.bodyParser());
	api.webApp.all('/*', function(req, res, next){
		api.stats.numberOfWebRequests = api.stats.numberOfWebRequests + 1;
		
		var connection = {};
		
		connection.type = "web";
		connection.timer = {};
		connection.timer.startTime = new Date().getTime();
		connection.req = req;
		connection.res = res;
		connection.response = {}; // the data returned from the API
		connection.error = false; 	// errors and requst state
		connection.remoteIP = connection.req.connection.remoteAddress;
		connection.contentType = "application/json";
		connection.res.header("X-Powered-By",api.configData.serverName);
		if(connection.req.headers['x-forwarded-for'] != null)
		{
			connection.remoteIP = connection.req.headers['x-forwarded-for'];	
		}
		
		connection.params = {};
		api.postVariables.forEach(function(postVar){
			connection.params[postVar] = connection.req.param(postVar);
			if (connection.params[postVar] === undefined){ connection.params[postVar] = connection.req.cookies[postVar]; }
		});
		
		if(connection.params["action"] == undefined){
			connection.params["action"] = connection.req.params[0].split("/")[0];
		}
		if(connection.req.form){
			if (connection.req.body == null || api.utils.hashLength(connection.req.body) == 0){
				connection.req.form.complete(function(err, fields, files){
					api.postVariables.forEach(function(postVar){
						if(fields[postVar] != null && fields[postVar].length > 0){ connection.params[postVar] = fields[postVar]; }
					});
					connection.req.files = files;
					process.nextTick(function() { api.processAction(api, connection, api.respondToWebClient); });
				});
			}else{
					api.postVariables.forEach(function(postVar){ 
					if(connection.req.body[postVar] != null && connection.req.body[postVar].length > 0){ connection.params[postVar] = connection.req.body[postVar]; }
				});
				process.nextTick(function() { api.processAction(api, connection, api.respondToWebClient); });
			}
		}else{
			process.nextTick(function() { api.processAction(api, connection, api.respondToWebClient); });
		}
	});
	
	api.respondToWebClient = function(connection, cont){
		if(cont != false)
		{
			var response = api.buildWebResponse(connection);
	  		try{
	  			connection.res.header('Content-Type', connection.contentType);
				process.nextTick(function() { connection.res.send(response); });
			}catch(e)
			{
				
			}
			// if(api.configData.logRequests){api.log(" > web request from " + connection.remoteIP + " | response: " + JSON.stringify(response), "grey");}
			if(api.configData.logRequests){api.log(" > web request from " + connection.remoteIP + " | responded in : " + connection.response.serverInformation.requestDuration + "ms", "grey");}
		}
		process.nextTick(function() { api.logAction(api, connection); });
	};
	
	api.buildWebResponse = function(connection)
	{	
		connection.response = connection.response || {};
			
		// serverInformation information
		connection.response.serverInformation = {};
		connection.response.serverInformation.serverName = this.configData.serverName;
		connection.response.serverInformation.apiVerson = this.configData.apiVerson;
		
		// requestorInformation
		connection.response.requestorInformation = {};
		connection.response.requestorInformation.remoteAddress = connection.remoteIP;
		connection.response.requestorInformation.RequestsRemaining = this.configData.apiRequestLimitPerHour - connection.requestCounter;
		connection.response.requestorInformation.recievedParams = {};
		for(var k in connection.params){
			if(connection.params[k] != undefined){
				connection.response.requestorInformation.recievedParams[k] = connection.params[k] ;
			}
		};
		
		// request timer
		connection.timer.stopTime = new Date().getTime();
		connection.response.serverInformation.requestDuration = connection.timer.stopTime - connection.timer.startTime;
			
		// errors
		if(connection.error == false){
			connection.response.error = "OK";
		}
		else{
			connection.response.error = connection.error;
		}
			
		if(connection.params.callback != null){
			connection.contentType = "application/javascript";
			return connection.params.callback + "(" + JSON.stringify(connection.response) + ");";
		}
		
		return JSON.stringify(connection.response);
	};
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebListen = initWebListen;