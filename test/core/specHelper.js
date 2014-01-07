var should = require('should');
var actionHeroPrototype = require(__dirname + "/../../actionHero.js").actionHeroPrototype;
var actionHero = new actionHeroPrototype();
var api;

describe('Core: specHelper', function(){

  before(function(done){
    actionHero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionHero.stop(function(err){
      done();
    });
  });

  it('can make a requset with just params', function(done){
    api.specHelper.runAction('randomNumber', function(response, connection){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.be.within(0,1);
      done();
    });
  });

  it('will return metadata like the web server', function(done){
    api.specHelper.runAction('x', {thing: 'stuff'}, function(response, connection){
      response.error.should.equal('Error: x is not a known action or that is not a valid apiVersion.');
      response.messageCount.should.equal(1);
      response.serverInformation.serverName.should.equal('actionHero API');
      response.requesterInformation.remoteIP.should.equal('testServer');
      done();
    });
  });

  it('will stack up messages recieved', function(done){
    api.specHelper.runAction('x', {thing: 'stuff'}, function(response, connection){
      connection.messages.length.should.equal(2);
      connection.messages[0].welcome.should.equal('Hello! Welcome to the actionHero api');
      connection.messages[1].error.should.equal('Error: x is not a known action or that is not a valid apiVersion.');
      done();
    });
  });

  describe('persistent test connections', function(){

    var conn;
    var connId;

    it('can make a requset with a spec\'d connection', function(done){
      conn = new api.specHelper.connection();
      conn.params = {
        key: 'someKey',
        value: 'someValue',
      }
      connId = conn.id;
      api.specHelper.runAction('cacheTest', conn, function(response, connection){
        response.messageCount.should.equal(1);
        connection.messages.length.should.equal(2);
        connId.should.equal(connection.id);
        done();
      });
    });

    it('can make second request', function(done){
      api.specHelper.runAction('randomNumber', conn, function(response, connection){
        response.messageCount.should.equal(2);
        connection.messages.length.should.equal(3);
        connId.should.equal(connection.id);
        done();
      });
    });
  });

});
