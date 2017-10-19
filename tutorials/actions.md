![](easy-to-use-actions.svg)

## Overview

```js
// A simple Action

'use strict'
const {Action, api} = require('actionhero')

module.exports = class MyAction extends Action {
 constructor () {
   super()
   this.name = 'randomNumber'
   this.description = 'I am an API method which will generate a random number'
   this.outputExample = {randomNumber: 0.1234}
 }

 async run (data) {
   data.response.randomNumber = Math.random()
 }
}
```

The core of ActionHero is the Action framework, and **actions** are the basic units of work.  All connection types from all servers can use actions.  This means that you only need to write an action once, and both HTTP clients and websocket clients can consume it.

The goal of an action is to read `data.params` (which are the arguments a connection provides), do work, and set the `data.response` (and `data.response.error` when needed) values to build the response to the client.

You can create you own actions by placing them in a `./actions/` folder at the root of your application.  You can use the generator with `actionhero generate action --name=myAction`

You can also define more than one action per file if you would like, and extend classes to share common methods and components (like input parsers).

```js
// Compound Action with Shared Inputs//
const {Action, api} = require('actionhero')

class ValidatedAction extends Action {
  constructor () {
    super()
    this.inputs = {
      email: {
        required: true,
        validator: this.emailValidator
      },
      password: {
        required: true,
        validator: this.passwordValidator
      }
    }
  }

  emailValidator (param) {
    if (email.indexOf('@') < 0) {
      throw new Error('that is not a valid email address')
    }
  }

  passwordValidator (param) {
    if (param.length < 4) {
      throw new Error('password should be at least 3 letters long')
    }
  }
}

// the actions
exports.UserAdd = class UserAdd extends ValidatedAction {
  constructor () {
    super()
    this.name = 'userAdd'
    this.description = 'I add a user'
  }

  run (data) {
    // your code here
  }
}

exports.UserDelete = class UserDelete extends ValidatedAction {
  constructor () {
    super()
    this.name = 'userDelete'
    this.description = 'I delete a user'
  }

  run (data) {
    // your code here
  }
}
```

## Versions

ActionHero supports multiple versions of the same action.  This will allow you to support actions/routes of the same name with upgraded functionality.

* actions optionally have the `action.version` attribute, which defaults to `1`.
* a reserved param, `apiVersion` is used to directly specify the version of an action a client may request.
* if a client doesn't specify an `apiVersion`, they will be directed to the highest numerical version of that action.

You can optionally create routes to handle your API versioning:

*As a note, if a client accessing ActionHero via routes does not provide an apiVersion and it is explicitly defined in the route, the highest number will not be assigned automatically, and will be seen as a routing error.*

```js
exports.routes = {
  all: [
    // creates routes like \`/api/myAction/1/\` and \`/api/myAction/2/\`
    // will also default \`/api/myAction\` to the latest version
    { path: '/myAction/:apiVersion', action: 'myAction' },

    // creates routes like \`/api/1/myAction/\` and \`/api/2/myAction/\`
    // will also default \`/api/myAction\` to the latest version
    { path: '/:apiVersion/myAction', action: 'myAction' },
  ]
};
```

We go into more detail about routes when discussing the [web server](tutorial-web-server.html)

## Options

The complete set of options an action can have are:

```js
const {Action, api} = require('actionhero')

class ValidatedAction extends Action {
  constructor () {
    super()

    // (required) the action's name (the \`exports\` key doesn't matter)
    this.name = 'randomNumber'

    // (required) the description
    this.description = 'I am an API method which will generate a random number'

    // (required) a hash of all the inputs this action will accept
    // any inputs provided to the action not in this hash will be stripped
    this.inputs = {
      multiplier: {
        required: false,
        validator: (param, connection, actionTemplate) => {
          if (param < 0) { throw new Error('must be > 0') } else { return true }
        },
        formatter: (param, connection, actionTemplate) => {
          return parseInt(param)
        },
        default: (param, connection, actionTemplate) => {
          return 1
        },
      }
    },

    // any middlewares to apply before/after this action
    // global middleware will be applied automatically
    // default []
    this.middleware = []

    // an example response
    // default: {}
    this.outputExample = { randomNumber: 123 }

    // you can choose to block certain servers from using this action
    // default: []
    this.blockedConnectionTypes = ['webSocket']

    // how should this action be logged?
    // default: 'info'
    this.logLevel = 'warning'

    // (HTTP only) if the route for this action includes an extension (like .jpg), should the response MIME be adjusted to match?
    // default: true
    this.matchExtensionMimeType = true

    // should this action appear within \`api.documentation.documentation\`
    // default: true
    this.toDocument = true

    // (required) the run method of the action
    async run (data) {
      data.response.randomNumber = Math.random() * data.params.multiplier;
    }
  }
}
```

Note that for many of these, you can define them as a scalar in the constructor or as a method which returns the proper response.

## Inputs

```js
action.inputs = {
  // a simple input
  // defaults assume required = false
  minimalInput: {}

  // a complex input
  multiplier: {
    required: true,
    validator: (param, connection, actionTemplate) => {
      if (param < 0) { throw new Error('must be > 0') } else { return true }
    },
    formatter: (param, connection, actionTemplate) => {
      return parseInt(param);
    },
    default: (param, connection, actionTemplate) => {
      return 1;
    },
  },

  // a schema input
  schemaInput: {
    required: true,
    default: {},
    schema: {
      nestedInput: {
        required: true,
        default: 1,
        validator: (param, connection, actionTemplate) => {
          if (param < 0) { throw new Error('must be > 0') } else { return true }
        },
        formatter: (param, connection, actionTemplate) => {
          return parseInt(param);
        },
      },
      otherInput: {},
    }
  }
};
```

The properties of an input are:

* `required` (boolean)
  * Default: `false`
* `formatter = function(param, connection, actionTemplate)`
  * will return the new value of the param
  * Default: The parameter is not reformatted
* `default = function(param, connection, actionTemplate)`
  * will return the default value of the param
  * you can also have a static assignment for `default` father than a function, ie: `default: 123`
  * Default: Parameter has no default value
* `validator = function(param, connection, actionTemplate)`
  * should return true if validation passed
  * should throw an error message if validation fails which will be returned to the client
  * Default: Parameter is always valid
* `schema` (object)
  * optional nested inputs definition
  * accept `object` similar to regular input
  * nested input also have properties: `required`, `formatter`, `default` and `validator`

You can define `api.config.general.missingParamChecks = [null, '', undefined]` to choose explicitly how you want un-set params to be handled in your actions.  For example, if you want to allow explicit `null` values in a JSON payload but not `undefined`, you can now opt-in to that behavior.  This is what `action.inputs.x.required = true` will check against.</p>

Since all properties of an input are optional, the smallest possible definition of an input is: `name : {}`.  However, you should usually specify that an input is required (or not), ie: `{`name: {required: false}`}`.</p>

The methods `default`, `formatter`, and `validator` have the api object set as `this` within their scopes.  This means that you can define common formatters within middleware and reference them in each action.</p>

The methods are applied in this order:</p>

* `default()`
* `formatter()`
* `validator()`
* `required()`

Here's an example...

```js
moneyInCents: {
  required:  true,
  default:   (p) => { return 0 },
  formatter: (p) => { return parseFloat(p) },
  validator: (p) => {
    if(isNaN(parseFloat(p)){ throw new Error('not a number') }
    if(p < 0){ throw new Error('money cannot be negative') }
    else{ return true }
  }
}
```

Formatters and Validators can also be named method names. For example, you might have an action like:

```js
inputs: {
  key: {
    required: true,
    formatter: 'api.formatter.uniqueKeyName'
  }
}
```

You can define `api.formatter.uniqueKeyName` elsewhere in your project.

Example schema input:

```js
inputs = {
  firstName: { required: true },
  lastName: { required: false },
  username: { required: true },
  address: {
    required: false,
    schema: {
      country: {
        required: true,
        default: 'USA'
      },
      state: { required: false },
      city: {
        required: true,
        formatter: (val) => \`City:\${val}\`,
        validator: (val) => val.length > 10,
      }
    }
  }
}
```

## The Data Object

The `data` object passed into your action captures the state of the connection at the time the action was started.  Middleware preProcessors have already fired, and input formatting and validation has occurred.  Here are the properties of the `data` object.

```js
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

The goal of most actions is to do work and then modify the value of `data.response`, which will eventually be sent down to the client.

You can also modify properties of the connection by accessing `data.connection`, IE changing the response header for a HTTP request.

If you don't want your action to respond to the client, or you have already sent data to the client (perhaps you already rendered a file to them or sent an error HTTP header), you can set `data.toRender = false;`

If you are certain that your action is only going to be handled by a web server, then a connivence function has been provided to you via `data.connection.setHeader()`. This function is a proxy to the <a href='https://nodejs.org/api/http.html#http_response_setheader_name_value'>Node HTTP Response setHeader</a> function and allows you to set response headers without having to drill into the `data.connection.rawConnection` object. Please be aware, the `data.connection.setHeader()` function will only be available if your action is being handled by a web server. Other server types will throw an exception. See [Servers: Customizing the Connection](tutorial-servers.html) for more details.

## Middleware

You can create middlware which would apply to the connection both before and after an action.  Middleware can be either global (applied to all actions) or local, specified in each action via `action.middleware = []`.  Supply the `names` of any middleware you want to use.

You can [learn more about middleware here](tutorial-middleware.html).

## Notes

* Actions' run method are async, and have `data` as their only argument.  Completing an action is as simple returning from the method.  
* If you throw an error, be sure that it is a `new Error()` object, and not a string.  Thrown errors will automatically be sent to the client in `response.error`
* The metadata `outputExample` is used in reflexive and self-documenting actions in the API, available via the `documentation` verb (and showDocumenation action).
* You can limit how many actions a persistent client (websocket, tcp, etc) can have pending at once with `api.config.general.simultaneousActions`
* `actions.inputs` are used for both documentation and for building the whitelist of allowed parameters the API will accept.  Client params not included in these whitelists will be ignored for security. If you wish to disable the whitelisting you can use the flag at `api.config.general.disableParamScrubbing`. Note that [Middleware](tutorial-middleware.html) preProcessors will always have access to all params pre-scrubbing.
* `matchExtensionMimeType` is currently only used by the `web` server, and it indicates that if this action is successfully called by a client with `connection.extension` set, the headers of the response should be changed to match that file type.  This is useful when creating actions that download files.
* ActionHero strives to keep the `data.connection` object uniform among various client types, and more importantly, present `data.params` in a homogeneous way to actions.  You can inspect `data.connection.type` to learn more about the connection.  The gory details of the connection (which vary on its type) are stored in `data.connection.rawConnection` which will contain the websocket, tcp connection, etc.  For web clients, `{`data.connection.rawConnection = {req: req, res: res}`}` for example.

[You can learn more about handling HTTP verbs and file uploads here](tutorial-web-server.html) and [TCP Clients](tutorial-socket-server.html) and [Web-Socket Clients](tutorial-websocket-server.html).
