////////////////////////////////////////////////////////////////////////////
// Web Sockets via Socket.IO

var initWebSockets = function(api, next)
{
	api.webSockets = {};
	api.webSockets.clients = [];
	var IOs = [];

	var logger = {
		error: function(original_message){
			api.log( "(socket.io) " + original_message, ["red", "bold"]);
		},
		warn: function(original_message){
			api.log( "(socket.io) " + original_message, "red");
		},
		info: function(original_message){
			api.log( "(socket.io) " + original_message);
		},
		debug: function(original_message){
			api.log( "(socket.io) " + original_message, "grey");
		}
	};

	var io_http = api.io.listen(api.webServer.webApp);
	IOs.push(io_http);
	if(api.configData.secureWebServer.enable){
		var io_https = api.io.listen(api.webServer.secureWebApp);
		IOs.push(io_https);
	}

	var c = api.configData.redis;
	if(c.enable == true){
		var RedisStore = require('socket.io/lib/stores/redis');
		var pub    = api.redisPackage.createClient(c.port, c.host, c.options);
		var sub    = api.redisPackage.createClient(c.port, c.host, c.options);
		var client = api.redisPackage.createClient(c.port, c.host, c.options);

		if(c.password != null){ 
			pub.auth(c.password, function(){}); 
			sub.auth(c.password, function(){}); 
			client.auth(c.password, function(){}); 
		}
	}

	for(var i in IOs){
		var io = IOs[i];

		io.set('log level', 3);
		io.enable('browser client minification'); 
		io.enable('browser client etag');
		io.enable('browser client gzip');
		io.set('logger', logger);

		if(c.enable == true){
			io.set('store', new RedisStore({
				redisPub : pub,
				redisSub : sub,
				redisClient : client
			}));
		}

		io.sockets.on('connection', function(connection){
			api.webSockets.clients.push(connection);
			api.stats.incrament(api, "numberOfWebSocketRequests");
			api.socketServer.numberOfLocalWebSocketRequests++;
			// console.log(connection)

			connection.type = "webSocket";
			connection.params = {};
			connection.remoteIP = connection.handshake.address.address;
			connection.room = api.configData.defaultSocketRoom;
			connection.messageCount = 0;
			connection.public = {};
			connection.public.id = connection.id;

			api.stats.incrament(api, "numberOfActiveWebSocketClients");
	    	api.log("webSocket connection "+connection.remoteIP+" | connected");

			var welcomeMessage = {welcome: api.configData.socketServerWelcomeMessage, room: connection.room, context: "api"};
	    	connection.emit('welcome', welcomeMessage);

	    	connection.on('exit', function(){ connection.disconnect(); });
	    	connection.on('quit', function(){ connection.disconnect(); });
	    	connection.on('close', function(){ connection.disconnect(); });
	    	
	    	connection.on('roomView', function(){});
	    	connection.on('roomChange', function(){});
	    	connection.on('say', function(){});
	    	connection.on('action', function(){});

			// socket.emit('news', { hello: 'world' });
		    //  socket.on('my other event', function (data) {
		    //    console.log(data);
		    //  });

			connection.on('disconnect', function(){
				// TODO: This never gets called?
				api.log("webSocket connection "+connection.remoteIP+" | disconnected");
				api.stats.incrament(api, "numberOfActiveWebSocketClients", -1);
			})
		});


	}

	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebSockets = initWebSockets;