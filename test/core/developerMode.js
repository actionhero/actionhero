var fs = require('fs');
var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var originalFile =    './actions/randomNumber.js';
var originalContent = fs.readFileSync(originalFile);

var newFileContent = '';
newFileContent += 'exports.randomNumber = {';
newFileContent += '  name: "randomNumber",';
newFileContent += '  description: "HACK",';
newFileContent += '  outputExample: {},';
newFileContent += '  run: function(api, connection, next){';
newFileContent += '    connection.response.randomNumber = "not a number!";';
newFileContent += '    next(connection, true);';
newFileContent += '  }';
newFileContent += '};';

describe('Core: Developer Mode', function(){

  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      setTimeout(function(){
        done();
      }, 1001); // allow the file to get stat-ed once in the original state
    });
  });

  after(function(done){
    actionhero.stop(function(){
      fs.writeFile(originalFile, String(originalContent), function(){
        setTimeout(function(){
          done();
        }, 1001 * 3);
      });
    });
  });

  it('random numbers work initially', function(done){
    api.specHelper.runAction('randomNumber', function(response){
      should.not.exist(response.error);
      response.randomNumber.should.be.within(0, 1);
      done();
    });
  });

  it('I can change the file and new actions will be loaded up', function(done){
    fs.writeFile(originalFile, newFileContent, function(){
      setTimeout(function(){
        api.actions.actions.randomNumber['1'].description.should.equal('HACK');
        api.specHelper.runAction('randomNumber', function(response){
          response.randomNumber.should.equal('not a number!');
          done();
        });
      }, 1001 * 3); //file read timer is 1 second; time to notice the change + 3x time to reload API
    });
  });

  it('It can be placed back', function(done){
    fs.writeFile(originalFile, originalContent, function(){
      setTimeout(function(){
        api.actions.actions.randomNumber['1'].description.should.equal('I am an API method which will generate a random number');
        done();
      }, 1001 * 3); //file read timer is 1 second; time to notice the change + 3x time to reload API
    });
  });

});
