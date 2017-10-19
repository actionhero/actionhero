![](documentation.svg)

## Overview

A Telnet or TLS raw connection server.

```bash
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

roomAdd default Room
{"status":"OK"}

say defaultRoom hooray!
{"status":"OK","context":"response","data":null,"messageCount":8}
```

You can access actionhero's methods via a persistent socket connection. The default port for this type of communication is 5000. As this is a persistent connection, socket connections have actionhero's verbs available to them. These verbs are:

* `quit` disconnect from the session
* `paramAdd` - save a singe variable to your connection. IE: ‘addParam screenName=evan'
* `paramView` - returns the details of a single param. IE: ‘viewParam screenName'
* `paramDelete` - deletes a single param. IE: `deleteParam screenName`
* `paramsView` - returns a JSON object of all the params set to this connection
* `paramsDelete` - deletes all params set to this session
* `roomAdd` - connect to a room.
* `roomLeave` - (room) leave the `room` you are connected to.
* `roomView` - (room) show you the room you are connected to, and information about the members currently in that room.
* `detailsView` - show you details about your connection, including your public ID.
* `say` (room,) message

Please note that any verbs set using the above method will be sticky to the connection and sent for all subsequent requests. Be sure to delete or update your params before your next request.

To help sort out the potential stream of messages a socket user may receive, it is best to understand the "context" of the response. For example, by default all actions set a context of "response" indicating that the message being sent to the client is response to a request they sent (either an action or a chat action like `say`). Messages sent by a user via the `say` command have the context of `user` indicating they came form a user. Messages resulting from data sent to the api (like an action) will have the `response` context.

Every message returned also contains a `messageId`, starting from 1, which increments to count a response to each client request.  `say` messages do not increment `messageCount`, which allows this count to be used by the client to map responses to queries.

`connection.type` for a TCP/Socket client is "socket"

## Config Options

```js
exports['default'] = {
  servers: {
    socket: function (api) {
      return {
        enabled: (process.env.ENABLE_TCP_SERVER !== undefined),
        // TCP or TLS?
        secure: false,
        // Passed to tls.createServer if secure=true. Should contain SSL certificates
        serverOptions: {},
        // Port or Socket
        port: 5000,
        // Which IP to listen on (use 0.0.0.0 for all)
        bindIP: '0.0.0.0',
        // Enable TCP KeepAlive pings on each connection?
        setKeepAlive: false,
        // Delimiter string for incoming messages
        delimiter: '\n',
        // Maximum incoming message string length in Bytes (use 0 for Infinite)
        maxDataLength: 0
      }
    }
  }
}
```

## TLS Encryption

You can switch your TCP server to use TLS encryption if you desire. Just toggle the settings in `/config/servers/socket.js` and provide valid certificates. You can test this with the openSSL client rather than telnet `openssl s_client -connect 127.0.0.1:5000`

Note that if you wish to create a secure (tls) server, you will be required to complete the serverOptions hash with at least a cert and a keyfile:

```js
config.severs.socket = {
  // TCP or TLS?
  secure: true,
  // Passed to tls.createServer if secure=true. Should contain SSL certificates
  serverOptions: {
    key: fs.readFileSync('certs/server-key.pem'),
    cert: fs.readFileSync('certs/server-cert.pem')
  }
};
```

You can connect like: `openssl s_client -connect 127.0.0.1:5000`

or from node:

```js
// Connecting over TLS from another node process
const tls = require('tls');
const fs = require('fs');

const options = {
  key: fs.readFileSync('certs/server-key.pem'),
  cert: fs.readFileSync('certs/server-cert.pem')
};

const cleartextStream = tls.connect(5000, options, () => {
  console.log('client connected', cleartextStream.authorized ? 'authorized' : 'unauthorized');
  process.stdin.pipe(cleartextStream);
  process.stdin.resume();
})

cleartextStream.setEncoding('utf8')

cleartextStream.on('data', function(data) {
  console.log(data)
})
```

## Files and Routes

Connections over socket can also use the file action. There is no route for files.

* Errors are returned in the normal way `{error: someError}` when they exist.
* A successful file transfer will return the raw file data in a single send(). There will be no headers set, nor will the content be JSON.  Plan accordingly!

```
> telnet localhost 5000
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
{"welcome":"Hello! Welcome to the actionhero api","context":"api"}
$ paramAdd file=simple.html
{"status":"OK","context":"response","messageCount":1}
$ file
<h1>ActionHero</h1>\nI am a flat file being served to you via the API from ./public/simple.html<br />
```

## JSON Parameters

The default method of using actions for TCP clients is to use the methods above to set params to their session and then call actions inline. However, you can also communication via JSON, passing along params specific to each request.

*   `{"action": "myAction", "params": {"key": "value"}}` is also a valid request over TCP

## Client Suggestions

The main `trick` to working with TCP/wire connections directly is to remember that you can have many ‘pending' requests at the same time. Also, the order in which you receive responses back can be variable. if you request `slowAction` and then `fastAction`, it's fairly likely that you will get a response to `fastAction` first.

Note that only requests the client makes increment the `messageCount`, but broadcasts do not (the `say` command, etc)

[The actionhero Node Client Library](https://github.com/actionhero/actionhero-node-client) uses TCP/TLS connections, and makes use of actionhero's `messageCount` parameter to keep track of requests, and keeps response callbacks for actions in a pending queue. For example:

```js
const path = require('path')
const ActionheroNodeClient = require(path.join(__dirname, 'lib', 'client.js'))

async function main () {
  const client = new ActionheroNodeClient()

  client.on('say', (message) => {
    console.log(' > SAY: ' + message.message + ' | from: ' + message.from)
  })

  client.on('welcome', (welcome) => {
    console.log('WELCOME: ' + welcome)
  })

  client.on('error', (error) => {
    console.log('ERROR: ' + error)
  })

  client.on('end', () => {
    console.log('Connection Ended')
  })

  client.on('timeout', (request, caller) => {
    console.log(request + ' timed out')
  })

  await client.connect({host: '127.0.0.1', port: '5000'})

  // get details about myself
  console.log('My Details: ', client.details)

  // try an action
  const params = { key: 'mykey', value: 'myValue' }
  let {error, data, delta} = await client.actionWithParams('cacheTest', params)
  if (error) { throw error }
  console.log('cacheTest action response: ', data)
  console.log(' ~ request duration: ', delta)

  // join a chat room and talk
  await client.roomAdd('defaultRoom')
  await client.say('defaultRoom', 'Hello from the actionheroClient')
  await client.roomLeave('defaultRoom')

  // leave
  await client.disconnect()
  console.log('all done!')
}

main()
```
