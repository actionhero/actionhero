# Actions

## General

```javascript
/////////////////////
// A Simple Action //
/////////////////////

exports.action = {
  name: 'randomNumber',
  description: 'I am an API method which will generate a random number',
  outputExample: {
    randomNumber: 0.123
  },
  
  run: function(api, data, next){
    data.response.randomNumber = Math.random();
    next();
  }

};
```

The core of actionhero is the Action framework, and **actions** are the basic units of work.  All connection types from all servers can use actions.  This means that you only need to write an action once, and both HTTP clients and websocket clients can consume it.

The goal of an action is to read `data.params` (which are the arguments a connection provides), do work, and set the `data.response` (and `error` when needed) values to build the response to the client.

You can create you own actions by placing them in a `./actions/` folder at the root of your application.  You can use the generator with `actionhero generateAction --name=myAction`

Here's an example of a simple action which will return a random number to the client:

You can also define more than one action per file if you would like, to share common methods and componants (like input parsers):

```javascript

/////////////////////////////////////////
// A Combound Action with Shared Inputs//
/////////////////////////////////////////

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

// the actions

exports.userAdd = {
  name: 'userAdd',
  description: 'I add a user',
  inputs: commonInputs,
  run: function(api, data, next){
    // your code here
    next(error);
  }
};

exports.userDelete = {
  name: 'userDelete',
  description: 'I delete a user',
  inputs: commonInputs,
  run: function(api, data, next){
    // your code here
    next(error);
  }
}
```

## Versions

ActionHero supports multiple versions of the same action.  This will allow you to support actions/routes of the same name with upgraded functionality.

- actions optionally have the `action.version` attribute.
- a reserved param, `apiVersion` is used to directly specify the version of an action a client may request.
- if a client doesn't specify an `apiVersion`, they will be directed to the highest numerical version of that action.

You can optionally create routes to handle your API versioning:

```javascript
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
```

*As a note, if a client accessing actionhero via routes does not provide an apiVersion and it is explicitly defined in the route, the highest number will not be assigned automatically, and will be seen as a routing error.*

## Options

```javascript
exports.action = {
  // the action's name (the `exports` key doesn't matter)
  name: "randomNumber",
  // the description
  description: "I am an API method which will generate a random number",
  // a hash of all the inputs this action will accept
  // any inputs provided to the action not in this hash will be stripped
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
  // any middlewares to apply before/after this action
  // global middleware will be applied automatically
  middleware: [],
  // an example response
  outputExample: { randomNumber: 123 },
  // you can choose to block certain servers from using this action
  blockedConnectionTypes: ["webSocket"],
  // how should this action be logged?
  logLevel: "warning",
  // (HTTP only) if the route for this action includes an extension (like .jpg), should the response MIME be adjusted to match?
  matchExtensionMimeType: true,
  // should this action appear wthin `api.documentation.documentation`
  toDocument: true,

  run: function(api, data, next){
    var error = null;

    data.response.randomNumber = Math.random() * data.params.multiplier;
    next(error);
  }
}
```

The complete set of options an action can have are:

## Inputs

```javascript
action.inputs = {
  // a simple input
  // defaults assume required = false
  minimalInput: {}
  // a complex input
  multiplier: {
    required: true,
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
};
```

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

Since all properties of an input are optional, the smallest possible definition of an input is: `name : {}`.  However, you should usually specify that an input is required (or not), ie: `name: {required: false}`.

The methods are applied in this order:

  - `defualt()`
  - `formatter()`
  - `validator()`
  - `required()`

Here's an example...

```javascript
moneyInCents: {
  required:  true,
  defualt:   function(p){ return 0; },
  formatter: function(p){ return parseFloat(p); },
  validator: function(p){
    if(isNaN(parseFloat(p)){ return new Error('not a number'); }
    if(p < 0){ return new Error('money cannot be negative'); }
    else{ return true; }
  },
}
```

...and the results would be:

- If moneyInCents = `4`       => (4 => 4 => 400 => ok)
- If moneyInCents = `"4"`     => ("4" => 4 => 400 => ok)
- If moneyInCents = `"-4"`    => ("-4" => -4 => -400 => Error('money cannot be negative'))
- If moneyInCents = `""`      => 0 (defualt value)
- If moneyInCents = `null`    => 0 (defualt value)
- If moneyInCents = `"hello"` => Error('not a number')


## The Data Object

```javascript
data = {
  connection: connection,
  action: 'randomNumber',
  toProcess: true,
  toRender: true,
  messageCount: 123,
  params: { action: 'randomNumber', apiVersion: 1 },
  actionStartTime: 123,
  response: {},
}
```

The `data` object passed into your action captures the state of of the connection at the time the action was started.  Midleware preProcessors have already fired, and input formatting and validation has occurred.  Here are the properties of the `data` object:

The goal of most actions is to do work and then modify the value of `data.response`, which will eventually be sent down to the client.  

You can also modify properties of the connection by accessing `data.connection`, IE changing the response header for a HTTP request.  

If you don't want your action to respond to the client, of you have already sent data to the client (perhaps you already rendered a file to them or sent an error HTTP header), you can set `data.toRender = false;`

## Using Middleware in Actions

You can create middlware which would apply to the connection both before and after an action.  Middleware can be either global (applied to all actions) or local, speficied in each action via `action.middleware = []`.  Supply the `names` of any middleware you want to use.

You can [learn more about middleware here](/docs#middleware).

## Notes

* Actions are asynchronous, and require in the API object, the connection object, and the callback function.  Completing an action is as simple as calling `next(error)`.  If you have an erro, be sure that it is an `new Error()` object, and not a string.
* The metadata `outputExample` is used in reflexive and self-documenting actions in the API, available via the `documentation` verb (and /api/ showDocumenation action).  
* You can limit how many actions a persistent client (websocket, tcp, etc) can have pending at once with `api.config.general.simultaniousActions`
* `actions.inputs` are used for both documentation and for building the whitelist of allowed parameters the API will accept.  Client params not included in these whitelists will be ignored for security. If you wish to disable the whitelisting you can use the flag at `api.config.general.disableParamScrubbing`. Note that [Middleware](/docs#middleware) preProcessors will always have access to all params pre-scrubbing.
* `matchExtensionMimeType` is curently only used by the `web` server, and it indicates that if this action is successfully called by a client with `connection.extension` set, the headers of the response should be changed to match that file type.  This is useful when creating actions that download files.
* actionhero strives to keep the `connection` object uniform among various client types, and more importantly, present `data.params` in a homogenous way.  You can inspect `connection.type` to learn more about the connection.  The gory details of the connection (which vary on its type) are stored in `connection.rawConnection` which will contain the websocket, tcp connection, etc.  For web clients, `connection.rawConnection = {req: req, res: res}` for example.  
  * You can learn more about some of the `rawConnection` options by learning how to [send files from actions](/docs#sending-files-from-actions).

[You can learn more about handling HTTP verbs and file uploads here](/docs#uploading-files) and [TCP Clients](/docs#files-and-routes) and [Web-Socket Clients](/docs#websocket-server)
