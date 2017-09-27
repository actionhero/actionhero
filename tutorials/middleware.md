## Overview

p>There are 4 types of middleware in ActionHero:

*   **Action**
*   **Connection**
*   **Chat**
*   **Task**

```bash
> Client **Connects**
#     connection middleware, \`create\` hook
> Client requests an **action**
#     action middleware, \`preProcessor\` hook
#     action middleware, \`postProcessor\` hook
> Client **joins a room**
#     chat middleware, \`join\` hook
> Client **says a message** in a room
#     chat middleware, \`say\` hook
#     chat middleware, \`onSayReceive\` hook
> Client requests a **disconnect** (quit)
#     chat middleware, \`leave\` hook
#     connection middleware, \`destroy\` hook
> Client executes a **task**
#     task middleware, \`preProcessor\` hook
#     task middleware, \`postProcessor\` hook
```

Each type of middleware is distinct from the others, and operates on distinct parts of a client's lifecycle. For a logical example, please inspect the following connection lifecycle:

## Action Request Flow

```js
var middleware = {
  name: 'userId checker',
  global: false,
  priority: 1000,
  preProcessor: function(data, next){
    if(!data.params.userId){
      next(new Error('All actions require a userId') );
    }else{
      next();
    }
  },
  postProcessor: function(data, next){
    if(data.thing.stuff == false){
      data.toRender = false;
    }
    next(error);
  }
}

api.actions.addMiddleware(middleware);
```

ActionHero provides hooks for you to execute custom code both before and after the execution of all or some actions. This is a great place to write authentication logic or custom loggers.

Action middleware requires a `name` and at least one of `preProcessor` or `postProcessor`. Middleware can be `global`, or you can choose to apply each middleware to an action specifically via `action.middleware = []` in the action's definition. You supply a list of middleware names, like `action.middleware = ['userId checker']` in the example above.

Each processor is passed `data` and the callback `next`. Just like within actions, you can modify the `data` object to add to `data.response` to create a response to the client. If you pass `error` to the callback `next`, that error will be returned to the client. If a `preProcessor` has an error, the action will never be called.

The priority of a middleware orders it with all other middleware which might fire for an action. Lower numbers happen first. If you do not provide a priority, the default from `api.config.general.defaultProcessorPriority` will be used

### The Data Object

`data` contains the same information as would be passed to an action:

```js
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
```

## Connection Middleware

```js
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
```

Like the action middleware above, you can also create middleware to react to the creation or destruction of all connections. Unlike action middleware, connection middleware is non-blocking and connection logic will continue as normal regardless of what you do in this type of middleware.

Keep in mind that some connections persist (webSocket, socket) and some only exist for the duration of a single request (web). You will likely want to inspect `connection.type` in this middleware. Again, if you do not provide a priority, the default from `api.config.general.defaultProcessorPriority` will be used.

Any modification made to the connection at this stage may happen either before or after an action, and may or may not persist to the connection depending on how the server is implemented.

## Chat Middleware

```js
var chatMiddleware = {
  name: 'chat middleware',
  priority: 1000,
  join: function(connection, room, callback){
    // announce all connections entering a room
    api.chatRoom.broadcast({}, room, 'I have joined the room: ' + connection.id, callback);
  },
  leave: function(connection, room, callback){
    // announce all connections leaving a room
    api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, callback);
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
```

The last type of middleware is used to act when a connection joins, leaves, or communicates within a chat room. We have 4 types of middleware for each step: `say`, `onSayReceive`, `join`, and `leave`.

Priority is optional in all cases, but can be used to order your middleware. If an error is returned in any of these methods, it will be returned to the user, and the action/verb/message will not be sent.

More detail and nuance on chat middleware can be found in the <link href="/docs/core/chat"><a>chat section</a>

### Chat Midleware Notes

*   In the example above, I want to announce the member joining the room, but he has not yet been added to the room, as the callback chain is still firing. If the connection itself were to make the broadcast, it would fail because the connection is not in the room. Instead, an empty `{}` connection is used to proxy the message coming from the 'system'
*   Only the `sayCallbacks` have a second return value on the callback, `messagePayload`. This allows you to modify the message being sent to your clients.
*   `messagePayload` will be modified and and passed on to all `addSayCallback` middlewares inline, so you can append and modify it as you go
*   If you have a number of callbacks (`say`, `onSayReceive`, `join` or `leave`), the priority maters, and you can block subsequent methods from firing by returning an error to the callback.
*   `sayCallbacks` are executed once per client connection. This makes it suitable for customizing the message based on the individual client.
*   `onSayReceiveCallbacks` are executed only once, when the message is sent to the server.

```js
// in this example no one will be able to join any room, and the \`say\` callback will never be invoked.

api.chatRoom.addMiddleware({
  name: 'blocking chat middleware',
  join: function(connection, room, callback){
    callback(new Error('blocked from joining the room'));
  }),
  say: function(connection, room, messagePayload, callback){
    api.chatRoom.broadcast({}, room, 'I have entered the room: ' + connection.id, function(e){
      callback();
    });
  },
});
```

If a `say` is blocked/errored, the message will simply not be delivered to the client. If a `join` or `leave` is blocked/errored, the verb or method used to invoke the call will be returned that error.

## Task Request Flow

![Task Request Flow](/static/images/connection_flow_tasks.png)

## Task Middleware

Task middleware is implemented as a thin wrapper around Node Resque plugins and currently exposes the `before_perform`, `after_perform`, `before_enqueue`, and `after_enqueue` functions of Resque plugins through `preProcessor`, `postProcessor`, `preEnqueue`, and `postEnqueue` methods. Each middleware requires a `name` and at least one {`function`}. In addition, a middleware can be global, in which case it also requires a `priority`.

In the `preProcessor`, you can access the original task `params` through `this.args[0]`. In the `postProcessor`, you can access the task result at `this.worker.result`. In the `preEnqueue` and `postEnqueue` you can access the task `params` through `this.args[0]`. If you wish to prevent a task from being enqueued using the `preEnqueue` middleware you must explicitly set the `toRun` value to `false` in the callback. Because the task middleware is executed by Resque `this` is an instance of a Resque Worker and contains a number of other elements which may be useful in a middleware.

### Task Middleware Example

The following example is a simplistic implementation of a task execution timer middleware.

```js
'use strict';

module.exports = {
  loadPriority:  1000,
  initialize: function(api, next){
    api.taskTimer = {
      middleware: {
        name: 'timer',
        global: true,
        priority: 90,
        preProcessor: function(next){
          var worker = this.worker;
          worker.start = process.hrtime();
          next();
        },
        postProcessor: function(next){
          var worker = this.worker;
          var elapsed = process.hrtime(worker.start);
          var seconds = elapsed[0];
          var millis = elapsed[1] / 1000000;
          api.log(worker.job.class + ' done in ' + seconds + ' s and ' + millis + ' ms.', 'info');
          next();
        },
        preEnqueue: function(next){
          var params = this.args[0];
          //Validate params
          next(null, true); //callback is in form cb(error, toRun)
        },
        postEnqueue: function(next){
          api.log("Task successfully enqueued!");
          next();
        }
      }
    };

    api.tasks.addMiddleware(api.taskTimer.middleware);
  }
};
```