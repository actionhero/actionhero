var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var uuid = require('node-uuid')
var api;
var messages = [];

var multiAction = function(action, count, params, next){
  var started = 0;
  var i = 0;
  var start = new Date().getTime();
  while(i < count){
    started++;
    var theseParams = {};
    for (var x in params){
      theseParams[x] = params[x];
      if(typeof theseParams[x] === 'function'){
        theseParams[x] = theseParams[x]();
      }
    }
    api.specHelper.runAction(action, theseParams, function(){
      started--;
      if(started === 0){
        var durationSeconds = ((new Date().getTime()) - start) / 1000;
        messages.push('benchmark: action: ' + action + ' x ' + count + ' >>> ' + durationSeconds + 's');
        next(durationSeconds);
      }
    });
    i++;
  }
};

describe('Benchmarks', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(){
      console.log('');
      console.log('');
      messages.forEach(function(message){
        console.log(message);
      });
      done();
    });
  });

  it('randomNumber', function(done){
    this.timeout(10 * 1000)
    multiAction('randomNumber', 1000, {}, function(){
      done();
    });
  });

  it('status', function(done){
    this.timeout(10 * 1000)
    multiAction('status', 1000, {}, function(){
      done();
    });
  });

  it('cacheTest', function(done){
    this.timeout(10 * 1000)
    multiAction('cacheTest', 1000, {
      key:   function(){ return uuid.v4() }, 
      value: function(){ return uuid.v4() }
    }, function(){
      done();
    });
  });

  it('sleepTest', function(done){
    this.timeout(10 * 1000)
    multiAction('sleepTest', 1000, {}, function(){
      done();
    });
  });

  it('debug', function(done){
    this.timeout(10 * 1000)
    multiAction('debug', 1000, {}, function(){
      done();
    });
  });

});
