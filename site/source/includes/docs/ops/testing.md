# Testing

actionhero provides test helpers so that you may try your actions and tasks within a headless environment. We do this by including a `specHelper` initializer which creates a server, `testServer` when running within the test environment.  Via the `testServer`, you can easily call actions or tasks without making a real request.

We have chosen [mocha](http://mochajs.org/) as our test framework and [should](https://github.com/visionmedia/should.js/) as our assertion tool which are included as dependancies within all new projects ([generated](/docs#install-amp-quickstart) with `./node_modules/.bin/actionhero generate`).  You do not need to use these testing tools, but an example will be provided which makes use of them.

You also don't need to use these test helpers, and you may want to make a 'real' http or websocket request to test something specific.  If this is the case, you can [check out how actionhero tests its own servers](https://github.com/evantahler/actionhero/tree/master/test/servers) for examples.

## Getting Started

```javascript
// package.json from a new actionhero project with `mocha` and `should` included
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
    "ws"         : "latest",
    "grunt"      : "latest"
  },
  "devDependencies" : {
    "mocha"  : "latest",
    "should" : "latest"
  },
  "scripts" : {
    "help"         : "actionhero help",
    "start"        : "actionhero start",
    "actionhero"   : "actionhero",
    "startCluster" : "actionhero startCluster",
    "test"         : "mocha"
  }
}
```

To run a mocha test suite, you invoke the mocha binary, `./node_modules/.bin/mocha`.  This will tell mocha to look in your `./test` folder and run any tests that it can find.  There are ways to change the test folder location, only run specific tests, change the reporting format and more which you can learn about on [Mocha's website](http://mochajs.org/).  We asume that you have `mocha` (and `should`) installed to your project by listing it in your `package.json`.  If you used `actionhero generate` to create your project, this should already be configured for your.

The majority of the time, you'll be testing actions and other methods you have written, so you'll need to "run" an actionhero server as part of your test suite.  Many times you'll want to have actionhero behave in a slightly unique way while testing (perhaps connect to a special database, don't log, etc).  To do this, you can change the behavior of the config files for the `test` environment.  Here's how we tell actionhero [not to write any logs when testing](https://github.com/evantahler/actionhero/blob/master/config/logger.js#L42-L48). Note thest test-specific configuration overrides the defaults.  To ensure that actionhero boots with the `test` environment loaded, the test command you run should explicitly do this, AKA: `NODE_ENV=test ./node_modules/.bin/mocha`.  You can log this in as the [`test` script in your `package.json`](https://github.com/evantahler/actionhero/blob/master/package.json#L63) so you can simplify the running of tests with just `npm test`.

Actionhero comes with a `specHelper` to make it easier to test tasks and actions.  This specHelper is a special [server](/docs/#servers) which can check things without needing to make an HTTP, websocket, etc request.  If you need to check the true behavior of a server (perhaps how the router works for an HTTP request), you should make a real HTTP request in your test suite, using something like the [request](https://github.com/request/request) library ([example](https://github.com/evantahler/actionhero/blob/master/test/servers/web.js#L178-L184)). 

## Example Test

```javascript
// ./test/integartion/actions/randomNumber.js

var should = require('should');
var actionheroPrototype = require('actionhero').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api, firstNumber;

describe('Action: RandomNumber', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  it('generates random numbers', function(done){
    api.specHelper.runAction('randomNumber', function(response){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.be.within(0,1);
      firstNumber = response.randomNumber;
      done();
    });
  });

  it('is unique / random', function(done){
    api.specHelper.runAction('randomNumber', function(response){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.not.equal(firstNumber);
      done();
    });
  });

});
```

Say you had an action that was supposed to respond with a `randomNumber`, and you wanted to write a test for it.  

More details on the specHelper methods are below.

If you want to see fuller example of how to create an integration test within actionhero, please [check out the tutorial](https://github.com/evantahler/actionhero-tutorial#testing)

## Test Methods

### new api.specHelper.connection()
- generate a new connection object for the `testServer`
- this connection can run actions, chat, etc.
- `connection.messages` will contain all messages the connection has been sent (welcome messages, action responses, say messages, etc)

### api.specHelper.runAction(actionName, input, callback)
- use this method to run an action
- `input` can be either a `api.specHelper.connection` object, or simply a hash of params, IE: `{key: 'value'}`
- the callback returns `message` and `connection`.
- example use:

```javascript
api.specHelper.runAction('cacheTest', {key: 'key', value: 'value'}, function(message, connection){
  // message is the normal API response;
  // connection is a new connection object
})
```

### api.specHelper.getStaticFile(file, callback)
- request a file in `/public` from the server
- the callback returns `message` and `connection` where `message` is a hash:

```javascript
var message = {
  error    : error,  // null if everything is OK
  content  : (string),  // string representation of the file's body
  mime     : mime,  // file mime
  length   : length  // bytes
}
```

### api.specHelper.runTask(taskName, params, callback)
- callback may or may not return anything depending on your task's makeup

```javascript
api.specHelper.runTask('sendEmailTask', {message: 'hello' to: 'evan@test.com'}, function(response){
  // test it!
  // remember that the task really will be run, so be sure that the test environment is set properly
})
```

## Notes

- be sure to run your tests in the `test` environment, setting the shell's env with `NODE_ENV=test`.  You can alternatively set this explicitly in your tests with `process.env.NODE_ENV = 'test'`
