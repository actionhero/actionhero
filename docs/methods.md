---
layout: docs
title: Documentation - API Methods
---

# API Methods

A refrence document for actionhero's methods.

## Actions

### new api.actionProcessor(data)

{% highlight javascript %}
new api.actionProcessor({
  connection: connection,
  callback: next,
})
{% endhighlight %}

- you should not need to interact with the actionProcessor directly if connections use a server
- `next(connection, toContinue)`
- process an action in-line
- connection must be a properly formatted connection object (best to use `new api.connection(data)`)

### actionProcessor.processAction(messageId)
- process the action pending `this.commection`
- messageID is optional, and used for clients which can have more than one pending action (TCP, webSocket)
- `this.callback` will be called when complete

## Connection

### new api.connection(data)

All connection objects have these properties by the time they reach middleware or an action:

{% highlight javascript %}
{
  id: 'bafbe812649a74e65021c689cf5b096d49f03a49',
  connectedAt: 1388804743345,
  type: 'web',
  remotePort: 50368,
  remoteIP: '127.0.0.1',
  rawConnection: {},
  error: null,
  params: { 
    action: 'status', 
  },
  response: {},
  pendingActions: 0,
  totalActions: 0,
  messageCount: 0,
  listeningRooms: [],
  canChat: false,
  room: null,
  sendMessage: [Function],
  _originalConnection: {},
  action: 'status',
  actionStatus: true
}
{% endhighlight %}

- All connections which appear to your actions are "proxy" connections built at the start of the request, and `_originalConnection` is a refrence back to the "real" connection object.  If you are modifying a long-lasting connection (perhaps for chat auth), be sure to modify both `connection.value` and `connection._originalConnection.value`.
- `rawConnection` contains the actual socket or connection object for the connection.  This will change based on the server type.  

{% highlight javascript %}
// web
connection.rawConnection = {
  req: req,
  res: res,
  method: method,
  cookies: cookies,
  responseHeaders: responseHeaders,
  responseHttpCode: responseHttpCode,
  parsedURL: parsedURL
}

// web socket
connection.rawConnection = {
  clientId: message.clientId,
  uuid: uuid
}

// socket
connection.rawConnection = DuplexSocket;
{% endhighlight %}

When building a connection: 

{% highlight javascript %}
connection = new api.connection({
    type "web",
    remoteIp: '123.123.123.123',
    remotePort: 80,
    rawConnection: {
      req: req,
      res: res,
    },
});
{% endhighlight %}

- data is required, and must contain: `{type: type, remotePort: remotePort, remoteIP: remoteIP, rawConnection: rawConnection}`
- If your connection already has an ID (from your server implementation, or browser_fingerprint), you can also pass `data.id`, otherwise a new id will be generated.
- If you want to link multiple connections together, consiter using `connection.fingerprint`
- When connections are built, they are added automatically to `api.connections`
- `.connection.params`, `connection.response`, etc are automatically built into the connection object

### connection.destroy()
- The proper way to disconnect a client.  This will remove the connection from any chatrooms and global lists.

### connection.sendMessage(message, type)
* You may use this method to send a message to a specific client which exists in `api.connections.connections`.  
* `sendMessage` abstracts the type of connection so you don't need to use `write` (socket clients) or `publish` (websockets).  
* message is a JSON block which will be serialized and type is optional, and used as the type name of the event to emit (optional, depends on transport)

### api.connections.connections
- the array of all active connections for this server

## Cache

### api.cache.size(next)
- `next(error, count)`
- counts the number of elements in the cache

### api.cache.save(key, value, expireTimeMS, next)
- `next(error, didSave)`
- expireTimeMS can be null if you don't want it to expire
- key must be a string
- value must be able to be JSON.stringify'd


### api.cache.load(key, next) | api.cache.load(key, options, next)
- `next(error, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt)`
- all callback values will be null if the object doesn't exist or has expired
- options can be `{expireTime: 1234}` where the act of reading the key will reset the key's expire time

### api.cache.destroy(key, next)
- `next(error, didDelete)`
- didDelete will be true if the object existed and was deleted.

### api.cache.lock(key, expireTimeMS, next)
- `expireTimeMS` is optional, and will be `expireTimeMS = api.cache.lockDuration = api.config.general.lockDuration`
- Callback: `next(error, lockOk)`
  - `error` will be null unless there was something wrong with the connection (perhaps a redis error)
  - `lockOk` will be `true` or `false` depending on if the lock was obtained.

### api.cache.unlock(key, next)
- Callback: `next(error, lockOk)`
  - `error` will be null unless there was something wrong with the connection (perhaps a redis error)
  - `lockOk` will be `true` or `false` depending on if the lock was removed.

### api.cache.checkLock(key,retry,  next)
-  `retry` is either `null` or an integer (ms) that we should keep retrying until the lock is free to be re-obtained
- Callback: `next(error, lockOk)`
  - `error` will be null unless there was something wrong with the connection (perhaps a redis error)
  - `lockOk` will be `true` or `false` depending on if the lock is currently obtainable.

### api.cache.locks()
- Callback: `next(error, locks)`


## Chat Rooms

connections should use the verbs `roomChange` or `listenToRoom` to move around rooms.  These methods are for the server to manage rooms.

### api.chatRoom.broadcast(connection, room, message, callback)
- tell a message to all members in a room.
- connection can either be a real connection (A message coming from a client), or a mockConnection.  A mockConnection at the very least has the form `{room: "someOtherRoom}`.  mockConnections without an id will be assigned the id of 0
- The `context` of messages sent with `api.chatRoom.broadcast` always be `user` to differentiate these responses from a `responsee` to a request

### api.chatRoom.add(room, callback)
- callback will return 1 if you created the room, 0 if it already existed

### api.chatRoom.destroy(room, callback)
- callback is empty

### api.chatRoom.exists(room, callback)
- callback returns (error, found); found is a boolean

### api.chatRoom.roomStatus(room, callback)
- callback returns (error, details); details is a hash containing room information

### api.chatRoom.roomStatus(room, callback)
- callback return (error, data)
- data is of the form:

{% highlight javascript %}
{
  room: "myRoom",
  membersCount: 2,
  members: {
    aaa: {id: "aaa", joinedAt: 123456789 },
    bbb: {id: "bbb", joinedAt: 123456789 },
  }
}
{% endhighlight %}

### api.chatRoom.addMember(connectionId, room, callback)
- callback is of the form (error, wasAdded)
- you can add connections from this or any other server in the cluster

### api.chatRoom.removeMember(connectionId, room, callback)
- callback is of the form (error, wasRemoved)
- you can remove connections from this or any other server in the cluster

### api.chatRoom.generateMemberDetails( connection )
- defines what is stored from the connection object in the member data
- default is `id: connection.id`
- other data that is stored by default is `host: api.id` and `joinedAt: new Date().getTime()`
- override the entire method to store custom data *that is on the connection*

### api.chatRoom.sanitizeMemberDetails( memberData )
- Defines what is pulled out of the member data when returning roomStatus
- Defaults to `joinedAt : memberData.joinedAt`
- After method call, always filled with `id`, based on the `connection.id` used to store the data
- Override the entire method to use custom data as defined in `api.chatRoom.generateMemberDetails`

**Example:**
{% highlight javascript %}
  api.chatRoom.sanitizeMemberDetails = function( memberData ) {
    return {
      joinedAt: memberData.joinedAt,
      userId: memberData.userId
    };
  }

  api.chatRoom.generateMemberDetails = function( connection ) {
    return {
      id: connection.id,
      userId: connection.userId
    };
  }
{% endhighlight %}
Now data stored for room members will contain the `userId`, that can be mapped to project database or what have you.

### api.chatRoom.generateMessagePayload( message )
- Defiens how messages from clients are sanitized
- Override the entire method to use custom data as defined in `api.chatRoom.generateMessagePayload`

## File Server

### api.staticFile.staticFile(file, next)
- next (exists? boolean)

### api.staticFile.get(connection, next)
- next(connection, error, fileStream, mime, length)
- note that fileStream is a stream you can `pipe` to the client, not the file contents

You can send files in actions with `connection.sendFile`, IE:
{% highlight javascript %}
connection.rawConnection.responseHttpCode = 404; 
connection.sendFile('404.html');
next(connection, false);
{% endhighlight %}

## Redis

### api.redis.client
- the connected redis client
- use this redis instance to make queries, etc

### api.redis.publish(channel, message)
- channel is a string of the form "/my/channel"
- message is an object
- to subscribe to messages, add your handler to `api.redis.subsciptionHandlers`, IE: `api.redis.subsciptionHandlers['x'] = function(message)`

### api.redis.doCluster(method, args, connectionId, callback)
- this calls a remote function on one or many other members of the actionhero cluster
- if you provide `connectionId`, only the one server who has that connection present will act, otherwise all servers will (including the sending server)
- doCluster can timeout, and this value is set at `api.config.redis.rpcTimeout`

## Tasks

### api.tasks.enqueue(taskName, params, queue, next)
- next(err, toRun)
- enqueues a task to run ASAP
- toRun will indicate if the task was successfully enqueued or blocked by a resque plugin

### api.tasks.enqueueAt(timestamp, taskName, params, queue, next)
- next()
- enqueue a task to run at `timestamp`(ms)

### api.tasks.enqueueIn(time, taskName, params, queue, next)
- next()
- enqueue a task to run in `time`ms from now

### api.tasks.scheduledAt(queue, taskName, args, next)
- next(err, timestamps)
- finds all matching instances of queue + taskName + args from the delayed queues
- timestamps will be an array of the delayed timestamps

### api.tasks.del(queue, taskName, args, count, next)
- next(err, count)
- removes all matching instances of queue + taskName + args from the normal queues
- count is how many instances of this task were removed

### api.tasks.delDelayed(queue, taskName, args, next)
- next(err, timestamps)
- removes all matching instances of queue + taskName + args from the delayed queues
- timestamps will be an array of the delayed timestamps which the task was removed from

### api.tasks.enqueueRecurrentJob(taskName, next)
- next()
- will enqueue are recurring job
- might not actually enqueue the job if it is already enqueued due to resque plugins

### api.tasks.stopRecurrentJob(taskName, next)
- next(err, removedCount)
- will remove all instances of `taskName` from the delayed queues and normal queues
- removedCount will inform you of how many instances of this job were removed

### api.tasks.timestamps(next)
- next(err, timestamps)
- will return an array of all timesamps which have at least one job scheduled to be run 
- for use with `api.tasks.delayedAt`

### api.tasks.delayedAt(timestamp, next)
- next(err, jobs)
- will return the list of jobs enqueued to run after this timestamp

### api.tasks.allDelayed(next)
- next(err, jobs)
- will return the list of all jobs enqueued by the timestamp they are enqueued to run at

### api.tasks.workers(next)
- next(err, workers)
- list all taskProcessors

### api.tasks.queue.workingOn(workerName, queues, next)
- next(err, status)
- list what a specific taskProcessors (defined by the name of the server + queues) is working on (or sleeping)

### api.tasks.queue.allWorkingOn(workerName, queues, next)
- next(err, workers)
- list what all taskProcessors are working on (or sleeping)

#### api.tasks.failedCount(next)
- next(err, failedCount)
- `failedCount` is how many resque jobs are in the failed queue.

#### api.tasks.failed(start, stop, next)
- next(err, failedJobs)
- `failedJobs` is an array listing the data of the failed jobs.  You can see an example at https://github.com/taskrabbit/node-resque#failed-job-managment

#### api.tasks.removeFailed(failedJob, next)
- next(err, removedCount)
- the input `failedJob` is an expanded node object representing the failed job, retrieved via `api.tasks.failed`

#### api.tasks.retryAndRemoveFailed(failedJob, next)
- next(err, failedJob)
- the input `failedJob` is an expanded node object representing the failed job, retrieved via `api.tasks.failed`

### api.tasks.details(next)
- next(err, details)
- details is a hash of all the queues in the system and how long they are
- this method also returns metadata about the taskProcessors and what they are currently working on

## Log

### api.log(message, severity, metadata)
- message is a string
- severity is a string, and should match the log-level (IE: 'info' or 'warning')
- the default severity level is 'info'
- (optional) metadata is anything that can be stringified with `JSON.stringify`

`api.logger.log` and `api.logger[severity]` also exist

## Middleware

### api.actions.addPreProcessor(function(connection, actionTemplate, next), priority)
- action middleware
- called in-line before every action
- callback is of the form `next(connection, toContinue)`
- priority is optional

### api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next), priority)
- action middleware
- called in-line after every action, before rendering a response to the client
- callback is of the form `next(connection, toRender)`
- priority is optional

### api.connections.addCreateCallback(function(connection), priority)
- connection middleware
- there is no callback
- called when a connection joins the server
- priority is optional

### api.connections.addDestroyCallback(function(connection), priority)
- connection middleware
- there is no callback
- called when a connection leaves the server
- priority is optional

### api.chatRoom.addJoinCallback(function(connection, room, callback), priority)
- chat middleware
- called when a connection joins a room
- priority is optional
- callback(error)
  - error will block the client from joining the room

### api.chatRoom.addLeaveCallback(function(connection, room, callback), priority)
- chat middleware
- called when a connection leaves a room
- priority is optional
- callback(error)
  - error will block the client from leaving the room

### api.chatRoom.addSayCallback(function(connection, room, messagePayload, callback), priority)
- chat middleware
- there is no callback
- priority is optional
- callback(error, modifiedMessagePayload)
  - error will block the client sending the message
  - modifiedMessagePayload will be passed to next middleware and eventually on to the client 

## Testing

### new api.specHelper.connection()
- generate a new connection object for the `testServer`
- this connection can run actions, chat, etc.
- `connection.messages` will contain all messages the connection has been sent (welcome messages, action responses, say messages, etc)

### api.specHelper.runAction(actionName, input, callback)
- use this method to run an action
- `input` can be either a `api.specHelper.connection` object, or simply a hash of params, IE: `{key: 'value'}`
- the callback returns `message` and `connection`.
- example use:

{% highlight javascript %}
api.specHelper.runAction('cacheTest', {key: 'key', value: 'value'}, function(message, connection){
  // message is the normal API response;
  // connection is a new connection object
})
{% endhighlight %}

### api.specHelper.getStaticFile(file, callback)
- request a file in `/public` from the server
- the callback returns `message` and `connection` where `message` is a hash:

{% highlight javascript %}
var message = {
  error    : error,  // null if everything is OK
  content  : (string),  // string representation of the file's body
  mime     : mime,  // file mime
  length   : length  // bytes
}
{% endhighlight %}

### api.specHelper.runTask(taskName, params, callback)
- callback may or may not return anything depending on your task's makeup

## Utils

### api.utils.sqlDateTime(time)
- returns a mySQL-style formatted time string `2012-01-01 00:00:00`
- if no time is provided, `new Date()` (now) will be used

### api.utils.sqlDate(time)
- returns a mySQL-style formatted date string `2012-01-01`
- if no time is provided, `new Date()` (now) will be used

### api.utils.randomString(chars)
- returns a random string of `chars` length
- the chars used are all HTML safe

### api.utils.hashLength(obj)
- calculates the 'size' of primary, top level keys in the hash
- `api.utils.hashLength({a: 1, b: 2})` would be 2

### api.utils.hashMerge(a, b)
- create a new hash which looks like b merged into a
- `{a:1, b:2}` merged with `{b:3, c:4}` looks like `{a: 1, b:3, c:4}`

### api.utils.isPlainObject(object)
- determines if `object` is a plain js 'Object' or somethign more complex, like a stream

### api.utils.arrayUniqueify(arr)
- removes duplicate entries from an array

### api.utils.sleepSync(seconds)
- a terrible and inneffiencet way to force a blocking sleep in the main thread
- never ever use this… ever

### api.utils.randomArraySort(arr)
- return a randomly sorted array

### api.utils.inArray(haystack, needle)
- checks if needle is contained within the haystack array
- returns true/false

### api.utils.objClone(obj)
- creates a new object with the same keys and values of the original object

### api.utils.getExternalIPAddress()
- attempts to determine this server's external IP address out of all plausible addressees this host is listening on

### api.utils.parseCookies(req)
- a helper to parse the request object's headers and returns a hash of the client's cookies

### api.utils.parseIPv6URI(address)
- will return `{host: host, port: port}` for an IPv6 address
