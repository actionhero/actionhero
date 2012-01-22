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
		connection.messageCount = 0;
		var md5 = api.crypto.createHash('md5');
		var hashBuff = new Buffer(connection.remotePort + connection.remoteAddress + Math.random()).toString('base64');
		md5.update(hashBuff);
		connection.id = md5.digest('hex');
		connection.public = {};
		connection.public.id = connection.id;
		
		api.connections.push(connection);
	
	  	connection.on("connect", function () {
	    	api.sendSocketMessage(connection, {welcome: api.configData.socketServerWelcomeMessage, room: connection.room, context: "api"});
	    	api.log("socket connection "+connection.remoteIP+" | connected");
			api.calculateRoomStatus(api, false);
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
				api.calculateRoomStatus(api, false);
				api.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room});
				if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
			}else if(words[0] == "roomView"){
				api.socketRoomStatus(api, connection.room, function(roomStatus){
					api.sendSocketMessage(connection, {context: "response", status: "OK", room: connection.room, roomStatus: roomStatus});
					if(api.configData.logRequests){api.log(" > socket request from " + connection.remoteIP + " | "+data, "grey");}
				});				
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
			api.calculateRoomStatus(api, false);
			if(api.configData.logRequests){api.log(" > socket connection " + connection.remoteIP + " disconnected", "white");}
	  	});
	});
	
	// broadcast a message to all connections in a room
	api.socketRoomBroadcast = function(api, connection, message, clusterRelay){
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
	api.socketRoomStatus = function(api, room, next){
		if(api.utils.hashLength(api.actionCluster.peers) == 0){
			api.cache.load(api, "_roomStatus", function(resp){
				next(resp.rooms[room]);
			});
		}else{
			api.actionCluster.cache.load(api, "_roomStatus", function(resp){
				var returnVal = {};
				returnVal.membersCount = 0
				returnVal.members = [];
				for(var i in resp.peerResponses){
					for(var j in resp.peerResponses[i]["value"]["rooms"]){
						if(j == room){
							for(var z in resp.peerResponses[i]["value"]["rooms"][j]["members"]){
								returnVal.membersCount++;
								returnVal.members.push(resp.peerResponses[i]["value"]["rooms"][j]["members"][z]);
							}
						}
					}
				}
				next(returnVal);
			});
		}
	}
	
	api.calculateRoomStatus = function(api, loop){
		if(loop == null){loop = true;}
		results = {};
		results.rooms = {};
		for(var i in api.connections){
			var thisConnection = api.connections[i];
			var thisRoom = thisConnection.room;
			if(results.rooms[thisRoom] == null){
				results.rooms[thisRoom] = {members: [], membersCount: 0};
			}
			results.rooms[thisRoom].membersCount++;
			results.rooms[thisRoom].members.push(thisConnection.public);
		}
		var expireTimeSeconds = 60*60; // 1 hour
		api.cache.save(api,"_roomStatus",results,expireTimeSeconds,function(){
			if(loop){ setTimeout(api.calculateRoomStatus, 30000, api); }
		});
	}
	api.calculateRoomStatus(api, true);
	
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
	
	
	
	
	
	
	// actionCluster
	api.actionCluster = {};
	api.actionCluster.peers = {}; // peers["host:port"] = connected
	api.actionCluster.connectionsToPeers = [];
	
	api.actionCluster.parseMessage = function(api, connection, rawMessage){
		try{ var message = JSON.parse(rawMessage); }catch(e){ }
		if(typeof message == "object" && message.action == "join"){
			if(message.key == api.configData.actionClusterKey){
				connection.type = "actionCluster";
				connection.room = null;
				api.calculateRoomStatus(api, false);
				api.sendSocketMessage(connection, {context: "response", status: "OK"});
				api.log("actionCluster peer joined from "+connection.remoteIP+":"+connection.remotePort, "blue");
				api.actionCluster.connectToClusterMember(api, connection.remoteIP, message.port, function(status){
					//
				}); 
			}else{
				api.sendSocketMessage(connection, {context: "response", status: "That is not the correct actionClusterKey"});
			}
		}else{
			if(connection.type == "actionCluster"){
				if(message.action == "peersList"){
					for(var i in message.peers){
						var parts = i.split(":");
						if(api.actionCluster.peers[i] == null){ 
							api.actionCluster.peers[i] = "disconnected"; 
							api.log("new peer in cluster @ "+i, "grey");
						}
					}
				}else if(message.action == "broadcast"){
					api.socketRoomBroadcast(api, message.connection, message.message, false)
				}
				else if (message.action == "cacheView"){
					api.cache.load(api, message.key, function(value){
						api.sendSocketMessage(connection, {context: "response", value: value, key: message.key, requestID: message.requestID})
					});
				}else if (message.action == "cacheDestroy"){
					api.cache.destroy(api, message.key, function(value){
						api.sendSocketMessage(connection, {context: "response", value: value, key: message.key, requestID: message.requestID})
					});
				}
			}else{
				api.sendSocketMessage(connection, {context: "response", status: "This connection is not in the actionCluster"});
			}
		}
	}
	
	api.actionCluster.connectToClusterMember = function(api, host, port, next){
		if(api.actionCluster.peers[host+":"+port] != "connected"){
			var client = api.net.connect(port, host, function(){
				client.setEncoding('utf8');
				api.actionCluster.connectionsToPeers.push(client);
				api.actionCluster.peers[host+":"+port] = "connected";
				client.send('actionCluster {"action":"join", "key":"'+api.configData.actionClusterKey+'", "port":'+api.configData.socketServerPort+'}');
				api.log("connected to actionCluster peer @ "+host+":"+port, "blue");
				client.remotePeer = {host: host, port:port}
		  
				client.on('data', function(data) {
					try{ 
						var message = JSON.parse(data); 
						if(message.context == "response"){
							if(message.requestID != null){
								api.actionCluster.cache.results[message.requestID]["peerResponses"].push({remotePeer:client.remotePeer, value: message.value});
							}
						}
					}catch(e){ }
				});
	  
				client.on('end', function() {
					api.log("connection to actionCluster peer @ "+this.remotePeer.host+":"+this.remotePeer.port+" closed", "red");
					api.actionCluster.peers[this.remotePeer.host+":"+this.remotePeer.port] = "disconnected";
					for (var i in api.actionCluster.connectionsToPeers){
						if(api.actionCluster.connectionsToPeers[i].remotePeer.host == this.remotePeer.host && api.actionCluster.connectionsToPeers[i].remotePeer.port == this.remotePeer.port){
							api.actionCluster.connectionsToPeers.splice(i,1);
						}
					}
					delete client;
				});
				if(typeof next == "function"){ process.nextTick( function(){ next(client) } ); }
			});
		
			client.on('error', function(e) {
				delete client;
				api.log("Cannot connect to peer @ "+host+":"+port, ['red', 'bold']);
				if(typeof next == "function"){ process.nextTick( function(){ next(false) } ); }
			});
		
			client.send = function(msg){ client.write(msg + "\r\n"); }
		}else{
			if(typeof next == "function"){ 
				process.nextTick( function(){ next(false) } ); 
			}
			// api.log("Already connected to actionCluster peer @ "+host+":"+port, "blue");
		}
	}
	
	api.actionCluster.shareMyPeers = function(api){
		msgObj = {action: "peersList", peers: api.actionCluster.peers};
		api.actionCluster.sendToAllPeers(msgObj);
	}
	
	api.actionCluster.sendToAllPeers = function(msgObj){
		for (var i in api.actionCluster.connectionsToPeers){
			api.actionCluster.connectionsToPeers[i].send("actionCluster "+ JSON.stringify(msgObj));
		}
	}
	
	api.actionCluster.sendToPeer = function(msgObj, host, port){
		for(var i in api.actionCluster.connectionsToPeers){
			if(api.actionCluster.connectionsToPeers[i].remotePeer.host == host && api.actionCluster.connectionsToPeers[i].remotePeer.port == port){
				api.actionCluster.connectionsToPeers[i].send("actionCluster "+ JSON.stringify(msgObj));
			}
		}
	}
	
	api.actionCluster.reconnectToLostPeers = function(api){
		api.actionCluster.shareMyPeers(api);
		var started = 0;
		if(api.utils.hashLength(api.actionCluster.peers) > 0){
			for (var i in api.actionCluster.peers){
				started++;
				var parts = i.split(":")
				var status = api.actionCluster.peers[i];
				// if(status != "connected"){ api.log("trying to recconect with peer @ "+parts[0]+":"+parts[1], "grey"); }
				api.actionCluster.connectToClusterMember(api, parts[0], parts[1], function(){
					started--;
					if(started == 0){ setTimeout(api.actionCluster.reconnectToLostPeers, api.configData.actionClusterReConnectToLostPeersMS, api); }
				});
			}
		}else{
			setTimeout(api.actionCluster.reconnectToLostPeers, api.configData.actionClusterReConnectToLostPeersMS, api);
		}
	}
	setTimeout(api.actionCluster.reconnectToLostPeers, api.configData.actionClusterReConnectToLostPeersMS, api);
	
	// connect to first peer
	if(api.configData.actionClusterStartingPeer.host != null){
		api.log("connecting to first actionCluster peer @ "+api.configData.actionClusterStartingPeer.host+":"+api.configData.actionClusterStartingPeer.port, "gray")
		api.actionCluster.peers[api.configData.actionClusterStartingPeer.host+":"+api.configData.actionClusterStartingPeer.port] = "disconnected";
		api.actionCluster.connectToClusterMember(api, api.configData.actionClusterStartingPeer.host, api.configData.actionClusterStartingPeer.port, function(resp){
			if(resp == false){
				process.exit();
			}else{
				next();
			}
		})
	}else{
		next();
	}
	
	// shared cache access
	api.actionCluster.cache = {};
	api.actionCluster.cache.results = {}
	api.actionCluster.requestID = 0;
	
	api.actionCluster.cache.save = function(api, key, value, expireTimeSeconds, remotePeer, next){
		api.actionCluster.requestID++;
		var requestID = api.actionCluster.requestID;
		api.actionCluster.cache.results[requestID] = {
			requestID: requestID,
			returned: false,
			key: key,
			peerResponses: []
		};
		
	}
	
	api.actionCluster.cache.load = function(api, key, next){
		api.actionCluster.requestID++;
		var requestID = api.actionCluster.requestID;
		api.actionCluster.cache.results[requestID] = {
			requestID: requestID,
			returned: false,
			key: key,
			peerResponses: []
		};
		api.actionCluster.sendToAllPeers({action: "cacheView", key: key, requestID: requestID});
		setTimeout(function(){
			if(api.actionCluster.cache.results[requestID]["returned"] == false){
				next(api.actionCluster.cache.results[requestID]);
			}
		},api.configData.actionClusterRemoteTimeoutWaitMS);
		setTimeout(function(){
			delete api.actionCluster.cache.results[requestID];
		}, (api.configData.actionClusterRemoteTimeoutWaitMS * 2))
	}
	
	api.actionCluster.cache.destroy = function(api, key, remotePeer, next){
		api.actionCluster.requestID++;
		var requestID = api.actionCluster.requestID;
		api.actionCluster.cache.results[requestID] = {
			requestID: requestID,
			returned: false,
			key: key,
			peerResponses: []
		};
		
		var msgObj = {action: "cacheDestroy", key: key, requestID: requestID};
		if(remotePeer == null){
			api.actionCluster.sendToAllPeers(msgObj);
		}else{
			var parts = remotePeer.split(":")
			api.actionCluster.sendToPeer(msgObj, parts[0], parts[1]);
		}
		next();
	}

}

/////////////////////////////////////////////////////////////////////
// exports
exports.initSocketServerListen = initSocketServerListen;