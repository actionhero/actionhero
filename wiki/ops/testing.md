---
layout: wiki
title: Wiki - Testing
---

# Testing

actionhero provides test helpers so that you may try your actions and tasks within a headless environment. We do this by including a `specHelper` initializer which creates a server, `testServer` when running within the test environment.  Via the `testServer`, you can easily call actions or tasks without making a real request.

We have chosen [mocha](http://visionmedia.github.io/mocha/) as our test framework and [should](https://github.com/visionmedia/should.js/) as our assertion tool which are included as dependancies within all new projects.  You do not need to use these testing tools, but an example will be provided which makes use of them.

You also don't need to use these test helpers, and you may want to make a 'real' http or websocket request to test something specific.  If this is the case, you can [check out how actionhero tests its own servers](https://github.com/evantahler/actionhero/tree/master/test/servers) for examples.

## Test Methods

#### new api.specHelper.connection()
- generate a new connection object for the `testServer`
- this connection can run actions, chat, etc.
- `connection.messages` will contain all messages the connection has been sent (welcome messages, action responses, say messages, etc)

#### api.specHelper.runAction(actionName, input, callback)
- use this method to run an action
- `input` can be either a `api.specHelper.connection` object, or simply a hash of params, IE: `{key: 'value'}`
- the callback returns `message` and `connection`.
- example use:

{% highlight javascript %}
api.specHelper.runAction('cacheTest', {key: 'key', value: 'value'}, function(message, connection){
  // message is the normal API response;
  // connection is a new connection object
})
{% endhighlight %}

#### api.specHelper.getStaticFile(file, callback)
- request a file in `/public` from the server
- the callback returns `message` and `connection` where `message` is a hash:

{% highlight javascript %}
var message = {
  error    : error,  // null if everything is OK
  content  : (string),  // string representation of the file's body
  mime     : mime,  // file mime
  length   : length  // bytes
}
{% endhighlight %}

#### api.specHelper.runTask(taskName, params, callback)
- callback may or may not return anything depending on your task's makeup

## Suggested Test Layout

{% highlight javascript %}
process.env.NODE_ENV = 'test';

var should = require('should');
var actionheroPrototype = require("actionhero").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Action: Random Number', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(err){
      done();
    });
  });

  var firstNumber = null;
  it('generates random numbers', function(done){
    api.specHelper.runAction('randomNumber', function(response, connection){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.be.within(0,1);
      firstNumber = response.randomNumber;
      done();
    });
  });

  it('is unique / random', function(done){
    api.specHelper.runAction('randomNumber', function(response, connection){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.not.equal(firstNumber);
      done();
    });
  });

});
{% endhighlight %}

## Notes

- be sure to run your tests in the `test` environment, setting the shell's env with `NODE_ENV=test`.  You can alternatively set this explicitly in your tests with `process.env.NODE_ENV = 'test'`