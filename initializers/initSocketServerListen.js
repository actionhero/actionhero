////////////////////////////////////////////////////////////////////////////
// Socket Request Processing

var initSocketServerListen = function(api, next){
	api.connections = [];
	api.socketServer = api.net.createServer(function (connection) {
		api.stats.numberOfSocketRequests = api.stats.numberOfSocketRequests + 1;
		
	  	connection.setEncoding("utf8");
	  	connection.type = "socket";
		connection.params = {};
		connection.remoteIP = connection.remoteAddress;
		connection.room = api.configData.defaultSocketRoom;
		connection.public = {};
		connection.public.id = connection.id;
		connection.messageCount = 0;
		
		var md5 = api.crypto.createHash('md5');
		var hashBuff = new Buffer(connection.remotePort + connection.remoteAddress + Math.random()).toString('base64');
		md5.update(hashBuff);
		connection.id = md5.digest('hex');
		
		api.connections.push(connection);
	
	  	connection.on("connect", function () {
	    	api.sendSocketMessage(connection, {welcome: api.configData.socketServerWelcomeMessage, room: connection.room, context: "api"});
	    	api.log("socket connection "+connection.remoteIP+" | connected");
	  	});
	  	connection.on("data", function (data) {
			var data = data.replace(/(\r\n|\n|\r)/gm,"");
			var words = data.split(" ");
			if(data.indexOf("\u0004") > -1){
				// trap for break chars; do nothing
			}
	    	else if(words[0] == "quit" || words[0] == "exit" || words[0] == "close" ){
				try{ 
					if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | requesting disconnect", "white");}
					api.sendSocketMessage(connection, {status: "Bye!"}); 
					connection.end();
				}catch(e){ }
			}else if(words[0] == "paramAdd"){
				var parts = words[1].split("=");
				connection.params[parts[0]] = parts[1];
				api.sendSocketMessage(connection, {status: "OK", context: "response"});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "paramDelete"){
				connection.data.params[words[1]] = null;
				api.sendSocketMessage(connection, {status: "OK", context: "response"});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "paramView"){
				var q = words[1];
				var params = {}
				params[q] = connection.params[q];
				api.sendSocketMessage(connection, {context: "response", params: params});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "paramsView"){
				api.sendSocketMessage(connection, {context: "response", params: connection.params});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "paramsDelete"){
				connection.params = {};
				api.sendSocketMessage(connection, {context: "response", status: "OK"});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "roomChange"){
				connection.room = words[1];
				api.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "roomView"){
				var roomStatus = api.socketRoomStatus(api, connection.room);
				api.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room, roomStatus: roomStatus});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "say"){
				var message = data.substr(4);
				api.socketRoomBroadcast(api, connection, message);
				api.sendSocketMessage(connection, {context: "response", status: "OK"});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else{
				connection.error = false;
				connection.response = {};
				connection.response.context = "response";
				connection.params["action"] = words[0];
				process.nextTick(function() { api.processAction(api, connection, api.respondToSocketClient); });
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}
	  	});
	  	connection.on("end", function () {
	    	try{ connection.end(); }catch(e){}
			for(var i in api.connections){
				var thisConnection = api.connections[i];
				if(thisConnection.id == connection.id){ api.connections.splice(i,1); }
			}
			if(api.configData.logRequests){api.log(" > socket connection " + connection.remoteIP + " disconnected", "white");}
	  	});
	});
	
	// broadcast a message to all connections in a room
	api.socketRoomBroadcast = function(api, connection, message){
		for(var i in api.connections){
			var thisConnection = api.connections[i];
			if(thisConnection.room == connection.room){
				if(connection == null){
					api.sendSocketMessage(thisConnection, {message: message, from: api.configData.serverName, context: "user"});
				}else{
					if(thisConnection.id != connection.id){
						api.sendSocketMessage(thisConnection, {message: message, from: connection.id, context: "user"});
					}
				}
			}
		}
	}
	
	// status for a room
	api.socketRoomStatus = function(api, room){
		results = {};
		results.rooms = {};
		results.rooms[room] = {members: [], membersCount: 0};
		for(var i in api.connections){
			var thisConnection = api.connections[i];
			var thisRoom = thisConnection.room;
			if(results.rooms[thisRoom] == null){
				results.rooms[thisRoom] = {members: [], membersCount: 0};
			}
			results.rooms[thisRoom].membersCount++;
			results.rooms[thisRoom].members.push(thisConnection.public);
		}
		return results.rooms[room];
	}
	
	// action response helper
	api.respondToSocketClient = function(connection, cont){
		if(cont != false)
		{
			if(connection.error == false){
				if(connection.response == {}){
					connection.response = {status: "OK"};
				}
				api.sendSocketMessage(connection, connection.response);
			}else{
				if(connection.response.error == null){
					connection.response.error = connection.error;
				}
				api.sendSocketMessage(connection, connection.response);
			}
		}
		process.nextTick(function() { api.logAction(api, connection); });
	}
	
	//message helper
	api.sendSocketMessage = function(connection, message){
		process.nextTick(function() { 
			try{
				message.messageCount = connection.messageCount;
				connection.write(JSON.stringify(message) + "\r\n"); 
				connection.messageCount++;
			}catch(e){ }
		});
	}
	
	// listen
	api.socketServer.listen(api.configData.socketServerPort);
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initSocketServerListen = initSocketServerListen;