# WebSocket Server

## General

actionhero uses [Primus](https://github.com/primus/primus) for web sockets.  The Primus project allows you to choose from many websocket backends, including `ws`, `engine.io`, `socket.io`, and more. Within actionhero, web sockets are bound to the web server (either http or https).

Actionhero will generate the client-side javascript needed for you (based on the actionheroClient library, primus, and the underlying ws transport). This file is regenerated each time you boot the application.

**Warning**

In `v9.0.0` and later, actionhero will no longer attempt to manage non-sticky client connections. This means if you have a multi-server actionhero deployment and you use long-polling in your websocket transport, you will need to ensure that your load balancer can enforce sticky connections, meaning every request from the client will hit the same actionhero node.

## Connection Details

```html
<script src="/public/javascript/actionheroClient.js"></script>

<script>

  client = new ActionheroClient;

  client.on('connected',    function(){ console.log('connected!') })
  client.on('disconnected', function(){ console.log('disconnected :(') })

  client.on('error',        function(err){ console.log('error', err.stack) })
  client.on('reconnect',    function(){ console.log('reconnect') })
  client.on('reconnecting', function(){ console.log('reconnecting') })
  
  // this will log all messages send the client
  // client.on('message',      function(message){ console.log(message) })

  client.on('alert',        function(message){ alert(message) })
  client.on('api',          function(message){ alert(message) })

  client.on('welcome',      function(message){ appendMessage(message); })
  client.on('say',          function(message){ appendMessage(message); })

  client.connect(function(err, details){
    if(err != null){
      console.log(err);
    }else{
      client.roomAdd("defaultRoom");
      client.action('someAction', {key: 'k', value: 'v'}, function(error, data){
        // do stuff
      });
    }
  });

</script>
```

`connection.type` for a webSocket client is "webSocket".  This type will not change regardless of if the client has fallen back to another protocol. 

Data is always returned as JSON objects to the webSocket client.  

An example web socket session might be the following:

You can also inspect `client.state` ('connected', 'disconnected', etc).  The websocket client will attempt to re-connect automatically.

If you want to communicate with a websocket client outside of an action, you can call `connection.send(message)` on the server. In the client lib, the event message will be fired. So, `client.on('message, function(m){ ... })`.  Be sure to add some descriptive content to the message you send from the sever (like perhaps `{"type": 'message type'}`) so you can route message types on the client.

## Methods

Methods which the provided actionheroWebSocket object expose are:

### client.connect(callback)
  - `callback` will contain (error, detauils)
  - details here is the same as the `detailsView` method

### client.action(action, params, callback)
  - `action` is a string, like "login"
  - `params` is an object
  - `callback` will be passed `response` (and you can inspect `response.error`)

### client.say(room, message, callback)
  - `message` is a string
  - may contain an `error`
  - note that you have to first join a room with `roomAdd` to chat within it of recieve events

### client.detailsView(callback)
  - `callback` will be passed `error`, `response` 
  - the first response from detailsView will also always be saved to `client.details` for later inspection
  - may contain an `error`

### client.roomView(room, callback)
  - will return metadata about the room 
  - may contain an `error`

### client.roomAdd(room, callback)
  - `room` is a string
  - may contain an `error`

### client.roomLeave(room, callback)
  - `room` is a string
  - may contain an `error`

### client.file(callback)
  - see below for details

### client.disconnect()
  - instantly sever the connection to the server

The contents of the `file` callback look like:
```javascript
{
  content: "<h1>ActionHero</h1>\nI am a flat file being served to you via the API from ./public/simple.html<br />",
  context: "response",
  error: null,
  length: 101,
  messageCount: 3,
  mime: "text/html"
}
```

## Events

### client.on('connected',    function(){ console.log('connected!') })
  - no event data

### client.on('disconnected', function(){ console.log('disconnected :(') })
  - no event data

### client.on('error',        function(error){ console.log('error', error.stack) })
  - this is fired when a general error is encountered (outside of an action or verb)
  - this may fire when a general server error occurs

### client.on('reconnect',    function(){ console.log('reconnect') })
  - fired when client has reconnected
  - this will indicate that details, connection.id and other server-generated settings may have changed

### client.on('reconnecting', function(){ console.log('reconnecting') })
  - client is attempting to reconnect to server

### client.on('message',      function(message){ console.log(message) })
  - this is VERY noisy, and is fired on all messages from the server, regardless of context or callback

### client.on('alert',        function(message){ alert(message) })
  - fired when message recieved from the server's context is specifically 'alert'

### client.on('api',          function(message){ alert(message) })
  - fired when message recieved from the server's context is unknown

### client.on('welcome',      function(message){ appendMessage(message); })
  - server's welcome message

### client.on('say',          function(message){ appendMessage(message); })
  - fired on all say messages from other clients in all rooms
  - message.room can be inspected

## Linking websockets to web auth

actionhero provides `connection.fingerprint` where available to help you link websocket connections to related web connections. While every connection will always have a unique `connection.id`, we attempt to build `connection.fingerprint` by checking the headers the websocket connection began with.  If the cookie defined by `api.config.servers.web.fingerprint.cookieKey` is present, we will store its value on the websocket connection.  

You can read more about using a value like `connection.fingerprint` in an [authentication middleware](/docs#middleware) or using it as a key for [session information](/docs/#example-initializers).

## Options

```javascript
enabled:          true,
// you can pass a FQDN here, or function to be called / window object to be inspected
clientUrl:        'window.location.origin',
// Directory to render client-side JS.  
// Path should start with "/" and will be built starting from api.config..general.paths.public
clientJsPath:     'javascript/',
// the name of the client-side JS file to render.  Both `.js` and `.min.js` versions will be created
// do not include the file exension
// set to `null` to not render the client-side JS on boot
clientJsName:     'actionheroClient',
// should the server signal clients to not reconnect when the server is shutdown/reboot
destroyClientsOnShutdown: false,

// Primus Server Options: 
server: {
  // authorization: null,
  // pathname:      '/primus',
  // parser:        'JSON',
  // transformer:   'ws',
  // plugin:        {},
  // timeout:       35000,
  // origins:       '*',
  // methods:       ['GET','HEAD','PUT','POST','DELETE','OPTIONS'],
  // credentials:   true,
  // maxAge:        '30 days',
  // headers:       false,
  // exposed:       false,
},

// Priumus Client Options: 
client: {
  // reconnect:        {},
  // timeout:          10000,
  // ping:             25000,
  // pong:             10000,
  // strategy:         "online",
  // manual:           false,
  // websockets:       true,
  // network:          true,
  // transport:        {},
  // queueSize:        Infinity,
},
```

You can create your client with options.  Options for both the server and client are stored in `/config/servers/websocket.js`.  Note there are 3 sections: 'server', 'client', and 'generation':

