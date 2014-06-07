---
layout: wiki
title: Wiki - Socket Server
---

# Socket Server

## General

You can access actionhero's methods via a persistent socket connection.  The default port for this type of communication is 5000.  As this is a persistent connection, socket connections have actionhero's verbs available to them.  These verbs are:

* `quit` disconnect from the session
* `paramAdd` - save a singe variable to your connection.  IE: 'addParam screenName=evan'
* `paramView` - returns the details of a single param. IE: 'viewParam screenName'
* `paramDelete` - deletes a single param.  IE: 'deleteParam screenName'
* `paramsView` - returns a JSON object of all the params set to this connection
* `paramsDelete` - deletes all params set to this session
* `roomAdd` - connect to a room.
* `roomLeave` - (room) leave the `room` you are connected to.
* `roomView` - (room) show you the room you are connected to, and information about the members currently in that room.
* `detailsView` - show you details about your connection, including your public ID.
* `say` (room,) message

Please note that any verbs set using the above method will be 'sticky' to the connection and sent for all subsequent requests.  Be sure to delete or update your params before your next request.

To help sort out the potential stream of messages a socket user may receive, it is best to understand the "context" of the response.  For example, by default all actions set a context of "response" indicating that the message being sent to the client is response to a request they sent (either an action or a chat action like `say`).  Messages sent by a user via the 'say' command have the context of `user` indicating they came form a user.  Messages resulting from data sent to the api (like an action) will have the `response` context.

Socket Example:

{% highlight javascript %}
> telnet localhost 5000
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
{"welcome":"Hello! Welcome to the actionhero api","room":"defaultRoom","context":"api"}
detailsView
{"status":"OK","context":"response","data":{"id":"2d68c389-521d-4dc6-b4f1-8292cd6cbde6","remoteIP":"127.0.0.1","remotePort":57393,"params":{},"connectedAt":1368918901456,"room":"defaultRoom","totalActions":0,"pendingActions":0},"messageCount":1}
randomNumber
{"randomNumber":0.4977603426668793,"context":"response","messageCount":2}
cacheTest
{"error":"Error: key is a required parameter for this action","context":"response","messageCount":3}
paramAdd key=myKey
{"status":"OK","context":"response","data":null,"messageCount":4}
paramAdd value=myValue
{"status":"OK","context":"response","data":null,"messageCount":5}
paramsView
{"status":"OK","context":"response","data":{"action":"cacheTest","key":"myKey","value":"myValue"},"messageCount":6}
cacheTest
{"cacheTestResults":{"saveResp":true,"sizeResp":1,"loadResp":{"key":"cacheTest_myKey","value":"myValue","expireTimestamp":1368918936984,"createdAt":1368918931984,"readAt":1368918931995},"deleteResp":true},"context":"response","messageCount":7}
say hooray!
{"status":"OK","context":"response","data":null,"messageCount":8}
{% endhighlight %}

`connection.type` for a TCP/Socket client is "socket"

## TLS

You can switch your TCP server to use TLS encryption if you desire.  Just toggle the settings in `/config/servers/socket.js` and provide valid certificates.  You can test this with the openSSL client rather than telnet `openssl s_client -connect 127.0.0.1:5000`

{% highlight javascript %}
config.severs.socket = {
  secure: false,                        // TCP or TLS?
  serverOptions: {},                    // passed to tls.createServer if secure=ture. Should contain SSL certificates
  port: 5000,                           // Port or Socket
  bindIP: "0.0.0.0",                    // which IP to listen on (use 0.0.0.0 for all)
};
{% endhighlight %}

Note that if you wish to create a secure (tls) server, you will be required to complete the serverOptions hash with at least a cert and a keyfile:

{% highlight javascript %}
config.server.socket.serverOptions: {
  key: fs.readFileSync('certs/server-key.pem'),
  cert: fs.readFileSync('certs/server-cert.pem')
}
{% endhighlight %}

You can connect like:

{% highlight javascript %}
openssl s_client -connect 127.0.0.1:5000
{% endhighlight %}

or from node:

{% highlight javascript %}
var tls = require('tls');
var fs = require('fs');

var options = {
  key: fs.readFileSync('certs/server-key.pem'),
  cert: fs.readFileSync('certs/server-cert.pem')
};

var cleartextStream = tls.connect(5000, options, function() {
  console.log('client connected', cleartextStream.authorized ? 'authorized' : 'unauthorized');
  process.stdin.pipe(cleartextStream);
  process.stdin.resume();
});
cleartextStream.setEncoding('utf8');
cleartextStream.on('data', function(data) {
  console.log(data);
});
{% endhighlight %}

## Files and Routes for TCP clients

Connections over socket can also use the file action.  There is no 'route' for files.

* errors are returned in the normal way `{error: someError}` when they exist.
* a successful file transfer will return the raw file data in a single send().  There will be no headers set, not will the content be JSON.

## JSON Params 

The default method of using actions for TCP clients is to use the methods above to set params to their session and then call actions inline.  However, you can also communication via JSON, passing along params specific to each request.

- `{"action": "myAction", "params": {"key": "value"}}` is also a valid request over TCP

## Client Suggestions

The main `trick` to working with TCP/wire connections directly is to remember that you can have many 'pending' requests at the same time.  Also, the order in which you receive responses back can be variable.  if you request `slowAction` and then `fastAction`, it's fairly likely that you will get a response to `fastAction` first.

[The actionhero client library](https://github.com/evantahler/actionhero_client) uses TCP/TLS connections, and makes use of actionhero's `messageCount` parameter to keep track of requests, and keeps response callbacks for actions in a pending queue.  You can check out the [example here](https://github.com/evantahler/actionhero_client/blob/master/actionhero_client.js)

Note that only requests the client makes increment the `messageCount`, but broadcasts do not (the `say` command, etc)
