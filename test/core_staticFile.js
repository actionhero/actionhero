describe('Core: Static File', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var defaultPath = '/public/default/';
  var should = require('should');

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){
      apiObj = specHelper.cleanAPIObject(api);
      //TODO: Why does travis-ci require the connection to be seeded like this?
      // It works locally on OSX and Ubuntu
      specHelper.apiTest.get(defaultPath + 'simple.html', 0, {}, function(response, json){});
      done();
    })
  });

  it('file: response is NOT json', function(done){
    specHelper.apiTest.get(defaultPath + 'someRandomFile', 0, {}, function(response, json){
      should.not.exist(json);
      done();
    });
  });

  it('file: 404 pages', function(done){
    specHelper.apiTest.get(defaultPath + 'someRandomFile', 0, {}, function(response, json){
      response.statusCode.should.equal(404)
      done();
    });
  });

  it('file: an HTML file', function(done){
    specHelper.apiTest.get(defaultPath + 'simple.html', 0, {}, function(response, json){
      response.statusCode.should.equal(200);
      response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
      done();
    });
  });

  it('file: ?filename should work like a path', function(done){
    specHelper.apiTest.get(defaultPath + '?file=simple.html', 0, {}, function(response, json){
      response.statusCode.should.equal(200);
      response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
      done();
    });
  });

  it('I should not see files outside of the public dir', function(done){
    specHelper.apiTest.get(defaultPath + '?file=../config.json', 0, {}, function(response, json){
      response.statusCode.should.equal(404);
      response.body.should.equal(apiObj.config.general.flatFileNotFoundMessage);
      done();
    });
  });

  it('file: index page should be served when requesting a path', function(done){
    specHelper.apiTest.get(defaultPath, 0, {}, function(response, json){
      response.statusCode.should.equal(200);
      response.body.should.be.a.String;
      done();
    });
  });

  it('file: sub paths should work', function(done){
    specHelper.apiTest.get(defaultPath + 'logo/actionHero.png', 0, {}, function(response, json){
      response.statusCode.should.equal(200);
      done();
    });
  });

  it('file: binary files should also work', function(done){
    specHelper.apiTest.get(defaultPath + 'logo/actionHero.png', 0, {}, function(response, json){
      response.statusCode.should.equal(200);
      response.body.length.should.be.within(136836, 136920);
      done();
    });
  });

});