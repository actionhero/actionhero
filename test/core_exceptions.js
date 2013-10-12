describe('Core: Exceptions', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  var uncaughtExceptionHandlers;
  beforeEach(function(done){
    uncaughtExceptionHandlers = process.listeners("uncaughtException");
    uncaughtExceptionHandlers.forEach(function(e){
      process.removeListener("uncaughtException", e); 
    });
    done();
  })

  afterEach(function(done){
    uncaughtExceptionHandlers.forEach(function(e){
      process.on("uncaughtException", e);
    });
    done();
  });

  it('I can inject a bad task that breaks', function(done){
    apiObj.actions.actions.badAction = {
      "1": {
        name: 'badAction',
        description: 'I will break',
        inputs: { required: [], optional: [] },
        outputExample: { },
        version: 1,
        run: function(api, connection, next){
          thing // undefined
          next(connection, true);
        }
      }
    }
    apiObj.actions.versions['badAction'] = [ 1 ];
    apiObj.actions.actions['badAction'].should.be.an.instanceOf(Object);
    done();
  });

  it('the bad action should fail gracefully', function(done){
    specHelper.apiTest.get('/badAction', 0, {} , function(response, json){
      json.error.should.equal("Error: The server experienced an internal error");
      done();
    });
  });

  it('other actions still work', function(done){
    specHelper.apiTest.get('/randomNumber', 0, {} , function(response){
      should.not.exist(response.body.error);
      done();
    });
  });

  it('I can remove the bad action', function(done){
    delete apiObj.actions.actions['badAction'];
    delete apiObj.actions.versions['badAction'];
    should.not.exist(apiObj.actions.actions['badAction']);
    done();
  });
});