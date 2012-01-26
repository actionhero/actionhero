////////////////////////////////////////////////////////////////////////////
// Socket Request Processing

var initSocketServer = function(api, next){
	api.socketServer = {};
	api.socketServer.connections = [];
	api.socketServer.socketDataString = "";
	api.socketServer.numberOfSocketRequests = 0;
	
	////////////////////////////////////////////////////////////////////////////
	// server
	api.socketServer.server = api.net.createServer(function (connection) {
		api.socketServer.numberOfSocketRequests = api.socketServer.numberOfSocketRequests + 1;
		
	  	connection.setEncoding("utf8");
	  	connection.type = "socket";
		connection.params = {};
		connection.remoteIP = connection.remoteAddress;
		connection.room = api.configData.defaultSocketRoom;
		connection.messageCount = 0;
		var md5 = api.crypto.createHash('md5');
		var hashBuff = new Buffer(connection.remotePort + connection.remoteAddress + Math.random()).toString('base64');
		md5.update(hashBuff);
		connection.id = md5.digest('hex');
		connection.public = {};
		connection.public.id = connection.id;
		
		api.socketServer.connections.push(connection);
	
	  	connection.on("connect", function () {
	    	api.socketServer.sendSocketMessage(connection, {welcome: api.configData.socketServerWelcomeMessage, room: connection.room, context: "api"});
	    	api.log("socket connection "+connection.remoteIP+" | connected");
			api.socketServer.calculateRoomStatus(api, false);
	  	});
		
	  	connection.on("data", function (chunk) {
			api.socketServer.socketDataString += chunk.toString('utf8');
			var index, line;
			while((index = api.socketServer.socketDataString.indexOf('\r\n')) > -1) {
				line = api.socketServer.socketDataString.slice(0, index);
				api.socketServer.socketDataString = api.socketServer.socketDataString.slice(index + 2);
				if(line.length > 0) {
					var line = line.replace(/(\r\n|\n|\r)/gm,"");
					var words = line.split(" ");
					if(line.indexOf("\u0004") > -1){ } // trap for break chars; do nothing
			    	else if(words[0] == "quit" || words[0] == "exit" || words[0] == "close" ){
						try{ 
							if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | requesting disconnect", "white");}
							api.socketServer.sendSocketMessage(connection, {status: "Bye!"}); 
							connection.end();
						}catch(e){ }
					}else if(words[0] == "paramAdd"){
						var parts = words[1].split("=");
						connection.params[parts[0]] = parts[1];
						api.socketServer.sendSocketMessage(connection, {status: "OK", context: "response"});
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}else if(words[0] == "paramDelete"){
						connection.params[words[1]] = null;
						api.socketServer.sendSocketMessage(connection, {status: "OK", context: "response"});
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}else if(words[0] == "paramView"){
						var q = words[1];
						var params = {}
						params[q] = connection.params[q];
						api.socketServer.sendSocketMessage(connection, {context: "response", params: params});
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}else if(words[0] == "paramsView"){
						api.socketServer.sendSocketMessage(connection, {context: "response", params: connection.params});
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}else if(words[0] == "paramsDelete"){
						connection.params = {};
						api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK"});
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}else if(words[0] == "roomChange"){
						connection.room = words[1];
						api.socketServer.calculateRoomStatus(api, false);
						api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room});
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}else if(words[0] == "roomView"){
						api.socketServer.socketRoomStatus(api, connection.room, function(roomStatus){
							api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room, roomStatus: roomStatus});
							if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
						});				
					}else if(words[0] == "say"){
						var message = line.substr(4);
						api.socketServer.socketRoomBroadcast(api, connection, message);
						api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK"});
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}else if(words[0] == "actionCluster"){
						var message = line.substr(14);
						api.actionCluster.parseMessage(api, connection, message);
					}else{
						connection.error = false;
						connection.response = {};
						connection.response.context = "response";
						connection.params["action"] = words[0];
						process.nextTick(function() { api.processAction(api, connection, api.socketServer.respondToSocketClient); });
						if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
					}
				}
			}
	  	});
		
	  	connection.on("end", function () {
			for(var i in api.connections){
				if(api.socketServer.connections[i].id == connection.id){ api.socketServer.connections.splice(i,1); }
			}
			try{ connection.end(); }catch(e){}
			api.socketServer.calculateRoomStatus(api, false);
			if(api.configData.logRequests){api.log(" > socket connection " + connection.remoteIP + " disconnected", "white");}
	  	});
	});
	
	////////////////////////////////////////////////////////////////////////////
	// broadcast a message to all connections in a room
	api.socketServer.socketRoomBroadcast = function(api, connection, message, clusterRelay){
		if(clusterRelay == null){clusterRelay = true;}
		if(clusterRelay){
			api.actionCluster.sendToAllPeers({action: "broadcast", connection: {
				type: connection.type,
				params: connection.params,
				remoteIP: connection.remoteIP,
				room: connection.room,
				public: connection.public,
				messageCount: connection.messageCount,
				id: connection.id
			}, message: message});
		}
		
		if(clusterRelay == false || api.utils.hashLength(api.actionCluster.peers) == 0){
			for(var i in api.socketServer.connections){
				var thisConnection = api.socketServer.connections[i];
				if(thisConnection.room == connection.room && ( connection.type == "socket" || connection.type == "web")){
					if(connection == null){
						api.socketServer.sendSocketMessage(thisConnection, {message: message, from: api.configData.serverName, context: "user"});
					}else{
						if(thisConnection.id != connection.id){
							api.socketServer.sendSocketMessage(thisConnection, {message: message, from: connection.id, context: "user"});
						}
					}
				}
			}
		}
	}
	
	////////////////////////////////////////////////////////////////////////////
	// status for a room
	api.socketServer.socketRoomStatus = function(api, room, next){
		if(api.utils.hashLength(api.actionCluster.peers) == 0){
			api.cache.load(api, "_roomStatus", function(resp){
				next(resp.rooms[room]);
			});
		}else{
			api.actionCluster.cache.load(api, "_roomStatus", function(resp){
				var returnVal = {};
				returnVal.membersCount = 0
				returnVal.members = [];
				for(var i in resp){
					for(var j in resp[i]["value"]["rooms"]){
						if(j == room){
							for(var z in resp[i]["value"]["rooms"][j]["members"]){
								returnVal.membersCount++;
								returnVal.members.push(resp[i]["value"]["rooms"][j]["members"][z]);
							}
						}
					}
				}
				next(returnVal);
			});
		}
	}
	
	////////////////////////////////////////////////////////////////////////////
	// room status
	api.socketServer.calculateRoomStatus = function(api, loop){
		if(loop == null){loop = true;}
		results = {};
		results.rooms = {};
		for(var i in api.socketServer.connections){
			var thisConnection = api.socketServer.connections[i];
			var thisRoom = thisConnection.room;
			if(results.rooms[thisRoom] == null){
				results.rooms[thisRoom] = {members: [], membersCount: 0};
			}
			results.rooms[thisRoom].membersCount++;
			results.rooms[thisRoom].members.push(thisConnection.public);
		}
		var expireTimeSeconds = 60*60; // 1 hour
		api.cache.save(api,"_roomStatus",results,expireTimeSeconds,function(){
			if(loop){ setTimeout(api.socketServer.calculateRoomStatus, 5000, api); }
		});
	}
	api.socketServer.calculateRoomStatus(api, true);
	
	////////////////////////////////////////////////////////////////////////////
	// action response helper
	api.socketServer.respondToSocketClient = function(connection, cont){
		if(cont != false)
		{
			if(connection.error == false){
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
		process.nextTick(function() { api.logAction(api, connection); });
	}
	
	//message helper
	api.socketServer.sendSocketMessage = function(connection, message){
		process.nextTick(function() { 
			try{
				message.messageCount = connection.messageCount;
				connection.write(JSON.stringify(message) + "\r\n"); 
				connection.messageCount++;
			}catch(e){ }
		});
	}
	
	////////////////////////////////////////////////////////////////////////////
	// Ping!
	api.tasks.pingSocketClients = function(api, next) {
		var params = {
			"name" : "pingSocketClients",
			"desc" : "I will send a message to all connected socket clients.  This will help with TCP keep-alive and send the current server time"
		};
		var task = Object.create(api.tasks.Task);
		task.init(api, params, next);
		task.run = function() {
			for(var i in api.connections){
				var message = {};
				message.context = "api";
				message.status = "keep-alive";
				message.serverTime = new Date();
				api.sendSocketMessage(api.connections[i], message);
			}
			task.log("sent keepAlive to "+api.socketServer.connections.length+" socket clients");
			task.end();
		};
		//
		process.nextTick(function () { task.run() });
	};
	
	////////////////////////////////////////////////////////////////////////////
	// listen
	api.socketServer.server.listen(api.configData.socketServerPort);
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initSocketServer = initSocketServer;