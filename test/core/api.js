var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: API', function(){

  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      done();
    });
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  it('should have an api object with proper parts', function(done){
    [
      api.actions.actions,
      api.actions.versions,
      api.actions.actions.cacheTest['1'],
      api.actions.actions.randomNumber['1'],
      api.actions.actions.status['1']
    ].forEach(function(item){
      item.should.be.a.Object;
    });

    [
      api.actions.actions.cacheTest['1'].run,
      api.actions.actions.randomNumber['1'].run,
      api.actions.actions.status['1'].run
    ].forEach(function(item){
      item.should.be.an.instanceOf(Function);
    });

    [
      api.actions.actions.randomNumber['1'].name,
      api.actions.actions.randomNumber['1'].description
    ].forEach(function(item){
      item.should.be.a.String;
    });

    api.config.should.be.an.instanceOf(Object);

    done();
  });

  it('should have loaded postVariables properly', function(done){
    [
      'file',
      'callback',
      'action',
      'apiVersion',
      'key',  // from cacheTest action
      'value' // from cacheTest action
    ].forEach(function(item){
      (api.params.postVariables.indexOf(item) >= 0).should.equal(true);
    });

    done();
  });

  describe('api versions', function(){

    before(function(done){
      api.actions.versions.versionedAction = [1, 2, 3];
      api.actions.actions.versionedAction = {
        '1': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run:function(api, connection, next){
            connection.response.version = 1;
            next(connection, true);
          }
        },
        '2': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 2,
          outputExample: {},
          run:function(api, connection, next){
            connection.response.version = 1;
            next(connection, true);
          }
        },
        '3': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 3,
          outputExample: {},
          run:function(api, data, next){
            data.response.version = 1;
            var error = {
              'a' : {'complex': 'error'}
            };
            next(error);
          }
        }
      };
      done();
    });

    after(function(done){
      delete api.actions.actions.versionedAction;
      delete api.actions.versions.versionedAction;
      done();
    });

    it('will default actions to version 1 when no version is provided by the defintion', function(done){
      api.specHelper.runAction('randomNumber', function(response){
        response.requesterInformation.receivedParams.apiVersion.should.equal(1);
        done();
      });
    });

    it('can specify an apiVersion', function(done){
      api.specHelper.runAction('versionedAction', {apiVersion: 1}, function(response){
        response.requesterInformation.receivedParams.apiVersion.should.equal(1);
        api.specHelper.runAction('versionedAction', {apiVersion: 2}, function(response){
          response.requesterInformation.receivedParams.apiVersion.should.equal(2);
          done();
        });
      });
    });

    it('will default clients to the latest version of the action', function(done){
      api.specHelper.runAction('versionedAction', function(response){
        response.requesterInformation.receivedParams.apiVersion.should.equal(3);
        done();
      });
    });

    it('will fail on a missing action + version', function(done){
      api.specHelper.runAction('versionedAction', {apiVersion: 10}, function(response){
        response.error.should.equal('Error: unknown action or invalid apiVersion');
        done();
      });
    });

    it('can return complex error responses', function(done){
      api.specHelper.runAction('versionedAction', {apiVersion: 3}, function(response){
        response.error.a.complex.should.equal('error');
        done();
      });
    });
  });

  describe('Action Params', function(){

    before(function(done){

      api.actions.versions.testAction = [1];
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'this action has some required params',
          version: 1,
          inputs: {
            requiredParam: {required: true},
            optionalParam: {required: false},
            fancyParam: {
              required: false,
              default: function(){ return 'abc123'; },
              validator: function(s){
                if(s === 'abc123'){ return true; }
                else{ return 'fancyParam should be "abc123".  so says ' + this.id; }
              },
              formatter: function(s){
                return String(s);
              }
            }
          },
          run:function(api, connection, next){
            connection.response.params = connection.params;
            next(connection, true);
          }
        }
      };

      done();
    });

    after(function(done){
      delete api.actions.actions.testAction;
      delete api.actions.versions.testAction;
      done();
    });

    it('correct params that are falsey (false, []) should be allowed', function(done){
      api.specHelper.runAction('testAction', {requiredParam: false}, function(response){
        response.params.requiredParam.should.equal(false);
        api.specHelper.runAction('testAction', {requiredParam: []}, function(response){
          response.params.requiredParam.should.eql([]);
          done();
        });
      });
    });

    it('will fail for missing or empty string params', function(done){
      api.specHelper.runAction('testAction', {requiredParam: ''}, function(response){
        response.error.should.containEql('required parameter for this action');
        api.specHelper.runAction('testAction', {}, function(response){
          response.error.should.containEql('required parameter for this action');
          done();
        });
      });
    });

    it('correct params respect config options', function(done){
      api.config.general.missingParamChecks = [undefined];
      api.specHelper.runAction('testAction', {requiredParam: ''}, function(response){
        response.params.requiredParam.should.equal('');
        api.specHelper.runAction('testAction', {requiredParam: null}, function(response){
          should(response.params.requiredParam).eql(null);
          done();
        });
      });
    });

    it('will set a default when params are not provided', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true}, function(response){
        response.params.fancyParam.should.equal('abc123');
        done();
      });
    });

    it('will use validator if provided', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, function(response){
        response.error.should.match(/Error: fancyParam should be "abc123"/);
        done();
      });
    });

    it('validator will have the API object in scope as this', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, function(response){
        response.error.should.match(new RegExp(api.id));
        done();
      });
    });

    it('will use formatter if provided (and still use validator)', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, function(response){
        response.requesterInformation.receivedParams.fancyParam.should.equal('123');
        done();
      });
    });

    it('will filter params not set in the target action or global safelist', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true, sleepDuration: true}, function(response){
        should.exist(response.requesterInformation.receivedParams.requiredParam);
        should.not.exist(response.requesterInformation.receivedParams.sleepDuration);
        done();
      });
    });

  });

  describe('named action validations', function(){

    before(function(done){
      api.validators = {
        validator1: function(param){
          if(typeof param !== 'string'){ return new Error('only strings'); }
          return true;
        },
        validator2: function(param){
          if(param !== 'correct'){ return new Error('that is not correct'); }
          return true;
        }
      };

      api.actions.versions.testAction = [1];
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'I am a test',
          inputs: {
            a: {
              validator: ['api.validators.validator1', 'api.validators.validator2']
            }
          },
          run:function(api, data, next){
            next();
          }
        }
      };

      done();
    });

    after(function(done){
      delete api.actions.versions.testAction;
      delete api.actions.actions.testAction;
      delete api.validators;
      done();
    });

    it('runs validator arrays in the proper order', function(done){
      api.specHelper.runAction('testAction', {a: 6}, function(response){
        response.error.should.equal('Error: only strings');
        done();
      });
    });

    it('runs more than 1 validator', function(done){
      api.specHelper.runAction('testAction', {a: 'hello'}, function(response){
        response.error.should.equal('Error: that is not correct');
        done();
      });
    });

    it('succeeds multiple validators', function(done){
      api.specHelper.runAction('testAction', {a: 'correct'}, function(response){
        should.not.exist(response.error);
        done();
      });
    });

  });

  describe('named action formatters', function(){

    before(function(done){
      api.formatters = {
        formatter1: function(param){
          return '*' + param + '*';
        },
        formatter2: function(param){
          return '~' + param + '~';
        }
      };

      api.actions.versions.testAction = [1];
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'I am a test',
          inputs: {
            a: {
              formatter: ['api.formatters.formatter1', 'api.formatters.formatter2']
            }
          },
          run:function(api, data, next){
            data.response.a = data.params.a;
            next();
          }
        }
      };

      done();
    });

    after(function(done){
      delete api.actions.versions.testAction;
      delete api.actions.actions.testAction;
      delete api.formatters;
      done();
    });

    it('runs formatter arrays in the proper order', function(done){
      api.specHelper.runAction('testAction', {a: 6}, function(response){
        response.a.should.equal('~*6*~');
        done();
      });
    });

  });

});
