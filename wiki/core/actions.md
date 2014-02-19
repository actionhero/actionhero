---
layout: wiki
title: Wiki - Actions
---

#Actions

## General

The core of actionhero is the Action framework, and **actions** are the basic units of work.  All connection types from all servers can use actions.  The goal of an action is to read `connection.params` an set the `connection.response` ( and `connection.error` when needed) values to build the response to the client.

You can create you own actions by placing them in a `./actions/` folder at the root of your application.  You can use the generator with `actionhero generateAction --name=myAction`

Here's an example of a simple action which will return a random number to the client:

{% highlight javascript %}

  var action = {};
  
  /////////////////////////////////////////////////////////////////////
  // metadata
  action.name = "randomNumber";
  action.description = "I am an API method which will generate a random number";
  action.inputs = {
    "required" : [],
    "optional" : []
  };
  action.outputExample = {
    randomNumber: 123
  }
  
  /////////////////////////////////////////////////////////////////////
  // functional
  action.run = function(api, connection, next){
    connection.response.randomNumber = Math.random();
    next(connection, true);
  };
  
  /////////////////////////////////////////////////////////////////////
  // exports
  exports.action = action;
{% endhighlight %}

or more concisely: 


{% highlight javascript %}

  exports.action = {
    name: "randomNumber",
    description: "I am an API method which will generate a random number",
    inputs: { required: [], optional: [] },
    outputExample: { randomNumber: 123 },
    run:function(api, connection, next){
    connection.response.randomNumber = Math.random();
    next(connection, true);
    }
  }

{% endhighlight %}

You can also define more than one action per file if you would like:

{% highlight javascript %}

    var commonInputs = {
      required: ['email', 'password'],
      optional: []
    };

    exports.userAdd = {
      name: 'userAdd',
      description: 'i add a user',
      inputs: commonInputs,
      outputExample: {},
      run: function(api, connection, next){
        // your code here
        next(connection, true);
      }
    };
    
    exports.userDelete = {
      name: 'userDelete',
      description: 'i delete a user',
      inputs: commonInputs,
      outputExample: {},
      run: function(api, connection, next){
        // your code here
        next(connection, true);
      }
    }
{% endhighlight %}

## Versions

ActionHero supports multiple versions of the same action.  This will allow you to support actions/routes of the same name with upgraded functionality.

- actions optionally have the `action.version` attribute
- a reserved param, `apiVersion` is used to directly specify the version of an action a client may request
- if a client doesn't specify an `apiVersion`, they will be directed to the highest numerical version of that action.

You can optionally create routes to handle your API versioning:

{% highlight javascript %}
exports.routes = {
  all: [
    // creates routes like `/api/myAction/1/` and `/api/myAction/2/`
    // will also default `/api/myAction` to the latest version
    { path: "/myAction/:apiVersion", action: "myAction" },

    // creates routes like `/api/1/myAction/` and `/api/2/myAction/`
    // will also default `/api/myAction` to the latest version
    { path: "/:apiVersion/myAction", action: "myAction" },
  ]
};
{% endhighlight %}

*As a note, if a client accessing actionhero via routes does not provide an apiVersion and it is explicitly defined in the route, the highest number will not be assigned automatically, as will be seen as a routing error.*

## Options

The complete set of options an action can have are:

{% highlight javascript %}
exports.action = {
  name: "randomNumber",
  description: "I am an API method which will generate a random number",
  inputs: { 
    required: ["userId"], 
    optional: ["room"] 
  },
  outputExample: { randomNumber: 123 },
  blockedConnectionTypes: ["webSocket"],
  logLevel: "warning",
  matchExtensionMimeType: true,
  toDocument: true,

  run: function(api, connection, next){
    connection.response.randomNumber = Math.random();
    next(connection, true);
  }
}
{% endhighlight %}

## Notes

* Actions are asynchronous, and require in the API object, the connection object, and the callback function.  Completing an action is as simple as calling `next(connection, toRender)`.  The second param in the callback is a boolean to let the framework know if it needs to render anything else to the client.  There are some actions where you may have already sent the user output (see the `file.js` action for an example) where you would not want to render the default messages.
* The metadata is used in reflexive and self-documenting actions in the API, available via the `documentation` verb (and /api/ routes).  
* You can limit how many actions a persistent client (websocket, tcp, etc) can have pending at once with `api.config.general.simultaniousActions`
* `actions.inputs.required` and `actions.inputs.optional` are used for both documentation and for building the whitelist of allowed parameters the API will accept.  Client params not included in these lists will be ignored for security. If you wish to disable the whitelisting you can use the flag at `api.config.general.disableParamScrubbing`. This is for situations when you want to validate input using [Middleware](/wiki/core/middleware.html).
* `matchExtensionMimeType` is curently only used by the `web` server, and it indicates that if this action is successfully called by a client with `connection.extension` set, the headers of the response should be changed to match that file type
* actionhero strives to keep the `connection` object uniform among various client types.  All connections have the `connection.response` and `connection.error` objects.  You can inspect `connection.type` to learn more about the connection.  The gory details of the connection (which vary on its type) are stored in `connection.rawConnection` which will contain the websocket, tcp connection, etc.  For web clients, `connection.rawConnection = {req: req, res: res}` for example.  

[You can learn more about handling HTTP verbs and file uploads here](/wiki/servers/web.html) and [TCP Clients](/wiki/servers/socket.html) and [Web-Socket Clients](/wiki/servers/websocket.html)