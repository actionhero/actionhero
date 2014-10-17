var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: Static File', function(){

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

  it('file: an HTML file', function(done){
    api.specHelper.getStaticFile('simple.html', function(response){
      response.mime.should.equal('text/html');
      response.content.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
      done();
    });
  });

  it('file: 404 pages', function(done){
    api.specHelper.getStaticFile('someRandomFile', function(response){
      response.error.should.equal( api.config.errors.fileNotFound() );
      should.not.exist(response.content);
      done();
    });
  });

  it('I should not see files outside of the public dir', function(done){
    api.specHelper.getStaticFile('../config/config.json', function(response){
      response.error.should.equal( api.config.errors.fileNotFound() );
      should.not.exist(response.content);
      done();
    });
  });

  it('file: sub paths should work', function(done){
    api.specHelper.getStaticFile('logo/actionhero.png', function(response){
      response.mime.should.equal('image/png');
      response.length.should.equal(142141);
      response.content.length.should.be.within(136836, 136920); // wacky per-OS encoding issues I guess
      done();
    });
  });

});