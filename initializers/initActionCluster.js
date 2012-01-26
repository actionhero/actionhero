////////////////////////////////////////////////////////////////////////////
// ActionCluster

var initActionCluster= function(api, next){

	api.actionCluster = {};
	api.actionCluster.peers = {}; // peers["host:port"] = connected
	api.actionCluster.connectionsToPeers = [];
	
	api.actionCluster.parseMessage = function(api, connection, rawMessage){
		try{ var message = JSON.parse(rawMessage); }catch(e){ }
		if(typeof message == "object" && message.action == "join"){
			if(message.key == api.configData.actionCluster.Key){
				connection.type = "actionCluster";
				connection.room = null;
				api.socketServer.calculateRoomStatus(api, false);
				api.socketServer.sendSocketMessage(connection, {context: "response", status: "OK"});
				api.log("actionCluster peer joined from "+connection.remoteIP+":"+connection.remotePort, "blue");
				api.actionCluster.connectToPeer(api, connection.remoteIP, message.port, function(status){
					//
				}); 
			}else{
				api.socketServer.sendSocketMessage(connection, {context: "response", status: "That is not the correct actionClusterKey"});
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
					api.socketServer.socketRoomBroadcast(api, message.connection, message.message, false)
				}else if (message.action == "cacheSave"){
					api.cache.save(api, message.key, message.value, message.expireTimeSeconds, function(value){
						api.socketServer.sendSocketMessage(connection, {context: "response", value: value, key: message.key, requestID: message.requestID})
					});
				}else if (message.action == "cacheView"){
					api.cache.load(api, message.key, function(value){
						api.socketServer.sendSocketMessage(connection, {context: "response", value: value, key: message.key, requestID: message.requestID})
					});
				}else if (message.action == "cacheDestroy"){
					api.cache.destroy(api, message.key, function(value){
						api.socketServer.sendSocketMessage(connection, {context: "response", value: value, key: message.key, requestID: message.requestID})
					});
				}
			}else{
				api.socketServer.sendSocketMessage(connection, {context: "response", status: "This connection is not in the actionCluster"});
			}
		}
	}
	
	api.actionCluster.connectToPeer = function(api, host, port, next){
		port = parseInt(port);
		if(api.actionCluster.peers[host+":"+port] != "connected"){
			var client = api.net.connect(port, host, function(){
				client.setEncoding('utf8');
				api.actionCluster.connectionsToPeers.push(client);
				api.actionCluster.peers[host+":"+port] = "connected";
				client.send('actionCluster {"action":"join", "key":"'+api.configData.actionCluster.Key+'", "port":'+api.configData.socketServerPort+'}');
				api.log("connected to actionCluster peer @ "+host+":"+port, "blue");
				client.remotePeer = {host: host, port: port}
		  
		  	  	var socketDataString = ""; 
				
				client.on('data', function(chunk) {
					socketDataString += chunk.toString('utf8');
					var index, line;
					while((index = socketDataString.indexOf('\r\n')) > -1) {
						line = socketDataString.slice(0, index);
						socketDataString = socketDataString.slice(index + 2);
						if(line.length > 0) {
							try{ 
								var message = JSON.parse(line); 
								if(message.context == "response"){
									if(message.requestID != null){
										api.actionCluster.cache.results[message.requestID]["peerResponses"].push({remotePeer:client.remotePeer, value: message.value});
									}
								}
							}catch(e){ api.log("actionCluser networking error: "+e, "red") }
						}
					}
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
		clearTimeout(api.actionCluster.peerReconnectTimer);
		if(api.actionCluster.connectionsToPeers.length > 0){
			api.actionCluster.shareMyPeers(api);
			var started = 0;
			for (var i in api.actionCluster.peers){
				started++;
				var parts = i.split(":")
				api.actionCluster.connectToPeer(api, parts[0], parts[1], function(){
					started--;
					if(started == 0){ 
						api.actionCluster.peerReconnectTimer = setTimeout(api.actionCluster.reconnectToLostPeers, api.configData.actionCluster.ReConnectToLostPeersMS, api); 
					}
				});
			}
		}else{
			api.actionCluster.peerReconnectTimer = setTimeout(api.actionCluster.reconnectToLostPeers, api.configData.actionCluster.ReConnectToLostPeersMS, api);
		}
	}
	api.actionCluster.peerReconnectTimer = setTimeout(api.actionCluster.reconnectToLostPeers, api.configData.actionCluster.ReConnectToLostPeersMS, api);
	
	// shared cache access
	api.actionCluster.cache = {};
	api.actionCluster.cache.results = {}
	api.actionCluster.requestID = 0;
	
	api.actionCluster.cache.save = function(api, key, value, expireTimeSeconds, next){
		
		var saveObjectAtOnePeer = function(api, key, value, expireTimeSeconds, requestID, i){
			var host = api.actionCluster.connectionsToPeers[i].remotePeer.host;
			var port = api.actionCluster.connectionsToPeers[i].remotePeer.port;
			api.actionCluster.sendToPeer({
				action: "cacheSave", 
				key: key, 
				value: value, 
				expireTimeSeconds: expireTimeSeconds, 
				requestID: requestID},
			host, port);
		}
		
		var saveAtEnoughPeers = function(api, key, value, expireTimeSeconds, requestID, i, instnaceCounter, next){
			if(requestID == null || i == null || instnaceCounter == null){
				api.actionCluster.requestID++;
				var requestID = api.actionCluster.requestID;
				var instnaceCounter = 0;
				var i = 0;
				api.actionCluster.cache.results[requestID] = {
					requestID: requestID,
					complete: false,
					key: key,
					peerResponses: []
				};
			}
			if(i < api.utils.hashLength(api.actionCluster.connectionsToPeers)){
				saveObjectAtOnePeer(api, key, value, expireTimeSeconds, requestID, i);
				api.actionCluster.cache.checkForComplete(api, requestID, (i+1), function(resp){
					if(resp[i]["value"] == true){ instnaceCounter++; }					
					if(instnaceCounter == api.configData.actionCluster.nodeDuplication){
						if(typeof next == "function"){ next(resp); }
					}else{
						i++;
						saveAtEnoughPeers(api, key, value, expireTimeSeconds, requestID, i, instnaceCounter, next);
					}
				});
			}else{
				if(typeof next == "function"){ next(false); }
			}
		}	
		
		api.actionCluster.cache.destroy(api, key, function(){
			saveAtEnoughPeers(api, key, value, expireTimeSeconds, null, null, null, next);
		})
	}
	
	api.actionCluster.cache.load = function(api, key, next){
		api.actionCluster.requestID++;
		var requestID = api.actionCluster.requestID;
		api.actionCluster.cache.results[requestID] = {
			requestID: requestID,
			complete: false,
			key: key,
			peerResponses: []
		};
		if(api.utils.hashLength(api.actionCluster.connectionsToPeers)){
			api.actionCluster.sendToAllPeers({action: "cacheView", key: key, requestID: requestID});
			api.actionCluster.cache.checkForComplete(api, requestID, api.actionCluster.connectionsToPeers.length, next);
		}else{
			if(typeof next == "function"){ next(false); }
		}
	}
	
	api.actionCluster.cache.destroy = function(api, key, remotePeer, next){
		if(next == null && typeof remotePeer == "function"){
			next = remotePeer;
			remotePeer = null;
		}
		api.actionCluster.requestID++;
		var requestID = api.actionCluster.requestID;
		api.actionCluster.cache.results[requestID] = {
			requestID: requestID,
			complete: false,
			key: key,
			peerResponses: []
		};
		
		if(api.utils.hashLength(api.actionCluster.connectionsToPeers)){
			var msgObj = {action: "cacheDestroy", key: key, requestID: requestID};
			if(remotePeer == null){
				api.actionCluster.sendToAllPeers(msgObj);
				api.actionCluster.cache.checkForComplete(api, requestID, null, next)
			}else{
				var parts = remotePeer.split(":")
				api.actionCluster.sendToPeer(msgObj, parts[0], parts[1]);
				api.actionCluster.cache.checkForComplete(api, requestID, 1, next)
			}
		}else{
			if(typeof next == "function"){ next(false); }
		}
	}
	
	api.actionCluster.cache.checkForComplete = function(api, requestID, numExpectedResponses, next){
		if(numExpectedResponses == null){numExpectedResponses = api.actionCluster.connectionsToPeers.length;}
		if(api.actionCluster.cache.results[requestID] == null){
			next(false);
		}else{
			if(api.actionCluster.cache.results[requestID]["peerResponses"].length < numExpectedResponses){
				setTimeout(api.actionCluster.cache.checkForComplete, api.configData.actionCluster.CycleCheckTimeMS, api, requestID, numExpectedResponses, next);
			}else{
				clearTimeout(api.actionCluster.cache.results[requestID].timeoutTimer);
				if(typeof next == "function"){ next(api.actionCluster.cache.results[requestID]["peerResponses"]); }
			}
		
			// catch for lost/unresponsive peers
			if(api.actionCluster.cache.results[requestID].timeoutTimer == null){
				api.actionCluster.cache.results[requestID].timeoutTimer = setTimeout(function(){
					if(api.actionCluster.cache.results[requestID].complete == false){
						if(typeof next == "function"){ next(api.actionCluster.cache.results[requestID]["peerResponses"]); }
					}
				},api.configData.actionCluster.remoteTimeoutWaitMS);
			}
		
			// clear result set data
			if(api.actionCluster.cache.results[requestID].dataClearTimer == null){
				api.actionCluster.cache.results[requestID].dataClearTimer = setTimeout(function(){
					clearTimeout(api.actionCluster.cache.results[requestID].timeoutTimer);
					delete api.actionCluster.cache.results[requestID];
				}, (api.configData.actionCluster.remoteTimeoutWaitMS * 2))
			}
		}
	}
	
	api.actionCluster.cache.ensureObjectDuplication = function(api){			
		var completeAndRestart = function(){
			if(started == 0){
				if(counter > 0){
					api.log(counter + " cache objects on this server do not have corresponding duplicates in peers; Attempting to re-duplicate", "red");
				}
				setTimeout(api.actionCluster.cache.ensureObjectDuplication, api.configData.actionCluster.remoteTimeoutWaitMS, api);
			}else{
				setTimeout(completeAndRestart, 1000);
			}
		}
		
		var doCacheCheck = function(key, cacheObj){
			started++;
			var value = cacheObj.value;
			var expireTimestamp = cacheObj.expireTimestamp;
			var expireTimeSeconds = (expireTimestamp - (new Date().getTime())) / 1000;
			if(expireTimestamp - (new Date().getTime()) > api.configData.actionCluster.remoteTimeoutWaitMS){
				api.actionCluster.cache.load(api, key, function(resp){
					var truthyResponses = 0;
					for (var i in resp){
						if(resp[i].value != null){ truthyResponses++; }
					}
					if(truthyResponses < api.configData.actionCluster.nodeDuplication){
						api.actionCluster.cache.save(api, key, value, expireTimeSeconds, function(){
							started--;
							counter++;
						});
					}else{
						started--;
					}
				});
			}else{
				started--;
			}
		}
		
		var started = 0;
		var counter = 0;
		if(api.actionCluster.connectionsToPeers.length > 0){
			for(var i in api.cache.data){
				doCacheCheck(i, api.cache.data[i]);
			}
			completeAndRestart(api);
		}else{
			completeAndRestart(api);
		}
		
	}
	setTimeout(api.actionCluster.cache.ensureObjectDuplication, api.configData.actionCluster.remoteTimeoutWaitMS, api);
	
	
	// connect to first peer
	if(api.configData.actionCluster.StartingPeer.host != null){
		api.log("connecting to first actionCluster peer @ "+api.configData.actionCluster.StartingPeer.host+":"+api.configData.actionCluster.StartingPeer.port, "gray")
		api.actionCluster.peers[api.configData.actionCluster.StartingPeer.host+":"+api.configData.actionCluster.StartingPeer.port] = "disconnected";
		api.actionCluster.connectToPeer(api, api.configData.actionCluster.StartingPeer.host, api.configData.actionCluster.StartingPeer.port, function(resp){
			if(resp == false){
				process.exit();
			}else{
				next();
			}
		})
	}else{
		next();
	}
	
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initActionCluster = initActionCluster;
