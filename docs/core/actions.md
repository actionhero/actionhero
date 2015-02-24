---
layout: docs
title: Documentation - Actions
---

#Actions

## General

The core of actionhero is the Action framework, and **actions** are the basic units of work.  All connection types from all servers can use actions.  The goal of an action is to read `connection.params`, do work, and set the `connection.response` (and `connection.error` when needed) values to build the response to the client.

You can create you own actions by placing them in a `./actions/` folder at the root of your application.  You can use the generator with `actionhero generateAction --name=myAction`

Here's an example of a simple action which will return a random number to the client:

{% highlight javascript %}
exports.randomNumber = {
  name: 'randomNumber',
  description: 'I am an API method which will generate a random number',
  outputExample: {
    randomNumber: 0.123
  },
  
  run: function(api, connection, next){
    connection.response.randomNumber = Math.random();
    next(connection, true);
  }

};
{% endhighlight %}

You can also define more than one action per file if you would like, to share common methods and componants (like input parsers):

{% highlight javascript %}

    var commonInputs = {
      email: {
        required: true,
        validator: function(param){
          var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
          if( re.test(email) ){
            return true;
          }else{
            return new Error('that is not a valid email address');
          }
        },  
      }, 
      password: {
        required: true,
        validator: function(param){
          if(param.length < 4){
            return new Error('password should be at least 3 letters long');
          }else{
            return true;
          }
        },
        formatter: function(param){
          return String(param);
        },
      }
    };

    exports.userAdd = {
      name: 'userAdd',
      description: 'i add a user',
      inputs: commonInputs,
      run: function(api, connection, next){
        // your code here
        next(connection, true);
      }
    };
    
    exports.userDelete = {
      name: 'userDelete',
      description: 'i delete a user',
      inputs: commonInputs,
      run: function(api, connection, next){
        // your code here
        next(connection, true);
      }
    }
{% endhighlight %}

## Versions

ActionHero supports multiple versions of the same action.  This will allow you to support actions/routes of the same name with upgraded functionality.

- actions optionally have the `action.version` attribute.
- a reserved param, `apiVersion` is used to directly specify the version of an action a client may request.
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

*As a note, if a client accessing actionhero via routes does not provide an apiVersion and it is explicitly defined in the route, the highest number will not be assigned automatically, and will be seen as a routing error.*

## Options

The complete set of options an action can have are:

{% highlight javascript %}
exports.action = {
  name: "randomNumber",
  description: "I am an API method which will generate a random number",
  inputs: { 
    multiplier: {
      required: false,
      validator: function(param, connection, actionTemplate){ if(param < 0){ 
        return 'must be > 0' }else{ return true; } 
      },
      formatter: function(param, connection, actionTemplate){ 
        return parseInt(param); 
      },
      default:   function(param, connection, actionTemplate){ 
        return 1; 
      },
    }
  },
  outputExample: { randomNumber: 123 },
  blockedConnectionTypes: ["webSocket"],
  logLevel: "warning",
  matchExtensionMimeType: true,
  toDocument: true,

  run: function(api, connection, next){
    connection.response.randomNumber = Math.random() * connection.params.multiplier;
    next(connection, true);
  }
}
{% endhighlight %}

## Inputs

The properties of an input are:

- `required` (boolean) 
  - Default: `false`
- `formatter = function(param, connection, actionTemplate)`
  - will return the new value of the param
  - Default: The parameter is not reformatted
- `default = function(param, connection, actionTemplate)`
  - will return the default value of the param
  - you can also have a static assignment for `default` father than a function, ie: `default: 123`
  - Default: Parameter has no default value
- `validator = function(param, connection, actionTemplate)`
  - should return `true` if validation passed
  - should return an error message if validation fails which will be returned to the client
  - Default: Parameter is always valid

You can define `api.config.general.missingParamChecks = [null, '', undefined]` to choose explicitly how you want un-set params to be handled in your actions.  For example, if you want to allow explicit `null` values in a JSON payload but not `undefined`, you can now opt-in to that behavior.  This is what `action.inputs.x.required = true` will check against.

Since all properties of an input are optional, the smallest possible definition of an input is:

{% highlight javascript %}
action.inputs = {
  minimalInput: {}
};
{% endhighlight %}

However, you should usually specify that an input is required (or not).

## Notes

* Actions are asynchronous, and require in the API object, the connection object, and the callback function.  Completing an action is as simple as calling `next(connection, toRender)`.  The second param in the callback is a boolean to let the framework know if it needs to render anything else to the client.  There are some actions where you may have already sent the user output (perhaps you already rendered a file to them or sent an error HTTP header) where you would not want to render the default messages.
* The metadata `outputExample` is used in reflexive and self-documenting actions in the API, available via the `documentation` verb (and /api/ showDocumenation action).  
* You can limit how many actions a persistent client (websocket, tcp, etc) can have pending at once with `api.config.general.simultaniousActions`
* `actions.inputs` are used for both documentation and for building the whitelist of allowed parameters the API will accept.  Client params not included in these whitelists will be ignored for security. If you wish to disable the whitelisting you can use the flag at `api.config.general.disableParamScrubbing`. Note that [Middleware](/docs/core/middleware.html) preProcessors will always have access to all params pre-scrubbing.
* `matchExtensionMimeType` is curently only used by the `web` server, and it indicates that if this action is successfully called by a client with `connection.extension` set, the headers of the response should be changed to match that file type.  This is useful when creating actions that download files.
* actionhero strives to keep the `connection` object uniform among various client types.  All connections have the `connection.response` and `connection.error` objects.  You can inspect `connection.type` to learn more about the connection.  The gory details of the connection (which vary on its type) are stored in `connection.rawConnection` which will contain the websocket, tcp connection, etc.  For web clients, `connection.rawConnection = {req: req, res: res}` for example.  
  * You can learn more about some of the `rawConnection` options by learning how to [send files from actions](/docs/core/file-server.html#sending-files-from-actions).

[You can learn more about handling HTTP verbs and file uploads here](/docs/servers/web.html) and [TCP Clients](/docs/servers/socket.html) and [Web-Socket Clients](/docs/servers/websocket.html)
