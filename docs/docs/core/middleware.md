---
layout: docs
title: Documentation - Middleware
---

# Middleware

<img src="/img/connection_flow.png" />

## Action Middleware

actionhero provides hooks for you to execute custom code both before and after the execution of all or some actions.  This is a great place to write authentication logic or custom loggers.  

{% highlight javascript %}
var middleware = {
  name: 'userId checker',
  global: false,
  priority: 1000,
  preProcessor: function(data, next){
    if(!data.params.userId){
      next(new Error('All actions require a userId') );
    }else{
      next(err);
    }
  }
  postProcessor: function(data, next){
    if(data.thing.stuff == false){
      data.toRender = false;
    }
    next(err);
  }
}

api.actions.addMiddleware(middleware);
{% endhighlight %}

Action middleware requires a `name` and at least one of `preProcessor` or `postProcessor`.  Middleware can be `global`, or you can choose to apply each middleware to an action specifically via `action.middleware = []` in the action's definiton.  You supply a list of middleware names, like `action.middleware = ['userId checker']` in the example above.

Each processor is passed `data` and the callback `next`.  Just like within actions, you can modify the `data` object to add to `data.resposne` to create a response to the client.  If you pass `error` to the callback `next`, that error will be returned to the client.  If a `preProcessor` has an error, the action will never be called.

If you do not provide a priority, the default from `api.config.general.defaultProcessorPriority` will be used

`data` contains:

{% highlight javascript %}
data = { 
  connection: {},
  action: 'randomNumber',
  toProcess: true,
  toRender: true,
  messageCount: 1,
  params: { action: 'randomNumber', apiVersion: 1 },
  missingParams: [],
  validatorErrors: [],
  actionStartTime: 1429531553417,
  actionTemplate: {}, // the actual object action definition
  working: true,
  response: {},
  duration: null,
  actionStatus: null,
}
{% endhighlight %}

If your action middleware is not `global`, you can opt-in to it per action, by adding the name of the middleware to `action.middleware.push('name of middleware')`


## Connection Middleware

Like the action middleware above, you can also create middleware to react to the creation or destruction of all connections.  Unlike action middleware, connection middleware is non-blocking and connection logic will continue as normal regardless of what you do in this type of middleware. 

Keep in mind that some connections persist (webSocket, socket) and some only exist for the duration of a single request (web).  You will likely want to inspect `connection.type` in this middleware.  Again, if you do not provide a priority, the default from `api.config.general.defaultProcessorPriority` will be used.

Any modification made to the connection at this stage may happen either before or after an action, and may or may not persist to the connection depending on how the server is implemented.

{% highlight javascript %}
var connectionMiddleware = {
  name: 'connection middleware',
  priority: 1000,
  create: function(connection){
    // do stuff
  },
  destroy: function(connection){
    // do stuff
  }
};

api.connections.addMiddleware(connectionMiddleware);
{% endhighlight %}

## Chat Middleware

The last type of middleware is used to act when a connection joins, leaves, or communicates within a chat room. We have 4 types of middleware for each step: `say`, `onSayReceive`, `join`, and `leave`.

{% highlight javascript %}
var chatMiddleware = {
  name: 'chat middleware',
  priority: 1000,
  join: function(connection, room, callback){
    // announce all connections entering a room
    api.chatRoom.broadcast({}, room, 'I have joined the room: ' + connection.id, function(e){
      callback(null);
    });
  },
  leave: function(connection, room, callback){
    // announce all connections leaving a room
    api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, function(e){
      callback(null);
    });
  },
  /**
   * Will be executed once per client connection before delivering the message.
   */
  say: function(connection, room, messagePayload, callback){
    // do stuff
    api.log(messagePayload);
    callback(null, messagePayload);
  },
  /**
   * Will be executed only once, when the message is sent to the server.
   */
  onSayReceive: function(connection, room, messagePayload, callback){
    // do stuff
    api.log(messagePayload);
    callback(null, messagePayload);
  }
};

api.chatRoom.addMiddleware(chatMiddleware);
{% endhighlight %}

Priority is optional in all cases, but can be used to order your middleware.  If an error is returned in any of these methods, it will be returend to the user, and the action/verb/message will not be sent.

More detail and nuance on chat middleware can be found in the [chat section](/docs/core/chat.html)
