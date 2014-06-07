---
layout: wiki
title: Wiki - WebSocket Server
---

# WebSocket Server

## General

actionhero uses [faye](http://faye.jcoglan.com/) for web sockets.  Faye provides an abstraction for web sockets which allow fallback to long-polling and other protocols which should be appropriate for the vast majority of browsers. Within actionhero, web sockets are bound to the web server (either http or https).  

Faye can be configured to use a redis store to share state information across nodes.  actionhero uses the [faye-node-redis](https://github.com/faye/faye-redis-node) backend to ensure that all the nodes in your cluster can serve content for any client (no need for 'sticky' load balancer sessions).  actionhero also uses faye interntally to communicate between peers.

## Connection Details

`connection.type` for a webSocket client is "webSocket".  This type will not change regardless of if the client has fallen back to another protocol. 

Data is always returned as JSON objects to the webSocket client.  

An example web socket session might be the following:

{% highlight html %}
<script src="/faye/client.js"></script>
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
      client.roomChange("defaultRoom");
      client.action('someAction', {key: 'k', value: 'v', function(error data){
        // do stuff
      });
    }
  });

</script>
{% endhighlight %}

You can also inspect `client.state` ('connected', 'disconnected', etc)

Note that we are using **both** the provided actionheroWebSocket prototype and requiring the faye library which actionhero provides.

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

## Options

You can create your client with options.  The full collection and defaults are:

{% highlight html %}
<script src="/faye/client.js"></script>
<script src="/public/javascript/actionheroClient.js"></script>

<script>
  var options = {
    host:            window.location.origin,
    fayePath:        '/faye',
    apiPath:         '/api',
    setupChannel:    '/client/websocket/_incoming/' + this.randomString(),
    channelPrefix:   '/client/websocket/connection/',
    connectionDelay:  200,
    timeout:          60 * 1000,
    retry:            10
  }

  client = new actionheroClient(options)

</script>
{% endhighlight %}

## Notes

The websocket server will use settings inherited by the `faye` `api.config` block.  If you want to set options on the client (like specific protocols to use), you can read up on the options [here](http://faye.jcoglan.com/browser.html).  Note that changes to server options may require updates to the client library `actionheroWebsocket.js` as well.

