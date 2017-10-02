## Overview

```js
var initialize = function(api, options, next){

  //////////
  // INIT //
  //////////

  var type = "test"
  var attributes = {
    canChat: true,
    logConnections: true,
    logExits: true,
    sendWelcomeMessage: true,
    verbs: [],
  }

  var server = new api.GenericServer(type, options, attributes);

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server.start = function(next){}

  server.stop = function(next){}

  server.sendMessage = function(connection, message, messageCount){}

  server.sendFile = function(connection, error, fileStream, mime, length){};

  server.goodbye = function(connection, reason){};

  ////////////
  // EVENTS //
  ////////////

  server.on("connection", function(connection){});

  server.on('actionComplete', function(data){
    completeResponse(data);
  });

  /////////////
  // HELPERS //
  /////////////

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initialize = initialize;
```

In ActionHero v6.0.0 and later, we have introduced a modular server system which allows you to create your own servers.  Servers should be thought of as any type of listener to clients, streams or your file system.  In ActionHero, the goal of each server is to ingest a specific type of connection and transform each client into a generic `connection` object which can be operated on by the rest of ActionHero.  To help with this, all servers extend `api.GenericServer` and fill in the required methods.
To get started, you can use the `generateServer action` (name is required).  This will generate a template server which looks like the above.
Like initializers, the `start()` and `stop()` methods will be called when the server is to boot up in ActionHero's lifecycle, but before any clients are permitted into the system.  Here is where you should actually initialize your server (IE: `https.createServer.listen`, etc).

## Designing Servers

Your job, as a server designer, is to coerce every client's connection into a connection object.  This is done with the `sever.buildConnection` helper.  Here is an example from the `web` server:

```js
server.buildConnection({
  rawConnection: {
    req: req,
    res: res,
    method: method,
    cookies: cookies,
    responseHeaders: responseHeaders,
    responseHttpCode: responseHttpCode,
    parsedURL: parsedURL
  },
  id: randomNumber(),
  remoteAddress: remoteIP,
  remotePort: req.connection.remotePort}
); // will emit "connection"

// Note that connections will have a \`rawConnection\` property.  This is where you should store the actual object(s) returned by your server so that you can use them to communicate back with the client.  Again, an example from the \`web\` server:

server.sendMessage = function(connection, message){
   cleanHeaders(connection);
   var headers = connection.rawConnection.responseHeaders;
   var responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
   var stringResponse = String(message)
   connection.rawConnection.res.writeHead(responseHttpCode, headers);
   connection.rawConnection.res.end(stringResponse);
   server.destroyConnection(connection);
 }
 ```

## Options and Attributes

A server defines `attributes` which define it's behavior.  Variables like `canChat` are defined here. `options` are passed in, and come from `api.config.servers[serverName]`.  These can be new variables (like https?) or they can also overwrite the set `attributes`.
The required attributes are provided in a generated server.

## Verbs

```js
allowedVerbs: [
      "quit",
      "exit",
      "paramAdd",
      "paramDelete",
      "paramView",
      "paramsView",
      "paramsDelete",
      "roomChange",
      "roomView",
      "listenToRoom",
      "silenceRoom",
      "detailsView",
      "say"
    ]
```

When an incoming message is detected, it is the server's job to build `connection.params`.  In the `web` server, this is accomplished by reading GET, POST, and form data.  For `websocket` clients, that information is expected to be emitted as part of the action's request.  For other clients, like `socket`, ActionHero provides helpers for long-lasting clients to operate on themselves.  These are called connection `verbs`.
Clients use verbs to add params to themselves, update the chat room they are in, and more.   The list of verbs currently supported is listed above.
Your server should be smart enough to tell when a client is trying to run an action, request a file, or use a verb.  One of the attributes of each server is `allowedVerbs`, which defines what verbs a client is allowed to preform.  A simplified example of how the `socket` server does this:

```js
var parseRequest = function(connection, line){
   var words = line.split(" ");
   var verb = words.shift();
   if(verb == "file"){
     if (words.length > 0){
       connection.params.file = words[0];
     }
     server.processFile(connection);
   }else{
     connection.verbs(verb, words, function(error, data){
       if(error == null){
         var message = {status: "OK", context: "response", data: data}
         server.sendMessage(connection, message);
       }else if(error === "verb not found or not allowed"){
         connection.error = null;
         connection.response = {};
         server.processAction(connection);
       }else{
         var message = {status: error, context: "response", data: data}
         server.sendMessage(connection, message);
       }
     });
   }
 }
```
## Chat

The `attribute` "canChat" defines if clients of this server can chat.  If clients can chat, they should be allowed to use vebs like "roomChange" and "say".  They will also be sent messages in their room (and rooms they are listening too) automatically.

## Sending Responses

All servers need to implement the `server.sendMessage = function(connection, message, messageCount)` method so ActionHero knows how to talk to each client.  This is likely to make use of `connection.rawConnection`.  If you are writing a server for a persistent connection, it is likely you will need to respond with `messageCount` so that the client knows which request your response is about (as they are not always going to get the responses in order).

## Sending Files

Servers can optionally implement the `server.sendFile = function(connection, error, fileStream, mime, length)` method.  This method is responsible for any connection-specific file transport (headers, chinking, encoding, etc). Note that fileStream is a `stream` which should be `pipe`'d to the client.

## Customizing Servers

```js
//Initializer
 module.exports = {
   startPriority: 1000,
   start: function (api, next) {
     let webServer = api.servers.servers.web
     webServer.connectionCustomMethods = webServer.connectionCustomMethods || {}
     webServer.connectionCustomMethods.requestHeaders = function (connection) {
       return connection.rawConnection.req.headers
     }
   }
 }

 //Action
 module.exports = {
   name: 'logHeaders',
   description 'Log Web Request Headers',
   run: function (api, data, next) {
     let headers = data.connection.requestHeaders()
     api.log('Headers:', 'debug', headers)
     next()
   }
 }
```

The `connection` object passed to a server can be customized on a per server basis through the use of the `server.connectionCustomMethods` hash. The hash can be populated with functions whose signature must match `function (connection, ...)`. Once populated, these functions are curried to always pass `connection` as the first argument and applied to the `data.connection` object passed to Actions, and can be accessed via `data.connection.functionName(...)` within the action or middleware.
In this way, you can create custom methods on your connections.
