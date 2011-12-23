# node.js actionHero API Framework
[![Build Status](https://secure.travis-ci.org/evantahler/actionHero.png)](http://travis-ci.org/[YOUR_GITHUB_USERNAME]/[YOUR_PROJECT_NAME])

## Who is an actionHero?
actionHero is a minimalist, multi-node, transactional API framework written in javaScript for the [node.js](http://nodejs.org) server.  It was inspired by the [DAVE PHP framework](http://github.com/evantahler/php-dave-api).  The goals of actionHero are to create an easy-to-use package to get started making http and socket APIs RIGHT NOW.

The actionHero API aims to simplify and abstract may of the common tasks that these types of APIs require.  actionHero does the work for you, and he's not _CRUD_, and he's never taking a _REST_.  actionHero was built to be both easy to use, but to be as simple as possible.  I was tired of bloated frameworks that were designed to be monolithic applications which include M's, V's, and C's together in a single running application.  As applications grow and become more 'service oriented', this is the eventual route which many applications go.  I wanted to make is as simple as possible to create a new application with this mindset, and to allow for future flexibility.

The actionHero API defines a single access point and accepts GET and POST input. You define "Actions" that handle the input, such as "userAdd" or "geoLocate". The actionHero API is NOT "RESTful", in that it does not use the normal http verbs (Get, Put, etc) and uses a single path/endpoint. This was chosen to make it as simple as possible for devices/users to access the functions, including low-level embedded devices which may have trouble with all the HTTP verbs.  To see how simple it is to handle basic actions, this package comes with a basic Actions included. Look in `api/actions/`.    You can also visit `http://{baseUrl}/{action}` or can configure your own router (based on the expressJS framework, which is included).

## Actions
The meat of actionHero is the Action framework.  Actions are the basic units of a request and work for HTTP and socket responses.  The goal of an action is to set the `connection.response` and `connection.error` values which will be turned to the client.  Here's an example of a simple action which will return a random number to the client:

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

* Actions are asynchronous, and take in the API object, the connection object, and the callback function.  Exiting an action is as simple as calling next(connection, true).  The second param in next  is a boolean to let the framework know if it needs to render anything else to the client (default = true).  There are some actions where you may have already sent the user output (see the `file.js` action for an example)
* metadata.  The metadata is used in reflexive and self-documenting actions in the API, such as `actionsView`.  ``actions.name`` is the only required metadata element.

## Models & mySQL
actionHero uses the sequelizeJS mySQL ORM.  It is awesome.  models (located in `./models/`) are used to define ORM objects in the API.  actionHero also adds seeding abilities to the API to pre-populate the database if you need.  Here is the default model for the cache table which ships with actionHero (in ./models/cache.js):

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

actionHero also uses the native mySQL NPM package so you can execute raw mySQL actions.  To use this, you can make use of the `api.rawDBConnction.query` object.  For example: 

	api.rawDBConnction.query("select * from table", function(err, rows, fields) {
		// do stuff
	});

## Tasks
Tasks are periodic special actions the server will do at a certain interval.  Because nodeJS has internal timers, it's simple to emulate a "cron" functionality in the server.  Some of the example tasks which ship with actionHero cleanup expired sessions and cache entries in the DB, and also check to see if the log file has gotten to large.  

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
		//
		task.run();
	};
	
	////////////////////////////////////////////////////////////////////////////
	// Export
	exports.tasks = tasks;

All of the metadata in the example task is required, as is task.init and task.run.  Note that task.run calls the task.end() callback at the close of it's execution.  `cron.js` manages the running of tasks and runs at the `cronTimeInterval`(ms) interval defined in `config.json`

## Connecting

### HTTP
You can visit the API in a browser, Curl, etc.  ?action or /{action} will normally be provided.  The only action which doesn't return the default JSON format would be file, as it should return files with the appropriate headers, etc.

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

* you can provide the ?callback=myFunc param to initiate a JSON-p response which will wrap the returned JSON in your callback function.  
* unless otherwise provided, the api will set default values of limit and offset to help with paginating long lists of response objects.
* the error if everything is OK will be "OK", otherwise, you should set an error within your action
* to build the response for "hello" above, the action would have set `connection.response.hello = "world";`

### Sockets

You can also access actionHero's methods via a persistent socket connection rather than http.  The default port for this type of communication is 5000.  There are a few special actions which set and keep parameters bound to your session (so they don't need to be re-posted).  These special methods are:

* quit. disconnect from the session
* paramAdd - save a singe variable to your connection.  IE: 'addParam screenName=evan'
* paramView - returns the details of a single param. IE: 'viewParam screenName'
* paramDelete - deletes a single param.  IE: 'deleteParam screenName'
* paramsView - returns a JSON object of all the params set to this connection
* paramsDelete - deletes all params set to this session
Every socket action (including the special param methods above) will return a single line denoted by \r\n  It will often be "OK" or a JSON object.

Socket Example:

	> telnet localhost 5000
	Trying 127.0.0.1...
	Connected to localhost.
	Escape character is '^]'.
	{"welcome":"Hello! Welcome to the actionHero server"}
	cacheTest
	{"error":"key is a required parameter for this action"}
	paramAdd key=myKey
	{"status":"OK"}
	paramAdd value=testValue
	{"status":"OK"}
	paramsView
	{"action":"viewParams","limit":100,"offset":0,"key":"myKey","value":"testValue"}
	cacheTest
	{"cacheTestResults":{"key":"myKey","value":"testValue","saveResp":"new record","loadResp":"testValue","deleteResp":true}}

actionHero will serve up flat files (html, images, etc) as well from your api/public folder.  This is accomplished via a `file` action. `http://{baseUrl}/file/{pathToFile}` is equivelent to `http://{baseUrl}?action=file&fileName={pathToFile}`

actionHero also includes methods to run periodic tasks within your server (think built in cron tasks) which can process within the same application which processes incoming events.  Hooray for the event queue!

## Requirements
* node.js server
* npm
* mySQL (other ORMs coming soon?)

## Install & Quickstart
* npm install actionHero
* startup mySQL and create a new database called `action_hero_api` ( and `action_hero_api_test`if you want to run the tests)
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
	}
	
	// start the server!
	actionHero.start(params);

* Start up the server: `node index.js`

You will notice that you will be getting warning messages about how actionHero is using default files contained within the NPM package.  This is normal.

## Extending actionHero
The first thing to do is to make your own ./actions and ./models folders.  If you like the default actions, feel free to copy them in.  You should also make you own tasks.js file.

A common practice to extend the API is to add new classes which are not actions, but useful to the rest of the api.  The api variable is globally accessible to all actions within the API, so if you want to define something everyone can use, add it to the api object.  In the quickstart example, if we wanted to create a method to generate a random number, we could do the following:
	
	function initFunction(api, next){
		api.utils.randomNumber = function(){
			return Math.random() * 100;
		};
	};
	
	var actionHero = require("actionHero").actionHero;
	actionHero.start({initFunction: init}, function(api){
		api.log("Loading complete!", ['green', 'bold']);
	});

Now `api.utils.randomNumber()` is available for any action to use!  It is important to define extra methods in a setter function which is passed to the API on boot via ``params.initFunction`.  This allows all threads in an cluster to access the methods. Setting them another way may not propagate to the children of a node cluster.

## Default Actions you can try [[?action=..]] which are included in the framework:
* cacheTest - a test of the DB-based key-value cache system
* actionsView - returns a list of available actions on the server
* file - servers flat files from `{serverRoot}\public\{filesNmae}` (defined in config.json)
* randomNumber - generates a random number
* status - returns server status and stats

## Other Goodies
### Cache
actionHero ships with the models and functions needed for mySQL-backed cache.  Check cache.js in both the application root and an action to see how to use it.
### Logging and API Request Limiting
Every web request is logged to te `log` database table.  By default, these are only kept for an hour and cleaned up by a task.  These records are used to rate limit API access (set in config.json by apiRequestLimitPerHour).  You can also parse the logs to inspect user behavior.  Socket activity is not logged.
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