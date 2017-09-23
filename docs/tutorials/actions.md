## Overview

```js
// A simple Action

'use strict'
const ActionHero = require('actionhero')

module.exports = class MyAction extends ActionHero.Action {
 constructor () {
   super()
   this.name = 'randomNumber'
   this.description = 'I am an API method which will generate a random number'
   this.outputExample = {randomNumber: 0.1234}
 }

 async run (api, data) {
   data.response.randomNumber = Math.random()
 }
}
```

The core of ActionHero is the Action framework, and **actions** are the basic units of work.  All connection types from all servers can use actions.  This means that you only need to write an action once, and both HTTP clients and websocket clients can consume it.

The goal of an action is to read `data.params` (which are the arguments a connection provides), do work, and set the `data.response` (and `data.response.error` when needed) values to build the response to the client.

You can create you own actions by placing them in a `./actions/` folder at the root of your application.  You can use the generator with `actionhero generate action --name=myAction`

You can also define more than one action per file if you would like, to share common methods and components (like input parsers).

```js
// A Combound Action with Shared Inputs//

var commonInputs = {
  email: {
    required: true,
    validator: function(param){
      if( email.indexOf('@') > 0 ){
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

* actions optionally have the `action.version` attribute.
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

## Options

The complete set of options an action can have are:

```js
exports.action = {
  // the action's name (the \`exports\` key doesn't matter)
  name: 'randomNumber',
  // the description
  description: 'I am an API method which will generate a random number',
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
  blockedConnectionTypes: ['webSocket'],
  // how should this action be logged?
  logLevel: 'warning',
  // (HTTP only) if the route for this action includes an extension (like .jpg), should the response MIME be adjusted to match?
  matchExtensionMimeType: true,
  // should this action appear within \`api.documentation.documentation\`
  toDocument: true,

  run: function(api, data, next){
    var error = null;

    data.response.randomNumber = Math.random() * data.params.multiplier;
    next(error);
  }
}
```

## Inputs

```js
action.inputs = {
  // a simple input
  // defaults assume required = false
  minimalInput: {}
  // a complex input
  multiplier: {
    required: true,
    validator: function(param, connection, actionTemplate){
      if(param < 0){ return 'must be > 0'; }else{ return true; }
    },
    formatter: function(param, connection, actionTemplate){
      return parseInt(param);
    },
    default:   function(param, connection, actionTemplate){
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
        validator: function(param, connection, actionTemplate){
          if(param < 0){ return 'must be > 0'; }else{ return true; }
        },
        formatter: function(param, connection, actionTemplate){
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
  * should return an error message if validation fails which will be returned to the client
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
  default:   function(p){ return 0; },
  formatter: function(p){ return parseFloat(p); },
  validator: function(p){
    if(isNaN(parseFloat(p)){ return new Error('not a number'); }
    if(p < 0){ return new Error('money cannot be negative'); }
    else{ return true; }
  }
}
```

Formatters and Validators can also be named method names. For example, you might have an action like:
