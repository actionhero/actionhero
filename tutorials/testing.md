## Overview

ActionHero provides test helpers so that you may try your actions and tasks within a headless environment. We do this by including a `specHelper` initializer which creates a server, `testServer` when running within the test environment. Via the `testServer`, you can easily call actions or tasks without making a real request.

We have chosen [mocha](http://mochajs.org/) as our test framework and [chai](http://chaijs.com/) as our assertion tool which are included as dependencies within all new projects ([generated](/docs/get-started) with `./node_modules/.bin/actionhero generate`). We also use `cross-env` to set NODE_ENV in a way that works for all operating systems, including Windows. You do not need to use these testing tools, but an example will be provided which makes use of them.

You also don't need to use these test helpers, and you may want to make a real http or websocket request to test something specific. If this is the case, you can [check out how ActionHero tests its own servers](https://github.com/actionhero/actionhero/tree/master/test/servers) for examples.

## Getting Started

```js
// package.json from a new actionhero project with \`mocha\` and \`chai\` included
{
  "author"      : "YOU <YOU@example.com>",
  "name"        : "my_actionhero_project",
  "description" : "my actionhero project",
  "version"     : "0.0.1",
  "engines"     : {
    "node": ">=0.10.0"
  },
  "dependencies" : {
    "actionhero" : "12.3.0",
    "ws"         : "latest"
  },
  "devDependencies" : {
    "cross-env": "latest",
    "mocha"  : "latest",
    "chai" : "latest"
  },
  "scripts" : {
    "help"         : "actionhero help",
    "start"        : "actionhero start",
    "actionhero"   : "actionhero",
    "start cluster": "actionhero start cluster",
    "test"         : "cross-env NODE_ENV=test mocha"
  }
}
```

To run a mocha test suite, you invoke the mocha binary, `./node_modules/.bin/mocha`. This will tell mocha to look in your `./test` folder and run any tests that it can find. There are ways to change the test folder location, only run specific tests, change the reporting format and more which you can learn about on [Mocha's website](http://mochajs.org/). We asume that you have `mocha` (and `chai`) installed to your project by listing it in your `package.json`. If you used `ActionHero generate` to create your project, this should already be configured for your.

The majority of the time, you'll be testing actions and other methods you have written, so you'll need to "run" an actionhero server as part of your test suite. Many times you'll want to have ActionHero behave in a slightly unique way while testing (perhaps connect to a special database, don't log, etc). To do this, you can change the behavior of the config files for the `test` environment. Here is how we tell ActionHero [not to write any logs when testing](https://github.com/actionhero/actionhero/blob/master/config/logger.js#L48-L54). Note thest test-specific configuration overrides the defaults. To ensure that ActionHero boots with the `test` environment loaded, the test command you run should explicitly do this, AKA: `NODE_ENV=test ./node_modules/.bin/mocha`. You can log this in as the [`test` script in your `package.json`](https://github.com/actionhero/actionhero/blob/master/package.json#L63) so you can simplify the running of tests with just `npm test`.

ActionHero comes with a `specHelper` to make it easier to test tasks and actions. This specHelper is a special [server](/docs/core/#servers) which can check things without needing to make an HTTP, websocket, etc request. If you need to check the true behavior of a server (perhaps how the router works for an HTTP request), you should make a real HTTP request in your test suite, using something like the [request](https://github.com/request/request) library ([example](https://github.com/actionhero/actionhero/blob/master/test/servers/web.js#L178-L184)).

## Example Test

```js
'use strict'

let path = require('path')
var expect = require('chai').expect
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: RandomNumber', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  var firstNumber = null
  it('generates random numbers', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).to.be.at.least(0)
      expect(response.randomNumber).to.be.at.most(1)
      firstNumber = response.randomNumber
      done()
    })
  })

  it('is unique / random', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).to.be.at.least(0)
      expect(response.randomNumber).to.be.at.most(1)
      expect(response.randomNumber).not.to.equal(firstNumber)
      done()
    })
  })
})
```

Say you had an action that was supposed to respond with a `randomNumber`, and you wanted to write a test for it.

More details on the specHelper methods are below.

If you want to see fuller example of how to create an integration test within ActionHero, please [check out the tutorial](https://github.com/actionhero/actionhero-tutorial#testing)

## Test Methods

### `new api.specHelper.connection()`

*   generate a new connection object for the `testServer`
*   this connection can run actions, chat, etc.
*   `connection.messages` will contain all messages the connection has been sent (welcome messages, action responses, say messages, etc)

### `api.specHelper.runAction(actionName, input, callback)`

*   use this method to run an action
*   `input` can be either a `api.specHelper.connection` object, or simply a hash of params, IE: `{`{key: 'value'}`}`
*   the callback returns `message` and `connection`.
*   example use:

```js
api.specHelper.runAction('cacheTest', {key: 'key', value: 'value'}, function(message, connection){
// message is the normal API response;
// connection is a new connection object
})
```

### `api.specHelper.getStaticFile(file, callback)`

*   request a file in `/public` from the server
*   the callback returns `message` and `connection` where `message` is a hash:

```js
var message = {
error    : error,    // null if everything is OK
content  : (string), // string representation of the file's body
mime     : mime,     // file mime
length   : length    // bytes
}
```

### `api.specHelper.runTask(taskName, params, callback)`

*   callback may or may not return anything depending on your task's makeup

```js
api.specHelper.runTask('sendEmailTask', {message: 'hello' to: 'evan@test.com'}, function(response){
// test it!
// remember that the task really will be run, so be sure that the test environment is set properly
})
```

## Notes

Be sure to run your tests in the `test` environment, setting the shell's env with `NODE_ENV=test`. You can alternatively set this explicitly in your tests with `process.env.NODE_ENV = 'test'`

If you do not want the `specHelper` actions to include metadata (`data.response.serverInformation`, `data.response.requesterInformation`, and `data.response.messageCount`) from the server, you can configure `api.specHelper.returnMetadata = false` in your tests.