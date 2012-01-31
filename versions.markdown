# Action Hero API Versions

## Version 0.2.3

**Summary:** This is a general cleanup release

**Details:**

* The cache will now write its contents to disc periodically, as defined by the  `tasks.saveCacheToDisk` task.  The api will also attempt to load in a cache file on boot.

## Version 0.2.2

**Summary:** This release adds additional functionality to the actionCluster and Cache

**Details:**

* Both `api.actionCluster.cache.load` and `api.cache.load` now both return 4 values, `(value, expireTimestamp, createdAt, readAt)`.  This new information can be used to avoid race conditions if another peer has recently accessed a saved object.
* Reading a object with the corresponding load command will update the readAt value.
* A pretty new example html in `/public/` which will demonstrate the `showActions` method
* npm tests for the cluster
* `actionHero.stop(next)` and `actionHero.restart(next)` added to api


## Version 0.2.1

**Summary:** This is a general cleanup release

**Details:**

* Removed the notion of (http) sessions from the project, as they are not core to this api.  Simpler code!  
* better test page (public/index.html) which shows a simple example of how to parse output from the API.
* Stats calculation now works across the actionCluster and is moved to an initializer
* cleanup to lots of methods for better encapsulation 
* all files in the initialization directory will now be loaded automatically, however their execution will still remain manual (to enforce load order)
* note: with api.cache, the _stats and _roomStatus keys are reserved for the system

## Version 0.2.0

**Summary:** This release introduces the actionCluster!

**Details:**

actionHero can be run either as a stand-alone server or as part of a cluster.  When running in cluster mode, the api will make use of the actionCluster methods.  Features of an actionCluster:

* `ring-based` communication.  Lists of peers are shared among all members of the actionCluster, and each member communicates directly with all other members.  This allows any member of the cluster to fail and the cluster to continue.
* reconnection.  Peers will always attempt to reconnect to disconnected peers
* cluster security.  Each actionCluster has a unique membership phrase `api.configData.actionCluster.Key` defined by you
* shared messaging: the `say` socket command will message all clients in the same room in all peers.  `roomView` will aggregate information for all peer's connections
* shared or individual configuration for each peer.
* Shared memory objects!
	* actionHero's single-node cache,  `api.cache` is extended when operating in an actionCluster to allow for you to simply create redundant in-memory objects which can be accessed by any member of the cluster, even a peer which doesn't hold any of the data being accessed.
	* Object duplication.  Using `api.configData.actionCluster.nodeDuplication`, you can ensure that your cached objects will be present on n peers to survive the crash of a peer.  In the event  a peer goes down, the remaining peers will reduplicate the object in question

## Version 0.1.7

**Summary:** This release prepares for multiple DB types and changes the cache to be in-memory

**Details:**

* Be careful not to waste all your ram with the in-memory cache!
* All DB connection options must define: api.rateLimitCheck = function(api, connection, next) which will be used in all web connections.  It should return requestThisHourSoFar (int)
* Reminder:  You can add DB specific by adding your task to the api.taks object
* Your DB init function should be called init and be exported.  init = function(api, next)
* Name your DB init file the same thing you want folks to use in api.configData.database.type
* It is now easier to use actionHero without any database as well.  

## Version 0.1.6

**Summary:** This release changes the way that actions and files are routed

**Details:**

* Mode Routing
	* /file and /api are now routes which expose the 'directories' of those types.  These top level paths can be configured in `config.json` with `api.configData.urlPathForActions` and `api.configData.urlPathForFiles`.
	* the root of the web server "/" can be toggled to serve the content between /file or /api actions per your needs `api.configData.rootEndpointType`. Versions prior to this can be thought of as always choosing /api as the default. The default is `api`.
	* `/file` now works for socket connections.  The raw contents of the file will be streamed back to the client upon success.  Rather than sending HTTP headers on errors, a string messages in the normal way will be sent upon error.
	* `file` is still an action, but its logic is moved into the code API.  Socket connections will only be using /api/ as their endpoint.

## Version 0.1.5

**Summary:** This release contains a number of fixes for socket clients and some minor task updates.

**Details:**

* Contexts
	* When connected via Socket, knowing the context of a message you receive is important.  All messages sent back to the client should include `context` in the JSON block returned.  
	* For example, by default all actions set a context of "response" indicating that the message being sent to the client is response to a request they sent.  Messages sent by a user via the 'say' command have the context of `user` indicating they came form a user.  Every minute a ping is sent from the server to keep the TCP connection alive and send the current time.  This message has the context of `api`.  Messages resulting from data sent to the api (like an action) will have the `response` context.
	* Be sure to set the context of anything you send!  Actions will always have the `response` context set to them by default.
* Keep Alive
	* A new default task now will send a 'keep alive' message to each connected socket connection.  This will help with TCP timeouts and will broadcast the server time each task cycle( default 1 min ). 
	* Per the above, the message has the `api` context.
* paramsView and paramView
	* params are now passed back wrapped in a `params` object.
* Response Counts
	* Socket connections will have every message sent to them counted, and every message sent will have the `messageCount` value set.  This will help clients keep messages in order.
* Better client id hashes
	* Every socket client has an `connection.id` set for them.  This is used by the `say` command and should be used by any other method which needs to identify one user to another.  This way, the user's IP and port can be kept secret, but you can have a unique id for each user.  Updates to how this hash is generated (now via MD5).
* Minor refactoring to the task framework to add task.log() as a method to help with formatted output.
* The task to clean the log file will now inspect every file in ./logs/ to check if the files have gotten too large.
* Documentation Updates
	Every 
	* This file!
	* readme.markdown
	* project website (branch gh-pages)

## Versions <= 0.1.4
Sorry, I wasn't keeping good notes :(