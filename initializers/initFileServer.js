////////////////////////////////////////////////////////////////////////////
// cache

var initFileServer = function(api, next){
	
	api.sendFile = function(api, connection, next){
		
		var fileName = "";
		if((connection.params.fileName == null || typeof connection.params.fileName == "undefined") && connection.req != null){
			var parsedURL = api.url.parse(connection.req.url);
			var parts = parsedURL.pathname.split("/");
			
			parts.shift();
			if (connection.directModeAccess == true){ parts.shift(); }
			if (connection.requestMode == "api"){ parts.shift(); }
			
			for (var i in parts){
				if (fileName != ""){ fileName += "/"; }
				fileName += parts[i];
			}
		}else if(connection.req == null){
			// socket connection
			api.utils.requiredParamChecker(api, connection, ["fileName"]);
			if(connection.error == false){ fileName = connection.params.fileName; }
		}else{
			fileName = connection.params.fileName;
		}
		if(connection.error == false){
			fileName = api.configData.general.flatFileDirectory + fileName;
			api.fs.exists(fileName, function(exists) {
				if(exists){
					var isPath = false
					if (api.path.extname(fileName) == "" || api.path.extname(fileName).indexOf("/") > -1){
						isPath = true;
					}
					if(isPath){
						var indexPage = fileName + "index.html";
				  		api.fs.exists(indexPage, function(indexExists) {
				  			if(indexExists){ sendFile(api, indexPage, connection, next); }
							else{ sendFileNotFound(api, connection, next); }
				  		});
					} else{ sendFile(api, fileName, connection, next); }
				}
				else{ sendFileNotFound(api, connection, next); }
			});
		}else{
			sendFileNotFound(api, connection, next); 
		}
	};

	var sendFile = function(api, file, connection, next){
		api.fs.readFile(file, function (err, data) {
			if(err){
				api.log("error reading: "+file, "red");
			}else{
				if(connection.req != null){
					connection.responseHeaders['Content-Type'] = api.mime.lookup(file);
					connection.responseHeaders['Cache-Control'] = "max-age=600, must-revalidate";
					connection.res.writeHead(200, connection.responseHeaders);
					connection.res.end(data);
				}else{
					try { 
						connection.write(data + "\r\n"); 
						connection.messageCount++;
					}catch(e){}
				}
				if(api.configData.log.logRequests){
					var full_url = null;
					var duration = null;
					var type = null;
					if(connection.req != null && connection.req.headers != null){
						full_url = connection.req.headers.host + connection.req.url
						duration = new Date().getTime() - connection.timer.startTime;
						type = "web";
					}else{
						type = "socket";
						full_url = type;
						duration = type;
					}
					api.logJSON({
						label: "file @ " + type,
						to: connection.remoteIP,
						file: file,
						request: full_url,
						size: data.length,
						duration: duration
					}, "grey");
				}
			}
			process.nextTick(function() { next(connection, false); });
		});
	}

	var sendFileNotFound = function(api, connection, next){
		if(connection.req != null){
			connection.responseHeaders['Content-Type'] = 'text/html';
			connection.res.writeHead(404, connection.responseHeaders);
			connection.res.end(api.configData.general.flatFileNotFoundMessage);
			next(connection, false);
		}else{
			if(connection.error == false){
				connection.error = "The file, "+connection.params.fileName+", is not found.";
			}
			next(connection, true);
		}
	}

	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initFileServer = initFileServer;
