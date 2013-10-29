describe('Core: Middlware', function(){

  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
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

  afterEach(function(done){
    rawApi.actions.preProcessors  = [];
    rawApi.actions.postProcessors = [];
    process.nextTick(function(){ done(); });
  });

  it('Server should be up and return data', function(done){
    specHelper.apiTest.get('', 0, {}, function(response, json){
      json.should.be.an.instanceOf(Object);
      done();
    });
  });

  describe("action preProcessors", function(){

    it('I can define an action preProcessor and it can append the connection', function(done){
      rawApi.actions.preProcessors.push(function(connection, actionTemplate, next){
        connection.response._preProcessorNote = "note"
        next(connection, true);
      });

      specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
        json._preProcessorNote.should.equal("note");
        done();
      });
    });

    it("postProcessors can append the connection", function(done){
      rawApi.actions.postProcessors.push(function(connection, actionTemplate, toRender, next){
        connection.response._postProcessorNote = "note"
        next(connection, true);
      });

      specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
        json._postProcessorNote.should.equal("note");
        done();
      });
    })

    it("preProcessors can block actions", function(done){
      rawApi.actions.preProcessors.push(function(connection, actionTemplate, next){
        connection.error = "BLOCKED"
        next(connection, false);
      });

      specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
        json.error.should.equal("BLOCKED");
        should.not.exist(json.randomNumber);
        done();
      });
    })

    it("postProcessors can modify toRender", function(done){
      rawApi.actions.postProcessors.push(function(connection, actionTemplate, toRender, next){
        next(connection, false);
      });

      specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
        throw new Error("should not get a response");
      });
      setTimeout(function(){
        done();
      }, 200);
    })
  
  })

  describe("connection create/destroy callbacks", function(){

    beforeEach(function(done){
      rawApi.connections.createCallbacks = [];
      rawApi.connections.destroyCallbacks = [];
      done();
    })

    afterEach(function(done){
      rawApi.connections.createCallbacks = [];
      rawApi.connections.destroyCallbacks = [];
      done();
    })

    it("can create callbackcks on connection creation", function(done){
      rawApi.connections.createCallbacks.push(function(c){
        done();
      });
      specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
        //
      });
    });

    it("can create callbackcks on connection destroy", function(done){
      rawApi.connections.destroyCallbacks.push(function(c){
        done();
      });
      specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
        //
      });
    })

  })

});