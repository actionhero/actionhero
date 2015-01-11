var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: API', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      done();
    })
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
    api.stats.should.be.an.instanceOf(Object);

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
      api.actions.versions.versionedAction = [1,2,3]
      api.actions.actions.versionedAction = {
        '1': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 1,
          inputs: { required: [], optional: [] },
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
          inputs: { required: [], optional: [] },
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
          inputs: { required: [], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            connection.response.version = 1;
            connection.error = {
              'a' : {'complex': 'error'}
            }
            next(connection, true);
          }
        }
      }
      done();
    });

    after(function(done){
      delete api.actions.actions.versionedAction;
      delete api.actions.versions.versionedAction;
      done();
    })

    it('will default actions to version 1 when no version is provided by the defintion', function(done){
      api.specHelper.runAction('randomNumber', function(response){
        response.requesterInformation.receivedParams.apiVersion.should.equal(1)
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
        response.requesterInformation.receivedParams.apiVersion.should.equal(3)
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
  })

  describe('duplicate callback prevention', function(){

    before(function(done){
      api.actions.versions.badAction = [1]
      api.actions.actions.badAction = {
        '1': {
          name: 'badAction',
          description: 'I double callback',
          version: 1,
          inputs: { required: [], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            connection.response.count = 1
            next(connection, true);
            setTimeout(function(){
              connection.response.count = 2
              next(connection, true);
            }, 1000)
          }
        }
      }
      done();
    });

    after(function(done){
      api.actions.preProcessors = {};
      delete api.actions.actions.badAction;
      delete api.actions.versions.badAction;
      done();
    });

    it('will only callback once for a bad action and only the first response will be returned', function(done){
      var responses = [];
      api.specHelper.runAction('badAction', function(response){
        responses.push( api.utils.objClone(response) );
      });

      setTimeout(function(){
        responses.length.should.equal(1);
        responses[0].count.should.equal(1)
        done();
      }, 2000)
    });

    it('can also prevent double callbacks from middleware', function(done){
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        next(connection, true);
        next(connection, true);
      });

      var responses = [];
      api.specHelper.runAction('randomNumber', function(response){
        responses.push( api.utils.objClone(response) );
      });

      setTimeout(function(){
        responses.length.should.equal(1);
        done();
      }, 2000)
    });

  });

  describe('Action Params', function(){

    before(function(done){

      api.actions.versions.testAction = [1]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'this action has some required params',
          version: 1,
          inputs: { 
            requiredParam: {
              required: true
            },
            optionalParam: {
              required: false
            },
            fancyParam: {
              required: false,
              default: function(){ return 'abc123'; },
              validator: function(s){
                if(s === 'abc123'){ return true; }
                else{ return 'fancyParam should be "abc123"'; }
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
      }

      done();
    });

    after(function(done){
      delete api.actions.actions.testAction;
      delete api.actions.versions.testAction;
      done();
    });
    
    
    it('correct params that are falsey (false, []) should be allowed', function(done){
      api.specHelper.runAction('testAction', {requiredParam: false }, function(response){
        response.params.requiredParam.should.equal(false);
        api.specHelper.runAction('testAction', {requiredParam: [] }, function(response){
          response.params.requiredParam.should.be.Array.and.be.empty;
          done();
        });
      });
    });
    
    it( 'will fail for missing or empty string params', function(done){
      api.specHelper.runAction('testAction', {requiredParam: '' }, function(response){
        response.error.should.containEql('required parameter for this action');
        api.specHelper.runAction('testAction', { }, function(response){
          response.error.should.containEql('required parameter for this action');
          done();
        });
      });
    } );
    
    it('correct params respect config options', function(done){
      api.config.general.missingParamChecks = [ undefined ]
      api.specHelper.runAction('testAction', {requiredParam: '' }, function(response){
        response.params.requiredParam.should.equal('');
        api.specHelper.runAction('testAction', {requiredParam: null }, function(response){
          should(response.params.requiredParam).eql(null);
          done();
        });
      });
    });

    it('will set a default when params are not provided', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true }, function(response){
        response.params.fancyParam.should.equal('abc123');
        done();
      });
    });

    it('will use validator if provided', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123 }, function(response){
        response.error.should.equal('Error: fancyParam should be "abc123"');
        done();
      });
    });

    it('will use formater if provided (and still use validator)', function(done){
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123 }, function(response){
        response.requesterInformation.receivedParams.fancyParam.should.equal('123');
        done();
      });
    });

  });

});
