# node.js actionHero API Framework

[![Build Status](https://secure.travis-ci.org/evantahler/actionHero.png?branch=master)](http://travis-ci.org/evantahler/actionHero)

[![Endorse Me](http://api.coderwall.com/evantahler/endorsecount.png)](http://coderwall.com/evantahler)

Links: [NPM](https://npmjs.org/package/actionHero) | [Public Site](http://www.actionherojs.com) | [GitHub](https://github.com/evantahler/actionHero) | [Client](https://github.com/evantahler/actionhero_client)

## Who is the actionHero?
actionHero is a [node.js](http://nodejs.org) **API framework** for both **tcp sockets**, **web sockets**, and **http clients**.  The goal of actionHero are to create an easy-to-use toolkit for making **reusable** & **scalable** APIs.

actionHero servers can process both requests and tasks (delayed actions like `send e-mail` or other background jobs).  actionHero servers can also run in a cluster (on the same or multiple machines) to work in concert to handle your load.

The actionHero API defines a single access point and accepts GET, POST, PUT and DELETE input along with persistent connection via TCP or web sockets. You define **Actions** which handle input and response, such as "userAdd" or "geoLocate". HTTP, HTTPS, and TCP clients can all use these actions.  The actionHero API is not inherently "RESTful" (which is meaningless for persistent socket connections) but can be extended to be so if you with.

actionHero will also serve static files for you, but actionHero is not a server-side website host (like express or rails).


## Actions
The core of actionHero is the Action framework, **actions** are the basic units of a request and work for HTTP and socket responses.  The goal of an action is to set the `connection.response` ( and `connection.error` when needed) value to build the response to the client

Here's an example of a simple action which will return a random number to the client:

	var action = {};
	
	/////////////////////////////////////////////////////////////////////
	// metadata
	action.name = "randomNumber";
	action.description = "I am an API method which will generate a random number";
	action.inputs = {
		"required" : [],
		"optional" : []
	};
	action.outputExample = {
		randomNumber: 123
	}
	
	/////////////////////////////////////////////////////////////////////
	// functional
	action.run = function(api, connection, next){
		connection.response.randomNumber = Math.random();
		next(connection, true);
	};
	
	/////////////////////////////////////////////////////////////////////
	// exports
	exports.action = action;

Notes:


* Actions are asynchronous, and require in the API object, the connection object, and the callback function.  Completing an action is as simple as calling `next(connection, true)`.  The second param in the callback is a boolean to let the framework know if it needs to render anything else to the client (default = true).  There are some actions where you may have already sent the user output (see the `file.js` action for an example) where you would not want to render the default messages.
* The metadata is used in reflexive and self-documenting actions in the API, such as `actionsView`.  `actions.inputs.required` and `actions.inputs.optional` are used for both documentation and for building the whitelist of allowed parameters the API will accept.  

## Connecting

### HTTP

#### General
You can visit the API in a browser, Curl, etc.  `{url}?action` or `{url}/{action}` is how you would access an action.  For example, using the default ports in `config.js` you could reach the status action with both `http://127.0.0.1:8080/status` or `http://127.0.0.1:8080/?action=status`  The only action which doesn't return the default JSON format would be `file`, as it should return files with the appropriate headers if they are found, and a 404 error if they are not.

HTTP responses follow the format:

	{
		hello: "world"
		serverInformation: {
			serverName: "actionHero API",
			apiVersion: 1,
			requestDuration: 14
		},
		requestorInformation: {
			remoteAddress: "127.0.0.1",
			RequestsRemaining: 989,
			recievedParams: {
				action: "",
				limit: 100,
				offset: 0
			}
		},
		error: "OK"
	}

HTTP Example: 

	> curl 'localhost:8080/api/status' -v | python -mjson.tool
	* About to connect() to localhost port 8080 (#0)
	*   Trying 127.0.0.1...
	* connected
	* Connected to localhost (127.0.0.1) port 8080 (#0)
	> GET /api/status HTTP/1.1
	> User-Agent: curl/7.24.0 (x86_64-apple-darwin12.0) libcurl/7.24.0 OpenSSL/0.9.8r zlib/1.2.5
	> Host: localhost:8080
	> Accept: */*
	> 
	< HTTP/1.1 200 OK
	< Content-Type: application/json
	< X-Powered-By: actionHero API
	< Date: Sun, 29 Jul 2012 23:25:53 GMT
	< Connection: keep-alive
	< Transfer-Encoding: chunked
	< 
	{ [data not shown]
	100   741    0   741    0     0   177k      0 --:--:-- --:--:-- --:--:--  361k
	* Connection #0 to host localhost left intact
	* Closing connection #0
	{
	    "error": "OK", 
	    "requestorInformation": {
	        "recievedParams": {
	            "action": "status", 
	            "limit": 100, 
	            "offset": 0
	        }, 
	        "remoteAddress": "127.0.0.1"
	    }, 
	    "serverInformation": {
	        "apiVersion": "3.0.0", 
	        "currentTime": 1343604353551, 
	        "requestDuration": 1, 
	        "serverName": "actionHero API"
	    }, 
	    "stats": {
	        "cache": {
	            "numberOfObjects": 0
	        }, 
	        "id": "10.0.1.12:8080:4443:5000", 
	        "memoryConsumption": 8421200, 
	        "peers": [
	            "10.0.1.12:8080:4443:5000"
	        ], 
	        "queue": {
	            "queueLength": 0, 
	            "sleepingTasks": []
	        }, 
	        "socketServer": {
	            "numberOfGlobalSocketRequests": 0, 
	            "numberOfLocalActiveSocketClients": 0, 
	            "numberOfLocalSocketRequests": 0
	        }, 
	        "uptimeSeconds": 34.163, 
	        "webServer": {
	            "numberOfGlobalWebRequests": 5, 
	            "numberOfLocalWebRequests": 3
	        }, 
	        "webSocketServer": {
	            "numberOfGlobalWebSocketRequests": 0, 
	            "numberOfLocalActiveWebSocketClients": 0
	        }
	    }
	}

* you can provide the `?callback=myFunc` param to initiate a JSONp response which will wrap the returned JSON in your callback function.  
* unless otherwise provided, the api will set default values of limit and offset to help with paginating long lists of response objects (default: limit=100, offset=0).  These are defined in `config.js`
* the error if everything is OK will be "OK", otherwise, you should set a string error within your action
* to build the response for "hello" above, the action would have set `connection.response.hello = "world";`

You may also enable a HTTPS server with actionHero.  It works exactly the same as the http server, and you can have both running with little overhead.  The following information should be enabled in your `config.js` file:

	configData.httpsServer = {
		"enable": true,
		"port": 4443,
		"keyFile": "./certs/server-key.pem",
		"certFile": "./certs/server-cert.pem",
		"bindIP": "0.0.0.0"
	};


#### Files and Routes for http and https clients

actionHero can also serve up flat files.  There is an action, `file.js` which is used to do this and a file server is part of the core framework (check out `initFileserver.js` for more information).  actionHero will not cache thees files and each request to `file` will re-read the file from disk (like the nginx web server).

* /public and /api are  routes which expose the 'directories' of those types.  These top level paths can be configured in `config.js` with `api.configData.commonWeb.urlPathForActions` and `api.configData.commonWeb.urlPathForFiles`.
* the root of the web server "/" can be toggled to serve the content between /file or /api actions per your needs `api.configData.commonWeb.rootEndpointType`. The default is `api`.
* actionHero will serve up flat files (html, images, etc) as well from your ./public folder.  This is accomplished via a `file` action or via the 'file' route as described above. `http://{baseUrl}/public/{pathToFile}` is equivalent to `http://{baseUrl}?action=file&fileName={pathToFile}` and `http://{baseUrl}/file/{pathToFile}`. 
* Errors will result in a 404 (file not found) with a message you can customize.
* Proper mime-type headers will be set when possible via the `mime` package.

### TCP Sockets

#### General

You can also access actionHero's methods via a persistent socket connection rather than http.  The default port for this type of communication is 5000.  There are a few special actions which set and keep parameters bound to your session (so they don't need to be re-posted).  These special methods are:

* `quit` disconnect from the session
* `paramAdd` - save a singe variable to your connection.  IE: 'addParam screenName=evan'
* `paramView` - returns the details of a single param. IE: 'viewParam screenName'
* `paramDelete` - deletes a single param.  IE: 'deleteParam screenName'
* `paramsView` - returns a JSON object of all the params set to this connection
* `paramsDelete` - deletes all params set to this session
* `roomChange` - change the `room` you are connected to.  By default all socket connections are in the `api.configData.defaultChatRoom` room.   
* `roomView` - show you the room you are connected to, and information about the members currently in that room.
* `detailsView` - show you details about your connection, including your public ID.
* `say` [message]

Please note that any params set using the above method will be 'sticky' to the connection and sent for all subsequent requests.  Be sure to delete or update your params before your next request.

Every socket action will return a single line denoted by `\r\n` which is a JSON object.  If the Action was executed successfully, the response will be `{"status":"OK"}`.

To help sort out the potential stream of messages a socket user may receive, it is best to set a "context" as part of the JSON response.  For example, by default all actions set a context of "response" indicating that the message being sent to the client is response to a request they sent (either an action or a chat action like `say`).  Messages sent by a user via the 'say' command have the context of `user` indicating they came form a user.  Messages resulting from data sent to the api (like an action) will have the `response` context.

Socket Example:

	> telnet localhost 5000
	Trying 127.0.0.1...
	Connected to localhost.
	Escape character is '^]'.
	{"welcome":"Hello! Welcome to the actionHero api","room":"defaultRoom","context":"api","messageCount":0}
	detailsView
	{"context":"response","status":"OK","details":{"params":{},"public":{"id":"86b43f5a32e6addb08d7cacd8773325e","connectedAt":1346909099674}},"messageCount":1}
	randomNumber
	{"context":"response","randomNumber":0.6138995781075209,"messageCount":2}
	cacheTest
	{"context":"response","error":"key is a required parameter for this action","messageCount":3}
	paramAdd key=myKey
	{"status":"OK","context":"response","messageCount":4}
	paramAdd value=myValue
	{"status":"OK","context":"response","messageCount":5}
	paramsView
	{"context":"response","params":{"action":"cacheTest","limit":100,"offset":0,"key":"myKey","value":"myValue"},"messageCount":6}
	cacheTest
	{"cacheTestResults":{"key":"myKey","value":"myValue","saveResp":"new record","loadResp":"myValue","deleteResp":true},"messageCount":7}
	say hooray!
	{"context":"response","status":"OK","messageCount":8}
	{"context":"api","status":"keep-alive","serverTime":"2012-01-03T19:48:40.136Z","messageCount":9}
	
In your actions, you can send a message directly to a TCP client (without relying on chat rooms) like this:`api.sendSocketMessage(api, connection, message)`

#### Files and Routes for TCP clients

Connections over socket can also use the file action.  There is no 'route' for files.

* errors are returned in the normal way `{error: someError}`
* a successful file transfer will return the raw file data in a single send().  There will be no headers set.

### Web Sockets 

#### General
actionHero uses [socket.io](http://socket.io/) for web sockets.  Within actionHero, web sockets are bound to either the http or https server (only one can be used at this time).  Also, if you are using a redis backend store (which is required to use actionHero in a cluster), socket.io will be configured to use this store automatically.

Just like the additional actions added for TCP connection, web socket connections have access to the chat room methods.  A template which exposes them is available in examples and looks like this:

	<script src="/public/javascript/socket.io/socket.io.js"></script>
	<script>
		var socket = io.connect('http://localhost:8080/');
		
		socket.on('welcome', function(data){
			console.log("connected!")
			console.log(JSON.stringify(data));
		});
	
		// responses to action or chat room function
		socket.on('response', function(data){
			console.log(JSON.stringify(data));
		});
	
		// responses to chatRoom
		socket.on('say', function(data){
			console.log(JSON.stringify(data));
		})
	
		// call an action
		var action = function(action, params){
			// params = {key1: 'value_1', key2: 'value2'}
			if (params == null){ params = {}; )
			params['action'] = action;
			socket.emit("action", params);
		}

		// get my details
		var getDetails = function(){
			socket.emit("detailsView");
		}
	
		// chat room functions
		var say = function(message){
			// message = "hello world"
			socket.emit("say", {message: message});
		}
		var roomView = function(){
			socket.emit("roomView");
		}
		var roomChange = function(room){
			// room = "newRoomName"
			socket.emit("roomChange", {room: room});
		}
	
		// disconnect
		var quit = function(){
			socket.emit("quit");
		}
	
	</script>


## Chat Rooms

All persistent connections (TCP and web socket) are also joined to a chat room.  Rooms are used to broadcast messages from the system or other users.  Rooms can be created on the fly and don't require any special setup.  In this way. you can push messages to your users with a special function: `api.chatRoom.socketRoomBroadcast(api, connection, message, [fromQueue])`.  `connection` can be null if you want the message to come from the server itself.  The special action for persistent connections is `say` which will tell a message to all other users in the room, IE: `say Hello World`.

API Functions for helping with room communications are below.  You can craft actions to use these methods to also allow http clients to "chat".

* `api.chatRoom.socketRoomBroadcast(api, connection, message, [fromQueue])`: tell a message to all members in a room.  `fromQueue` is an internal optional parameter to indicate if the message has come form a peer connected to this server, or another peer in the actionCluster.
* `api.chatRoom.socketRoomStatus(api, room, next)`: return the status object which contains information about a room and its members


## Cache
actionHero ships with the functions needed for an in-memory key-value cache.  You can cache strings, numbers, arrays and objects (anything that responds to `JSON.stringify`). Cache functions:

* `api.cache.save(api, key, value, expireTimeMS, next)`
* `api.cache.load(api, key, next)`
* `api.cache.destroy(api, key, next)`


`api.cache.save` is used to both create new entires or update existing cache entires.  If you don't define an expireTimeMS.  Using `null` here will cause this cached item to not expire.  Objects will not be returned if they have expired, although they will no be removed from RAM/disc.  There is an example task provided you can use to periodically free up expired cache entries.  If you are running a stand-alone version of actionHero, this cache will be in memory of the actionHero process, otherwise this data will be stored in redis.

Note: that the keys starting with an "_" should not be used, as they are in use by core parts of the system, such as the task queue.

**api.cache.save**: Response

* true / false
	* will be true unless the object could not be saved (perhaps out of ram or a bad object type).
	* overwriting an existing object will return `true`

**api.cache.load**: Response

* `(value, expireTimestamp, createdAt, readAt)`
	* value will be the object which was saved
	* expireTimestamp(ms) is when the object is set to expire in system time
	* createdAt(ms) is when the object was created
	* readAt(ms) is the timestamp at which the object was last read with `api.cache.load`

**api.cache.destroy**: Response

* true / false
	* will be false if the object cannot be found
	
You can see an example of using the cache within an action in `[actions/cacheTest.js](https://github.com/evantahler/actionHero/blob/master/actions/cacheTest.js)`

## actionCluster
actionHero can be run either as a stand-alone server or as part of a cluster.  The goal of actionCluster is to allow you to create a group of servers which will share memory state and all be able to handle requets and run tasks.  You can also add and remove nodes from the cluster without fear of data loss or task duplication.  You can run many instances of actionHero using node.js' cluster methods.

Using a [redis](http://redis.io/) backend, actionHero nodes can now share memory objects and have a common queue for tasks.  Philosophically, we have changed from a mesh network (actionHero versions prior to v2) to a queue-based network (action hero after version 2).

When working within an actionCluster the `api.cache` methods described above switch from using an in-process memory store, to using a common one based on redis.  This means that all peers will have access to all data stored in the cache.  The task system described below also becomes a common queue which all peers will work on draining.  There should be no changes needed to your use of the api to use the benefits of cluster deployment and synchronization.  Using a redis-based backend works for both a cluster hosted on many physically separate hosts or if you set using the [node.js cluster module](https://github.com/evantahler/actionHero/blob/master/actionHeroCluster) on one host, or both at the same time.

*There have recently been significant changes to the cluster system since v1.x, please checkout the change-log if you are upgrading from an older version.*

## Tasks
Tasks are background jobs meant to be run asynchronously from a request.  With actionHero, there is no need to run a separate job processing/queuing process.  Using the node.js event loop, background tasks can be processed in-line with web requests in a non-blocking way.  Tasks are built like actions, but they can be run as called or periodically.  Tasks can be run on every node in the actionCluster or just one.  There is one task which is core to action hero `runAction`, but there are a number of example tasks provided:

* cleanLogFiles (all)
	* removes all files in `./log/` if they are larger than `api.configData.general.maxLogFileSize`
	* runs every 60 seconds
* cleanOldCacheObjects (any)
	* removes expired objects in `api.cache.data`
	* runs every 10 seconds
* pingSocketClients (all)
	* sends a keep-alive message to all TCP socket clients
	* runs every 60 seconds
* runAction (any)
	* a wrapper to run an action as a task
	* will not run automatically

You can create you own tasks by placing them in a `./tasks/` folder at the root of your application.  Like actions, all tasks have some required metadata:

* `task.name`: The unique name of your task
* `task.description`: a description
* `task.scope`: "**any**" or "**all**".  Should a single actionCluster server (any) run this task, or should all of them? For example, `pingSocketClients` is run by all peers in the action cluster (because we want all clients to be pinged), but if you had a task to clean old sessions from your database or send an email, you would only want a single node to do that.
* `task.frequency`: In milliseconds, how often should I run?.  Setting me to 0 will cause me not to run automatically, but I can still be run with `api.task.run`

To enqueue a task (the normal way of doing things) use `api.tasks.enqueue(api, taskName, runAtTime, params)`.  To run a task in the future, set runAtTime, otherwise leave it null or set in the past.


As stated above, any task can also be called programmatically with `api.tasks.run(api, taskName, params, next)`.

An example Task:

	var task = {};
	
	/////////////////////////////////////////////////////////////////////
	// metadata
	task.name = "sayHello";
	task.description = "I am a demo task which will be run only on one peer";
	task.scope = "any";
	task.frequency = 1000;
	
	/////////////////////////////////////////////////////////////////////
	// functional
	task.run = function(api, params, next){
		api.log("----- Hi There! ----", "green");
		next(true);
	};
	
	/////////////////////////////////////////////////////////////////////
	// exports
	exports.task = task;
	
This task will be run every ~1 second on the first peer to be free after that one second has elapsed.  It is important to note that the `runAt` time is setting the when the task is 'allowed' to be run, not explicitly when it will be run.  Due to this, it is highly likely that your task will be run slightly after the set runAt time.

## Requirements
* node.js server
* npm
* redis (for actionCluster)

## Install & Quickstart

**tl;dr: `mkdir ~/project && cd ~/project; npm install actionHero; npm run-script actionHero generate; npm start`**

* Create a new directory `mkdir ~/project && cd ~/project`
* Checkout the actionHero source `npm install actionHero`
* Use the generator to create a template project `npm run-script actionHero generate`
* Create a new file called `index.js`
* Start up the server: `npm start`

Visit `http://127.0.0.1:8080` in your browser and telnet to `telnet localhost 5000` to see the actionHero in action!

You can programmatically control an actionHero server with `actionHero.start(params, callback)`, `actionHero.stop(callback)` and `actionHero.restart(callback)`

	var timer = 5000;
	actionHero.start(params, function(api){
		
		api.log(" >> Boot Successful!");
		setTimeout(function(){
			
			api.log(" >> restarting server...");
			actionHero.restart(function(){
				
				api.log(" >> Restarted!");
				setTimeout(function(){
					
					api.log(" >> stopping server...");
					actionHero.stop(function(){
						
						api.log(" >> Stopped!");
						process.exit();
						
					});
				}, timer);
			})
		}, timer);
	});
	
## Application Structure

Actions in /actions will be loaded in automatically, along /initializers and /tasks. /public will become your applicaiton's default static asset location.  You can make your own config.json in your application root with only the partial changes you want to use over the default settings.

	/
	|- actions
	|-- (your actions)
	|
	|- certs
	|-- (your https certs for your domain)
	|
	|- initializers
	|-- (any additional initializers you want)
	|
	|- log
	|-- (default location for logs)
	|
	|- node_modules
	|-- (your modules, actionHero should be npm installed in here)
	|
	|- public
	|-- (your static assets to be served by /file)
	|
	|- tasks
	|-- (your tasks)
	|
	your_main_app.js
	config.js
	package.json (be sure to include 'actionHero':'x')

## Extending actionHero
The first thing to do is to make your own ./actions and ./tasks folder.  If you like the default actions, feel free to copy them in.  A common practice to extend the API is to add new classes which are not actions, but useful to the rest of the api.  The api variable is globally accessible to all actions within the API, so if you want to define something everyone can use, add it to the api object.  In the quickstart example, if we wanted to create a method to generate a random number, we could do the following:
	
	function initFunction(api, next){
		api.utils.randomNumber = function(){
			return Math.random() * 100;
		};
	};
	
	var actionHero = require("actionHero").actionHero;
	actionHero.start({initFunction: initFunction}, function(api){
		api.log("Loading complete!", ['green', 'bold']);
	});

Now `api.utils.randomNumber()` is available for any action to use!  It is important to define extra methods in a setter function which is passed to the API on boot via `params.initFunction`. Even though the api object is returned to you, setting globally-available functions after initialization may not propagate to the parts of actionHero.

## Configuration
Create a `config.js` file in the root of your project.  Here is the default configuration.  Any top-level values you do not set will be assumed from the default.

	var configData = {};
	
	/////////////////////////
	// General Information //
	/////////////////////////
	
	configData.general = {
		"apiVersion": "3.0.0",
		"serverName": "actionHero API",
		// The welcome message seen by TCP and webSocket clients upon connection
		"welcomeMessage" : "Hello! Welcome to the actionHero api",
		// The location of this package relative to your project
		"apiBaseDir": "./node_modules/actionHero/",
		"flatFileDirectory": "./node_modules/actionHero/public/",
		"flatFileNotFoundMessage": "Sorry, that file is not found :(",
		"flatFileIndexPageNotFoundMessage": "Sorry, there is no index page for this folder :(",
		// the chatRoom that TCP and webSocket clients are joined to when the connect
		"defaultChatRoom": "defaultRoom",
		// defaultLimit & defaultOffset are useful for limiting the length of response lists.  
		// These params will always be appended to any request as "limit" and "offest" unless set by the client
		"defaultLimit": 100,
		"defaultOffset": 0,
	};
	
	/////////////
	// logging //
	/////////////
	
	configData.log = {
		"logging" : true,
		"logFolder" : "./log/",
		"logFile" : "api.log",
		// Should we log the actual requests coming in (and their params)?
		"logRequests" : true,
	};
	
	///////////
	// Redis //
	///////////
	
	configData.redis = {
		"enable": true,
		"host": "127.0.0.1",
		"port": 6379,
		"password": null,
		"options": null,
		"DB": 0
	};
	
	///////////////////////////////////////
	// Common HTTP & HTTPS Configuration //
	///////////////////////////////////////
	
	configData.commonWeb = {
		// Any additional headers you want actionHero to respond with
		"httpHeaders" : { },
		// route which actions will be served from
		// secondary route against this route will be treated as actions, IE: /api/?action=test == /api/test/
		"urlPathForActions" : "api",
		// route which static files will be served from
		// folder path (relitive to your project root) to server static content from
		"urlPathForFiles" : "public",
		// when visiting the root URL, should visitors see "api" or "public"?
		// visitors can always visit /api and /public as normal
		"rootEndpointType" : "api",
	};
	
	/////////////////
	// HTTP Server //
	/////////////////
	
	configData.httpServer = {
		"enable": true,
		"port": 8080,
		// which IP to listen on (use 0.0.0.0 for all)
		"bindIP": "0.0.0.0"
	};
	
	//////////////////
	// HTTPS Server //
	//////////////////
	
	configData.httpsServer = {
		"enable": true,
		"port": 4443,
		"keyFile": "./certs/server-key.pem",
		"certFile": "./certs/server-cert.pem",
		// which IP to listen on (use 0.0.0.0 for all)
		"bindIP": "0.0.0.0"
	};
	
	////////////////
	// TCP Server //
	////////////////
	
	configData.tcpServer = {
		"enable": true,
		"port": 5000,
		// which IP to listen on (use 0.0.0.0 for all)
		"bindIP": "0.0.0.0"
	};
	
	/////////////////
	// Web Sockets //
	/////////////////
	
	configData.webSockets = {
		// You must have either the http or https server enabled for websockets
		"enable": true,
		// which web interface to bind the websockets to (http or https)
		"bind" : "http",
		"logLevel" : 1,
		"settings" : [
			"browser client minification",
			"browser client etag",
			"browser client gzip"
		]
	};
	
	//////////////////////////////////
	
	exports.configData = configData;

## Example Content
__Actions__:

* cacheTest - a test of the DB-based key-value cache system
* actionClusterCacheTest - another version of a cache test, but this one works across many nodes in the actionCluster.  This version also persists an object after the test is compete.
* actionsView - returns a list of available actions on the server and their metadata
* randomNumber - generates a random number
* status - returns server status and stats
* say - sends messages via http to clients connected via socket (in the room you specify)

__Files__:

There are also some static files (index.html and associate files for a test) included in `/public/` which you can check with the file action.  Check out `/examples` for clients and other ways to configure actionHero.

## Other Goodies 

### Safe Params
Params provided by the user (GET, POST, etc for http and https servers, setParam for TCP clients, and passed to action calls from a web socket client) will be checked against a whitelist.  Variables defined in your actions by `action.inputs.required` and `action.inputs.optional` will be aded to your whitelist.  Special params which the api will always accept are: 
	[
		"callback",
		"action",
		"limit",
		"offset",
		"outputType"
	];
Params are loaded in this order GET -> POST (normal) -> POST (multipart).  This means that if you have {url}?key=getValue and you post a variable `key`=`postValue` as well, the postValue will be the one used.  The only exception to this is if you use the URL method of defining your action.  You can add arbitrary params to the whitelist by adding them to the `api.postVariables` array in you initializers. 

### Logging
The `api.log()` method is available to you throughout the application.  `api.log()` will both write these log messages to file, but also display them on the console.  There are formatting options you can pass to `api.log(yourMessage, options=[])`.  The options array can be many colors and formatting types, IE: `['blue','bold']`.  Check out `/initializers/initLog.js` to see the options.

## Versions of this API
see [versions.md](https://github.com/evantahler/actionHero/blob/master/versions.md) to see what's new in each version

## Who?
* The primary creator of the actionHero framework is [Evan Tahler](http://evantahler.com)
* If you want to contribute to actionHero, contribute to the conversation on [github](https://github.com/evantahler/actionHero)

###
