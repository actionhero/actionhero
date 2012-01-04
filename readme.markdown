# node.js actionHero API Framework
[![Build Status](https://secure.travis-ci.org/evantahler/actionHero.png)](http://travis-ci.org/evantahler/actionHero)

## Who is an actionHero?
actionHero is a minimalist transactional API framework for sockets and http clients using [node.js](http://nodejs.org).  It was inspired by the [DAVE PHP framework](http://github.com/evantahler/php-dave-api).  The goals of actionHero are to create an easy-to-use framework to get started making combination http and socket APIs as quickly as possible.

The actionHero API aims to simplify and abstract may of the common tasks that these types of APIs require.  actionHero does the work for you, and he's not _CRUD_, and he's never taking a _REST_.  I was tired of "heavy" frameworks that were designed to run as monolithic applications which include M's, V's, and C's together in a single running application.  This tethering of view to business logic doesn't make much sense in modern web development (from a server PoV) when your presentation layer can just as easily be a mobile application or a website. 

The actionHero API defines a single access point and accepts GET and POST input. You define "Actions" which handle input and response, such as "userAdd" or "geoLocate". The actionHero API is NOT "RESTful", in that it does not use the normal http verbs (Get, Put, etc) and uses a single path/endpoint. This was chosen to make it as simple as possible for devices/users to access the actions, including low-level embedded devices which may have trouble with all the HTTP verbs.  To see how simple it is to handle basic actions this package comes with a few basic Actions included. Check them out in `api/actions/`.    

## Actions
The meat of actionHero is the Action framework.  Actions are the basic units of a request and work for HTTP and socket responses.  The goal of an action is to set the `connection.response` ( and `connection.error` when needed) value to build the response to the client

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


* Actions are asynchronous, and take in the API object, the connection object, and the callback function.  Completing an action is as simple as calling `next(connection, true)`.  The second param in the callback is a boolean to let the framework know if it needs to render anything else to the client (default = true).  There are some actions where you may have already sent the user output (see the `file.js` action for an example) where you would not want to render the default messages.
* The metadata is used in reflexive and self-documenting actions in the API, such as `actionsView`.  `actions.inputs.required` and `actions.inputs.required` are used for both documentation and for building the whitelist of allowed GET and POST variables the API will accept (in addition to your schema/models).  

## Models & mySQL
actionHero uses the sequelizeJS mySQL ORM.  It is awesome.  Models (located in `./models/`) are used to define ORM objects in the API.  actionHero also adds seeding abilities to the API to pre-populate the database if needed.  Here is the default model for the cache table which ships with actionHero (in ./models/cache.js):

	function defineModel(api)
	{
		var model = api.dbObj.define('Cache', {
			key: { type: api.SequelizeBase.STRING, allowNull: false, defaultValue: null, unique: true, autoIncrement: false},
			value: { type: api.SequelizeBase.STRING, allowNull: false, defaultValue: null, unique: false, autoIncrement: false},
			expireTime: { type: api.SequelizeBase.DATE, allowNull: false, defaultValue: null, unique: false, autoIncrement: false}
		});	
		return model;
	}
	
	function defineSeeds(api){
		return null;
	}
	
	exports.defineModel = defineModel;
	exports.defineSeeds = defineSeeds;

Seeds are simple JSON objects.  You don't need to set all the values as long as they have sensible defaults in the model definition.  Seeding is only run if the table is empty.  If you wanted a seed, you would add it like so:

	function defineSeeds(api){
		var seeds = [
			{key: "foo", value:"bar"},
			{key: "foo2", value:"bar2"},
		];
		return seeds;
	}

You can then use api.models[myModel] to use the normal sequelize functions on.  Check [http://www.sequelizejs.com](www.sequelizejs.com) for more info.  Here's how you would add a log record:

	var logRecord = api.models.log.build({
		ip: connection.remoteIP,
		action: connection.action,
		error: connection.error,
		params: JSON.stringify(connection.params)
	});
	logRecord.save();

actionHero also uses the native node-mysql package so you can execute raw mySQL queries.  To use this, you can make use of the `api.rawDBConnction.query` object.  For example: 

	api.rawDBConnction.query("describe myTable", function(err, rows, fields) {
		// do stuff
	});

## Tasks
Tasks are special periodically run actions the server will do at a set interval.  Because nodeJS has internal timers, it's simple to emulate a "cron" functionality in the server.  Some of the example tasks which ship with actionHero cleanup expired sessions and cache entries in the DB, and also check to see if the log file has gotten to large.  Huzzah for the event queue!

The basic structure of a task _extends_ the task prototype like this example.

Make you own tasks in a `tasks.js` file in your project root.

	var tasks = {};
	
	////////////////////////////////////////////////////////////////////////////
	// generic task prototype
	tasks.Task = { 
		// prototypical params a task should have
		"defaultParams" : {
			"name" : "generic task",
			"desc" : "I do a thing!"
		},
		init: function (api, params, next) {
			this.params = params || this.defaultParams;
			this.api = api;
			if (next != null){this.next = next;}
			this.api.log("  starging task: " + this.params.name, "yellow");
		},
		end: function () {
			this.api.log("  completed task: " + this.params.name, "yellow");
			if (this.next != null){this.next();}
		},		
		run: function() {
			this.api.log("RUNNING: "+this.params.name);
		}
	};

	////////////////////////////////////////////////////////////////////////////
	// A test task 
	tasks.testTask = function(api, next) {
		var params = {
			"name" : "Test Task",
			"desc" : "I will say 'hello world' to the console every time I run"
		};
		var task = Object.create(api.tasks.Task);
		task.init(api, params, next);
		task.run = function() {
			console.log("Hello World!");
			task.end();
		};
		task.run();
	};
	
	////////////////////////////////////////////////////////////////////////////
	// Export
	exports.tasks = tasks;

All of the metadata in the example task is required, as is task.init and task.run.  Note that task.run calls the task.end() callback at the close of it's execution.  `cron.js` manages the running of tasks and runs at the `api.configData.cronTimeInterval` (ms) interval defined in `config.json`

## Connecting

### HTTP

#### General
You can visit the API in a browser, Curl, etc.  `{url}?action` or `{url}/{action}` is how you would access an action.  For example, using the default ports in config.json you could reach the status action with both `http://127.0.0.1/status` or `http://127.0.0.1/?action=status`  The only action which doesn't return the default JSON format would be `file`, as it should return files with the appropriate headers if they are found, and a 404 error if they are not.

HTTP responses follow the format:

	{
		hello: "world"
		serverInformation: {
			serverName: "actionHero API",
			apiVerson: 1,
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
	{"serverInformation":{"serverName":"actionHero API","apiVerson":"0.1.5","requestDuration":16},"requestorInformation":{"remoteAddress":"127.0.0.1","RequestsRemaining":905,"recievedParams":{"limit":100,"offset":0}},"error":"undefined is not a known action."}

* you can provide the `?callback=myFunc` param to initiate a JSON-p response which will wrap the returned JSON in your callback function.  
* unless otherwise provided, the api will set default values of limit and offset to help with paginating long lists of response objects (default: limit=100, offset=0).
* the error if everything is OK will be "OK", otherwise, you should set a string error within your action
* to build the response for "hello" above, the action would have set `connection.response.hello = "world";`

#### Files and Routes

actionHero can also serve up flat files.  There is an action, `file` which is used to do this and a file server is part of the core framework (check out `initFileserver` for more information).  

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

## Requirements
* node.js server
* npm
* mySQL (other ORMs coming soon?)

## Install & Quickstart
* `npm install actionHero`
* start up mySQL and create a new database called `action_hero_api` ( and `action_hero_api_test`if you want to run the tests)
* Create a new file called `index.js`

The contents of `index.js` should look something like this:

	// load in the actionHero class
	var actionHero = require("actionHero").actionHero;
	
	// if there is no config.js file in the application's root, then actionHero will load in a collection of default params.  You can overwrite them with params.configChanges
	var params = {};
	params.configChanges = {
		"database" : {
	        "host" : "127.0.0.1",
			"database" : "action_hero_api",
			"username" : "root",
			"password" : null,
			"port" : "3306",
			"consoleLogging" : false
	    },
		"webServerPort" : 8080,
		"socketServerPort" : 5000
	}
	
	// start the server!
	actionHero.start(params);

* Start up the server: `node index.js`

You will notice that you will be getting warning messages about how actionHero is using default files contained within the NPM package.  This is normal until you replace those files with your own versions.  actionHero will not create databases on its own, so you should create the `action_hero_api` database on your local mySQL server.  Visit `http://127.0.0.1:8080` in your browser and telnet to `telnet localhost 5000` to see the actionHero in action!

## Extending actionHero
The first thing to do is to make your own ./actions and ./models folders.  If you like the default actions, feel free to copy them in.  You should also make you own ``tasks.js` file.

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

Now `api.utils.randomNumber()` is available for any action to use!  It is important to define extra methods in a setter function which is passed to the API on boot via ``params.initFunction`.  This allows all threads in an cluster to access the methods. Setting them another way may not propagate to the children of a node cluster.

## Default Actions you can try `?action=..` which are included in the framework:
* cacheTest - a test of the DB-based key-value cache system
* actionsView - returns a list of available actions on the server and their metadata
* randomNumber - generates a random number
* status - returns server status and stats
* say - sends messages via http to clients connected via socket (in the room you specify)

## Other Goodies

### Cache
actionHero ships with the models and functions needed for mySQL-backed key-value cache.  Check cache.js in both the application root and an action to see how to use it.  You can cache strings, numbers, arrays and objects (as long as they contain only strings, numbers, and arrays). Cache functions:

* `api.cache.save(api,key,value,expireTimeSeconds,next)`
* `api.cache.load(api, key, next)`
* `api.cache.destroy(api, key, next)`


api.cache.save is used to both create new entires or update existing cache entires.  If you don't define an expireTimeSeconds, the default will be used from `api.configData.cache.defaultExpireTimeSeconds`.

### Logging and API Request Limiting
Every web request is logged to te `log` database table.  By default, these are only kept for an hour and cleaned up by a task.  These records are used to rate limit API access (set in config.json by `api.configData.apiRequestLimitPerHour`).  You can also parse the logs to inspect user behavior.  If you want to store this behavior for longer, it is recommended that you store it elsewhere from your operational database.

Socket activity is not logged.

### Safe Params
Params (GET and POST) provided by the user will be checked against a whitelist.  Any column headers in your tables (like firstName, lastName) will be accepted and additional params you define as required or optional in your actions `action.inputs.required` and `action.inputs.optional`.  Special params which the api will always accept are: 
	[
		"callback",
		"action",
		"limit",
		"offset",
		"sessionKey",
		"id",
		"createdAt",
		"updatedAt"
	];
Params are loaded in this order GET -> POST (normal) -> POST (multipart).  This means that if you have {url}?key=getValue and you post a variable `key`=`postValue` as well, the postValue will be the one used.  The only exception to this is if you use the URL method of defining your action.

### Logging
The `api.log()` method is available to you throughout the application.  `api.log()` will both write these log messages to file, but also display them on the console.  There are formatting options you can pass to ``api.log(yourMessage, options=[])`.  The options array can be many colors and formatting types, IE: `['blue','bold']`.  Check out `/initializers/initLog.js` to see the options.

Remember that one of the default actions will delete the log file if it gets over 10MB.

## Versions of this API
see `versions.markdown` to see what's new in each version

###