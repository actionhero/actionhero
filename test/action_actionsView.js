describe('Action: actionsView', function(){
    var specHelper = require('../helpers/specHelper.js').specHelper;
    var apiObj = {};
    var should = require("should");

    before(function(done){
      specHelper.prepare(0, function(api){ 
        apiObj = specHelper.cleanAPIObject(api);
        done();
      })
    });

    it('actions should be returned', function(done){
      specHelper.apiTest.get('/actionsView', 0, {}, function(response){
        response.body.actions.should.be.an.instanceOf(Array);
        done();
      });
    });

    it('should have actions with all the right parts', function(done){
      specHelper.apiTest.get('/actionsView', 0, {}, function(response){
        for(var i in response.body.actions){
          var action = response.body.actions[i];
          action.name.should.be.a('string'); 
          action.description.should.be.a('string'); 
          action.inputs.should.be.a('object'); 
          action.inputs.required.should.be.an.instanceOf(Array)
          action.inputs.optional.should.be.an.instanceOf(Array)
          action.outputExample.should.be.a('object');  
        } 
      done();
      });
    });

});