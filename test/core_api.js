describe('Core: API', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var rawApi = {}
  var should = require("should");

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){ 
      rawApi = api;
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('should have an api object with proper parts', function(done){
    [
      apiObj.actions.actions,
      apiObj.actions.versions,
      apiObj.actions.actions.cacheTest["1"],
      apiObj.actions.actions.randomNumber["1"],
      apiObj.actions.actions.status["1"],
    ].forEach(function(item){
      item.should.be.a('object');
    });

    [
      apiObj.actions.actions.cacheTest["1"].run,
      apiObj.actions.actions.randomNumber["1"].run,
      apiObj.actions.actions.status["1"].run,
    ].forEach(function(item){
      item.should.be.an.instanceOf(Function);
    });

    [
      apiObj.actions.actions.randomNumber["1"].name,
      apiObj.actions.actions.randomNumber["1"].description,
    ].forEach(function(item){
      item.should.be.a('string');
    });

    apiObj.configData.should.be.an.instanceOf(Object);
    apiObj.stats.should.be.an.instanceOf(Object);

    done();
  });

  it('should have loaded postVariables properly', function(done){

    [
      "callback",
      "action",
      "limit",
      "offset",
      "outputType",
      "key", // from action
      "value", // from action
    ].forEach(function(item){
      apiObj.params.postVariables.should.include(item);
    });

    done();
  });

  describe("api versions", function(){

    before(function(done){
      rawApi.actions.versions.versionedAction = [1,2]
      rawApi.actions.actions.versionedAction = {
        "1": {
          name: "versionedAction",
          description: "I am a test",
          version: 1,
          inputs: { required: [], optional: [] }, outputExample: {},
          run:function(api, connection, next){
            connection.response.version = 1;
            next(connection, true);
          }
        },
        "2": {
          name: "versionedAction",
          description: "I am a test",
          version: 2,
          inputs: { required: [], optional: [] }, outputExample: {},
          run:function(api, connection, next){
            connection.response.version = 1;
            next(connection, true);
          }
        }
      }
      done();
    });

    after(function(done){
      delete rawApi.actions.actions['versionedAction'];
      delete rawApi.actions.versions['versionedAction'];
      done();
    })

    it("will default actions to version 1", function(done){
      specHelper.apiTest.get('/randomNumber/', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.apiVersion.should.equal(1)
        done();
      });
    });

    it("can specify an apiVersion", function(done){
      specHelper.apiTest.get('/versionedAction/', 0, {apiVersion: 1}, function(response, json){
        json.requestorInformation.receivedParams.apiVersion.should.equal(1)
        specHelper.apiTest.get('/versionedAction/', 0, {apiVersion: 2}, function(response, json){
          json.requestorInformation.receivedParams.apiVersion.should.equal(2)
          done();
        });
      });
    });

    it("will default clients to the latest version of the action", function(done){
      specHelper.apiTest.get('/versionedAction/', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.apiVersion.should.equal(2)
        done();
      });
    });

    it("will fail on a missing action + version", function(done){
      specHelper.apiTest.get('/versionedAction/', 0, {apiVersion: 3}, function(response, json){
        json.error.should.equal("Error: versionedAction is not a known action or that is not a valid apiVersion.");
        done();
      });
    });
  })

});