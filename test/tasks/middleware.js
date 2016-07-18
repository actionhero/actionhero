var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var taskParams = {
  action: 'randomNumber'
};

var middleware = {
  name: 'test-middleware',
  priority: 1000,
  global: true,
  preProcessor: function(next){
    try{
      var worker = this.worker;
      var params = this.args[0];
      params.should.be.equal(taskParams);
      params.test = true;
      next();
    }catch(e){
      next(e);
    }

  },
  postProcessor: function(next){
    try{
      var worker = this.worker;
      var params = this.args[0];
      params.test.should.be.equal(true);
      var result = worker.result;
      result.randomNumber.should.exist;
      result.shortRandom = result.randomNumber.toPrecision(3);

      next(null, result);
    }catch(e){
      next(e);
    }
  }
};

describe('Test: Task Middleware', function(){
  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      api.tasks.addMiddleware(middleware, function(error){
        done(error);
      });
    });
  });

  after(function(done){
    api.tasks.globalMiddleware = [];
    actionhero.stop(function(){
      done();
    });
  });

  it('can modify parameters before a task and modify result after task completion', function(done){
    api.specHelper.runFullTask('runAction', taskParams, function(error, response){
      should.not.exist(error);
      response.shortRandom.should.equal(response.randomNumber.toPrecision(3));

      done();
    });
  });
});
