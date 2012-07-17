# Action Hero API Versions

## Version 2.0.4

**Summary:** Redis Auth Fix
- There was a signifigant bug when authnticating with redis.  That bug has been fixed.

## Version 2.0.3

**Summary:** Bug Fixes, Examples, and REPL

- actionHero now has a REPL! You can use the command line to use all the api-namespaced functions and define your own.  Great for debugging or checking on the status of the cluster.  
- Checkout the /examples folder for how to use the actionHeroClient package, browser javascript, and curl to interface with actionHero.  More languages coming soon.

** Notes **

- cache actions now take miliseconds like everything else.
- you can now have non-expiring cache entires (just pass a null value for expireTimeMS)
- there are no no default periodically-run tasks.  Look in `/examples` for the tasks that used to be there and copy them into your own project's /tasks folder.  This was done to reduce the 'magic' in the framework.  the runTask task still remains, as it was not run periodically.

## Note:
** [actionHeroClient](https://github.com/evantahler/actionHeroNodeClient) released! Connect node to node! **

## Version 2.0.2

**Summary:** Bug Fixes & Examples

** Details **
Check the notes for the bug fixes.  There are now also more examples in the prject, showing off how you can connect from various enviorments.  This also ccoencides with the release of the [actionHeroClient](https://github.com/evantahler/actionHeroNodeClient) NPM package.  More coming soon.  

** Notes **

- Updates to how socket client requests are tracked to enfore proper message IDs.  If you directly used `api.processAction` before, the interface has changed.
- running the test suite will now use a seperate redis db.  You can also set this in config.json for your app.
- better logic to ensure that tasks are enqueued properly
- cluster members will remove stale tasks they were working on when the app is started (in case of a crash)

## Version 2.0.1
Bug Fixes

## Version 2.0.0

** Redis-powered Cluster & major refactor **

** Details **

This version realizes the dream of a true cluster for actionHero.  There is no longer a need for a master process, and every node in the cluster can work alone or in a group.  This release also enables using the node.js cluster module to make the most of your server(s).  

*This version is likley to be incompatible with prior versions.  Running an actionCluster now requires redis (running a single node does not require redis and is still a pure node.js implementation).*

Using a [redis](http://redis.io/) backend, actionHero nodes can now share memory objects and have a common queue for tasks.  Philosophically, we have changed from a mesh network to a queue-based network.  This means that no longer will every node talk to every other node, but rather all nodes will talk to redis.  Now, I know that you are thinking "isn't that bad because it creates a single point of failure?"  Normally, the answer is yes, but redis already has mesh networking support! The suggested method of deployment is to setup a redis instance on each server, and they will handle the mesh networking for you.  

`api.cache` now works in a shared way if you are part of an actionCluster.  All cache actions refer to redis and in this way, all peers can have access to shared ojects.  To avoid conflicts, you will have access to 'lastReadAt' as part of `api.cache.load` responses.  actionHero will also no longer store its own cache to disc periodically as redis does this already.

The task system also has undergone some major refactoring.  All tasks are now stored in a shared queue within redis.  All peers will periodically check the queue for unfilled tasks, and drain the queue one at a time.  In this manner, you can add more task capacity by spinning up more actionHero nodes which may or may not also handle web/socket traffic.  This also means that tasks will not get lost if a node crashes as they will remain in the redis queue until drained.  Each peer also has a 'personal' task queue for "all" actions.

For periodic tasks ("any" and "all"), the peer which most recently completed the task while hold the semaphore for that task (in a `actionHero::tasksClaimed` shared list) until the proper amount of time has elapsed, then they will re-enqueue the task.  This does not mean that a specific node will always preform tasks of the same type.

There are new requirements to `config.json` to configure redis.  Here is an example:

	"redis" : {
		"enable": true,
		"host": "127.0.0.1",
		"port": 6379,
		"password": null,
		"options": null
	},

All methods under the `api.actionCluster` namespace have been removed for simplicity.  Just use the normal cache methods, and if you are in a cluster, you will operate in a shared memory space.

** Notes **

- all peers now share the same `api.cache` data
- api.tasks.enqueue is now `api.tasks.enqueue(api, taskName, runAtTime, params)`  Set runAtTime to 0 to run the task as soon as possible
- using redis cache save; no longer saving cache periodically
- all nodes are created equal; there is no need for a master
- the entire `actionCluster` namesapace has been removed
- there are new requirements to `config.json` to setup redis
- every node will try to handle requests and process one job pending in the task queue at a time
- shared tasks will be prefered over per-node tasks
- the 'status' action has some new output types to reflect 'global' stats in comparison to 'local' stats (IE: count of web requests that this node has served vs total)

## Version 1.0.3

** Optional Headers **

** Details **

- You can now define custom host-headers in `config.json` which will be sent with every http/https response
- bug fixes introduced with task sharing (v 1.0.1)

## Version 1.0.2

** Task Sharing **

** Details **

- The master process will now delegate tasks in his queue to other peers in the cluster.
- Minor bug fixes

## Version 1.0.1

** SSL / HTTPS web server **

** Details **

* You can now spin up a secure https server along with you http server in action hero.  It will work exactly the same as the http server, and you can have both on at the same time with no overhead.
    * There are new configuration settins in `config.json` for this below

Settings for https server:

	"secureWebServer" : {
		"port": 4443,
		"enable": true,
		"keyFile": "./certs/server-key.pem",
		"certFile": "./certs/server-cert.pem"
	},
	

## Version 1.0.0

**Summary:** OMG 1.0!

**Details:**

* initializers
	* you can add your own initializers to a folder called `initializers` in your project's root.  They will be loaded at boot and accessible like this:
		* actionHero.myNewInitFunction(api, function(){ next(); });
* This is a cleanup and bug-fix release
* After some refactoring, actionHero is now at v 1.0
* The last message sent by a socket client can now be read by inspecting `connection.lastLine`
* Better error handling if the socket / web port are in use
* Cleanup of the example HTML pages
* HTTP requets will now return serverInformation.currentTime
* The original server (the one with no `configData.actionCluster.startingPeer` will be the only server to run 'any' tasks)
	* Other servers will NOT assume the role of runing "any" tasks, but they will keep them in memory until the master server comes back upon a crash.
* Using the node-mime module
* Adding 10 min cache-control to flat files

## Version 0.2.6

**Summary:** Cluster Task Managment

**Details:**

* rewrite of the task system to be more like actions
* tasks now live in ./tasks/ in your application root
* tasks can now have their own specific timers
* tasks are now scoped to be "any" or "all", to run once per actionCluster (any) or on all nodes (all)
* Default tasks within the api are now better explained:
	* calculateStats
		* Polls all other members in the actionCluster to build up statistics
		* Runs every 10 seconds
	* cleanLogFiles
		* removes all files in `./log/` if they are larger than `api.configData.maxLogFileSize`
		* runs every 60 seconds
	* cleanOldCacheObjects
		* removes expired objects in `api.cache.data`
		* runs every 10 seconds
	* pingSocketClients
		* sends a keep-alive message to all TCP socket clients
		* runs every 60 seconds
	* runAction
		* a wrapper to run an action as a task
		* will not run automatically
	* saveCacheToDisk
		* will save the contents of `api.cache.data` to disc
		* runs every 60 seconds

## Version 0.2.5

**Summary:** Goodbye Databases & Models, hello other versions of Node!

**Details:**

* You can now use actionHero on node.js version 5 upwards (including the new v0.7)
* In order to keep actionHero as compartmentalized as possible, we have removed databases and models.  
	* There are tons of great ORMs and drivers for node.  When deploying actionHero in production, I expect that you will make use of them.  However, requiring database integration with actionHero is no longer a core part of the framework.  The previous DB connection support was too specific to my test implementations to be useful for everyone.  
	* This makes previous implementations of actionHero incompatible with versions > 0.2.4.
		* I'm sorry, but that's the price of progress!
* The location where the cache is saved and loaded from is configurable in `config.json` via `api.configData.cache.cacheFolder` and `api.configData.cache.cacheFile`

## Version 0.2.4

**Summary:** Goodbye Rate Limiting; Hello validators, and XML

**Details:**

* You can now request XML output rather than json.  Pass `outputType=XML` to the api
* Actions will be checked for the proper variables and methods. 
* Actions' required params will be automatically checked for existence. 
* Removed anything to do with rate-limiting.  I don't think that anyone was using it anyway.  This really isn't a core feature and was causing trouble at the DB layer.
	* api will no longer return details of requests remaining
	* DBs no longer need to build the `api.rateLimitCheck` method
* `npm start` can not be used to stat an example actionHero server

## Version 0.2.3

**Summary:** This is a general cleanup release

**Details:**

* The cache will now write its contents to disc periodically, as defined by the  `tasks.saveCacheToDisk` task.  The api will also attempt to load in a cache file on boot.
* If you application needs to manage more than one instance of an actionHero test, you can call `require('actionHero').createActionHero()` rather than `require('actionHero').actionHero`.  `createActionHero()` will return a new instance of a server each time rather than a shared object.

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