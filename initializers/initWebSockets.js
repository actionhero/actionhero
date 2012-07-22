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
			// api.log( "(socket.io) " + original_message, "red");
		},
		info: function(original_message){
			// api.log( "(socket.io) " + original_message);
		},
		debug: function(original_message){
			// api.log( "(socket.io) " + original_message, "grey");
		}
	};

	var io_http = api.io.listen(api.webServer.webApp);
	IOs.push(io_http);
	// TODO: Having 2 of these open at the same time crashes when redis is in use
	// if(api.configData.secureWebServer.enable){
	// 	var io_https = api.io.listen(api.webServer.secureWebApp);
	// 	IOs.push(io_https);
	// }

	for(var i in IOs){
		var io = IOs[i];

		io.set('log level', 0);
		io.enable('browser client minification'); 
		io.enable('browser client etag');
		io.enable('browser client gzip');

		var c = api.configData.redis;
		if(c.enable == true){
			var RedisStore = require('socket.io/lib/stores/redis');
			var pub    = api.redisPackage.createClient(c.port, c.host, c.options);
			var sub    = api.redisPackage.createClient(c.port, c.host, c.options);
			var client = api.redisPackage.createClient(c.port, c.host, c.options);

			pub.on("error", function(msg){ logger.error(msg); })
			sub.on("error", function(msg){ logger.error(msg); })
			client.on("error", function(msg){ logger.error(msg); })

			if(c.password != null){ 
				pub.auth(c.password, function(){
					pub.select(c.DB, function(err,res){});
				}); 
				sub.auth(c.password, function(){
					sub.select(c.DB, function(err,res){});
				}); 
				client.auth(c.password, function(){
					client.select(c.DB, function(err,res){});
				}); 
			}else{
				pub.select(c.DB, function(err,res){});
				sub.select(c.DB, function(err,res){});
				client.select(c.DB, function(err,res){});
			}
		}

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

	    	connection.on('exit', function(data){ connection.disconnect(); });
	    	connection.on('quit', function(data){ connection.disconnect(); });
	    	connection.on('close', function(data){ connection.disconnect(); });
	    	
	    	connection.on('test', function(data){
	    		console.log(data)
	    	});
	    	connection.on('roomView', function(data){});
	    	connection.on('roomChange', function(data){});
	    	connection.on('say', function(data){});
	    	connection.on('action', function(data){});

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