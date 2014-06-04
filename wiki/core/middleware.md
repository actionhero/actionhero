---
layout: wiki
title: Wiki - Middleware
---

# Middleware

<img src="/img/connection_flow.png" />

## Action Middleware

actionhero provides hooks for you to execute custom code both before and after the execution of all actions.  You do this by adding to the `api.actions.preProcessors` and `api.actions.postProcessors` array.  Functions you add here will be executed in order on the connection.

This is a great place to write authentication logic or custom loggers.

preProcessors, like actions themselves, return the connection and a `toProcess` flag.  Setting `toProcess` to false will block the execution of an action.  You can operate on `connection.response` and `connection.error`, just like within an action to create messages to the client.

**preProcessors** are provided with `connection`, `actionTemplate`, and `next`.  They are expected to return (connection, toProcess)
**postProcessors** are provided with `connection`, `actionTemplate`, `toRender`, and `next`.  They are expected to return (connection, toRender)

Note: preProcessor action middleware will be executed before connections have their params filtered.  This means that you will have access to all the request's input at `connection.params`.  Extra caution should be used.

Some Examples:

{% highlight javascript %}

// a preProcessor to check if a userId is provided:

api.actions.preProcessors.push(function(connection, actionTemplate, next){
  if(connection.params.userId == null){
    connection.error = "All actions require a userId";
    next(connection, false);
  }else{
    next(connection, true);
  }
});

// a postProcessor to append the action's description to the response body

api.actions.postProcessors.push(function(connection, actionTemplate, toRender, next){
  connection.response._description = actionTemplate.description;
  next(connection, toRender);
});

{% endhighlight %}

Action middleware is often used in authentication.  Here are some examples:

* [simple authentication middleware](https://github.com/evantahler/actionhero-tutorial/blob/master/initializers/middleware.js)
* [mongoDB based authentication](https://gist.github.com/panjiesw/7768779)

## Connection Middleware

Like the action middleware above, you can also create middleware to react to the creation or destruction of all connections.  Unlike action middleware, connection middleware is non-blocking and connection logic will continue as normal regardless of what you do in this type of middleware.  

`api.connections.createCallback` is an array of functions to call on a new connection and `api.connections.destroyCallbacks` will be called on destruction.  Keep in mind that some connections persist (webSocket, socket) and some only exist for the duration of a single request.  You will likely want to inspect `connection.type` in this middleware.

Any modification made to the connection at this stage may happen either before or after an action, and may or may not persist to the connection depending on how the server is implemented.

{% highlight javascript %}

api.connections.createCallbacks.push(function(connection){
  console.log(connection);
});

api.connections.destroyCallbacks.push(function(connection){
  console.log(connection);
});

{% endhighlight %}
