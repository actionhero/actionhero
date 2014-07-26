---
layout: docs
title: Documentation - WebSocket Server
---

# WebSocket Server

## General

actionhero uses [Primus](https://github.com/primus/primus) for web sockets.  The Primus project allows you to choose from many websocket backends, including `ws`, `engine.io`, `socket.io`, and more. Within actionhero, web sockets are bound to the web server (either http or https).

Actionhero will generate the client-side javascript needed for you (based on the actionheroClient library, primus, and the underlying ws transport). This file is regenerated each time you boot the application.

**Warning**

In `v9.0.0`, actionhero will no longer attempt to manage non-sticky client connections. This means if you have a multi-server actionhero deployment and you use long-polling in your websocket transport, you will need to ensure that your load balancer can enforce sticky connections, meaning every request from the client will hit the same actionhero node.

## Connection Details

`connection.type` for a webSocket client is "webSocket".  This type will not change regardless of if the client has fallen back to another protocol. 

Data is always returned as JSON objects to the webSocket client.  

An example web socket session might be the following:

{% highlight html %}
<script src="/public/javascript/actionheroClient.js"></script>

<script>

  client = new actionheroClient;

  client.on('connected',    function(){ console.log('connected!') })
  client.on('disconnected', function(){ console.log('disconnected :(') })
  
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
      client.action('someAction', {key: 'k', value: 'v', function(error data){
        // do stuff
      });
    }
  });

</script>
{% endhighlight %}

You can also inspect `client.state` ('connected', 'disconnected', etc).  The websocket client will attempt to re-connect automatically.

## Methods

Methods which the provided actionheroWebSocket object expose are:

- `client.connect(callback)`
- `client.action(action, params, callback)`
  - `action` is a string, like "login"
  - `params` is an object
  - `callback` will be passed `response` (and you can inspect `response.error`)
- `client.say(room, message, callback)`
  - `message` is a string
  - `callback` will be passed `error`, `response`
- `client.detailsView(callback)`
  - `callback` will be passed `error`, `response` 
- `client.roomView(room, callback)`
- `client.roomAdd(room, callback)`
  - `room` is a string
  - `callback` will be passed `error`, `response`
- `client.roomLeave(room, callback)`
  - `room` is a string
  - `callback` will be passed `error`, `response`
- `client.file(callback)`
- `client.disconnect()`

The contents of the `file` callback look like:
{% highlight javascript %}
{
  content: "<h1>ActionHero</h1>\nI am a flat file being served to you via the API from ./public/simple.html<br />",
  context: "response",
  error: null,
  length: 101,
  messageCount: 3,
  mime: "text/html"
}
{% endhighlight %}

## Linking websockets to web auth

actionhero provides `connection.fingerprint` where available to help you link websocket connections to related web connections. While every connection will always have a unique `connection.id`, we attempt to build `connection.fingerprint` by checking the headers the websocket connection began with.  If the cookie defined by `api.config.servers.web.fingerprint.cookieKey` is present, we will store its value on the websocket connection.  

You can read more about using a value like `connection.fingerprint` in an [authentication middleware](/docs/core/middleware.html) or using it as a key for [session information](/docs/examples/initialzers/session.html).

## Options

You can create your client with options.  Options for both the server and client are stored in `/config/servers/websocket.js`.  Note there are 3 sections: 'server', 'client', and 'generation':

{% highlight javascript %}
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
{% endhighlight %}
