describe('Core: Exceptions', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  if(specHelper.canUseDomains){

    before(function(done){
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
      apiObj.actions.actions['badAction'] = { 
        name: 'badAction',
        description: 'I will break',
        inputs: { required: [], optional: [] },
        outputExample: { },
        run: function(api, connection, next){
          api.log(thing, 'info'); // undefined
          next(connection, true);
        }
      }
      apiObj.actions.actions['badAction'].should.be.an.instanceOf(Object);
      done();
    });

    it('the bad action should fail gracefully', function(done){
      specHelper.apiTest.get('/badAction', 0, {} , function(response){
        response.body.error.should.equal("Error: The server experienced an internal error");
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
      should.not.exist(apiObj.actions.actions['badAction']);
      done();
    });

  }else{
    console.log("\r\n\r\n ** the exception test can only run for node >= v0.8.0; skipping ** \r\n\r\n");
  }
});