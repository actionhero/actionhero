# node.js actionHero API Framework
[![Build Status](https://secure.travis-ci.org/evantahler/actionHero.png?branch=master)](http://travis-ci.org/evantahler/actionHero)

## Who is the actionHero?
actionHero is a [node.js](http://nodejs.org) API framework for both **tcp sockets** and **http clients**.  The goals of actionHero are to create an easy-to-use toolkit to get started making combination http and socket APIs as quickly as possible.

actionHero servers can process both requests and tasks (delayed actions like send e-mail or other batch jobs).  actionHero servers can also run in a cluster (on the same or multiple machines) to work in concert to handle your load.

The actionHero API defines a single access point and accepts GET, POST, and PUT input. You define "Actions" which handle input and response, such as "userAdd" or "geoLocate". HTTP, HTTPS, and TCP clients can all use these actions.  The actionHero API is not "RESTful" (which is meaningless for persistent socket connections). This was chosen to make it as simple as possible for devices/users to access the actions, including low-level embedded devices which may have trouble with all the HTTP verbs.  


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
* The metadata is used in reflexive and self-documenting actions in the API, such as `actionsView`.  `actions.inputs.required` and `actions.inputs.required` are used for both documentation and for building the whitelist of allowed GET and POST variables the API will accept (in addition to your schema/models).  

## Connecting

### HTTP

#### General
You can visit the API in a browser, Curl, etc.  `{url}?action` or `{url}/{action}` is how you would access an action.  For example, using the default ports in config.json you could reach the status action with both `http://127.0.0.1/status` or `http://127.0.0.1/?action=status`  The only action which doesn't return the default JSON format would be `file`, as it should return files with the appropriate headers if they are found, and a 404 error if they are not.

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

	> curl localhost:8080/api -v
	* About to connect() to localhost port 8080 (#0)
	*   Trying ::1... Connection refused
	*   Trying 127.0.0.1... connected
	* Connected to localhost (127.0.0.1) port 8080 (#0)
	> GET /api HTTP/1.1
	> User-Agent: curl/7.21.4 (universal-apple-darwin11.0) libcurl/7.21.4 OpenSSL/0.9.8r zlib/1.2.5
	> Host: localhost:8080
	> Accept: */*
	> 
	< HTTP/1.1 200 OK
	< Content-Type: application/json
	< X-Powered-By: actionHero API
	< Connection: keep-alive
	< Transfer-Encoding: chunked
	< 
	* Connection #0 to host localhost left intact
	* Closing connection #0
	{"serverInformation":{"serverName":"actionHero API","apiVersion":"0.1.5","requestDuration":16},"requestorInformation":{"remoteAddress":"127.0.0.1","RequestsRemaining":905,"recievedParams":{"limit":100,"offset":0}},"error":"undefined is not a known action."}

* you can provide the `?callback=myFunc` param to initiate a JSON-p response which will wrap the returned JSON in your callback function.  
* unless otherwise provided, the api will set default values of limit and offset to help with paginating long lists of response objects (default: limit=100, offset=0).
* the error if everything is OK will be "OK", otherwise, you should set a string error within your action
* to build the response for "hello" above, the action would have set `connection.response.hello = "world";`

You may also enable a HTTPS server with actionHero.  It works exactly the same as the http server, and you can have both running with little overhead.  The following information should be enabled in your `config.json` file:

	"secureWebServer" : {
		"port": 4443,
		"enable": true,
		"keyFile": "./certs/server-key.pem",
		"certFile": "./certs/server-cert.pem"
	},


#### Files and Routes

actionHero can also serve up flat files.  There is an action, `file` which is used to do this and a file server is part of the core framework (check out `initFileserver` for more information).  actionHero will not cache thses files, nor do we have any templating languages built in.  Each request to `file` will re-read the file from disk (like the nginx web server)

* /file and /api are  routes which expose the 'directories' of those types.  These top level paths can be configured in `config.json` with `api.configData.urlPathForActions` and `api.configData.urlPathForFiles`.
* the root of the web server "/" can be toggled to serve the content between /file or /api actions per your needs `api.configData.rootEndpointType`. The default is `api`.
* actionHero will serve up flat files (html, images, etc) as well from your ./public folder.  This is accomplished via a `file` action or via the 'file' route as described above. `http://{baseUrl}/file/{pathToFile}` is equivalent to `http://{baseUrl}?action=file&fileName={pathToFile}`. 
* Errors will result in a 404 (file not found).
* proper mime-type headers will be set when possible.

### Sockets

#### General

You can also access actionHero's methods via a persistent socket connection rather than http.  The default port for this type of communication is 5000.  There are a few special actions which set and keep parameters bound to your session (so they don't need to be re-posted).  These special methods are:

* quit. disconnect from the session
* paramAdd - save a singe variable to your connection.  IE: 'addParam screenName=evan'
* paramView - returns the details of a single param. IE: 'viewParam screenName'
* paramDelete - deletes a single param.  IE: 'deleteParam screenName'
* paramsView - returns a JSON object of all the params set to this connection
* paramsDelete - deletes all params set to this session
* roomChange - change the `room` you are connected to.  By default all socket connections are in the `api.configData.defaultSocketRoom` room.   
* roomView - show you the room you are connected to, and information about the members currently in that room.
* say [message]

Please note that any params set using the above method will be 'sticky' to the connection and sent for all subsequent requests.  Be sure to delete or update your params!

All socket connections are also joined to a room.  Rooms are used to broadcast messages from the system or other users.  Rooms can be created on the fly and don't require any special setup.  In this way. you can push messages to your users with a special function: `api.socketRoomBroadcast(api, connection, message)`.  `connection` can be null if you want the message to come from the server itself.  The final special action socket connections have is `say` which will tell a message to all other users in the room, IE: `say Hello World`.

API Functions for helping with room communications are:

* `api.socketRoomBroadcast(api, connection, message)`: tell a message to all members in a room
* `api.socketRoomStatus(api, room)`: return the status object which contains information about a room and its members
* `api.sendSocketMessage(api, connection, message)`: send a message directly to a socket connection


Every socket action (including the special param methods above) will return a single line denoted by \r\n  in JSON.  If the Action was executed successfully, the response will be `{"status":"OK"}`.

To help sort out the potential stream of messages a socket user may receive, it is best to set a "context" as part of the JSON response.  For example, by default all actions set a context of "response" indicating that the message being sent to the client is response to a request they sent.  Messages sent by a user via the 'say' command have the context of `user` indicating they came form a user.  Every minute a ping is sent from the server to keep the TCP connection alive and send the current time.  This message has the context of `api`.  Messages resulting from data sent to the api (like an action) will have the `response` context.

Socket Example:

	> telnet localhost 5000
	Trying 127.0.0.1...
	Connected to localhost.
	Escape character is '^]'.
	{"welcome":"Hello! Welcome to the actionHero api","room":"defaultRoom","context":"api","messageCount":0}
	randomNumber
	{"context":"response","randomNumber":0.6138995781075209,"messageCount":1}
	cacheTest
	{"context":"response","error":"key is a required parameter for this action","messageCount":2}
	paramAdd key=myKey
	{"status":"OK","context":"response","messageCount":3}
	paramAdd value=myValue
	{"status":"OK","context":"response","messageCount":4}
	paramsView
	{"context":"response","params":{"action":"cacheTest","limit":100,"offset":0,"key":"myKey","value":"myValue"},"messageCount":5}
	cacheTest
	{"cacheTestResults":{"key":"myKey","value":"myValue","saveResp":"new record","loadResp":"myValue","deleteResp":true},"messageCount":6}
	say hooray!
	{"context":"response","status":"OK","messageCount":7}
	{"context":"api","status":"keep-alive","serverTime":"2012-01-03T19:48:40.136Z","messageCount":8}

#### Files and Routes

Connections over socket can also use the file action.  

* errors are returned in the normal way `{error: someError}` rather than setting headers.  That wouldn't make sense in this context
* a successful file transfer will return the raw file data in a single send().  

## Cache
actionHero ships with the functions needed for an in-memory key-value cache.  Check the cacheTest action to see how to use it.  You can cache strings, numbers, arrays and objects (as long as they contain only strings, numbers, and arrays). Cache functions:

* `api.cache.save(api, key, value, expireTimeSeconds, next)`
* `api.cache.load(api, key, next)`
* `api.cache.destroy(api, key, next)`


api.cache.save is used to both create new entires or update existing cache entires.  If you don't define an expireTimeSeconds, the default will be used from `api.configData.cache.defaultExpireTimeSeconds`.  A task will periodically go though and delete expired cache entries.  If you are running a stand-alone version of actionHero, this cache will be in memory of the actionHero process, otherwise this data will be stored in redis.

Note: that the keys starting with an "_" should not be used, as they are in use by core parts of the system.

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

## actionCluster
actionHero can be run either as a stand-alone server or as part of a cluster.  The goal of actionCluster is to allow you to create a group of servers which will share memory state and all be able to handle requets and run tasks.  You can also add and remove nodes from the cluster without fear of data loss or task duplication.  You can run many instances of actionHero using node.js' cluster methods.

Using a [redis](http://redis.io/) backend, actionHero nodes can now truly share memory objects and have a common queue for tasks.  Philosophically, we have changed from a mesh network to a queue-based network.  This means that no longer will every node talk to every other node, but rather all nodes will talk to redis.  Now, I know that you are thinking "isn't that bad because it creates a single point of failure?"  Normally, the answer is yes, but redis already has mesh networking support! The suggested method of deployment is to setup a redis instance on each server, and they will handle the mesh networking for you.  

When working within an actionCluster the `api.cache` methods described above switch from using an in-process memory store, to using a common one based on redis.  This means that all peers will be in sync at all times.  The task system described below also becomes a common queue which all peers will work on draining.  There should be no changes needed to your use of the api to use the benifits of cluster deployment and synchronization.  

*There have recently been signigigant chagnes to the cluster system, so if you are upgrading from v1.x, please checkout the changelog.*

## Tasks
Tasks are special actions (potentially periodically run) the server will do at a set interval.  Tasks can be run on every node in the actionCluster or just one.  There are a few tasks which are core to actionHero which include:

* cleanLogFiles (all)
	* removes all files in `./log/` if they are larger than `api.configData.maxLogFileSize`
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
* `task.scope`: "any" or "all".  Should a single actionCluster server (any) run this task, or should all of them? For example, `calculateStats` is run by all peers in the action cluster (because we want to know all peer's status), but if you had a task to clean old sessions from your database or send an email, you would only want a single node to do that.
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
	
"all" tasks will be run on all nodes in the actionCluster, but "any" tasks will be run on all peers (and kept in thier own local queue)

## Requirements
* node.js server
* npm
* redis (for actionCluster)

## Install & Quickstart
* `npm install actionHero`
* Create a new file called `index.js`

The contents of `index.js` should look something like this:

	// load in the actionHero class
	var actionHero = require("actionHero").actionHero;
	
	// if there is no config.js file in the application's root, then actionHero will load in a collection of default params.  You can overwrite them with params.configChanges
	var params = {};
	params.configChanges = {
		"webServerPort" : 8080,
		"socketServerPort" : 5000
	}
	
	// start the server!
	actionHero.start(params);

* Start up the server: `node index.js`

You will notice that you will be getting warning messages about how actionHero is using default files contained within the NPM package.  This is normal until you replace those files with your own versions.  Visit `http://127.0.0.1:8080` in your browser and telnet to `telnet localhost 5000` to see the actionHero in action!

You can pragmatically control an actionHero server with `actionHero.start(params, callback)`, `actionHero.stop(callback)` and `actionHero.restart(callback)`

	var timer = 5000;
	actionHero.start(params, function(api){
		
		api.log(" >> Boot Sucessful!");
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

The actionCluster module contains no native code and is arranged like this:

	/
	|- actions
	|-- (the base actions)
	|
	|- certs
	|-- (example certs for the https server, keyed for 'localhost')
	|
	|- examples
	|-- (some common examples of using actionHero in the actionCluster)
	|
	|- initializers
	|-- (the common intiilzers for he web and socket servers, actions, logging, etc)
	|
	|- node_modules
	|-- (actionHero dependancies get installed here)
	|
	|- public
	|-- (default location for public assets served by /file path)
	|
	|- spec
	|-- (tests)
	|
	|- tasks
	|-- (default tasks)
	|
	_specHelper.js
	actionHero
	api.js
	config.json
	license.txt
	package.json
	readme.markdown
	utils.js
	versions.markdown
	
Your application structure should look similar.  

actions in /actions will be loaded in automatically, along /initializers and /tasks. /public will become your applicaiton's default static asset location.  You can make your own config.json in your application root with only the partial changes you want to use over the default settings.

	/
	|- actions
	|-- (your actions)
	|
	|- cache
	|-- (where the api.cache.data will be saved/loaded from)
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
	config.json
	package.json (be sure to include 'actionHero':'x')

## Extending actionHero
The first thing to do is to make your own ./actions (and ./models) folder.  If you like the default actions, feel free to copy them in.  You should also make you own tasks as defined above.

A common practice to extend the API is to add new classes which are not actions, but useful to the rest of the api.  The api variable is globally accessible to all actions within the API, so if you want to define something everyone can use, add it to the api object.  In the quickstart example, if we wanted to create a method to generate a random number, we could do the following:
	
	function initFunction(api, next){
		api.utils.randomNumber = function(){
			return Math.random() * 100;
		};
	};
	
	var actionHero = require("actionHero").actionHero;
	actionHero.start({initFunction: initFunction}, function(api){
		api.log("Loading complete!", ['green', 'bold']);
	});

Now `api.utils.randomNumber()` is available for any action to use!  It is important to define extra methods in a setter function which is passed to the API on boot via ``params.initFunction`.  This allows all threads in an cluster to access the methods. Even though the api object is returned to you, setting globally-available functions after initialization way may not propagate to the parts of actionHero.

## Configuration
Create a config.json file in the root of your project.  Here is the default configuration.  Any top-level values you do not set will be assuemd from the default.

	{ 
	    "apiVersion" : "2.0.0",
		"webServerPort" : 8080,
		"socketServerPort" : 5000,
		"serverName" : "actionHero API",
		"socketServerWelcomeMessage" : "Hello! Welcome to the actionHero api",
		"apiBaseDir" : "./node_modules/actionHero/",
		
		"secureWebServer" : {
			"port": 4443,
			"enable": true,
			"keyFile": "./certs/server-key.pem",
			"certFile": "./certs/server-cert.pem"
		},
		
		"httpheaders":{}
	
		"urlPathForActions" : "api",
		"urlPathForFiles" : "file",
		"rootEndpointType" : "api",
		
		"logging" : true,
		"logFolder" : "./log/",
		"logFile" : "api.log",
		"maxLogFileSize" : 10485760,
		"logTable" : "log",
		"logRequests" : true,
			
		"redis" : {
			"enable": true,
			"host": "127.0.0.1",
			"port": 6379,
			"password": null,
			"options": null,
			"DB": 0
		},

		"flatFileDirectory" : "./node_modules/actionHero/public/",
		"flatFileNotFoundMessage" : "Sorry, that file is not found :(",
		"flatFileIndexPageNotFoundMessage" : "Sorry, there is no index page for this folder :(",
	
		"defaultSocketRoom": "defaultRoom",

		"defaultLimit" : 100,
		"defaultOffset" : 0
	}

## Default Content
__Actions__:

* cacheTest - a test of the DB-based key-value cache system
* actionClusterCacheTest - another version of a cache test, but this one works across many nodes in the actionCluster.  This version also persists an object after the test is compete.
* actionsView - returns a list of available actions on the server and their metadata
* randomNumber - generates a random number
* status - returns server status and stats
* say - sends messages via http to clients connected via socket (in the room you specify)

__Files__:

There are also some static files (index.html and associate files for a test) included in `/public/` which you can check with the file action.

## Other Goodies 

### Safe Params
Params (GET and POST) provided by the user will be checked against a whitelist.  Any column headers in your tables (like firstName, lastName) will be accepted and additional params you define as required or optional in your actions `action.inputs.required` and `action.inputs.optional`.  Special params which the api will always accept are: 
	[
		"callback",
		"action",
		"limit",
		"offset",
		"outputType"
	];
Params are loaded in this order GET -> POST (normal) -> POST (multipart).  This means that if you have {url}?key=getValue and you post a variable `key`=`postValue` as well, the postValue will be the one used.  The only exception to this is if you use the URL method of defining your action.

### Logging
The `api.log()` method is available to you throughout the application.  `api.log()` will both write these log messages to file, but also display them on the console.  There are formatting options you can pass to ``api.log(yourMessage, options=[])`.  The options array can be many colors and formatting types, IE: `['blue','bold']`.  Check out `/initializers/initLog.js` to see the options.

Remember that one of the default actions will delete the log file if it gets over 10MB.

## Versions of this API
see `versions.markdown` to see what's new in each version

## Who?
* The primary creator of the actionHero framework is [Evan Tahler](http://evantahler.com)
* If you want to contribute to actionHero, contribute to the conversation on [github](https://github.com/evantahler/actionHero)

###
