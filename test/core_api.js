describe('Core: API', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('should have an api object with propper parts', function(done){
    [
      apiObj.actions,
      apiObj.actions.actionsView,
      apiObj.actions.cacheTest,
      apiObj.actions.file,
      apiObj.actions.randomNumber,
      apiObj.actions.status,
    ].forEach(function(item){
      item.should.be.a('object');
    });

    [
      apiObj.actions.actionsView.run,
      apiObj.actions.cacheTest.run,
      apiObj.actions.file.run,
      apiObj.actions.randomNumber.run,
      apiObj.actions.status.run,
    ].forEach(function(item){
      item.should.be.an.instanceOf(Function);
    });

    [
      apiObj.actions.randomNumber.name,
      apiObj.actions.randomNumber.description,
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
      apiObj.postVariables.should.include(item);
    });

    done();
  });

});