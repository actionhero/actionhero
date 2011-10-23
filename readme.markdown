# node.js DAVE API Framework

## Who is _DAVE_?
DAVE is a minimalist, multi-node, transactional API framework written in javaScript for the [node.js](http://nodejs.org) server.  It was inspired by the [DAVE PHP framework](http://github.com/evantahler/php-dave-api).

DAVE is an acronym that stands for Delete, Add, Edit, and View. These 4 methods make up the core functionality of many transactional web applications. The DAVE API aims to simplify and abstract may of the common tasks that these types of APIs require.  DAVE does the work for you, and he's not CRUD.  Dave was built to be both easy to use, but to be as simple as possible.  I was tired of bloated frameworks that were designed to be monolithic applications which include M's, V's, and C's together in a single running application.  As applications grow and become more 'service oriented', this is the eventual route which many applications go.  I wanted to make is as simple as possible to create a new application with this mindset, and to allow for future flexibility.

The DAVE API defines a single access point and accepts GET, POST, or COOKIE input. You define "Action's" that handle the input, such as "AddUser" or "GeoLocate". The DAVE API is NOT "RESTful", in that it does not use the normal verbs (Get, Put, etc) and uses a single path/endpoint. This was chosen to make it as simple as possible for devices/users to access the functions, including low-level embedded devices which may have trouble with all the HTTP verbs.  To see how simple it is to handle basic actions, this package comes with a basic Actions included. Look in `api/actions/`.    You can also visit `http://{baseUrl}/{action}` or can configure your own router.

You can also access DAVE's methods via a persistent socket connection rather than http.  The default port for this type of communication is 5000.  There are a few special actions which set and keep parameters bound to your session (so they don't need to be re-posted).  These special methods are:

* quit. disconnect from the session
* addParam - save a singe variable to your connection.  IE: 'addParam screenName=evan'
* viewParam - returns the details of a single param. IE: 'viewParam screenName'
* deleteParam - deletes a single param.  IE: 'deleteParam screenName'
* viewParams - returns a JSON object of all the params set to this connection
* deleteParams - deletes all params set to this session
Every socket action (including the special param methods above) will return a single line denoted by \r\n  It will often be "OK" or a JSON object.

Socket Example:

	>> telnet localhost 5000'
	Trying 127.0.0.1...
	Connected to localhost.
	Escape character is '^]'.
	Hello! Welcome to the daveNodeApi server
	>> cacheTest
	key is a required parameter for this action
	>> addParam key=myKey
	OK
	>> addParam value=myValue
	OK
	>> viewParams
	{"action":"showParams","limit":100,"offset":
	0,"key":"myKey","value":"myValue"}
	>> cacheTest
	{"cacheTestResults":{"key":"myKey","value":"myValue","saveResp":"newrecord","loadResp":"myValue","deleteResp":true}}

Dave will serve up flat files (html, images, etc) as well from your api/public folder.  This is accomplished via a `file` action. `http://{baseUrl}/file/{pathToFile}` is equivelent to `http://{baseUrl}?action=file&fileName={pathToFile}`

Dave also includes methods to run periodic tasks within your server (think built in cron tasks) which can process within the same application which processes incoming events.  Hooray for the event queue!

## Requirements
* node.js server
* npm
* mySQL (other ORMs coming soon)

## Suggested Packages
* HAProxy.  Deployment becomes much simpler if you can run your node application on port 8080 and use HAProxy to forward connection from port 80 to 8080.


## Actions you can try [[?action=..]] which are included in the framework:
* cacheTest - a test of the DB-based key-value cache system
* describeActions - returns a list of available actions on the server
* file - servers flat files from `{serverRoot}\public\{filesNmae}`
* randomNumber - generates a random number
* status - returns server status and stats

## QuickStart (osx)
* brew install node
* curl http://npmjs.org/install.sh | sudo sh
* npm updat`e