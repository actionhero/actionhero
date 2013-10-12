describe('Core: Documentaion', function(){
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

  it('documentation should be returned for web clients with no params', function(done){
    specHelper.apiTest.get('/api/', 0, {}, function(response, json){
      json.documentation.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('should have actions with all the right parts', function(done){
    specHelper.apiTest.get('/api/', 0, {}, function(response, json){
      for(var actionName in json.documentation){
        for(var version in json.documentation[actionName]){
          var action = json.documentation[actionName][version];
          action.name.should.be.a('string'); 
          action.description.should.be.a('string'); 
          action.inputs.should.be.a('object'); 
          action.inputs.required.should.be.an.instanceOf(Array)
          action.inputs.optional.should.be.an.instanceOf(Array)
          action.outputExample.should.be.a('object'); 
        }
      };
    done();
    });
  });

});