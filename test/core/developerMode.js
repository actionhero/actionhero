var fs = require('fs');
var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var original_file =    './actions/randomNumber.js';
var original_content = fs.readFileSync(original_file);

var new_file_content = '';
new_file_content += 'var action = {};';
new_file_content += 'action.name = \'randomNumber\';';
new_file_content += 'action.description = \'HACK\';';
new_file_content += 'action.inputs = { \'required\' : [], \'optional\' : [] };';
new_file_content += 'action.outputExample = {randomNumber: 123};';
new_file_content += 'action.run = function(api, connection, next){';
new_file_content += '  connection.response.randomNumber = \'not a number!\';';
new_file_content += '  next(connection, true);';
new_file_content += '};';
new_file_content += 'exports.action = action;';

describe('Core: Developer Mode', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      setTimeout(function(){
        done();
      }, 1001) // allow the file to get stat-ed once in the original state
    })
  });

  after(function(done){
    actionhero.stop(function(err){
      fs.writeFile(original_file, String(original_content), function(err){
        setTimeout(function(){
          done();
        }, 1001 * 3);
      });
    });
  });

  it('random numbers work initially', function(done){
    api.specHelper.runAction('randomNumber', function(response, connection){
      should.not.exist(response.error);
      response.randomNumber.should.be.within(0,1);
      done();
    });
  });

  it('I can change the file and new actions will be loaded up', function(done){
    fs.writeFile(original_file, new_file_content, function(err){
      setTimeout(function(){
        api.actions.actions.randomNumber['1'].description.should.equal('HACK');
        api.specHelper.runAction('randomNumber', function(response, connection){
          response.randomNumber.should.equal('not a number!');
          done();
        });
      }, 1001 * 3); //file read timer is 1 second; time to notice the change + 3x time to reload API
    });
  });

  it('It can be placed back', function(done){
    fs.writeFile(original_file, original_content, function(err){
      setTimeout(function(){
        api.actions.actions.randomNumber['1'].description.should.equal('I am an API method which will generate a random number');
        done();
      }, 1001 * 3); //file read timer is 1 second; time to notice the change + 3x time to reload API
    });
  });

});
