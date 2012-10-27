////////////////////////////////////////////////////////////////////////////
// Socket Request Processing

var initSocketServer = function(api, next){
	if(api.configData.tcpServer.enable != true){
		next()
	}else{
		api.socketServer = {};
		api.socketServer.socketDataString = "";
		api.socketServer.numberOfLocalSocketRequests = 0;
		
		////////////////////////////////////////////////////////////////////////////
		// server
		api.socketServer.server = api.net.createServer(function (connection) {
			api.stats.incrament(api, "numberOfSocketRequests");
			api.socketServer.numberOfLocalSocketRequests++;

			api.utils.setupConnection(api, connection, "socket", connection.remotePort, connection.remoteAddress);
			connection.setEncoding("utf8");
			connection.responsesWaitingCount = 0;

			connection.on("connect", function () {
				api.stats.incrament(api, "numberOfActiveSocketClients");
				if(api.configData.log.logRequests){
					api.logJSON({
						label: "connect @ socket",
						to: connection.remoteIP,
					});
				}
				process.nextTick(function(){
					api.socketServer.sendSocketMessage(connection, {welcome: api.configData.general.welcomeMessage, room: connection.room, context: "api"});
				})
			});
			
			connection.on("data", function (chunk) {
				api.socketServer.socketDataString += chunk.toString('utf8');
				var index, line;
				while((index = api.socketServer.socketDataString.indexOf('\r\n')) > -1) {
					var line = api.socketServer.socketDataString.slice(0, index);
					connection.lastLine = line;
					api.socketServer.socketDataString = api.socketServer.socketDataString.slice(index + 2);
					if(line.length > 0) {
						connection.messageCount++; // increment at the start of the requset so that responses can be caught in order on the client
						var line = line.replace(/(\r\n|\n|\r)/gm,"");
						var words = line.split(" ");
						if(line.indexOf("\u0004") > -1){ } // trap for break chars; do nothing
						else if(words[0] == "quit" || words[0] == "exit" || words[0] == "close" ){
							try{ 
								if(api.configData.log.logRequests){
									api.logJSON({
										label: "quit @ socket",
										to: connection.remoteIP,
									});
								}
								api.socketServer.sendSocketMessage(connection, {status: "Bye!", context: "response"}); 
								connection.end();
							}catch(e){ }
						}else if(words[0] == "paramAdd"){
							var parts = words[1].split("=");
							if(parts[0] != null){
								connection.params[parts[0]] = parts[1];
								api.socketServer.sendSocketMessage(connection, {status: "OK", context: "response"});
							}else{
								api.socketServer.sendSocketMessage(connection, {status: "Cannot set null", context: "response"});
							}
							if(api.configData.log.logRequests){
								api.logJSON({
									label: "paramAdd @ socket",
									to: connection.remoteIP,
									params: JSON.stringify(words),
								}, "grey");
							}
						}else if(words[0] == "paramDelete"){
							connection.params[words[1]] = null;
							api.socketServer.sendSocketMessage(connection, {status: "OK", context: "response"});
							if(api.configData.log.logRequests){
								api.logJSON({
									label: "paramDelete @ socket",
									to: connection.remoteIP,
									params: JSON.stringify(words),
								}, "grey");
							}
						}else if(words[0] == "paramView"){
							var q = words[1];
							var params = {}
							params[q] = connection.params[q];
							api.socketServer.sendSocketMessage(connection, {context: "response", params: params});
							if(api.configData.log.logRequests){
								api.logJSON({
									label: "paramView @ socket",
									to: connection.remoteIP,
									params: JSON.stringify(words),
								}, "grey");
							}
						}else if(words[0] == "paramsView"){
							api.socketServer.sendSocketMessage(connection, {context: "response", params: connection.params});
							if(api.configData.log.logRequests){
								api.logJSON({
									label: "paramsView @ socket",
									to: connection.remoteIP,
									params: JSON.stringify(words),
								}, "grey");
							}
						}else if(words[0] == "paramsDelete"){
							connection.params = {};
							api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK"});
							if(api.configData.log.logRequests){
								api.logJSON({
									label: "paramsDelete @ socket",
									to: connection.remoteIP,
									params: JSON.stringify(words),
								}, "grey");
							}
						}else if(words[0] == "roomChange"){
							api.chatRoom.roomRemoveMember(api, connection, function(){
								connection.room = words[1];
								api.chatRoom.roomAddMember(api, connection);
								api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room});
								if(api.configData.log.logRequests){
									api.logJSON({
										label: "roomChange @ socket",
										to: connection.remoteIP,
										params: JSON.stringify(words),
									}, "grey");
								}
							});
						}else if(words[0] == "roomView"){
							api.chatRoom.socketRoomStatus(api, connection.room, function(roomStatus){
								api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room, roomStatus: roomStatus});
								if(api.configData.log.logRequests){
									api.logJSON({
										label: "roomView @ socket",
										to: connection.remoteIP,
										params: JSON.stringify(words),
									}, "grey");
								}
							});		
						}else if(words[0] == "detailsView"){
							var details = {};
							details.params = connection.params;
							details.public = connection.public;
							details.room = connection.room;
							api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK", details: details});
							if(api.configData.log.logRequests){
								api.logJSON({
									label: "detailsView @ socket",
									to: connection.remoteIP,
									params: JSON.stringify(words),
								}, "grey");
							}
						}else if(words[0] == "say"){
							var message = line.substr(4);
							api.chatRoom.socketRoomBroadcast(api, connection, message);
							api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK"});
							if(api.configData.log.logRequests){
								api.logJSON({
									label: "say @ socket",
									to: connection.remoteIP,
									params: JSON.stringify(words),
								}, "grey");
							}
						}else{
							connection.error = false;
							connection.actionStartTime = new Date().getTime();
							connection.response = {};
							connection.response.context = "response";
							try{
								var local_params = {};
								var request_hash = JSON.parse(line);
								if(request_hash["params"] != null){
									local_params = request_hash["params"];
								}
								if(request_hash["action"] != null){
									local_params["action"] = request_hash["action"];
								}
							}catch(e){
								connection.params["action"] = words[0];
							}
							connection.responsesWaitingCount++;

							// actions should be run using params set at the begining of excecution
							// build a proxy connection so that param changes during execution will not break this
							var proxy_connection = {
								_original_connection: connection,
							}
							for (var i in connection) {
								if (connection.hasOwnProperty(i)) {
									proxy_connection[i] = connection[i];
								}
							}
							if(local_params != null && api.utils.hashLength(local_params) > 0){
								proxy_connection.params = local_params;
							}

							api.processAction(api, proxy_connection, proxy_connection.messageCount, function(proxy_connection, cont){
								connection = proxy_connection._original_connection;
								connection.response = proxy_connection.response;
								connection.error = proxy_connection.error;
								connection.responsesWaitingCount--;
								var delta = new Date().getTime() - connection.actionStartTime;
								if(api.configData.log.logRequests && connection.action != "file"){
									api.logJSON({
										label: "action @ socket",
										to: connection.remoteIP,
										action: connection.action,
										params: JSON.stringify(connection.params),
										duration: delta,
									});
								}
								api.socketServer.respondToSocketClient(connection, cont);
							});
						}
					}
				}
			});

			connection.on("end", function () {				
				api.stats.incrament(api, "numberOfActiveSocketClients", -1);
				api.utils.destroyConnection(api, connection);
				try{ 
					connection.end(); 
				}catch(e){ }
				// if(api.configData.log.logRequests){api.log(" > socket connection " + connection.remoteIP + " disconnected", "white");}
				if(api.configData.log.logRequests){
					api.logJSON({
						label: "disconnect @ socket",
						to: connection.remoteIP,
					});
				}
			});

			connection.on("error", function(e){
				api.log("socket error: " + e, "red");
				connection.end();
			});

		});

		////////////////////////////////////////////////////////////////////////////
		// action response helper
		api.socketServer.respondToSocketClient = function(connection, cont){
			if(cont != false)
			{
				if(connection.error == false){
					connection.response.error = connection.error;
					if(connection.response == {}){
						connection.response = {status: "OK"};
					}
					api.socketServer.sendSocketMessage(connection, connection.response);
				}else{
					if(connection.response.error == null){
						connection.response.error = connection.error;
					}
					api.socketServer.sendSocketMessage(connection, connection.response);
				}
			}
		}
		
		////////////////////////////////////////////////////////////////////////////
		//message helper
		api.socketServer.sendSocketMessage = function(connection, message){
			try{
				if(connection.respondingTo != null){
					message.messageCount = connection.respondingTo;
					connection.respondingTo = null;
				}else if(message.context == "response"){
					message.messageCount = connection.messageCount;
				}
				connection.write(JSON.stringify(message) + "\r\n"); 
			}catch(e){
				api.log("socket write error: "+e, "red");
			}
		}

		////////////////////////////////////////////////////////////////////////////
		//shutdown helpers
		api.socketServer.gracefulShutdown = function(api, next, alreadyShutdown){
			if(alreadyShutdown == null){alreadyShutdown = false;}
			if(alreadyShutdown == false){
				api.socketServer.server.close();
				alreadyShutdown = true;
			}
			var pendingConnections = 0;
			for(var i in api.connections){
				var connection = api.connections[i];
				if(connection.type == "socket"){
					if (connection.responsesWaitingCount == 0){
						api.connections[i].end("Server going down NOW\r\nBye!\r\n");
					}else{
						pendingConnections++;
					}
				}
			}
			if(pendingConnections > 0){
				api.log("[socket] waiting on shutdown, there are still " + pendingConnections + " connected clients waiting on a response");
				setTimeout(function(){
					api.socketServer.gracefulShutdown(api, next, alreadyShutdown);
				}, 3000);
			}else{
				next();
			}
		}
		
		////////////////////////////////////////////////////////////////////////////
		// listen
		api.socketServer.server.on("error", function(e){
			api.log("Cannot start socket server @ " + api.configData.tcpServer.bindIP + ":" + api.configData.tcpServer.port + "; Exiting.", ["red", "bold"]);
			api.log(e);
			process.exit();
		});
		
		api.socketServer.server.listen(api.configData.tcpServer.port, api.configData.tcpServer.bindIP, function(){
			api.log("tcp server listening on " + api.configData.tcpServer.bindIP + ":" + api.configData.tcpServer.port, "green");
			next();
		});
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initSocketServer = initSocketServer;