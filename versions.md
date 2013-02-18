# Action Hero API Versions

## Version 4.3.5

** General **
- normalized all connection times to have a `connection.sendMessage(message,type)` method which can be used globally.  This will allow you to send a message to any connection directly without messing with chatrooms
- there were too many commas (@mmadden)
- `api.webSockets` renambed to `api.webSocketServer` to be consistant with other servers
- reordered shutdown proess to help with stats (https://github.com/evantahler/actionHero/issues/109)
- action and task generators now generate `hash` style files

** Web Sockets
- Will be sent a message on server shutdown

* Tasks *
- if `toAnnounce` is false, we will no silence the act of enquing delayed versions of this task (@macrauder)

## Version 4.3.4

** webServer ** 
- allow for `formidable` options to be passed via config.  Details on the optons here: https://github.com/felixge/node-formidable

## Version 4.3.3

** Bugs **

- `listenToRoom` and `silenceRoom` for websocket clients will not properly modify the messageCount id in the response object

## Version 4.3.2

** Binary **
- the default action for the actionHero binary is now `start` rather than `help`

** config **
- for compatibility, only the "http" server will be on at boot
- directory creation is now part of the example file logger

## Version 4.3.1

** bugs **
- callbacks from actions with `toRender = false` now are respected properly
- `api.actions` is now a collection for all things action, and `api.actions.actions` contail the list of actions
- seperating taskProcessor methods to prepare to work on memory leaks

** cluster **
- fix logging of master when daemonized
- fix daemon server from not being able to detach
- disable renaming of the running process.  This was not consistant across various operating systems and was confusing.

## Version 4.3.0

** logger **
- actionHero is now using the winston logger: https://github.com/flatiron/winston.  This will allow for better, more customizable logging.
- The `api.configData.log` is replaced with `api.configData.logger`
- You can now specifiy all the logging options and transports in `api.configData.logger.transports`
- You will probably want to define your transports in functions(api) so that you can evaluate them later and get things like `api.id` to use in your file names
- The notion of 'coloring' output has been removed, and replaced with more standard log-levels
- actionHero's log levels: 0=debug, 1=info, 2=notice, 3=warning, 4=error, 5=crit, 6=alert, 7=emerg
- `api.log(message, severity, data)` is the new syntax
- you can access winston directly at `api.logger`

** tasks ** 
**!!! It is likley you will loose access to previously enqueued tasks with this upgrade**
- fixes to the delayed task system
- delayed tasks now occupy thier own timestamp'd queue
- periodic tasks now have a specific hash to deonte if they have been enqueued already or not

** webserver ** 
- Support for grouped action names added (thanks @Macrauder)

** core **
- the actionHero server will not exit until any currently processing tasks are compelte 
- This may effect forever adversley

** cluster ** 
- when running in a cluser, the child processes will ignore all signals passed in from the parent
- the timeout for closing a worker has been increased to a minute to allow for tasks to complete

## Version 4.2.4

** Bugs **

- fixes to boot order and booting withoug an IP address (external)
- fix to booting actionCluster
- use actionName from definition rather than file name (thanks @Macrauder)
- logging fixes for tasks

## Version 4.2.3

** Bugs **

- boot order regarding logging
- task load messaging
- runAction task crashes

## Version 4.2.2

** Bugs **

- Fix a form parsing bug for web clients

## Version 4.2.1

Allowing support to limit the connection.type for which an action if valid for.  Define the array of `action.blockedConnectionTypes = ['socket', 'webSocket']` for example to not allow access from TCP or webSocket clients.  Not defining the array will allow all client types in.

## Version 4.2.0

** General **

This release chanes (simplifies) a nmber of APIs, but it does introduce changes.  Please read the wiki, specifically the API methods page, to learn the new syntax for various methods.

- circular refrences are bad... remove all functions that require api to be passed in (mainly the API object)
- change initializer names to remove (init)
- object-ize connections, append connection-type prototypes in the server setups
- remove connection classes from utils
- remove global 'requires' from the API object, put them in the intilizers that need them
- remove the notion of 'public' from connection objects
- server shutdown needs to clear its connections from the chatrooms
- delayed tasks which are older than 1 min should be checked against the various queues to be sure exist
- fix http message request so that all pending messages are returned
- general project orginization

## Version 4.1.0

** Tasks **

- Tasks will no longer be 'popped' from a queue, but rather slid from queue to queue.  This makes it much harder to loose a task
- There is no longer a need for a periodc task reloader because of the above
- Tasks can now be easily inspectd, and have been included in the `status` task
- Please check the wiki for new task syntax:

		var task = new api.task({
		  name: "myTaskName",
		  runAt: new Date().getTime() + 30000, // run 30 seconds from now
		  params: {email: 'evantahler@gmail.com'}, // any optional params to pass to the task
		  toAnnounce: true // to log the run of this task or not
		});
		
		task.equeue(function(err){
		  // enqueued!
		})

** Stats ** 

- Stats system has been overhaled to have both local and global tasks kept for the cluster
- the `status` action now reflects the global status and local status for the server queried
- Please check the wiki for new syntax:

`api.stats.increment(api, key, count, next)`

- next(err, wasSet)
- key is a string
- count is a signed integer
- - this method will work on local and global stats

`api.stats.set(api, key, count, next)`

- next(err, wasSet)
- key is a string
- count is a signed integer
- this method will only work on local stats

`api.stats.get(api, key, collection, next)`

- next(err, data)
- key is a string
- collection is either:
  - `api.stats.collections.local`
  - `api.stats.collections.global`

`api.stats.getAll(api, next)`

- next(err, stats)
- stats is a hash of `{global: globalStats, local: localStats}`

## Version 4.0.8

** Bugs **

- Typo: additionalListiningRooms -> additionalListeningRooms
- Convert all tabs to spaces, for those of us who are OCD (me)

## Version 4.0.7

updates to the actionHeroWebSocket

## Version 4.0.6

initializers can now have a `_start(api, callback)` method which will be invoked when the server boots.

** Bugs **

- `api.tasks.inspect` has been renamed `api.tasks.inspectTasks` as to work with console.log and util.inspect
- api.cache actions now force a domain binding when used within an action or task.  This will help broken actions not to crash the server.  This is needed until the redis package is updated to support domains (Thanks @othiym23)
- Typo corrected in `api.configData.general.pidFileDirectory`
- Other spelling fixes (Thanks jacobbubu)!

## Version 4.0.5

** socket server & web sockets **

- connections can regester to be notified about messages in chatRooms they are not currently in with `listenToRoom` and `silenceRoom`.  You still need to be in a room to `say` and interact with the room, but this will allow clients to register for additional events.
- various commands have had the `room` paramite added to thier responses to allow for clarity in the above situation.
- the rooms that a connection is (optionally) additionally interseted in is saved at `connection.additionalListiningRooms`
- you can limit the number of actions the server will process at a time for a connection with `api.configData.general.simultaniousActions`.  Defaults to `5`

** bugs **

- when shutting down the socket-server, if a connection doesn't close withing 5 seconds (a pending action), the connection will be disconnected forcibly
- fixed a bug where messageCount would be overwritten in proxy connections for long-lasting actions
- file server now uses `pipe` as to not require loading all of the file's content into ram to serve the file
- webserver no longer requires the 'file' action to exist
- removed the 'file' action, as it was confusing, and duplicated core functionality of the web server
- ctrl+c and ctrl+d will now properly exit a telnet (TCP) session to an actionHero server

## Version 4.0.4

** Bugs **

- fix a sweeper bug introduced in the previous version

## Version 4.0.3

** initializers **

- you can now define api.{module}._teardown in any api module to be called at shutdown.
- `_teardown(api, next)` will passed to this method
- a `_teardown` method is not required

** Bugs **

- fix duplicate headers sometimes returned to http(s) clients
- fixed logging for actionCluster
- fixed SIGWINCH so only daemonized clusters can use it
- added in a sweeper for api.cache, so that expired values will be deleted eventually
- better locking out of internal timers when the cluster is off

## Version 4.0.2

** Status Codes. **

- For HTTP(S) clients, you can now toggle `api.configData.commonWeb.returnErrorCodes`, which when enabled will only return the http status code `200` for truly sucessful request (`conneciton.error== null`), and an error HTTP response header when there is an error.  
- You can now set `connection.responseHttpCode` in your actions to indicate a specific HTTP error code for each request if something goes wrong.
- The default `connection.responseHttpCode` when `api.configData.commonWeb.returnErrorCodes` is enabled is `400` (bad request).
- If you request an action that doesn't exist in the mode `404` (Bad Request).
- If you request an action without all the required params `422` (Unprocessable Entity).

## Version 4.0.1

** Binary **

- better support for running the actionHero binary globally
- when generating a new project, the actionHero version will be locked
- `actionHero` generate will create a `_project.js` initializer
- you can now daemonize all of the actionHero commands (start, startCluster) with the `--daemon`.  This will background the server or cluster
- the actionHero server can now respond to basic unix signals (USR2 will restart, and KILL/INT will try a more graceful shutdown)
- general cleanup for the binary commands

** actions **

- you can now define more than one action or task in a file, like this:

  exports.userAdd = {
    name: 'userAdd',
    description: 'i add a user',
    inputs: {
      required: ['email', 'password'],
      optional: []
    },
    outputExample: {},
    run: function(api, connection, next){
      // your code here
      next(connection, true);
    }
  };

  exports.userDelete = {
    name: 'userDelete',
    description: 'i delete a user',
    inputs: {
      required: ['email', 'password'],
      optional: []
    },
    outputExample: {},
    run: function(api, connection, next){
      // your code here
      next(connection, true);
    }
  }

** config **

- the name of the log file is now based on the process name, to match the pidFiles

** general **

- uppon sever shutdown, all connected TCP clinents will recieve the message: {"status":"Bye!","context":"response","reason":"server shutdown"}

## Version 4.0.0

** Boot **

- actionHero will now manage the starting/stopping of your applicaiton for you
- this means that there is no more 'main' or 'app.js' file for your projects
- you can still include and start an actionHero server programatically, and actionHero is now a prototypical object 

** actionHero Binary **

- refactor of `scripts` into a general `actionHero` executable which can be found in `./node_modules/actionHero/bin/actionHero` and `./node_modules/.bin/actionHero` after `npm install actionHero`
- allows you to start your server with `actionHero start` and `actionHero startCluster` from your project's root
- actionHero start can be passed many options, including `--config=[file]` which will allow you to specify other config.json(s) (IE: for development/staging envrionments)
- you can learn more about the new CLI with `actionHero help`

** core API ** 

- (breaking) actionHero itself is now a prototypical object to facilitate multiple servers in one app (testing)
- if an external IP cannot be determined, 'actionHero' will be the api.id base name
- actionHero will now set pidFiles for each server, and attempt to delete them on shutdown
- (breaking) params.initFunction no longer exists.  Please use a propper initializer instead
- better creation of pid files for running servers

** clients **

- a better client example for the browser (ajax/jsonp)
- moved websocket client to it's own includable js file (for browsers).  look for it in `examples/clients/web/actionHeroWebSocket.js`

** Other **

- ensure that the file action / public path cannot be used to server files outsite of /public
- dependency updates

## Version 3.1.6

- bug fixes and spelling mistakes corrected

## Version 3.1.5

- allow for `api.configData.webSockets.options` to contain a hash of settings to be bound to the websocket initalizer (along with .settings which remains an array)

## Version 3.1.4

- explicit call of `node` in package.json to wnable project to run on windows
- added a generator for initializers @ `npm run-script actionHero generateInitializer` 
- create a template readme file when generating a new project

## Version 3.1.3

- enable you to add custom initializers in your project

## Version 3.1.2

- fix a bug with web socket sequencing for responses

## Version 3.1.1

custom matchers on `api.chatRoom.socketRoomBroadcast`

- `api.chatRoom.socketRoomBroadcast()` can now send messges to only some clients that match certain params, IE: {auth: true} or {id: 123}.  This will let you segment the users in your rooms who hear you broadcasts.  
- `connection.params.roomMatchKey` and `connection.params.roomMatchVale` are set by the broadcaster to determine who they wish to message, along with the room.

## Version 3.1.0

* * * This is likley to cause many minor, but breaking changes * * * 

** Pattern Consistancy **

- actionHero.start, actionHero.stop, and actionHero.restart's callbacks now all callback with (error, api) rather than just (api)
- Actions now have a default error of 'null' rather than 'false' and actions will not return an error object unless there is an error.  Client-side checks should now look for errors with `if(error != null)`, which makes more sense
- api.cache.save and api.cache.destroy now return with callback(error, didSave) and callback(error, didDestroy).  api.cache.load now responds with next(error, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt)
- a number of other functions have also been updated to properly follow the (err, data) pattern.  Check them out in the "internal methods" wiki page
- Tasks should now `callback(data, toContinue)` where 'toContinue' is a boolean indicating if the task ran sucessuflly, and is able to be run again
- the extra methods for socket/webSocket connections (say, roomView, etc) have been removed from the `actionsView` action, as they aren't really actions
- default session ID renambed from "__browser_fingerprint" to "sessionID"
- you can now pass "x-sessionID" headers as well as cookies to continue a web session with the same ID

** Tasks ** 

- `api.tasks.inspect` can be used to inspect all the tasks in the queue
- `api.tasks.enqueue` now has a callback(err, enqueued) which can be used to check if there were any errors adding your task to the queue
- anquing a non-periodic "all" task now will be sent to all servers in the actionCluster properly

## Version 3.0.14

** Refactor of servers **

- Rather than having both a HTTP and HTTPS server, you now configure both the web server and socket server if you want them to be secure (tls, https) or not (tcp, http)
- the TCP server can now be upgraded to a TLS server, similar to how the https server can be enabled
- as there is now only one http server, webSockets will be bound apporpriatly if enabled

** Other **

- changing your config.js file in development mode will now reboot the server

** Bugs **

- reloading of tasks in development mode crashed before... now it doesn't!
- providing both a custom config.js and `params.configChanges` when botting actionHero didn't work (only config.js was used).  Fixed
- in development mode, causing a parser error in a task or action will no longer crash the program.  The action will be ignored until you fix it.


## Version 3.0.13

Cleanup and changing our test suite to mocha

** Connections **

- Version 3.0.12 introduced http(s) message queues, but this created a lot of overhead for each request.  We have changed this feature to "opt-in" if you want to use it.  
- `api.configData.commonWeb.httpClientMessageTTL` will default to null (disable http client http(s) message queues).  Setting it an integer (ms) will enable it again.

** Other **

- routes.js will now be reloaded when in development mode as the file changes

** Bugs **

- Fixed a header issue with mime times on flat files
- Added a helper which will ensure no duplicate headers are sent to http clients (like mime/type) except for setting cookies
- ignore the developer mode test in node < 0.7.0

## Version 3.0.12

** Connections ** 

- Connections have been refactored to all live within `api.connections`, and matain an type refering to thier connection method (web, websocket, tcp)
- web clients can now also be sent messages.  Web clients can retrieve pending messages with the `chat` api action and the method `messages`.  The old `say` action has been merged into this example action.
- all connections (including web clients) will be assigned a `connection.public.id` to facilitate the above.  actionHero will attempt to save this id within in a cookie.  Options can be set in `api.configData.commmonWeb.fingerprintOptions`
- http client's messages will be pruned every so often as determined by `api.configData.commonWeb.httpClientMessageTTL`

**Strict Mode**

- actionHero now conforms to strict JS mode.

**Bugs**

- Relaxed the necesity to provide public information to mock connections when using socketRoomBroadcast progamatically. 

## Version 3.0.11

**RESTful Routes**

- Building off of `api.utils.mapParamsFromURL`, you can now define named routes to your actionHero projects to help out http and https clients
- routes remain optional
- actions defiend in params directly `action=theAction` or hitting the named URL for an action `/api/theAction` will always override RESTful routing 
- the hierarchy of the routes object is prefix --> REST verb -> data
- data contains the 'action' to map to, and then an optional urlMap (api.utils.mapParamsFromURL)
- only single depth routes are supported at this time
- generating a new project will create a template `routes.js`, but it will contain no content

An example `routes.js`

```javascript
  exports.routes = {
    
    users: {
      get: {
        action: "usersList", // (GET) /api/users
      }
    },

    user : {
      get: {
        action: "userAdd",
        urlMap: ["userID"], // (GET) /api/user/123
      },
      post: {
        action: "userEdit",
        urlMap: ["userID"] // (POST) /api/user/123
      },
      put: {
        action: "userAdd",
        urlMap: ["type", "screenName"] // (PUT) /api/user/admin/handle123
      },
      delete: {
        action: "userDelete",
        urlMap: ["userID"] // (DELETE) /api/user/123
      }
    }

  };
```

**chat & redis**

- The redis pub/sub channel used for interclient communiaction is now suffiexed by your redis DB
- This means that differenet actionHero clusters using the same redis instance will no longer intercept eachother's messages

**non-breaking Exceptions (node >= v0.8.0 only)**

Thanks to node.js `domains`, exceptions in Actions and Tasks will no longer crash the application.  

- Exceptions within actions will be logged, and a new `api.configData.general.serverErrorMessage` will be rendered to clients within an action
  - web clients will be sent the 500 (server error) header
- Exceptions created in tasks will also be logged, and the task will return
- If the Exception occured within a periodic task, the task will be re-enqueud.
- keep in mind that any applicaton-wide settings which may have been modified in this erronious action/task will not be rolled-back

**Readme and Wiki**

- The `readme.md` was gettting really long and hard to searh, [so we started a github wiki!](https://github.com/evantahler/actionHero/wiki)

**Other**

- Documentation and Tests for XML output

## Version 3.0.10 

**Route parsing**

You can now extract prams per HTTP(s) request from the route requested by the user via an included utility.
URL routes remain not being a source of RESTful parameters by default, however, you can opt to parse them: 

```
  var urlMap = ['userID', 'gameID'];
  connection.params = api.utils.mapParamsFromURL(connection, urlMap);
```

- this is still left up to the action as the choice of which to choose as the default: query params, post params, or RESTful params is a deeply personal mater.
- if your connection is TCP or webSockets, `api.utils.mapParamsFromURL` will return null
- map is an array of the param's keys in order (ie: `/:action/:userID/:email/:gameID` => `['userID', 'email', 'gameID']`)
- the action itself will be omitted from consideration in the mapping
- these are equivalent: [ `localhost:8080/a/path/and/stuff?action=randomNumber` ] && [ `localhost:8080/randomNumber/a/path/and/stuff` ]

**Socket Communiaction**

You can now pass a stringified-JSON message over TCP sockets to request an action to be preformed.

- `{"action": "myAction", "params": {"key": "value"}}` is now a valid request over TCP
- params passed within an action's hash will NOT be 'sticky' to the connection, unlike paramAdd which remains 'sticky'
- general refactoring to the TCP codebase which will ensure that the state of params at the time of the action will be used when computing an action, and changes to the connection's state will not effect the action's execution
- these changes do not break the previous API, and sending single-line 'action' still works!  

**Bugs**

- fixed bug where websocket clients would not return after a actionHero reboot; also allows for more than one socket.io binding point
- Fixed default room assignment for webSocket clients
- only respond with messageCount to TCP/webSocket clients when it is in response to a request they made
- tests for webSockets finally writen and passing
- added connection idle timeout to aid with HTTP(s) server shutdown
- fixed a bug where action generators with 0 params wold generate invalid js

## Version 3.0.9

**Development Mode**

- actionHero now has a development mode! files in `/actions` and `/tasks` will be watched for changes, and reloaded on the fly.  
- this uses fs.watchFile() and doesn't work on all OSs / file systems.
- new files won't be loaded in just yet, only existing files when the app was booted will be monitored
- as deleting a file might crash your application, we will not attempt to re-load delted files
- if you have changed the `task.frequency` of a periodic task, you will the old timer value will be in use until the event fires at least once after the change 
- Don't use this in production! 

**Bugs**

- default config does not use redis again

## Version 3.0.8

**CLUSTER**

- A new, production-ready cluster example (complete with unix signal handling and 0-down time reloads for code changes)

**Bugs**

- Stopping an actionHero node will remove himself from `actionHero:peerPings`
- Cleaned up the colorizer within the logger
- Shutting down the actionHero when no servers were active to begin with returns true on `actionHero.stop()`
- final message sent to TCP clients on disconnect or shutdown now matches, "Bye!"

## Version 3.0.7

**Action Cluster**

- a new global hash, actionHero:peerPings, will store the last pings from each peer.  They should ping every ~500ms.  This can be used to detect when peers disappear
- disconnected peers are removed from the global list, and any tasks they were working on are re-enqueued

**Bugs**

- fixed a bug where using the generator to create a new action with no inputs would generate invalid syntax
- refactor redis name-space to be `actionHero:` rather than `actionHero:`
- actionHero.restart now returns the api object on success `actionHero.restart(true, api)`

## Version 3.0.6

**Chat Rooms**

- Events Emitted when folks enter/leave the room you are in

**Socket / WebSocket Clients**

- New Method `detailsView` to retrieve information about yourself (including your public ID)

## Version 3.0.5

**File Server**

- Files will now be served with a default cache-duration of 0 seconds.  Setting added to configure this
- Default files for directories is still "index.html", but this is now configurable.
- accessing directories works without the trailing slash (IE: http://localhost:8080/public resolves the same as http://localhost:8080/public/)
- the `Cache-Controll` is returned along with `Expires` header

**Better Logging**

- separation between file and action logging
- better shared syntax for all types of connections
- files log the path they were accessed from and duration

**Project Organization**

- You can now orginize your tasks and actions in sub-folders
- You can now symlink actions/taks into your project
- You can now symlink files in /public

**General Bug Fixes**

- better logic for including base config.json when you don't provide one
- updates for travis.ci

## Version 3.0.4

**General Bug Fixes**

- fixed bugs regearding load order of initializers and user-added initializers
- fixed a bug introduced in the previous version which may double-enqueue tasks 

## Version 3.0.3

**Notes**

- Configuration to set how many task workers each actionHero node has.  You now are **required** to set `api.configData.general.workers`
- Added generators for actions and tasks
  - `npm run-script actionHero generateAction`
  - `npm run-script actionHero generateTask`

## Version 3.0.2

**General Bug Fixes**

- fixed bugs where some tasks would not allow the task queue to continue even if they had been completed
- fixed a bug where non-redis tasks wouldn't be re-enqueued
- spelling

## Version 3.0.1

**Project Generator**

- A project Generator!
  - You can start up a new project in an empty directory with `npm install actionHero && npm run-script actionHero generate`.  This will create project structure and copy in some default actions and tasks.  
- Only tasks present in your project will be loaded (like actions).  Now that there is a generator which will copy in some default actions, loading tasks within actionHero is not needed.
- Project reorganization per the above
- remove hredis from the project
  - hredis is awesome, but this makes the project have less complex compiled dependencies.  You should add it to your project if you want fast redis communication, but it isn't *required* for actionHero to function
- This release adds more configuration options to webSockets in the form of `api.configData.webSockets.logLevel` (integer) and `configData.webSockets.settings` (which is an array strings which will be applied to socketIO's 'set' command)

## Version 3.0.0

**WebSockets and a better configuration system**

*This is a major release.  Sections of older actionHero projects will be incompatible with this release.*

This release adds web socket support to the project, and abstracts the chat room system to be available generically to all types of persistently-connected clients.  This release also updates the configuration system to allow developers to use any/all/none of the connection methods.  This should make it easier to add more and more communication protocols to the project.

**Notes**

General

- default file route changed from '/file' to '/public'; /file is the "action" called file which is provided as an example
- new configuration system.  Check `config.js` for updated structure
- all transports can be enabler or disabled based on `config.js`
- api.id now reflects protocols in use
- you can now specify which IPs actionHero will listen on for each protocol.  Use "0.0.0.0" for "all""

Actions

- randomNumber action update to show how to inspect different HTTP verbs to create different responses

Chat

- new initializer to make chat available to all persistent-socket clients
- new `api.chatRoom` namespace for chat functions (IE: `api.socketServer.socketRoomBroadcast` => `api.chatRoom.socketRoomBroadcast`)

Web Sockets

- socket.io a dependency of the project
- socket.io client JS symlikned to /public
- websocket example created
- status counts for webSockets
- websockets can be bound to http or https

Tests

- Spec Helper & Tests updated to reflect new configuration system

Examples

- updated to reflect new configuration system

## Version 2.0.3

**Summary:** Bug Fixes, Examples, and REPL

- actionHero now has a REPL! You can use the command line to use all the api-namespaced functions and define your own.  Great for debugging or checking on the status of the cluster.  
- Checkout the /examples folder for how to use the actionHeroClient package, browser javascript, and curl to interface with actionHero.  More languages coming soon.

**Notes**

- cache actions now take milliseconds like everything else.
- you can now have non-expiring cache entires (just pass a null value for expireTimeMS)
- there are no no default periodically-run tasks.  Look in `/examples` for the tasks that used to be there and copy them into your own project's /tasks folder.  This was done to reduce the 'magic' in the framework.  the runTask task still remains, as it was not run periodically.

## Note:
** [actionHeroClient](https://github.com/evantahler/actionHeroNodeClient) released! Connect node to node! **

## Version 2.0.2

**Summary:** Bug Fixes & Examples

**Details**
Check the notes for the bug fixes.  There are now also more examples in the project, showing off how you can connect from various environments.  This also coincides with the release of the [actionHeroClient](https://github.com/evantahler/actionHeroNodeClient) NPM package.  More coming soon.  

**Notes**

- Updates to how socket client requests are tracked to enforce proper message IDs.  If you directly used `api.processAction` before, the interface has changed.
- running the test suite will now use a separate redis db.  You can also set this in `config.json` for your app.
- better logic to ensure that tasks are enqueued properly
- cluster members will remove stale tasks they were working on when the app is started (in case of a crash)

## Version 2.0.1
Bug Fixes

## Version 2.0.0

** Redis-powered Cluster & major refactor **

**Details**

This version realizes the dream of a true cluster for actionHero.  There is no longer a need for a master process, and every node in the cluster can work alone or in a group.  This release also enables using the node.js cluster module to make the most of your server(s).  

*This version is likely to be incompatible with prior versions.  Running an actionCluster now requires redis (running a single node does not require redis and is still a pure node.js implementation).*

Using a [redis](http://redis.io/) backend, actionHero nodes can now share memory objects and have a common queue for tasks.  Philosophically, we have changed from a mesh network to a queue-based network.  This means that no longer will every node talk to every other node, but rather all nodes will talk to redis.  Now, I know that you are thinking "isn't that bad because it creates a single point of failure?"  Normally, the answer is yes, but redis already has mesh networking support! The suggested method of deployment is to setup a redis instance on each server, and they will handle the mesh networking for you.  

`api.cache` now works in a shared way if you are part of an actionCluster.  All cache actions refer to redis and in this way, all peers can have access to shared objects.  To avoid conflicts, you will have access to 'lastReadAt' as part of `api.cache.load` responses.  actionHero will also no longer store its own cache to disc periodically as redis does this already.

The task system also has undergone some major refactoring.  All tasks are now stored in a shared queue within redis.  All peers will periodically check the queue for unfilled tasks, and drain the queue one at a time.  In this manner, you can add more task capacity by spinning up more actionHero nodes which may or may not also handle web/socket traffic.  This also means that tasks will not get lost if a node crashes as they will remain in the redis queue until drained.  Each peer also has a 'personal' task queue for "all" actions.

For periodic tasks ("any" and "all"), the peer which most recently completed the task while hold the semaphore for that task (in a `actionHero:tasksClaimed` shared list) until the proper amount of time has elapsed, then they will re-enqueue the task.  This does not mean that a specific node will always preform tasks of the same type.

There are new requirements to `config.json` to configure redis.  Here is an example:

  "redis" : {
    "enable": true,
    "host": "127.0.0.1",
    "port": 6379,
    "password": null,
    "options": null
  },

All methods under the `api.actionCluster` namespace have been removed for simplicity.  Just use the normal cache methods, and if you are in a cluster, you will operate in a shared memory space.

**Notes**

- all peers now share the same `api.cache` data
- api.tasks.enqueue is now `api.tasks.enqueue(api, taskName, runAtTime, params)`  Set runAtTime to 0 to run the task as soon as possible
- using redis cache save; no longer saving cache periodically
- all nodes are created equal; there is no need for a master
- the entire `actionCluster` namesapace has been removed
- there are new requirements to `config.json` to setup redis
- every node will try to handle requests and process one job pending in the task queue at a time
- shared tasks will be preferred over per-node tasks
- the 'status' action has some new output types to reflect 'global' stats in comparison to 'local' stats (IE: count of web requests that this node has served vs total)

## Version 1.0.3

** Optional Headers **

**Details**

- You can now define custom host-headers in `config.json` which will be sent with every http/https response
- bug fixes introduced with task sharing (v 1.0.1)

## Version 1.0.2

** Task Sharing **

**Details**

- The master process will now delegate tasks in his queue to other peers in the cluster.
- Minor bug fixes

## Version 1.0.1

** SSL / HTTPS web server **

**Details**

* You can now spin up a secure https server along with you http server in action hero.  It will work exactly the same as the http server, and you can have both on at the same time with no overhead.
    * There are new configuration settings in `config.json` for this below

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
* HTTP requests will now return serverInformation.currentTime
* The original server (the one with no `configData.actionCluster.startingPeer` will be the only server to run 'any' tasks)
  * Other servers will NOT assume the role of running "any" tasks, but they will keep them in memory until the master server comes back upon a crash.
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