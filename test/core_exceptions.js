describe('Core: Exceptions', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  try{
    require('domain');

    before(function(done){
      specHelper.prepare(0, function(api){ 
        apiObj = specHelper.cleanAPIObject(api);
        done();
      })
    });

    it('I can inject a bad task that breaks', function(done){
      apiObj.actions['badAction'] = { 
      name: 'badAction',
      description: 'I will break',
      inputs: { required: [], optional: [] },
      outputExample: { },
      run: function(api, connection, next){
        api.log(thing); // undefined
        next(connection, true);
      }
    }
    apiObj.actions['badAction'].should.be.an.instanceOf(Object);
    done();
    });

    // commenting out for now until the mocha team helps sort this out
    //  it('the bad action should fail gracefully', function(done){
    //    specHelper.apiTest.get('/badAction', 0, {} , function(response){
    //      response.body.error.should.equal("The server experienced an internal error");
    //      done();
    // });
    //  });

    it('other actions still work', function(done){
      specHelper.apiTest.get('/randomNumber', 0, {} , function(response){
        should.not.exist(response.body.error);
        done();
    });
    });

    it('I can remove the bad action', function(done){
      delete apiObj.actions['badAction'];
      should.not.exist(apiObj.actions['badAction']);
      done();
    });

  }catch(e){
    console.log("\r\n\r\n ** the exception test can only run for node >= v0.8.0; skipping ** \r\n\r\n");
  }
});