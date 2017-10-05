![](documentation.svg)

## Overview

ActionHero uses [Primus](https://github.com/primus/primus) for web socket connections. The Primus project allows you to choose from many websocket backends, including `ws`, `engine.io`, `socket.io`, and more. Within ActionHero, web sockets are bound to the web server (either http or https).

ActionHero will generate the client-side javascript needed for you (based on the ActionheroWebsocketClient library, primus, and the underlying ws transport). This file is regenerated each time you boot the application.

## Connection Details

```html
// In the Browser...
<script src="/public/javascript/ActionheroWebsocketClient.js"></script>

<script>

  client = new ActionheroWebsocketClient();

  client.on('connected',    function(){ console.log('connected!') })
  client.on('disconnected', function(){ console.log('disconnected :(') })

  client.on('error',        function(error){ console.log('error', error.stack) })
  client.on('reconnect',    function(){ console.log('reconnect') })
  client.on('reconnecting', function(){ console.log('reconnecting') })

  // this will log all messages send the client
  // client.on('message',      function(message){ console.log(message) })

  client.on('alert',        function(message){ alert(message) })
  client.on('api',          function(message){ alert(message) })

  client.on('welcome',      function(message){ appendMessage(message); })
  client.on('say',          function(message){ appendMessage(message); })

  client.connect(function(error, details){
    if(error != null){
      console.log(error);
    }else{
      client.roomAdd("defaultRoom");
      client.action('someAction', {key: 'k', value: 'v'}, function(error, data){
        // do stuff
      });
    }
  });

</script>
```

`connection.type` for a webSocket client is "websocket". This type will not change regardless of if the client has fallen back to another protocol.

Data is always returned as JSON objects to the webSocket client.

An example web socket session might be the following:

You can also inspect `client.state` (‘connected', ‘disconnected', etc). The websocket client will attempt to re-connect automatically.

If you want to communicate with a websocket client outside of an action, you can call `connection.send(message)` on the server. In the client lib, the event message will be fired. So, client.on('message, function(m){ ... })`. Be sure to add some descriptive content to the message you send from the sever (like perhaps {"type": 'message type'}`) so you can route message types on the client.

## Client Methods

The clent API can be viewed here: [WebSocket Client API](ActionHero.ActionheroWebsocketClient.html)

## Linking WebSockets to Web Clients

ActionHero provides `connection.fingerprint` where available to help you link websocket connections to related web connections. While every connection will always have a unique `connection.id`, we attempt to build `connection.fingerprint` by checking the headers the websocket connection began with. If the cookie defined by `api.config.servers.web.fingerprint.cookieKey` is present, we will store its value on the websocket connection.

You can read more about using a value like `connection.fingerprint` in an [authentication middleware](tutorial-middleware.html) or using it as a key for session information.

## Config Options

```js
exports['default'] = {
  servers: {
    websocket: function (api) {
      return {
        enabled: true,
        // you can pass a FQDN (string) here or 'window.location.origin'
        clientUrl: 'window.location.origin',
        // Directory to render client-side JS.
        // Path should start with "/" and will be built starting from api.config..general.paths.public
        clientJsPath: 'javascript/',
        // the name of the client-side JS file to render.  Both \`.js\` and \`.min.js\` versions will be created
        // do not include the file exension
        // set to \`undefined\` to not render the client-side JS on boot
        clientJsName: 'ActionheroWebsocketClient',
        // should the server signal clients to not reconnect when the server is shutdown/reboot
        destroyClientsOnShutdown: false,

        // websocket Server Options:
        server: {
          // authorization: null,
          // pathname:      '/primus',
          // parser:        'JSON',
          // transformer:   'websockets',
          // plugin:        {},
          // timeout:       35000,
          // origins:       '*',
          // methods:       ['GET','HEAD','PUT','POST','DELETE','OPTIONS'],
          // credentials:   true,
          // maxAge:        '30 days',
          // exposed:       false,
        },

        // websocket Client Options:
        client: {
          apiPath: '/api' // the api base endpoint on your actionhero server
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
        }
      }
    }
  }
}
```

You can create your client with options. Options for both the server and client are stored in `/config/servers/websocket.js`. Note there are 2 sections: `server` and `client`.
