var net = require('net');
var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('API benchmarks');
var apiObj = {};
var client = {};

var startTime = 0;
var endTime = 0;

function makeSocketRequest(message, next){
  var rsp = function(response){ 
    var parts = response.split("\r\n")
    if(parts.length > 2){
      response = parts[(parts.length - 1 )];
    }
    try{
      parsed = JSON.parse(response);
    }catch(e){
      parsed = {};
    }
    client.removeListener('data', rsp); 
    next(parsed); 
  };
  client.setMaxListeners(9999999);
  client.on('data', rsp);
  process.nextTick(function(){
    client.write(message + "\r\n");
  });
}

function loopingTest(message, count, next){
  var counter = 0;
  var responses = 0;
  while(counter <= count){
    counter++;
    process.nextTick(function(){
      makeSocketRequest(message, function(response){
        responses++
        if(responses == count){
          next(false, response);
        }
      });
    });
  }
}

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){
      var cb = this.callback;
      specHelper.prepare(0, function(api){
        apiObj = specHelper.cleanAPIObject(api);
        cb();
      })
    },
    'api object should exist': function(){
      console.log('\r\n');
      specHelper.assert.isObject(apiObj);
      apiObj = apiObj;
      client = net.connect(specHelper.params[0].tcpServer.port, function(){
        client.setEncoding('utf8'); 
      });
    },
  }
});

suite.addBatch({
  'say 10000 times':{
    topic: function(){
      var cb = this.callback;
      startTime = new Date().getTime();
      loopingTest("say hello there, I am test!", 10000, cb)
    },
    'how long?': function(err, lastResponse){
      var delta = new Date().getTime() - startTime
      console.log("Benchmark: say 10000 times: " + delta + "ms");
    },
  }
});

suite.addBatch({
  'ask for status 10000 times':{
    topic: function(){
      var cb = this.callback;
      startTime = new Date().getTime();
      loopingTest("status", 10000, cb)
    },
    'how long?': function(err, lastResponse){
      var delta = new Date().getTime() - startTime
      console.log("Benchmark: ask for status 1000 times: " + delta + "ms");
    },
  }
});

suite.addBatch({
  'actionsView 10000 times':{
    topic: function(){
      var cb = this.callback;
      startTime = new Date().getTime();
      loopingTest(JSON.stringify({
        action: 'actionsView',
      }), 10000, cb)
    },
    'how long?': function(err, lastResponse){
      var delta = new Date().getTime() - startTime
      console.log("Benchmark: actionsView 1000 times: " + delta + "ms");
    },
  }
});

suite.addBatch({
  'cacheTest 10000 times':{
    topic: function(){
      var cb = this.callback;
      startTime = new Date().getTime();
      loopingTest(JSON.stringify({
        action: 'cacheTest',
        params: {
          key: 'testKey',
          value: 'testValue',
        },
      }), 10000, cb)
    },
    'how long?': function(err, lastResponse){
      var delta = new Date().getTime() - startTime
      console.log("Benchmark: cacheTest 1000 times: " + delta + "ms");
    },
  }
});

suite.addBatch({
  'actionCluster.stop - 0':{
    topic: function(){ 
      var cb = this.callback
      makeSocketRequest("exit", function(){
        specHelper.stopServer(0, cb); 
      });
    },
    'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
});

// export
suite.export(module);