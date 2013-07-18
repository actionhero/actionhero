describe('Core: Middlware', function(){

  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var rawApi = {};
  var should = require("should");

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){ 
      rawApi = api;
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  after(function(done){
    rawApi.actions.preProcessors  = [];
    rawApi.actions.postProcessors = [];
    rawApi.connections.postSetupProcessors  = [];
    rawApi.connections.preDestroyProcessors = [];
    done();
  });

  it('Server should be up and return data', function(done){
    specHelper.apiTest.get('', 0, {}, function(response, json){
      json.should.be.an.instanceOf(Object);
      done();
    });
  });


  it('I can define an connection postSetupProcessors and it can append the connection', function(done){
    rawApi.connections.postSetupProcessors.push(function(connection, next){
      connection._postSetupProcessors = "note";
      next(connection);
    });

    rawApi.actions.preProcessors.push(function(connection, actionTemplate, next){
      connection.response._postSetupProcessors = connection._postSetupProcessors;
      next(connection, true);
    });

    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      json._postSetupProcessors.should.equal("note");
      done();
    });
  });

  it('I can define an connection preDestroyProcessors and it can append the connection', function(done){
    rawApi.connections.preDestroyProcessors.push(function(connection, next){
      rawApi.cache.save("preDestroyProcessors","note",null,function(err, resp){
        should.not.exist(err);
        resp.should.equal(true);
        next(connection);
      });
    });

    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      rawApi.cache.load("preDestroyProcessors",function(err, resp){
        resp.should.equal("note");
        done();
      });
    });
  });

  it('I can define an action preProcessor and it can append the connection', function(done){
    rawApi.actions.preProcessors.push(function(connection, actionTemplate, next){
      connection.response._preProcessorNote = "note";
      next(connection, true);
    });

    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      json._preProcessorNote.should.equal("note");
      done();
    });
  });

  it("postProcessors can append the connection", function(done){
    rawApi.actions.postProcessors.push(function(connection, actionTemplate, next){
      connection.response._postProcessorNote = "note";
      next(connection, true);
    });

    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      json._postProcessorNote.should.equal("note");
      done();
    });
  })

  it("preProcessors can block actions", function(done){
    rawApi.actions.preProcessors.push(function(connection, actionTemplate, next){
      connection.error = "BLOCKED";
      next(connection, false);
    });

    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      json.error.should.equal("BLOCKED");
      should.not.exist(json.randomNumber);
      done();
    });
  })

});