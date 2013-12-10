describe('~~ Benchmarks', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var client = {};
  var should = require('should');

  var startTime = 0;
  var endTime = 0;

  var makeSocketRequest = function(message, next){
    var rsp = function(response){
      var parts = response.split('\r\n')
      if(parts.length > 2){
        response = parts[(parts.length - 1 )];
      }
      var parsed = {};
      try { parsed = JSON.parse(response) } catch(e){}
      client.removeListener('data', rsp);
      next(parsed);
    };
    client.setMaxListeners(9999999);
    client.on('data', rsp);
    process.nextTick(function(){
      client.write(message + '\r\n');
    });
  }

  var makeHTTPRequest = function(path, data, next){
    specHelper.apiTest.get(path, 0, data, next );
  }

  var loopingTest = function(path, data, count, next){
    var counter = 0;
    var responses = 0;
    while(counter <= count){
      counter++;
      process.nextTick(function(){
        var thisData = {}
        for(var i in data){
          thisData[i] = data[i];
          if('function' === typeof thisData[i]){ thisData[i] = thisData[i]() }
        }
        makeHTTPRequest(path, thisData, function(response){
          responses++
          if(count === responses){ next(false, response) }
        });
      });
    }
  }

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('ask for status 1000 times', function(done){
    this.timeout(60000)
    startTime = new Date().getTime();
    loopingTest('/api/status', {}, 1000, function(){
      var delta = new Date().getTime() - startTime
      done();
    });
  });

  it('ask for actionsView 1000 times', function(done){
    this.timeout(60000)
    startTime = new Date().getTime();
    loopingTest('/api/', {action: 'actionsView'}, 1000, function(){
      var delta = new Date().getTime() - startTime
      done();
    });
  });

  it('ask for cacheTest 1000 times', function(done){
    this.timeout(60000)
    startTime = new Date().getTime();
    loopingTest('/api/cacheTest', { key: function(){
          return apiObj.utils.randomString(99);
        }, value: function(){
          return apiObj.utils.randomString(99);
        } }, 1000, function(){
      var delta = new Date().getTime() - startTime
      done();
    });
  });

});
