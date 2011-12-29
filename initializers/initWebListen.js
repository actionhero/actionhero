////////////////////////////////////////////////////////////////////////////
// Web Request Processing

var initWebListen = function(api, next)
{
	api.webApp = api.http.createServer(function (req, res) {
		api.stats.numberOfWebRequests = api.stats.numberOfWebRequests + 1;
		
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
			"X-Powered-By": api.configData.serverName,
		};
		connection.responseHttpCode = 200;
		if(connection.req.headers['x-forwarded-for'] != null)
		{
			connection.remoteIP = connection.req.headers['x-forwarded-for'];	
		}
		
		// parse GET (URL) variables
		var parsedURL = api.url.parse(connection.req.url, true);
		fillParamsFromWebRequest(api, connection, parsedURL.query);
		if(connection.params.action === undefined){ connection.params.action = parsedURL.pathname.split("/")[1]; }
		
		// parse POST variables
		if (connection.req.method.toLowerCase() == 'post') {
			if(connection.req.headers['content-type'] == null && connection.req.headers['Content-Type'] == null){
				connection.error = "content-type is a required header for processing this form.";
				process.nextTick(function() { api.processAction(api, connection, api.respondToWebClient); });
			}else{
				var form = new api.formidable.IncomingForm();
			    form.parse(connection.req, function(err, fields, files) {
					if(err){
						api.log(err, "red");
						connection.error = "There was an error processign this form."
						process.nextTick(function() { api.processAction(api, connection, api.respondToWebClient); });
					}else{
				  		fillParamsFromWebRequest(api, connection, files);
				  		fillParamsFromWebRequest(api, connection, fields);
				  		process.nextTick(function() { api.processAction(api, connection, api.respondToWebClient); });
					}
			    });
			}
		}else{
			process.nextTick(function() { api.processAction(api, connection, api.respondToWebClient); });
		}		
	})
	
	// Go server!
	api.webApp.listen(api.configData.webServerPort, "0.0.0.0"); // listen on all bound addresses
	
	var fillParamsFromWebRequest = function(api, connection, varsHash){
		api.postVariables.forEach(function(postVar){
			if(varsHash[postVar] !== undefined && varsHash[postVar] != null){ 
				connection.params[postVar] = varsHash[postVar]; 
			}
		});
	}
	
	api.respondToWebClient = function(connection, cont){
		connection.response = connection.response || {};
					
		// serverInformation information
		connection.response.serverInformation = {};
		connection.response.serverInformation.serverName = api.configData.serverName;
		connection.response.serverInformation.apiVerson = api.configData.apiVerson;
				
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
					
		// errors
		if(connection.error == false){ connection.response.error = "OK"; }
		else{ connection.response.error = connection.error; }
		
		if(cont != false){
			var stringResponse = JSON.stringify(connection.response);		
			
			if(connection.params.callback != null){
				connection.responseHeaders['Content-Type'] = "application/javascript";
				stringResponse = connection.params.callback + "(" + stringResponse + ");";
			}
			
			connection.res.writeHead(connection.responseHttpCode, connection.responseHeaders);
			connection.res.end(stringResponse);
		}
		if(api.configData.logRequests){api.log(" > web request from " + connection.remoteIP + " | responded in : " + connection.response.serverInformation.requestDuration + "ms", "grey");}
		process.nextTick(function() { api.logAction(api, connection); });
	};

	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebListen = initWebListen;