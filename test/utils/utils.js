var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Utils', function(){

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

  it('utils.sqlDateTime default', function(done){
    api.utils.sqlDateTime().should.be.a.String;
    done();
  });

  it('utils.sqlDateTime specific time', function(done){
    var now = new Date(0);
    var nowUtc = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds()
    );
    api.utils.sqlDateTime(nowUtc).should.equal('1970-01-01 00:00:00');
    done();
  });

  it('utils.randomString', function(done){
    var randomString = api.utils.randomString(100);
    randomString.should.be.a.String;
    var i = 0;
    while(i < 1000){
      randomString.should.not.equal(api.utils.randomString(100));
      i++;
    }
    done();
  });

  it('utils.hashLength', function(done){
    var testHash = { a: 1, b: 2, c: {aa: 1, bb: 2}};
    api.utils.hashLength(testHash).should.equal(3)
    api.utils.hashLength({}).should.equal(0)
    done();
  });

  it('utils.sleepSync', function(done){
    var start = new Date();
    api.utils.sleepSync(0.1)
    var end = new Date();
    (end - start).should.be.within(100, 200);
    done();
  });

  it('utils.arrayUniqueify', function(done){
    var a = [1,2,3,3,4,4,4,5,5,5]
    api.utils.arrayUniqueify(a).should.eql([1,2,3,4,5]);
    done();
  });

  describe('utils.hashMerge', function(){
    var A = {a: 1, b: 2};
    var B = {b: -2, c: 3};
    var C = {a: 1, b: {m: 10, n:11}};
    var D = {a: 1, b: {n:111, o:22}};

    it('simple', function(done){
      var Z = api.utils.hashMerge(A, B);
      Z.a.should.equal(1);
      Z.b.should.equal(-2);
      Z.c.should.equal(3);
      done();
    });

    it('directional', function(done){
      var Z = api.utils.hashMerge(B, A);
      Z.a.should.equal(1);
      Z.b.should.equal(2);
      Z.c.should.equal(3);
      done();
    });

    it('nested', function(done){
      var Z = api.utils.hashMerge(C, D);
      Z.a.should.equal(1);
      Z.b.m.should.equal(10);
      Z.b.n.should.equal(111);
      Z.b.o.should.equal(22);
      done();
    });
  });

  it('utils.inArray', function(done){
    api.utils.inArray([1,2,3], 1).should.eql(true);
    api.utils.inArray([1,2,3], 4).should.eql(false);
    api.utils.inArray([1,2,3], null).should.eql(false);
    done();
  });

  it('utils.objClone', function(done){
    var a = {
      a: 1,
      b: 2,
      c: {
        first: 1,
        second: 2
      }
    }
    var b = api.utils.objClone(a);
    a.should.eql(b);
    delete a.a
    a.should.not.eql(b);
    done();
  });

  describe('#parseIPv6URI', function(){

    it('address and port', function(){
      var uri = '[2604:4480::5]:8080';
      var parts = api.utils.parseIPv6URI(uri);
      parts.host.should.equal('2604:4480::5');
      parts.port.should.equal(8080);
    });

    it('address without port', function(){
      var uri = '2604:4480::5';
      var parts = api.utils.parseIPv6URI(uri);
      parts.host.should.equal('2604:4480::5');
      parts.port.should.equal(80);
    });

    it('full uri', function(){
      var uri = 'http://[2604:4480::5]:8080/foo/bar';
      var parts = api.utils.parseIPv6URI(uri);
      parts.host.should.equal('2604:4480::5');
      parts.port.should.equal(8080);
    });
    
    it('failing address', function(){
      var uri = '[2604:4480:z:5]:80';
      try{
        var parts = api.utils.parseIPv6URI(uri);
        console.log(parts);
      }catch(e){
        e.message.should.equal('failed to parse address');
      }
    });

  });

});
