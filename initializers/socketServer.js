var net = require("net");
var tls = require("tls");
var fs = require('fs');

var socketServer = function(api, next){

  if(api.configData.tcpServer.enable != true){
    next()
  }else{
    api.socketServer = {};

    api.socketServer._start = function(api, next){
      if(api.configData.tcpServer.secure == false){
        api.socketServer.server = net.createServer(function(connection){
          api.socketServer.handleConnection(connection);
        });
      }else{
        var key = fs.readFileSync(api.configData.httpServer.keyFile);
        var cert = fs.readFileSync(api.configData.httpServer.certFile);
        api.socketServer.server = tls.createServer({key: key, cert: cert}, function(connection){
          api.socketServer.handleConnection(connection);
        });
      }

      api.socketServer.server.on("error", function(e){
        api.log("Cannot start socket server @ " + api.configData.tcpServer.bindIP + ":" + api.configData.tcpServer.port + "; Exiting.", "emerg");
        api.log(e, "error");
        process.exit();
      });
      
      api.socketServer.server.listen(api.configData.tcpServer.port, api.configData.tcpServer.bindIP, function(){
        api.log("tcp server listening on " + api.configData.tcpServer.bindIP + ":" + api.configData.tcpServer.port, "notice");
        next();
      });
    }

    api.socketServer._teardown = function(api, next){
      api.socketServer.gracefulShutdown(next);
    }

    api.socketServer.decorateConnection = function(connection){
      connection.responsesWaitingCount = 0;
      connection.socketDataString = "";
      connection.sendMessage = function(message){
        try{
          connection.rawConnection.write(JSON.stringify(message) + "\r\n");
        }catch(e){
          api.log("socket write error: "+e, "error");
        } 
      }
    }

    api.socketServer.handleConnection = function(rawConnection){
      var connection = new api.connection({
        type: 'socket', 
        remotePort: rawConnection.remotePort, 
        remoteIP: rawConnection.remoteAddress, 
        rawConnection: rawConnection
      });
      api.socketServer.decorateConnection(connection);
      api.log("[ connect @ socket ]", 'info', {to: connection.remoteIP});

      process.nextTick(function(){
        api.socketServer.prepareSocketMessage(connection, {welcome: api.configData.general.welcomeMessage, room: connection.room, context: "api"});
      });
      
      connection.rawConnection.on("data", function (chunk) {
        if(api.socketServer.checkBreakChars(chunk)){ 
          api.socketServer.goodbye(connection); 
        }else{
          connection.socketDataString += chunk.toString('utf-8').replace(/\r/g, "\n");
          var index, line;
          while((index = connection.socketDataString.indexOf('\n')) > -1) {
            var line = connection.socketDataString.slice(0, index);
            connection.socketDataString = connection.socketDataString.slice(index + 2);
            if(line.length > 0) {
              connection.messageCount++; // increment at the start of the requset so that responses can be caught in order on the client
              line = line.replace("\n","");
              api.socketServer.parseRequest(connection, line);
            }
          }
        }
      });

      connection.rawConnection.on("end", function () {        
        try{ 
          connection.rawConnection.end(); 
        }catch(e){ }
        connection.destroy(function(){
          api.log("[ disconnect @ socket ]", 'info', {to: connection.remoteIP});
        });
      });

      connection.rawConnection.on("error", function(e){
        api.log("socket error: " + e, "error");
        connection.rawConnection.end();
      });

    };

    ////////////////////////////////////////////////////////////////////////////
    // determine what to do
    api.socketServer.parseRequest = function(connection, line){
      var words = line.split(" ");
      if(words[0] == "quit" || words[0] == "exit" || words[0] == "close" ){
        api.socketServer.goodbye(connection);
      }else if(words[0] == "paramAdd"){
        var parts = words[1].split("=");
        if(parts[0] != null){
          connection.params[parts[0]] = parts[1];
          api.socketServer.prepareSocketMessage(connection, {status: "OK", context: "response"});
        }else{
          api.socketServer.prepareSocketMessage(connection, {status: "Cannot set null", context: "response"});
        }
        api.log("[ quit @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(words[0] == "paramDelete"){
        connection.params[words[1]] = null;
        api.socketServer.prepareSocketMessage(connection, {status: "OK", context: "response"});
        api.log("[ paramDelete @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(words[0] == "paramView"){
        var q = words[1];
        var params = {}
        params[q] = connection.params[q];
        api.socketServer.prepareSocketMessage(connection, {context: "response", params: params});
        api.log("[ paramView @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(words[0] == "paramsView"){
        api.socketServer.prepareSocketMessage(connection, {context: "response", params: connection.params});
        api.log("[ paramsView @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(words[0] == "paramsDelete"){
        connection.params = {};
        api.socketServer.prepareSocketMessage(connection, {context: "response", status: "OK"});
        api.log("[ paramsDelete @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(api.chatRoom.enabled && words[0] == "roomChange"){
        api.chatRoom.roomRemoveMember(connection, function(err, wasRemoved){
          connection.room = words[1];
          api.chatRoom.roomAddMember(connection);
          api.socketServer.prepareSocketMessage(connection, {context: "response", status: "OK", room: connection.room});
          api.log("[ roomChange @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
        });
      }else if(api.chatRoom.enabled && words[0] == "roomView"){
        api.chatRoom.socketRoomStatus(connection.room, function(err, roomStatus){
          api.socketServer.prepareSocketMessage(connection, {context: "response", status: "OK", room: connection.room, roomStatus: roomStatus});
          api.log("[ roomView @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
        });   
      }else if(api.chatRoom.enabled && words[0] == "listenToRoom"){
        var message = {context: "response", status: "OK", room: words[1]}
        if(connection.additionalListeningRooms.indexOf(words[1]) > -1){
          message.error = "you are already listening to this room";
        }else{
          connection.additionalListeningRooms.push(words[1]);
          message.status = "OK"
        }
        api.socketServer.prepareSocketMessage(connection, message);
        api.log("[ listenToRoom @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(api.chatRoom.enabled && words[0] == "silenceRoom"){
        var message = {context: "response", status: "OK", room: words[1]}
        if(connection.additionalListeningRooms.indexOf(words[1]) > -1){
          var index = connection.additionalListeningRooms.indexOf(words[1]);
          connection.additionalListeningRooms.splice(index, 1);
          message.status = "OK"
        }else{
          message.error = "you are not listening to this room";
        }
        api.socketServer.prepareSocketMessage(connection, message);
        api.log("[ silenceRoom @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(words[0] == "detailsView"){
        var details = {};
        details.params = connection.params;
        details.id = connection.id;
        details.connectedAt = connection.connectedAt;
        details.room = connection.room;
        details.totalActions = connection.totalActions;
        details.pendingActions = connection.pendingActions;
        api.socketServer.prepareSocketMessage(connection, {context: "response", status: "OK", details: details});
        api.log("[ detailsView @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else if(api.chatRoom.enabled && words[0] == "say"){
        var message = line.substr(4);
        api.chatRoom.socketRoomBroadcast(connection, message);
        api.socketServer.prepareSocketMessage(connection, {context: "response", status: "OK"});
        api.log("[ say @ socket ]", 'debug', {to: connection.remoteIP, params: JSON.stringify(words)});
      }else{
        api.socketServer.processAction(connection, line, words);
      }
    }

    ////////////////////////////////////////////////////////////////////////////
    // process the action
    api.socketServer.processAction = function(connection, line, words){
      connection.error = null;
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
        local_params = null;
        connection.params["action"] = words[0];
      }
      connection.responsesWaitingCount++;

      // actions should be run using params set at the begining of excecution
      // build a proxy connection so that param changes during execution will not break this
      var proxy_connection = {
        _original_connection: connection
      }
      for (var i in connection) {
        if (connection.hasOwnProperty(i)) {
          proxy_connection[i] = connection[i];
        }
      }
      if(local_params != null && api.utils.hashLength(local_params) > 0){
        proxy_connection.params = local_params;
      }

      var actionProcessor = new api.actionProcessor({connection: proxy_connection, callback: function(proxy_connection, cont){
        connection.response = proxy_connection.response;
        connection.error = proxy_connection.error;
        connection.responsesWaitingCount--;
        var delta = new Date().getTime() - connection.actionStartTime;
        if(cont != false){
          if(connection.error != null){ 
            if(connection.response.error == null){
              connection.response.error = String(connection.error);
            }
          }
          api.socketServer.prepareSocketMessage(connection, connection.response, proxy_connection.messageCount);
        }
        api.log("[ action @ socket ]", 'info', {
          to: connection.remoteIP, 
          params: JSON.stringify(words), 
          action: proxy_connection.action, 
          duration: delta, 
          error: String(proxy_connection.error)
        });
      }});

      actionProcessor.processAction();
    }

    ////////////////////////////////////////////////////////////////////////////
    // check for break chars
    api.socketServer.checkBreakChars = function(chunk){
      var found = false;
      var hexChunk = chunk.toString('hex',0,chunk.length);
      if(hexChunk == "fff4fffd06"){
        found = true // CTRL + C
      }else if(hexChunk == "04"){
        found = true // CTRL + D
      }
      return found
    }

    ////////////////////////////////////////////////////////////////////////////
    // goodbye
    api.socketServer.goodbye = function(connection){
      try{ 
        api.log("[ quit @ socket ]", 'info', {to: connection.remoteIP});
        api.socketServer.prepareSocketMessage(connection, {status: "Bye!", context: "response", reason: 'request'}); 
        connection.rawConnection.end();
      }catch(e){ }
    }
    
    ////////////////////////////////////////////////////////////////////////////
    //message helper
    api.socketServer.prepareSocketMessage = function(connection, message, proxyMessageCount){
      if(connection.respondingTo != null){
        message.messageCount = connection.respondingTo;
        connection.respondingTo = null;
      }else if(message.context == "response"){
        if(proxyMessageCount != null){
          message.messageCount = proxyMessageCount;
        }else{
          message.messageCount = connection.messageCount;
        }
      }
      connection.sendMessage(message);
    }

    ////////////////////////////////////////////////////////////////////////////
    //shutdown helpers
    api.socketServer.gracefulShutdown = function(next, alreadyShutdown){
      if(alreadyShutdown == null){alreadyShutdown = false;}
      if(alreadyShutdown == false){
        api.socketServer.server.close();
        alreadyShutdown = true;
      }
      var pendingConnections = 0;
      for(var i in api.connections.connections){
        var connection = api.connections.connections[i];
        if(connection.type == "socket"){
          if (connection.responsesWaitingCount == 0){
            connection.rawConnection.end(JSON.stringify({status: "Bye!", context: "response", reason: 'server shutdown'}) + "\r\n");
          }else{
            pendingConnections++; 
            // hard shutdown in 5 seconds
            if(connection.shutDownTimer == null){
              connection.shutDownTimer = setTimeout(function(){
                connection.end(JSON.stringify({status: "Bye!", context: "response", reason: 'server shutdown'}) + "\r\n");
              }, 5000);
            }
          }
        }
      }
      if(pendingConnections > 0){
        api.log("[socket] waiting on shutdown, there are still " + pendingConnections + " connected clients waiting on a response", "notice");
        setTimeout(function(){
          api.socketServer.gracefulShutdown(next, alreadyShutdown);
        }, 1000);
      }else{
        if(typeof next == 'function'){ next(); }
      }
    }    

    next();

  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.socketServer = socketServer;
