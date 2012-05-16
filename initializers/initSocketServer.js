////////////////////////////////////////////////////////////////////////////
// Socket Request Processing

var initSocketServer = function(api, next){
	api.socketServer = {};
	api.socketServer.connections = [];
	api.socketServer.socketDataString = "";
	api.socketServer.numberOfLocalSocketRequests = 0;

	if(api.redis.enable === false){
		api.socketServer.rooms = {};
	}else{
		api.socketServer.redisRoomPrefix = "actionHero::roomMembers::";
	}
	
	////////////////////////////////////////////////////////////////////////////
	// server
	api.socketServer.server = api.net.createServer(function (connection) {
		api.stats.incrament(api, "numberOfSocketRequests");
		api.socketServer.numberOfLocalSocketRequests++;
		
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
	  		api.stats.incrament(api, "numberOfActiveSocketClients");
	    	api.socketServer.sendSocketMessage(connection, {welcome: api.configData.socketServerWelcomeMessage, room: connection.room, context: "api"});
	    	api.log("socket connection "+connection.remoteIP+" | connected");
			api.socketServer.roomAddMember(api, connection);
	  	});
		
	  	connection.on("data", function (chunk) {
			api.socketServer.socketDataString += chunk.toString('utf8');
			var index, line;
			while((index = api.socketServer.socketDataString.indexOf('\r\n')) > -1) {
				var line = api.socketServer.socketDataString.slice(0, index);
				connection.lastLine = line;
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
						api.socketServer.roomRemoveMember(api, connection, function(){
							connection.room = words[1];
							api.socketServer.roomAddMember(api, connection);
							api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room});
							if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+line, "grey");}
						});
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
	  		api.socketServer.roomRemoveMember(api, connection, function(){
	  			api.stats.incrament(api, "numberOfActiveSocketClients", -1);
				for(var i in api.socketServer.connections){
					if(api.socketServer.connections[i].id == connection.id){ api.socketServer.connections.splice(i,1); }
				}
				try{ connection.end(); }catch(e){
					//
				}
				if(api.configData.logRequests){api.log(" > socket connection " + connection.remoteIP + " disconnected", "white");}
	  		});
	  	});
		
		connection.on("error", function(e){
			api.log("socket error: " + e, "red");
			connection.end();
		});
	});
	
	////////////////////////////////////////////////////////////////////////////
	// broadcast a message to all connections in a room
	api.socketServer.socketRoomBroadcast = function(api, connection, message, fromQueue){
		if(fromQueue == null){fromQueue = false;}
		if(api.redis.enable === true && fromQueue == false){ 
			var payload = {
				message: message,
				connection: {
					room: connection.room,
					public: {
						id: connection.public.id
					}
				}
			};
			api.redis.client.publish("actionHero::say", JSON.stringify(payload));
		}
		else{
			for(var i in api.socketServer.connections){
				var thisConnection = api.socketServer.connections[i];
				if(thisConnection.room == connection.room){
					if(connection == null){
						api.socketServer.sendSocketMessage(thisConnection, {message: message, from: api.configData.serverName, context: "user"});
					}else{
						if(thisConnection.public.id != connection.public.id){
							api.socketServer.sendSocketMessage(thisConnection, {message: message, from: connection.public.id, context: "user"});
						}
					}
				}
			}
		}
	}
	
	////////////////////////////////////////////////////////////////////////////
	// status for a room
	api.socketServer.socketRoomStatus = function(api, room, next){
		if(api.redis.enable === true){
			var key = api.socketServer.redisRoomPrefix + room;
			api.redis.client.llen(key, function(err, length){
				api.redis.client.lrange(key, 0, length, function(err, members){
					next({
						members: members,
						membersCount: length
					});
				});
			});
		}else{
			next({
				members: api.socketServer.rooms[room],
				membersCount: api.socketServer.rooms[room].length
			});
		}
	}

	api.socketServer.roomAddMember = function(api, connection, next){
		var room = connection.room;
		var name = connection.public.id;
		if(api.redis.enable === true){
			var key = api.socketServer.redisRoomPrefix + connection.room;
			api.redis.client.rpush(key, name, function(){
				if(typeof next == "function"){ next(true) }
			});
		}else{
			if(api.socketServer.rooms[room] == null){
				api.socketServer.rooms[room] = [];
			}
			api.socketServer.rooms[room].push(name);
			if(typeof next == "function"){ next(true) }
		}
	}

	api.socketServer.roomRemoveMember = function(api, connection, next){
		var room = connection.room;
		var name = connection.public.id;
		if(api.redis.enable === true){
			var key = api.socketServer.redisRoomPrefix + connection.room;
			api.redis.client.lrem(key, 1, name, function(){
				if(typeof next == "function"){ next(true) }
			});
		}else{
			for(var i in api.socketServer.rooms){
				if(i == room){
					var rList = api.socketServer.rooms[i];
					for(var j in rList){
						if(rList[j] == name){
							rList.splice(j,1);
							break;
						}
					}
					break;
				}
			}
			if(typeof next == "function"){ next(true) }
		}
	}
	
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
	}
	
	////////////////////////////////////////////////////////////////////////////
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
	// listen
	api.socketServer.server.on("error", function(e){
		api.log("Cannot start socket server @ port " + api.configData.socketServerPort + "; Exiting.", ["red", "bold"]);
		api.log(e);
		process.exit();
	});

	// register for messages
	if(api.redis.enable === true){
		api.redis.registerChannel(api, "actionHero::say", function(channel, message){
			message = JSON.parse(message);
			api.socketServer.socketRoomBroadcast(api, message.connection, message.message, true);
		});
	}
	
	api.socketServer.server.listen(api.configData.socketServerPort, "0.0.0.0", function(){
		next();
	});
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initSocketServer = initSocketServer;