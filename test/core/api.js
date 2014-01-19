var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
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
    actionhero.stop(function(err){
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
      'callback',
      'action',
      'limit',
      'offset',
      'key', // from action
      'value' // from action
    ].forEach(function(item){
      api.params.postVariables.should.include(item);
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
      delete api.actions.actions['versionedAction'];
      delete api.actions.versions['versionedAction'];
      done();
    })

    it('will default actions to version 1', function(done){
      api.specHelper.runAction('randomNumber', function(response, connection){
        response.requesterInformation.receivedParams.apiVersion.should.equal(1)
        done();
      });
    });

    it('can specify an apiVersion', function(done){
      api.specHelper.runAction('versionedAction', {apiVersion: 1}, function(response, connection){
        response.requesterInformation.receivedParams.apiVersion.should.equal(1);
        api.specHelper.runAction('versionedAction', {apiVersion: 2}, function(response, connection){
          response.requesterInformation.receivedParams.apiVersion.should.equal(2);
          done();
        });
      });
    });

    it('will default clients to the latest version of the action', function(done){
      api.specHelper.runAction('versionedAction', function(response, connection){
        response.requesterInformation.receivedParams.apiVersion.should.equal(3)
        done();
      });
    });

    it('will fail on a missing action + version', function(done){
      api.specHelper.runAction('versionedAction', {apiVersion: 10}, function(response, connection){
        response.error.should.equal('Error: versionedAction is not a known action or that is not a valid apiVersion.');
        done();
      });
    });

    it('can return complex error responses', function(done){
      api.specHelper.runAction('versionedAction', {apiVersion: 3}, function(response, connection){
        response.error.a.complex.should.equal('error');
        done();
      });
    });
  })

});
