////////////////////////////////////////////////////////////////////////////
// cache

var initFileServer = function(api, next){

	api.fileServer = {}

	if(api.configData.commonWeb.flatFileCacheDuration == null){
		api.configData.commonWeb.flatFileCacheDuration = 0;
	}
	if(api.configData.commonWeb.directoryFileType == null){
		api.configData.commonWeb.directoryFileType = "index.html";
	}

	api.sendFile = function(api, connection, next){
		var fileName = "";

		// determine the filename
		if((connection.params.fileName == null || typeof connection.params.fileName == "undefined") && connection.type == "web"){
			var parsedURL = api.url.parse(connection.req.url);
			var parts = parsedURL.pathname.split("/");
			parts.shift();
			if (connection.directModeAccess == true){ parts.shift(); }
			if (connection.requestMode == "api"){ parts.shift(); }
			for (var i in parts){
				if (fileName != ""){ fileName += "/"; }
				fileName += parts[i];
			}
		}else{
			connection.fileRequestStartTime = new Date().getTime();
			api.utils.requiredParamChecker(api, connection, ["fileName"]);
			if(connection.error === null){ fileName = connection.params.fileName; }
		}

		fileName = api.path.normalize(api.configData.general.flatFileDirectory  + "/" + fileName);
		api.fileServer.checkPublic(api, fileName, connection, next);	
	};

	api.fileServer.checkPublic = function(api, fileName, connection, next){
		if(fileName.indexOf(api.path.normalize(api.configData.general.flatFileDirectory)) === 0 && connection.error == null){
			api.fileServer.checkExistance(api, fileName, connection, next);
		}else{
			api.fileServer.sendFileNotFound(api, connection, next);
		}
	}

	api.fileServer.checkExistance = function(api, fileName, connection, next){
		api.fs.stat(fileName, function(err, stats){
			if(err != null){
				api.fileServer.sendFileNotFound(api, connection, next);
			}else{
				if(stats.isDirectory()){
					fileName += "/";
					var indexPage = api.path.normalize(fileName + api.configData.commonWeb.directoryFileType);
					api.fileServer.checkExistance(api, indexPage, connection, next);
				}else if(stats.isSymbolicLink()){
					api.fs.readLink(fileName, function(err, truePath){
						if(err != null){
							api.fileServer.sendFileNotFound(api, connection, next);
						}else{
							truePath = api.path.normalize(truePath);
							api.fileServer.checkExistance(api, truePath, connection, next);
						}
					});
				}else if(stats.isFile()){
					api.fileServer.sendFile(api, fileName, connection, next);
				}else{
					api.fileServer.sendFileNotFound(api, connection, next);
				}
			}
		});
	}

	api.fileServer.sendFile = function(api, file, connection, next){
		var fileSize = 0;
		var fileStream = api.fs.createReadStream(file, {
		  'flags': 'r',
		}).addListener( "data", function(chunk) {
		  fileSize = fileSize + chunk.length;
		}).addListener( "close",function() {
		  api.fileServer.logRequest(api, file, connection, fileSize, true);
			process.nextTick(function() { next(connection, false); });
		});

		if(connection.type == "web"){
			connection.responseHeaders.push(['Content-Type', api.mime.lookup(file)]);
			connection.responseHeaders.push(['Expires', new Date(new Date().getTime() + api.configData.commonWeb.flatFileCacheDuration * 1000).toUTCString()]);
			connection.responseHeaders.push(['Cache-Control', "max-age=" + api.configData.commonWeb.flatFileCacheDuration + ", must-revalidate"]);
			api.webServer.cleanHeaders(api, connection);
			connection.res.writeHead(200, connection.responseHeaders);
			fileStream.pipe(connection.res, {end: true});
		}else{
			try { 
				fileStream.pipe(connection._original_connection, {end: false});
				connection._original_connection.write("\r\n"); 
			}catch(e){
				try{
					fileStream.pipe(connection, {end: false});
					connection.write("\r\n"); 
				}catch(e){
					api.log(e, "red");
				}
			}
		}
	}

	api.fileServer.sendFileNotFound = function(api, connection, next){
		if(connection.type == "web"){
			connection.responseHeaders.push(['Content-Type', 'text/html']);
			api.webServer.cleanHeaders(api, connection);
			connection.res.writeHead(404, connection.responseHeaders);
			connection.res.end(api.configData.general.flatFileNotFoundMessage);
			next(connection, false);
		}else{
			if(connection.error === null){
				connection.error = new Error("The file, "+connection.params.fileName+", is not found.");
			}
			api.fileServer.logRequest(api, '{404: not found}', connection, null, false);
			next(connection, true);
		}
	}

	api.fileServer.logRequest = function(api, file, connection, length, success){
		if(api.configData.log.logRequests){
			var full_url = null;
			var duration = null;
			var type = connection.type;
			if(connection.type == "web" && connection.req.headers != null){
				full_url = connection.req.headers.host + connection.req.url
				duration = new Date().getTime() - connection.timer.startTime;
			}else{
				full_url = connection.params.fileName;
				duration = new Date().getTime() - connection.fileRequestStartTime;
			}
			api.logJSON({
				label: "file @ " + type,
				to: connection.remoteIP,
				file: file,
				request: full_url,
				size: length,
				duration: duration,
				success: success
			}, "grey");
		}
	}

	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initFileServer = initFileServer;
