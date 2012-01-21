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
			}else if(words[0] == "actionCluster"){
				var message = data.substr(14);
				api.actionCluster.parseMessage(api, connection, message);
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
			for(var i in api.connections){
				if(api.connections[i].id == connection.id){ api.connections.splice(i,1); }
			}
			try{ connection.end(); }catch(e){}
			if(api.configData.logRequests){api.log(" > socket connection " + connection.remoteIP + " disconnected", "white");}
	  	});
	});
	
	// broadcast a message to all connections in a room
	api.socketRoomBroadcast = function(api, connection, message){
		for(var i in api.connections){
			var thisConnection = api.connections[i];
			if(thisConnection.room == connection.room && connection.type == "socket"){
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
	
	// actionCluster
	api.actionCluster = {};
	api.actionCluster.peers = {}; // peers["host:port"] = connected
	api.actionCluster.peerConnections = [];
	
	api.actionCluster.parseMessage = function(api, connection, rawMessage){
		try{ var message = JSON.parse(rawMessage); }catch(e){ }
		console.log(message);
		// actionCluster {"action":"join", "key":"4ijhaijhm43yjnawhja43jaj", "port":5678}
		if(typeof message == "object" && message.action == "join"){
			if(message.key == api.configData.actionClusterKey){
				connection.type = "actionCluster";
				connection.room = null;
				api.sendSocketMessage(connection, {context: "response", status: "OK"});
				api.log("actionCluster member joined from "+connection.remoteIP+":"+connection.remotePort, "blue");
				api.actionCluster.connectToClusterMember(api, connection.remoteIP, message.port); 
			}else{
				api.sendSocketMessage(connection, {context: "response", status: "That is not the correct actionClusterKey"});
			}
		}else{
			if(connection.type == "actionCluster"){
				if(message.action == "peersList"){
					
				}
			}else{
				api.sendSocketMessage(connection, {context: "response", status: "This connection is not in the actionCLuster"});
			}
		}
	}
	
	api.actionCluster.connectToClusterMember = function(api, host, port, next){
		if(api.actionCluster.peers[host+":"+port] != "connected"){
			var client = api.net.connect(port, host, function(){
				client.setEncoding('utf8');
				api.actionCluster.peers[host+":"+port] = "connected";
				api.actionCluster.peerConnections.push(client);
				client.send('actionCluster {"action":"join", "key":"'+api.configData.actionClusterKey+'", "port":'+api.configData.socketServerPort+'}');
				api.log("connected to actionCluster peer @ "+host+":"+port, "blue");
				client.remotePeer = {host: host, port:port}
		  
				client.on('data', function(data) {
					// console.log(data);
				});
	  
				client.on('end', function() {
					api.log("connection to actionCluster peer @ "+this.remotePeer.host+":"+this.remotePeer.port+" closed", "red");
					api.actionCluster.peers[this.remotePeer.host+":"+this.remotePeer.port] = "disconnected";
				});

				if(typeof next == "function"){
					next(client);
				}
			});
		
			client.on('error', function() {
			  api.log("Cannot connect to peer @ "+api.configData.actionClusterStartingPeer.host+":"+api.configData.actionClusterStartingPeer.port, ['red', 'bold']);
			  process.exit();
			});
		
			client.send = function(msg){ client.write(msg + "\r\n"); }
		}else{
			// api.log("Already connected to actionCluster peer @ "+host+":"+port, "blue");
		}
	}
	
	// listen
	api.socketServer.listen(api.configData.socketServerPort);
	
	// connect to peer
	if(api.configData.actionClusterStartingPeer.host != null){
		api.log("connecting to first actionCluster peer @ "+api.configData.actionClusterStartingPeer.host+":"+api.configData.actionClusterStartingPeer.port, "gray")
		api.actionCluster.peers[api.configData.actionClusterStartingPeer.host+":"+api.configData.actionClusterStartingPeer.port] = "disconnected";
		api.actionCluster.connectToClusterMember(api, api.configData.actionClusterStartingPeer.host, api.configData.actionClusterStartingPeer.port, function(){
			next();
		})
	}else{
		next();
	}

}

/////////////////////////////////////////////////////////////////////
// exports
exports.initSocketServerListen = initSocketServerListen;